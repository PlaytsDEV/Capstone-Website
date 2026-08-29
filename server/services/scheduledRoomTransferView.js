/**
 * ============================================================================
 * SCHEDULED ROOM TRANSFER — SERIALIZATION
 * ============================================================================
 *
 * The single canonical shape returned to Admin + Tenant (web & mobile) for a
 * scheduled room transfer. Callers never build their own — so the
 * user-facing status vocabulary is defined in exactly one place.
 *
 * USER-FACING STATUS (derived — never a raw enum leak):
 *   "awaiting_payment" — scheduled, a transfer balance exists and is not fully
 *                        settled.
 *   "ready"            — scheduled, transfer balance fully settled OR zero
 *                        balance; waiting for the effective date.
 *   "completed"        — executed.
 *   "action_required"  — the system cannot safely execute automatically;
 *                        `actionRequiredReason` carries the sub-reason.
 *   "cancelled"        — cancelled pre-cutover.
 *
 * Phase 2C ships this with the balance always treated as settled (no Bill yet
 * — 2D adds Bill creation and wires the real payment lookup here).
 * ============================================================================
 */

import { Bill, Contract, User } from "../models/index.js";

export const SCHEDULED_TRANSFER_USER_STATUSES = Object.freeze([
  "awaiting_payment",
  "ready",
  "completed",
  "action_required",
  "cancelled",
]);

export const SCHEDULED_TRANSFER_STATUS_LABELS = Object.freeze({
  awaiting_payment: "Awaiting Payment",
  ready: "Ready",
  completed: "Completed",
  action_required: "Action Required",
  cancelled: "Cancelled",
});

// Short, friendly Admin-facing explanation for an `action_required` sub-reason
// (`lastError`). The raw code is never the primary UI — this is. Mirrors the
// vocabulary in scheduledRoomTransferExecutor's buildAdminMessage without
// importing the executor (avoids a service<->service cycle).
const ACTION_REQUIRED_MESSAGES = Object.freeze({
  TRANSFER_BALANCE_UNPAID:
    "The Scheduled Room Transfer Balance is not fully settled. The tenant remains in the current room. Settle the balance, then retry.",
  ADDITIONAL_BALANCE_DUE:
    "The settlement recomputed at the effective date is higher than what was billed. The extra amount was added to the transfer balance Bill. Settle it, then retry.",
  FINANCIAL_ADJUSTMENT_REQUIRED:
    "The final transfer amount is lower than what the tenant already paid. No automatic refund is made — please coordinate with the Administration Office, 2nd Floor.",
  PAYMENT_ALREADY_RECEIVED:
    "A payment was already received for this transfer. It cannot be cancelled automatically — please coordinate with the Administration Office, 2nd Floor.",
  OPERATIONAL_VALIDATION_FAILED:
    "The destination room or bed is no longer valid. Review the destination and retry after correcting it.",
  EXECUTION_FAILED:
    "The transfer could not be completed on the effective date. Review the destination room/bed and retry.",
});

export function describeScheduledTransferActionRequired(reason) {
  if (!reason) return null;
  const key = String(reason).split(":")[0].trim();
  return ACTION_REQUIRED_MESSAGES[key] || "This scheduled transfer needs review before it can complete.";
}

/**
 * Resolve a scheduledBy / cancelledBy ObjectId (or populated doc) into a safe
 * Admin-facing identity. Never returns email / phone / account internals.
 */
async function resolveActorIdentity(actor, { session = null } = {}) {
  if (!actor) return null;
  if (typeof actor === "object" && (actor.firstName || actor.lastName || actor.name)) {
    const name = actor.name || `${actor.firstName || ""} ${actor.lastName || ""}`.trim();
    return { id: actor._id ? String(actor._id) : null, name: name || "Staff", role: actor.role || null };
  }
  const q = User.findById(actor).select("firstName lastName role");
  const u = await (session ? q.session(session) : q).lean();
  if (!u) return null;
  const name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return { id: String(u._id), name: name || "Staff", role: u.role || null };
}

/**
 * Resolve the payment state of a scheduled transfer's balance Bill.
 * @returns {{ hasBill:boolean, billId:string|null, amountDue:number,
 *   amountPaid:number, remaining:number, paymentState:"none"|"unpaid"|"partial"|"paid" }}
 */
export async function resolveScheduledTransferBalance(scheduledTransfer, { session = null } = {}) {
  // The balance Bill is the transfer_settlement Bill linked from
  // settlementBillId (2D). Absent => nothing to pay.
  const billId = scheduledTransfer.settlementBillId || null;
  if (!billId) {
    return {
      hasBill: false,
      billId: null,
      amountDue: 0,
      amountPaid: 0,
      remaining: 0,
      paymentState: "none",
    };
  }
  const q = Bill.findById(billId);
  const bill = await (session ? q.session(session) : q).lean();
  if (!bill || bill.status === "voided") {
    return {
      hasBill: false,
      billId: String(billId),
      amountDue: 0,
      amountPaid: 0,
      remaining: 0,
      paymentState: "none",
    };
  }
  const amountDue = Number(bill.totalAmount || 0);
  const amountPaid = Number(bill.amountPaid ?? bill.paidAmount ?? 0);
  const remaining = Math.max(0, Math.round((amountDue - amountPaid) * 100) / 100);
  let paymentState = "unpaid";
  if (amountDue <= 0 || remaining <= 0) paymentState = "paid";
  else if (amountPaid > 0) paymentState = "partial";
  return {
    hasBill: true,
    billId: String(billId),
    amountDue,
    amountPaid,
    remaining,
    paymentState,
  };
}

/**
 * Derive the user-facing status from the record's internal status + balance.
 */
export function deriveScheduledTransferUserStatus(scheduledTransfer, balance) {
  switch (scheduledTransfer.status) {
    case "executed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "action_required":
      return "action_required";
    case "scheduled":
    default: {
      // Nothing owed (zero-balance transfer, or the balance Bill is fully
      // settled / absent) => Ready. Otherwise Awaiting Payment.
      if (!balance || balance.paymentState === "none" || balance.paymentState === "paid") {
        return "ready";
      }
      return "awaiting_payment";
    }
  }
}

/**
 * The canonical serialized shape. Safe for Admin, Tenant web and Tenant
 * mobile — no internal-only fields.
 */
export async function serializeScheduledRoomTransfer(scheduledTransfer, { session = null } = {}) {
  if (!scheduledTransfer) return null;
  const doc = typeof scheduledTransfer.toObject === "function"
    ? scheduledTransfer.toObject()
    : scheduledTransfer;

  const balance = await resolveScheduledTransferBalance(doc, { session });
  const userStatus = deriveScheduledTransferUserStatus(doc, balance);

  const preview = doc.previewSnapshot || null;
  const executed = doc.executedSettlement || null;
  const figures = executed || preview || null;

  // Executed settlement is a FLAT shape (rentAdjustmentDue, additionalDepositDue,
  // excessRentCredit, excessDepositHeld, totalImmediateDue); the preview is a
  // NESTED shape (rent.*, deposit.*). Read both without conflating them.
  const rentAdjustment = executed
    ? executed.rentAdjustmentDue ?? null
    : preview?.rent?.adjustmentDue ?? null;
  const additionalDeposit = executed
    ? executed.additionalDepositDue ?? null
    : preview?.deposit?.balanceDue ?? null;
  const rentCredit = executed
    ? executed.excessRentCredit ?? null
    : preview?.rent?.excessCredit ?? null;
  const excessDepositHeld = executed
    ? executed.excessDepositHeld ?? null
    : preview?.deposit?.excessHeld ?? null;
  const finalSettlementAmount = executed ? executed.totalImmediateDue ?? null : null;

  const initiatedBy = await resolveActorIdentity(doc.scheduledBy, { session });
  const cancelledByIdentity = await resolveActorIdentity(doc.cancelledBy, { session });

  // Addendum status — before execution it is a prepared, not-yet-current
  // Draft that becomes effective on `effectiveTransferDate`.
  let addendum = null;
  if (doc.addendumContractId) {
    const q = Contract.findById(doc.addendumContractId).select("status isCurrent contractNumber amendmentEffectiveDate");
    const c = await (session ? q.session(session) : q).lean();
    if (c) {
      addendum = {
        contractId: String(c._id),
        contractNumber: c.contractNumber || null,
        status: c.status,
        isCurrent: !!c.isCurrent,
        effectiveDate: c.amendmentEffectiveDate || doc.effectiveTransferDate,
        // User-facing: "Scheduled" until it actually becomes the current lease.
        label: c.isCurrent ? "Room Transfer Addendum" : "Room Transfer Addendum — Scheduled",
      };
    }
  }

  return {
    id: String(doc._id),
    reservationId: String(doc.reservationId),
    tenantId: doc.tenantId ? String(doc.tenantId) : null,
    branch: doc.branch,

    currentRoom: {
      id: doc.sourceRoomId ? String(doc.sourceRoomId) : null,
      name: preview?.fromRoom?.name || null,
      type: preview?.fromRoom?.type || null,
      bedId: doc.sourceBedId || null,
    },
    scheduledRoom: {
      id: doc.destinationRoomId ? String(doc.destinationRoomId) : null,
      name: preview?.toRoom?.name || null,
      type: preview?.toRoom?.type || null,
      bedId: doc.destinationBedId || null,
      needsBed: doc.destinationNeedsBed,
    },

    // Destination bed — only meaningful for a shared destination.
    destinationBed: doc.destinationNeedsBed ? (doc.destinationBedId || null) : null,

    effectiveTransferDate: doc.effectiveTransferDate,
    reason: doc.reason || null,
    status: userStatus,
    statusLabel: SCHEDULED_TRANSFER_STATUS_LABELS[userStatus] || userStatus,
    actionRequiredReason: doc.status === "action_required" ? (doc.lastError || null) : null,
    actionRequiredMessage:
      doc.status === "action_required" ? describeScheduledTransferActionRequired(doc.lastError) : null,

    // Rent / deposit figures — the executed settlement once it exists,
    // otherwise the scheduling-time preview. (rent.* rates only exist on the
    // preview; the executed settlement is a flat shape.)
    currentMonthlyRent: preview?.rent?.sourceEffectiveRate ?? null,
    newMonthlyRent: preview?.rent?.destinationApprovedRate ?? null,
    rentAdjustment,
    additionalSecurityDeposit: additionalDeposit,
    // The canonical settled total, present only once the transfer has executed.
    finalSettlementAmount,
    // Informational-until-execution figures for a cheaper destination.
    estimatedRentCreditAfterTransfer: rentCredit,
    estimatedExcessDepositHeld: excessDepositHeld,

    // Safe Admin-facing identities.
    initiatedBy,
    cancelledBy: cancelledByIdentity,

    transferBalance: {
      hasBill: balance.hasBill,
      billId: balance.billId,
      amountDue: balance.amountDue,
      amountPaid: balance.amountPaid,
      remaining: balance.remaining,
      paymentState: balance.paymentState, // none | unpaid | partial | paid
      dueDate: doc.effectiveTransferDate,
    },

    utilitiesNote:
      "Electricity and water follow the normal utility billing after the room-transfer cutoff.",

    settlementBillId: balance.billId || (doc.settlementBillId ? String(doc.settlementBillId) : null),
    addendumContractId: doc.addendumContractId ? String(doc.addendumContractId) : null,
    addendum,

    createdAt: doc.createdAt || doc.scheduledAt || null,
    scheduledAt: doc.scheduledAt || doc.createdAt || null,
    executedAt: doc.executedAt || null,
    cancelledAt: doc.cancelledAt || null,
  };
}

/**
 * Resolve the OPEN scheduled transfer for a reservation (or null), serialized.
 * Convenience for the tenant/admin detail serializers.
 */
export async function getOpenScheduledRoomTransferForReservation(reservationId, { session = null } = {}) {
  const { ScheduledRoomTransfer } = await import("../models/index.js");
  const { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } = await import("../models/ScheduledRoomTransfer.js");
  const q = ScheduledRoomTransfer.findOne({
    reservationId,
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    isArchived: { $ne: true },
  }).sort({ createdAt: -1 });
  const doc = await (session ? q.session(session) : q);
  if (!doc) return null;
  return serializeScheduledRoomTransfer(doc, { session });
}
