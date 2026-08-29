/**
 * ============================================================================
 * SCHEDULED ROOM TRANSFER — EFFECTIVE-DATE EXECUTOR
 * ============================================================================
 *
 * Executes a ScheduledRoomTransfer on its effective Manila business date.
 *
 * PRINCIPLE: a scheduled transfer executes ONLY when the system can prove it
 * is financially and operationally safe. Otherwise the tenant stays in the
 * source room and the record moves to `action_required` with ONE clear
 * machine reason — never a partial cutover, never an automatic retry.
 *
 * ONE TRANSFER ENGINE: the actual cutover is `transferStayWorkflow`. This
 * module is pure orchestration around it — re-fetch, operational validation,
 * the payment gate, live financial revalidation, then delegate. The
 * pre-created (and possibly already-paid) Scheduled Transfer Balance Bill is
 * RE-USED by the workflow (payload.scheduledTransferBillId) so there is only
 * ever ONE settlement Bill for the transfer.
 *
 * Job 20 (scheduler.js) calls `executeDueScheduledRoomTransfers` for
 * `status: "scheduled"` records only. `action_required` records are NEVER
 * auto-retried — an admin resolves the blocker and calls
 * `retryScheduledRoomTransfer`.
 * ============================================================================
 */

import mongoose from "mongoose";
import logger from "../middleware/logger.js";
import {
  ScheduledRoomTransfer,
  Reservation,
  Room,
  Stay,
  Contract,
  Bill,
} from "../models/index.js";
import { toManilaStartOfDay, getManilaToday } from "../utils/dateUtils.js";
import { sumBillCharges, syncBillAmounts } from "./billing/billingPolicy.js";
import { notify, notifyBranchAdmins } from "./notifications/notificationService.js";
import { resolveRoomTransferSuccessor } from "./contractRoomTransferActivationService.js";

// Heavy modules (tenantActionService + the scheduled-transfer service/view)
// are imported lazily inside the functions below to avoid an ESM
// circular-init hazard: scheduler.js -> this module -> tenantActionService ->
// billingPolicy, while scheduler.js's own test harness is still linking
// billingPolicy. Job 19 uses the same lazy-import pattern.
const lazy = {
  async tenantActions() {
    return import("../utils/tenantActionService.js");
  },
  async schedSvc() {
    return import("./scheduledRoomTransferService.js");
  },
  async schedView() {
    return import("./scheduledRoomTransferView.js");
  },
};

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

// A stable pseudo-actor id for scheduler-driven mutations (Contract
// updatedBy/createdBy, ledger createdBy). Not a real User — audit trails
// record "System (Scheduled Transfer)".
const SYSTEM_ACTOR_ID = new mongoose.Types.ObjectId("000000000000000000000020");

// Machine reasons stored on lastError (also the user-facing distinction).
export const SCHEDULED_TRANSFER_ACTION_REASONS = Object.freeze({
  TRANSFER_BALANCE_UNPAID: "TRANSFER_BALANCE_UNPAID",
  ADDITIONAL_BALANCE_DUE: "ADDITIONAL_BALANCE_DUE",
  FINANCIAL_ADJUSTMENT_REQUIRED: "FINANCIAL_ADJUSTMENT_REQUIRED",
  OPERATIONAL_VALIDATION_FAILED: "OPERATIONAL_VALIDATION_FAILED",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  // Set by cancellation / tenant-departure when the balance Bill already
  // carries a real payment — nothing financial is reversed automatically.
  PAYMENT_ALREADY_RECEIVED: "PAYMENT_ALREADY_RECEIVED",
});

/**
 * Is `effectiveTransferDate` due as of `now` (Manila business date)?
 * Due when the Manila calendar date of `effectiveTransferDate` is today or
 * earlier — i.e. `< toManilaStartOfDay(now).add(1, "day")`, the same cutoff
 * convention `activateDueRenewalContracts` uses.
 */
export function isScheduledTransferDue(effectiveTransferDate, now = new Date()) {
  const eff = toManilaStartOfDay(effectiveTransferDate);
  if (!eff) return false;
  return eff.isBefore(getManilaToday(now).add(1, "day"), "day") || eff.isSame(getManilaToday(now), "day");
}

async function moveToActionRequired(scheduledTransferId, reason, { notifyTenant = false } = {}) {
  const doc = await ScheduledRoomTransfer.findByIdAndUpdate(
    scheduledTransferId,
    { $set: { status: "action_required", lastError: reason, lastAttemptAt: new Date() } },
    { new: true },
  );
  if (!doc) return null;
  try {
    await notifyBranchAdmins(
      doc.branch,
      "general",
      "Scheduled Room Transfer — Action Required",
      buildAdminMessage(doc, reason),
      {
        entityType: "reservation",
        entityId: String(doc.reservationId),
        actionUrl: "/admin/tenants",
        dedupeKey: `scheduled_transfer_action_required:${String(doc._id)}:${reason}`,
      },
    );
  } catch (e) {
    logger.warn({ err: e, scheduledTransferId: String(doc._id) }, "[scheduledTransferExecutor] admin notify failed (non-fatal)");
  }
  if (notifyTenant && doc.tenantId) {
    try {
      await notify.general(
        doc.tenantId,
        "Scheduled Room Transfer",
        userFacingMessage(reason),
        { entityType: "reservation", entityId: String(doc.reservationId) },
      );
    } catch { /* non-fatal */ }
  }
  return doc;
}

function buildAdminMessage(doc, reason) {
  const when = doc.effectiveTransferDate
    ? toManilaStartOfDay(doc.effectiveTransferDate).format("MMMM D, YYYY")
    : "its effective date";
  switch (reason) {
    case SCHEDULED_TRANSFER_ACTION_REASONS.TRANSFER_BALANCE_UNPAID:
      return `A scheduled room transfer due ${when} could not be completed because the required transfer balance is not fully settled. The tenant remains in the source room. Settle the balance, then retry.`;
    case SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE:
      return `A scheduled room transfer due ${when} needs an additional balance: the settlement recomputed at execution is higher than the amount already billed. The extra amount has been added to the transfer balance Bill. The tenant remains in the source room until it is settled, then retry.`;
    case SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED:
      return `A scheduled room transfer due ${when} needs a financial adjustment: the final transfer amount is lower than what the tenant already paid. No automatic refund is made. Please coordinate with the Administration Office, 2nd Floor for settlement, then retry.`;
    case SCHEDULED_TRANSFER_ACTION_REASONS.OPERATIONAL_VALIDATION_FAILED:
      return `A scheduled room transfer due ${when} could not be validated (room/bed/lease/renewal state changed). The tenant remains in the source room. Review and retry or cancel.`;
    default:
      return `A scheduled room transfer due ${when} failed to execute and needs review. The tenant remains in the source room.`;
  }
}

function userFacingMessage(reason) {
  switch (reason) {
    case SCHEDULED_TRANSFER_ACTION_REASONS.TRANSFER_BALANCE_UNPAID:
      return "Your scheduled room transfer could not be completed because the required transfer balance is not fully settled. Please settle the outstanding balance or coordinate with the Administration Office.";
    case SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE:
      return "Your scheduled room transfer needs an additional balance settled before it can take effect. Please check your Billing.";
    case SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED:
      return "The final transfer amount changed after payment. Please coordinate with the Administration Office, 2nd Floor for settlement.";
    default:
      return "Your scheduled room transfer could not be completed automatically. Please coordinate with the Administration Office.";
  }
}

/**
 * Execute (or re-attempt) ONE ScheduledRoomTransfer.
 *
 * @param {string|ObjectId} scheduledTransferId
 * @param {Object} [opts]
 * @param {"scheduled"|"retry"} [opts.trigger] — "retry" allows an
 *   `action_required` record; the cron only passes "scheduled".
 * @returns {{ outcome: "executed"|"action_required"|"skipped", reason?: string }}
 */
export async function executeScheduledRoomTransfer(scheduledTransferId, { trigger = "scheduled", actorId = null, now = new Date() } = {}) {
  const effectiveActorId = actorId || SYSTEM_ACTOR_ID;
  // 1. Re-fetch fresh — never trust scheduling-time objects.
  const sched = await ScheduledRoomTransfer.findById(scheduledTransferId);
  if (!sched) return { outcome: "skipped", reason: "not_found" };
  if (sched.status === "executed") return { outcome: "skipped", reason: "already_executed" };
  if (sched.status === "cancelled") return { outcome: "skipped", reason: "cancelled" };
  if (trigger === "scheduled" && sched.status !== "scheduled") {
    // action_required is admin-resolve only.
    return { outcome: "skipped", reason: `status_${sched.status}` };
  }
  if (trigger === "retry" && !["scheduled", "action_required"].includes(sched.status)) {
    return { outcome: "skipped", reason: `status_${sched.status}` };
  }
  // The Manila effective date must have arrived. (Job 20 pre-filters, but a
  // direct/retry call must be gated too.)
  if (!isScheduledTransferDue(sched.effectiveTransferDate, now)) {
    return { outcome: "skipped", reason: "not_yet_due" };
  }

  const reservation = await Reservation.findById(sched.reservationId)
    .populate("roomId", "name roomNumber branch beds currentOccupancy capacity type")
    .populate("userId", "firstName lastName email tenantStatus");
  if (!reservation) {
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.OPERATIONAL_VALIDATION_FAILED);
    return { outcome: "action_required", reason: "reservation_missing" };
  }

  // 2. Operational validation — prove it is still safe to cut over.
  const opFail = await validateOperational({ sched, reservation });
  if (opFail) {
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.OPERATIONAL_VALIDATION_FAILED, { notifyTenant: false });
    logger.warn({ scheduledTransferId: String(sched._id), opFail }, "[scheduledTransferExecutor] operational validation failed");
    return { outcome: "action_required", reason: opFail };
  }

  // 3. Payment gate — the linked balance Bill must be fully settled (or none).
  const { resolveScheduledTransferBalance } = await lazy.schedView();
  const balance = await resolveScheduledTransferBalance(sched.toObject());
  if (balance.hasBill && balance.paymentState !== "paid") {
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.TRANSFER_BALANCE_UNPAID, { notifyTenant: true });
    return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.TRANSFER_BALANCE_UNPAID };
  }

  // 4. Live financial revalidation against the effective date + current state.
  // The pre-paid Scheduled Transfer Balance Bill may have ALREADY funded
  // reservation.securityDepositHeld (paymentLedger.reconcileTransferDepositHeld,
  // Phase 2F). Recompute the additional-deposit-due against the held amount as
  // it stood BEFORE that funding, so a paid deposit component is not mistaken
  // for "the destination requirement dropped".
  let depositHeldOverride = null;
  if (balance.hasBill) {
    const ledgerEntry = (reservation.securityDepositLedger || []).find(
      (e) => e.idempotencyKey === `room_transfer_deposit_settlement:${String(balance.billId)}`,
    );
    if (ledgerEntry && Number.isFinite(Number(ledgerEntry.previousHeld))) {
      depositHeldOverride = round(Number(ledgerEntry.previousHeld));
    }
  }

  const { computeRoomTransferPreview } = await lazy.tenantActions();
  const preview = await computeRoomTransferPreview({
    reservationId: reservation._id,
    targetRoomId: String(sched.destinationRoomId),
    effectiveTransferDate: sched.effectiveTransferDate,
    depositHeldOverride,
  }).catch((e) => {
    logger.warn({ err: e, scheduledTransferId: String(sched._id) }, "[scheduledTransferExecutor] preview recompute failed");
    return null;
  });
  if (!preview) {
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.OPERATIONAL_VALIDATION_FAILED);
    return { outcome: "action_required", reason: "preview_unavailable" };
  }

  const liveRent = round(Math.max(0, Number(preview.rent?.adjustmentDue) || 0));
  const liveDeposit = round(Math.max(0, Number(preview.deposit?.balanceDue) || 0));
  const liveTotal = round(liveRent + liveDeposit);

  const billRent = balance.hasBill ? round(Number((await Bill.findById(balance.billId).lean())?.charges?.rent || 0)) : 0;
  const billDeposit = balance.hasBill ? round(Number((await Bill.findById(balance.billId).lean())?.charges?.securityDeposit || 0)) : 0;
  const billedTotal = round(billRent + billDeposit);

  const delta = round(liveTotal - billedTotal);

  if (Math.abs(delta) <= 0.01) {
    // 4a. Unchanged — proceed to cutover.
  } else if (delta > 0.01) {
    // 4b. Higher — reconcile the extra onto the canonical Bill, do NOT execute.
    await raiseAdditionalBalance({ sched, balance, liveRent, liveDeposit, preview });
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE, { notifyTenant: true });
    return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE };
  } else {
    // 4c. Lower.
    if (balance.hasBill && balance.amountPaid > 0) {
      // Money already collected — no automatic refund/reallocation.
      await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED, { notifyTenant: true });
      return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED };
    }
    // Nothing paid and the (recomputed) amount is > 0 but there was no Bill /
    // a zero-balance schedule: create the Bill and require settlement first.
    if (!balance.hasBill && liveTotal > 0) {
      await createBalanceBillForZeroSchedule({ sched, reservation, liveRent, liveDeposit, preview });
      await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE, { notifyTenant: true });
      return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.ADDITIONAL_BALANCE_DUE };
    }
    // Lower and unpaid on an existing Bill -> the payment gate already caught
    // it above (paymentState !== "paid"); fall through defensively.
    await moveToActionRequired(sched._id, SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED, { notifyTenant: true });
    return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.FINANCIAL_ADJUSTMENT_REQUIRED };
  }

  // Zero-balance schedule that STILL owes nothing at execution: create a
  // paid-status Bill so there is one canonical settlement record, and let the
  // workflow reuse it.
  let reusableBillId = balance.billId;
  if (!balance.hasBill && liveTotal <= 0) {
    reusableBillId = await createZeroSettlementBill({ sched, reservation, preview });
  }

  // 5. Cutover — the ONE canonical engine. Reuses the linked Bill.
  const payload = {
    confirm: true,
    forceOverride: true, // the payment gate already ran; the settlement Bill is the balance
    targetRoomId: String(sched.destinationRoomId),
    targetBedId: sched.destinationNeedsBed ? sched.destinationBedId : undefined,
    effectiveTransferDate: sched.effectiveTransferDate,
    reason: sched.reason || "Scheduled room transfer",
    sourceRoomMeterReading: sched.sourceRoomMeterReading ?? undefined,
    targetRoomMeterReading: sched.targetRoomMeterReading ?? undefined,
    scheduledTransferBillId: reusableBillId ? String(reusableBillId) : undefined,
    depositHeldOverride: depositHeldOverride != null ? depositHeldOverride : undefined,
    __scheduledTransferId: String(sched._id),
  };

  let result;
  try {
    // Release the destination hold and run the cutover in ONE boundary: the
    // workflow's own transaction re-takes the slot/bed atomically. We release
    // the hold in its own tiny transaction IMMEDIATELY before, so there is no
    // double currentOccupancy increment, and if the workflow then fails we
    // restore the hold in the failure branch.
    await releaseHoldInOwnTxn(sched);
    const { transferStayWorkflow } = await lazy.tenantActions();
    result = await transferStayWorkflow({ reservationId: String(reservation._id), payload, actorId: effectiveActorId });
  } catch (err) {
    logger.error({ err, scheduledTransferId: String(sched._id) }, "[scheduledTransferExecutor] cutover failed");
    // The workflow's transaction already rolled back every physical mutation.
    // Restore the destination hold so the admin's fix has a slot to land in.
    await restoreHoldInOwnTxn(sched).catch((e) =>
      logger.error({ err: e, scheduledTransferId: String(sched._id) }, "[scheduledTransferExecutor] hold restore failed"),
    );
    await ScheduledRoomTransfer.findByIdAndUpdate(sched._id, {
      $set: {
        status: "action_required",
        lastError: `${SCHEDULED_TRANSFER_ACTION_REASONS.EXECUTION_FAILED}: ${err?.code || err?.message || "unknown"}`,
        lastAttemptAt: new Date(),
        holdApplied: true,
      },
    });
    try {
      await notifyBranchAdmins(
        sched.branch, "general",
        "Scheduled Room Transfer — Execution Failed",
        buildAdminMessage(sched, SCHEDULED_TRANSFER_ACTION_REASONS.EXECUTION_FAILED),
        { entityType: "reservation", entityId: String(sched.reservationId), actionUrl: "/admin/tenants",
          dedupeKey: `scheduled_transfer_exec_failed:${String(sched._id)}` },
      );
    } catch { /* non-fatal */ }
    return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.EXECUTION_FAILED, execError: `${err?.code || ""} ${err?.message || ""}`.trim() };
  }

  // 6. Success — record executedSettlement + flip to executed.
  const settlementBillId = result?.billingSnapshot?.transferBillId || reusableBillId || null;
  const executedSettlement = {
    rentAdjustmentDue: round(result?.billingSnapshot?.rentComponentDue ?? liveRent),
    additionalDepositDue: round(result?.billingSnapshot?.depositComponentDue ?? liveDeposit),
    excessRentCredit: round(result?.billingSnapshot?.excessRentCredit ?? 0),
    excessDepositHeld: round(result?.billingSnapshot?.excessDepositHeld ?? 0),
    totalImmediateDue: round(result?.billingSnapshot?.totalImmediateDue ?? liveTotal),
    settlementBillId: settlementBillId ? String(settlementBillId) : null,
    previewTotalAtScheduling: round(
      Math.max(0, Number(sched.previewSnapshot?.rent?.adjustmentDue) || 0) +
      Math.max(0, Number(sched.previewSnapshot?.deposit?.balanceDue) || 0),
    ),
    billedTotalBeforeExecution: billedTotal,
    computedAt: new Date(),
  };

  await ScheduledRoomTransfer.findByIdAndUpdate(sched._id, {
    $set: {
      status: "executed",
      executedAt: new Date(),
      executedSettlement,
      settlementBillId: settlementBillId || sched.settlementBillId || null,
      holdApplied: false,
      lastError: null,
      lastAttemptAt: new Date(),
    },
  });

  try {
    await notify.general(
      sched.tenantId,
      "Room Transfer Completed",
      `Your scheduled room transfer to ${result?.toRoomName || "your new room"} is now in effect.`,
      { entityType: "stay", entityId: String(sched.reservationId) },
    );
  } catch { /* non-fatal */ }

  logger.info(
    { scheduledTransferId: String(sched._id), reservationId: String(sched.reservationId), settlementBillId: String(settlementBillId || "") },
    "[scheduledTransferExecutor] executed",
  );
  return { outcome: "executed" };
}

// ── Operational validation ─────────────────────────────────────────────────
async function validateOperational({ sched, reservation }) {
  if (!["moveIn"].includes(String(reservation.status))) return "reservation_not_active";
  if (String(reservation.roomId?._id || reservation.roomId) !== String(sched.sourceRoomId)) {
    return "reservation_room_changed";
  }
  const activeStay = await Stay.findOne({
    reservationId: reservation._id,
    status: { $in: ["active", "ending_soon"] },
  }).sort({ leaseStartDate: -1 });
  if (!activeStay) return "no_active_stay";
  if (String(activeStay.roomId) !== String(sched.sourceRoomId)) return "stay_room_changed";

  // Pending renewal chain — same guard the immediate/schedule paths use.
  const reservationStayIds = (await Stay.find({ reservationId: reservation._id }).select("_id").lean()).map((s) => s._id);
  const pendingRenewal = await Stay.exists({ reservationId: reservation._id, previousStayId: { $in: reservationStayIds } });
  if (pendingRenewal) return "pending_renewal_exists";

  // Destination room + bed still valid.
  const destRoom = await Room.findById(sched.destinationRoomId).lean();
  if (!destRoom) return "destination_room_missing";
  if (String(destRoom.branch) !== String(reservation.roomId?.branch || "")) return "destination_cross_branch";
  if (sched.destinationNeedsBed) {
    const bed = (destRoom.beds || []).find((b) => String(b.id) === String(sched.destinationBedId));
    if (!bed) return "destination_bed_missing";
    // The hold keeps it "reserved" for THIS tenant; anything else is a conflict.
    if (bed.status !== "reserved" || String(bed.occupiedBy?.reservationId || "") !== String(reservation._id)) {
      return "destination_hold_lost";
    }
  }

  // Addendum still prepared, not current, matching destination.
  const predecessor = await Contract.findOne({
    reservationId: reservation._id,
    isCurrent: true,
  });
  if (!predecessor) return "no_current_contract";
  const successor = await resolveRoomTransferSuccessor({ predecessorContractId: predecessor._id }).catch(() => null);
  if (!successor) return "addendum_missing";
  if (successor.isCurrent === true) return "already_executed";
  if (String(successor.roomId) !== String(sched.destinationRoomId)) return "addendum_room_mismatch";
  if (sched.addendumContractId && String(successor._id) !== String(sched.addendumContractId)) {
    return "addendum_changed";
  }

  // Cheap intent revalidation (branch/type/bed rules) — reuse the canonical validator.
  try {
    const { resolveValidatedRoomTransferIntent } = await lazy.tenantActions();
    await resolveValidatedRoomTransferIntent({
      reservationId: String(reservation._id),
      payload: {
        confirm: true,
        targetRoomId: String(sched.destinationRoomId),
        targetBedId: sched.destinationNeedsBed ? sched.destinationBedId : undefined,
        effectiveTransferDate: sched.effectiveTransferDate,
      },
      requireConfirm: true,
    });
  } catch (e) {
    return `intent_${e.code || "invalid"}`;
  }
  return null;
}

// ── Financial reconciliation helpers ──────────────────────────────────────
async function raiseAdditionalBalance({ sched, balance, liveRent, liveDeposit, preview }) {
  const bill = await Bill.findById(balance.billId);
  if (!bill) return;
  bill.charges.rent = liveRent;
  bill.charges.securityDeposit = liveDeposit;
  bill.charges.electricity = 0;
  bill.charges.water = 0;
  const total = sumBillCharges(bill.charges);
  bill.totalAmount = total;
  bill.grossAmount = total;
  bill.remainingAmount = round(Math.max(0, total - Number(bill.paidAmount || 0)));
  bill.notes =
    `${bill.notes || ""} | Reconciled at execution (${toManilaStartOfDay(sched.effectiveTransferDate).format("YYYY-MM-DD")}): ` +
    `rent ₱${liveRent.toFixed(2)}, deposit ₱${liveDeposit.toFixed(2)}.`;
  bill.transferSnapshot = {
    ...(bill.transferSnapshot || {}),
    reconciledAtExecution: true,
    scheduledRentAdjustment: liveRent,
    scheduledAdditionalDeposit: liveDeposit,
  };
  syncBillAmounts(bill, { preserveStatus: false });
  await bill.save();
  void preview;
}

async function createBalanceBillForZeroSchedule({ sched, reservation, liveRent, liveDeposit, preview }) {
  const eff = toManilaStartOfDay(sched.effectiveTransferDate).toDate();
  const charges = { rent: liveRent, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, securityDeposit: liveDeposit, discount: 0 };
  const total = sumBillCharges(charges);
  const [bill] = await Bill.create([{
    billType: "transfer_settlement",
    reservationId: reservation._id,
    userId: reservation.userId?._id || reservation.userId,
    branch: reservation.roomId?.branch || sched.branch,
    roomId: sched.sourceRoomId,
    billingMonth: eff,
    billingCycleStart: preview?.billingCycle?.billingCycleStart || eff,
    billingCycleEnd: preview?.billingCycle?.billingCycleEnd || eff,
    dueDate: eff,
    charges, totalAmount: total, grossAmount: total, remainingAmount: total, paidAmount: 0,
    status: "pending", publicationState: "published",
    notes: `Scheduled Room Transfer balance created at execution (state changed since scheduling).`,
    transferSnapshot: {
      fromRoomId: sched.sourceRoomId, toRoomId: sched.destinationRoomId,
      effectiveTransferDate: eff, isScheduledTransferBalance: true, createdAtExecution: true,
      scheduledRentAdjustment: liveRent, scheduledAdditionalDeposit: liveDeposit,
    },
  }]);
  await ScheduledRoomTransfer.findByIdAndUpdate(sched._id, { $set: { settlementBillId: bill._id } });
  return bill._id;
}

async function createZeroSettlementBill({ sched, reservation, preview }) {
  const eff = toManilaStartOfDay(sched.effectiveTransferDate).toDate();
  const charges = { rent: 0, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, securityDeposit: 0, discount: 0 };
  const [bill] = await Bill.create([{
    billType: "transfer_settlement",
    reservationId: reservation._id,
    userId: reservation.userId?._id || reservation.userId,
    branch: reservation.roomId?.branch || sched.branch,
    roomId: sched.sourceRoomId,
    billingMonth: eff,
    billingCycleStart: preview?.billingCycle?.billingCycleStart || eff,
    billingCycleEnd: preview?.billingCycle?.billingCycleEnd || eff,
    dueDate: eff,
    charges, totalAmount: 0, grossAmount: 0, remainingAmount: 0, paidAmount: 0,
    status: "paid", publicationState: "published",
    notes: `Scheduled Room Transfer settlement — no amount due.`,
    transferSnapshot: {
      fromRoomId: sched.sourceRoomId, toRoomId: sched.destinationRoomId,
      effectiveTransferDate: eff, isScheduledTransferBalance: true, zeroBalance: true,
    },
  }]);
  await ScheduledRoomTransfer.findByIdAndUpdate(sched._id, { $set: { settlementBillId: bill._id } });
  return bill._id;
}

// ── Hold release / restore in their own tiny transactions ─────────────────
async function releaseHoldInOwnTxn(sched) {
  if (!sched.holdApplied) return;
  const { releaseScheduledTransferHold } = await lazy.schedSvc();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await releaseScheduledTransferHold({
        session,
        destinationRoomId: sched.destinationRoomId,
        destinationBedId: sched.destinationBedId,
        destinationNeedsBed: sched.destinationNeedsBed,
        reservationId: sched.reservationId,
      });
      await ScheduledRoomTransfer.updateOne({ _id: sched._id }, { $set: { holdApplied: false } }, { session });
    });
  } finally {
    await session.endSession();
  }
}

async function restoreHoldInOwnTxn(sched) {
  const { applyScheduledTransferHold } = await lazy.schedSvc();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyScheduledTransferHold({
        session,
        destinationRoomId: sched.destinationRoomId,
        destinationBedId: sched.destinationNeedsBed ? sched.destinationBedId : null,
        destinationNeedsBed: sched.destinationNeedsBed,
        tenantUserId: sched.tenantId,
        reservationId: sched.reservationId,
      });
      await ScheduledRoomTransfer.updateOne({ _id: sched._id }, { $set: { holdApplied: true } }, { session });
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Job 20 entry point — process ALL due `scheduled` records. Never touches
 * `action_required` (admin-resolve only). Job-level retry (retryJobOperation
 * in scheduler.js) re-runs the whole scan on a transient PROCESS failure; the
 * per-record "no auto-retry" rule is enforced by only selecting
 * `status: "scheduled"`.
 */
export async function executeDueScheduledRoomTransfers({ now = new Date() } = {}) {
  const report = { scanned: 0, executed: 0, actionRequired: 0, skipped: 0, errors: 0, records: [] };
  const cutoff = getManilaToday(now).add(1, "day").toDate();

  const due = await ScheduledRoomTransfer.find({
    status: "scheduled",
    isArchived: { $ne: true },
    effectiveTransferDate: { $lt: cutoff },
  }).select("_id effectiveTransferDate").sort({ effectiveTransferDate: 1 }).lean();

  report.scanned = due.length;

  for (const { _id } of due) {
    try {
      const res = await executeScheduledRoomTransfer(_id, { trigger: "scheduled", now });
      if (res.outcome === "executed") report.executed += 1;
      else if (res.outcome === "action_required") report.actionRequired += 1;
      else report.skipped += 1;
      report.records.push({ scheduledTransferId: String(_id), ...res });
    } catch (e) {
      report.errors += 1;
      report.records.push({ scheduledTransferId: String(_id), outcome: "error", error: e.message });
      logger.error({ err: e, scheduledTransferId: String(_id) }, "[executeDueScheduledRoomTransfers] record failed");
    }
  }

  if (report.executed || report.actionRequired || report.errors) {
    logger.info(report, "[executeDueScheduledRoomTransfers] pass complete");
  }
  return report;
}

/**
 * Admin retry for a single `action_required` (or still-scheduled) record.
 * Re-runs EVERY gate: operational validation, payment gate, live financial
 * revalidation. Never bypasses any of them; never duplicates artifacts.
 */
export async function retryScheduledRoomTransfer(scheduledTransferId, { actorId = null, now = new Date() } = {}) {
  return executeScheduledRoomTransfer(scheduledTransferId, { trigger: "retry", actorId, now });
}

// ── CANCELLATION ─────────────────────────────────────────────────────────────

export const SCHEDULED_TRANSFER_CANCEL_REASONS = Object.freeze({
  PAYMENT_ALREADY_RECEIVED: "PAYMENT_ALREADY_RECEIVED",
  TRANSFER_ALREADY_COMPLETED: "TRANSFER_ALREADY_COMPLETED",
  NOT_CANCELLABLE: "NOT_CANCELLABLE",
});

/**
 * Resolve how much real money has been received against a scheduled
 * transfer's balance Bill (0 when there is no Bill).
 */
async function paidAmountOnBalanceBill(sched) {
  if (!sched.settlementBillId) return 0;
  const bill = await Bill.findById(sched.settlementBillId).select("paidAmount status").lean();
  if (!bill || bill.status === "voided") return 0;
  return round(Number(bill.paidAmount || 0));
}

/**
 * Void the UNPAID balance Bill using the canonical Bill lifecycle status
 * (`voided`, remainingAmount 0). NEVER deletes the Bill. No-op when there is
 * no Bill or it already carries a payment (caller must have gated on that).
 */
async function voidUnpaidBalanceBill(sched, { session } = {}) {
  if (!sched.settlementBillId) return { voided: false };
  const q = Bill.findById(sched.settlementBillId);
  const bill = await (session ? q.session(session) : q);
  if (!bill) return { voided: false };
  if (bill.status === "voided") return { voided: true, already: true };
  if (Number(bill.paidAmount || 0) > 0) return { voided: false, hasPayment: true };
  bill.status = "voided";
  bill.remainingAmount = 0;
  bill.notes = `${bill.notes || ""} | Voided — scheduled room transfer cancelled before cutover.`;
  if (session) await bill.save({ session });
  else await bill.save();
  return { voided: true };
}

/**
 * Cancel the prepared Room Transfer Addendum (generated / not-yet-current
 * Draft -> "cancelled" via transitionContract — the same abandoned state
 * `discardRoomTransferAddendum` uses). Never deletes the document/history;
 * it just can never become current. Idempotent.
 */
async function cancelPreparedAddendum(sched, actorId) {
  if (!sched.addendumContractId) return { cancelled: false };
  const c = await Contract.findById(sched.addendumContractId);
  if (!c) return { cancelled: false };
  if (c.isCurrent === true) return { cancelled: false, isCurrent: true };
  const ABANDONED = new Set(["cancelled", "voided", "rejected", "archived"]);
  if (ABANDONED.has(c.status)) return { cancelled: true, already: true };
  const { transitionContract } = await import("./contractService.js");
  try {
    await transitionContract(c, "cancelled", actorId, "Room Transfer Addendum cancelled — scheduled transfer cancelled before cutover");
  } catch (e) {
    logger.warn({ err: e, contractId: String(c._id) }, "[scheduledTransferExecutor] addendum cancel transition failed (non-fatal)");
    return { cancelled: false, error: e.message };
  }
  return { cancelled: true };
}

/**
 * Safe automatic cancellation of a NOT-yet-executed scheduled transfer.
 *
 * CANONICAL RULE: automatic cancellation is allowed ONLY when
 * `paidAmount === 0` on the balance Bill (or there is no Bill). If ANY real
 * money was received, nothing financial is reversed — the record goes to
 * `action_required` PAYMENT_ALREADY_RECEIVED and an admin coordinates the
 * settlement with the Administration Office.
 *
 * Safe path (no money): release the destination hold (idempotent, once),
 * cancel the prepared Addendum, void the unpaid Bill (canonical `voided`
 * status, never deleted), status -> `cancelled` + cancelledBy/At.
 * Everything about the source tenancy is untouched.
 *
 * @param {string|ObjectId} scheduledTransferId
 * @param {Object} [opts]
 * @param {ObjectId|null} [opts.actorId]
 * @param {boolean} [opts.system] — a lifecycle-driven call (tenant departure)
 *   rather than an explicit admin click; only affects notification wording.
 * @returns {{ outcome: "cancelled"|"action_required"|"skipped", reason?: string }}
 */
export async function cancelScheduledRoomTransfer(scheduledTransferId, { actorId = null, system = false } = {}) {
  const sched = await ScheduledRoomTransfer.findById(scheduledTransferId);
  if (!sched) return { outcome: "skipped", reason: "not_found" };

  if (sched.status === "executed") {
    return { outcome: "skipped", reason: SCHEDULED_TRANSFER_CANCEL_REASONS.TRANSFER_ALREADY_COMPLETED };
  }
  if (sched.status === "cancelled") {
    return { outcome: "skipped", reason: "already_cancelled" };
  }
  // Defence-in-depth: if the Addendum has somehow already become current, the
  // transfer effectively occurred — do not "cancel" it here.
  if (sched.addendumContractId) {
    const addendumIsCurrent = await Contract.exists({ _id: sched.addendumContractId, isCurrent: true });
    if (addendumIsCurrent) {
      return { outcome: "skipped", reason: SCHEDULED_TRANSFER_CANCEL_REASONS.TRANSFER_ALREADY_COMPLETED };
    }
  }

  const paid = await paidAmountOnBalanceBill(sched);

  // ── ANY money received -> manual settlement, NO financial reversal ──────────
  if (paid > 0) {
    const doc = await ScheduledRoomTransfer.findOneAndUpdate(
      { _id: sched._id, status: { $ne: "cancelled" } },
      {
        $set: {
          status: "action_required",
          lastError: SCHEDULED_TRANSFER_ACTION_REASONS.PAYMENT_ALREADY_RECEIVED,
          lastAttemptAt: new Date(),
        },
      },
      { new: true },
    );
    try {
      await notifyBranchAdmins(
        (doc || sched).branch,
        "general",
        "Scheduled Room Transfer Requires Review",
        system
          ? "The tenant departed before a paid scheduled room transfer could occur. Please coordinate with the Administration Office, 2nd Floor for financial settlement. The destination hold has been released."
          : "This scheduled room transfer has an existing payment and cannot be cancelled automatically. Please coordinate with the Administration Office, 2nd Floor for settlement.",
        {
          entityType: "reservation",
          entityId: String(sched.reservationId),
          actionUrl: "/admin/tenants",
          dedupeKey: `scheduled_transfer_payment_review:${String(sched._id)}`,
        },
      );
    } catch { /* non-fatal */ }

    // Physical resource release and financial refund are SEPARATE concerns:
    // for a lifecycle-driven departure the future room must NOT stay blocked
    // forever, so release the hold even though the money stays put. For an
    // explicit admin cancel click we KEEP the hold (the admin may still push
    // the transfer through after settling).
    if (system && sched.holdApplied) {
      await releaseHoldInOwnTxn(sched).catch((e) =>
        logger.error({ err: e, scheduledTransferId: String(sched._id) }, "[cancelScheduledRoomTransfer] departure hold release failed"),
      );
    }
    return { outcome: "action_required", reason: SCHEDULED_TRANSFER_ACTION_REASONS.PAYMENT_ALREADY_RECEIVED };
  }

  // ── No money -> safe automatic cancellation ───────────────────────────────
  // Release the hold first (its own tiny txn, idempotent — releaseHoldInOwnTxn
  // no-ops when holdApplied is already false, and releaseScheduledTransferHold
  // only frees a bed still "reserved" for THIS reservation).
  await releaseHoldInOwnTxn(sched).catch((e) => {
    logger.error({ err: e, scheduledTransferId: String(sched._id) }, "[cancelScheduledRoomTransfer] hold release failed");
    throw e;
  });

  const addendumResult = await cancelPreparedAddendum(sched, actorId);
  const billResult = await voidUnpaidBalanceBill(sched);

  const doc = await ScheduledRoomTransfer.findOneAndUpdate(
    { _id: sched._id, status: { $ne: "cancelled" } },
    {
      $set: {
        status: "cancelled",
        cancelledBy: actorId || SYSTEM_ACTOR_ID,
        cancelledAt: new Date(),
        holdApplied: false,
        lastError: null,
        lastAttemptAt: new Date(),
      },
    },
    { new: true },
  );

  try {
    await notify.general(
      sched.tenantId,
      "Scheduled Room Transfer Cancelled",
      "Your scheduled room transfer has been cancelled. You remain in your current room.",
      { entityType: "reservation", entityId: String(sched.reservationId) },
    );
  } catch { /* non-fatal */ }

  logger.info(
    {
      scheduledTransferId: String(sched._id),
      reservationId: String(sched.reservationId),
      addendumCancelled: addendumResult.cancelled,
      billVoided: billResult.voided,
      system,
    },
    "[cancelScheduledRoomTransfer] cancelled (safe, no payment)",
  );
  void doc;
  return { outcome: "cancelled" };
}

/**
 * Called by the departure workflows (move-out / early termination /
 * abandonment) BEFORE the tenant permanently leaves the dorm. Resolves any
 * OPEN scheduled transfer so a future room hold is never left blocking a room
 * after the tenant is gone.
 *
 *   no payment  -> safe automatic cancellation (hold released, Addendum
 *                  cancelled, unpaid Bill voided, status cancelled)
 *   payment     -> hold RELEASED (physical resource freed) but Bill / Payment
 *                  / deposit ledger / Addendum history PRESERVED; status
 *                  action_required PAYMENT_ALREADY_RECEIVED; admin notified
 *
 * Never executes the transfer. Idempotent. Best-effort — a failure here is
 * logged and swallowed so it can never block the departure workflow itself.
 *
 * @returns {{ handled: boolean, outcome?: string, reason?: string }}
 */
export async function resolveScheduledTransferBeforeTenantDeparture(reservationId, { actorId = null } = {}) {
  try {
    const { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } = await import("../models/ScheduledRoomTransfer.js");
    const open = await ScheduledRoomTransfer.findOne({
      reservationId,
      status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
      isArchived: { $ne: true },
    }).sort({ createdAt: -1 });
    if (!open) return { handled: false };

    const res = await cancelScheduledRoomTransfer(open._id, { actorId, system: true });
    return { handled: true, outcome: res.outcome, reason: res.reason };
  } catch (e) {
    logger.error({ err: e, reservationId: String(reservationId) }, "[resolveScheduledTransferBeforeTenantDeparture] failed (non-fatal)");
    return { handled: false, error: e.message };
  }
}
