/**
 * ============================================================================
 * SCHEDULED ROOM TRANSFER SERVICE
 * ============================================================================
 *
 * Phase 2B scope — foundation only:
 *   - applyScheduledTransferHold / releaseScheduledTransferHold — the real,
 *     availability-affecting destination-capacity hold.
 *   - scheduleRoomTransfer — validate a FUTURE-dated transfer intent, prepare
 *     the Addendum Draft, place the hold, snapshot the preview, and persist a
 *     ScheduledRoomTransfer — all in one transaction. Mutates NOTHING about
 *     the tenant's current Stay / room / rent / utilities.
 *   - countOpenDestinationHolds / openHoldBackedBedKeys — helpers the
 *     occupancy reconcilers use so an open hold is not reconciled away.
 *
 * NOT in this phase: the cron executor, effective-date execution, the
 * cancellation endpoint, action_required retry, and all frontend.
 * ============================================================================
 */

import mongoose from "mongoose";
import logger from "../middleware/logger.js";
import {
  Room,
  Stay,
  Contract,
  Bill,
  ScheduledRoomTransfer,
} from "../models/index.js";
import { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } from "../models/ScheduledRoomTransfer.js";
import { getManilaToday, toManilaStartOfDay } from "../utils/dateUtils.js";
import { sumBillCharges } from "./billing/billingPolicy.js";
import {
  resolveValidatedRoomTransferIntent,
  prepareRoomTransferAddendum,
  computeRoomTransferPreview,
} from "../utils/tenantActionService.js";

const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;

const err = (message, statusCode, code, extra = {}) =>
  Object.assign(new Error(message), { statusCode, code, ...extra });

/**
 * True when `effectiveTransferDate` is strictly AFTER today's Manila business
 * date. Today / past => not a scheduled transfer (today is the immediate
 * path; past is rejected by the caller).
 */
export function isFutureManilaDate(effectiveTransferDate) {
  const eff = toManilaStartOfDay(effectiveTransferDate);
  if (!eff) return false;
  return eff.isAfter(getManilaToday(), "day");
}

/**
 * True when `effectiveTransferDate` is strictly BEFORE today's Manila date.
 */
export function isPastManilaDate(effectiveTransferDate) {
  const eff = toManilaStartOfDay(effectiveTransferDate);
  if (!eff) return false;
  return eff.isBefore(getManilaToday(), "day");
}

// ────────────────────────────────────────────────────────────────────────────
// HOLD PRIMITIVES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Place the real destination-capacity hold for a scheduled inbound transfer.
 * MUST be called inside a transaction (`session` required).
 *
 * Shared destination:
 *   - the target bed must currently be "available"
 *   - bed.status -> "reserved", occupiedBy -> { the tenant's EXISTING
 *     reservation }, occupiedSince: null (distinguishes a hold from a real
 *     move-in)
 *   - Room.atomicIncreaseOccupancy — null => DESTINATION_ROOM_FULL
 *
 * Private / capacity-only destination:
 *   - Room.atomicIncreaseOccupancy only; no bed row touched, no fake bed id
 *   - null => DESTINATION_ROOM_FULL
 *
 * @returns {{ holdApplied: true, destinationBedId: string|null }}
 */
export async function applyScheduledTransferHold({
  session,
  destinationRoomId,
  destinationBedId = null,
  destinationNeedsBed,
  tenantUserId,
  reservationId,
}) {
  if (!session) throw new Error("applyScheduledTransferHold requires a transaction session");

  const incremented = await Room.atomicIncreaseOccupancy(destinationRoomId, session);
  if (!incremented) {
    throw err("The destination room is full.", 409, "DESTINATION_ROOM_FULL");
  }

  if (destinationNeedsBed) {
    if (!destinationBedId) {
      throw err("A destination bed is required to hold a shared room.", 400, "MISSING_TRANSFER_FIELDS");
    }
    // Re-read with the session so the check sees committed-in-txn state.
    const room = await Room.findById(destinationRoomId).session(session);
    const bed = room?.beds?.find(
      (b) => String(b.id) === String(destinationBedId) || String(b._id) === String(destinationBedId),
    );
    if (!bed) {
      throw err("Destination bed not found in the room.", 404, "TARGET_BED_NOT_FOUND");
    }
    if (bed.status !== "available") {
      throw err("The selected destination bed is not available.", 409, "BED_NOT_AVAILABLE");
    }
    bed.status = "reserved";
    bed.lockedBy = null;
    bed.lockExpiresAt = null;
    bed.occupiedBy = {
      userId: tenantUserId || null,
      reservationId: reservationId || null,
      occupiedSince: null, // null => a scheduled hold, not a physical move-in
    };
    if (typeof room.updateAvailability === "function") room.updateAvailability();
    await room.save({ session });
    return { holdApplied: true, destinationBedId: String(bed.id || bed._id) };
  }

  return { holdApplied: true, destinationBedId: null };
}

/**
 * Reverse `applyScheduledTransferHold`. Idempotent-ish: safe to call when the
 * bed is already free / occupancy already low, but callers should gate on
 * `holdApplied`. MUST be called inside a transaction.
 */
export async function releaseScheduledTransferHold({
  session,
  destinationRoomId,
  destinationBedId = null,
  destinationNeedsBed,
  reservationId,
}) {
  if (!session) throw new Error("releaseScheduledTransferHold requires a transaction session");

  if (destinationNeedsBed && destinationBedId) {
    const room = await Room.findById(destinationRoomId).session(session);
    const bed = room?.beds?.find(
      (b) => String(b.id) === String(destinationBedId) || String(b._id) === String(destinationBedId),
    );
    if (
      bed &&
      bed.status === "reserved" &&
      String(bed.occupiedBy?.reservationId || "") === String(reservationId || "") &&
      !bed.occupiedBy?.occupiedSince
    ) {
      bed.status = "available";
      bed.lockedBy = null;
      bed.lockExpiresAt = null;
      bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
      if (typeof room.updateAvailability === "function") room.updateAvailability();
      await room.save({ session });
    }
  }

  await Room.atomicDecreaseOccupancy(destinationRoomId, session);
  return { holdReleased: true };
}

// ────────────────────────────────────────────────────────────────────────────
// RECONCILER AWARENESS
// ────────────────────────────────────────────────────────────────────────────

/**
 * How many OPEN (scheduled | action_required) inbound transfers are holding a
 * slot in `roomId`. The nightly occupancy reconciler (scheduler Job 15) and
 * the realtime room-status sync add this to a room's reservation-derived live
 * count so a valid hold is not reconciled away.
 */
export async function countOpenDestinationHolds(roomId, { session } = {}) {
  const q = ScheduledRoomTransfer.countDocuments({
    destinationRoomId: roomId,
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    holdApplied: true,
    isArchived: { $ne: true },
  });
  return session ? q.session(session) : q;
}

/**
 * The set of destination bed keys ("<roomId>::<bedId>") currently backed by an
 * OPEN, hold-applied inbound transfer. A reconciler that would otherwise clear
 * a "reserved" bed whose occupiedBy pointer doesn't match a live reservation's
 * selectedBed must skip any bed in this set.
 *
 * @param {ObjectId[]} [roomIds] optional filter
 * @returns {Promise<Set<string>>}
 */
export async function openHoldBackedBedKeys(roomIds = null) {
  const query = {
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    holdApplied: true,
    destinationBedId: { $ne: null },
    isArchived: { $ne: true },
  };
  if (Array.isArray(roomIds) && roomIds.length) {
    query.destinationRoomId = { $in: roomIds };
  }
  const rows = await ScheduledRoomTransfer.find(query)
    .select("destinationRoomId destinationBedId")
    .lean();
  return new Set(rows.map((r) => `${String(r.destinationRoomId)}::${String(r.destinationBedId)}`));
}

/**
 * Map of roomId -> array of open holds for display (occupancyManager can flag
 * the held bed's occupant snapshot as `scheduledIncoming`).
 */
export async function openHoldsByRoom(roomIds = null) {
  const query = {
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    holdApplied: true,
    isArchived: { $ne: true },
  };
  if (Array.isArray(roomIds) && roomIds.length) {
    query.destinationRoomId = { $in: roomIds };
  }
  const rows = await ScheduledRoomTransfer.find(query)
    .select("destinationRoomId destinationBedId tenantId reservationId effectiveTransferDate")
    .lean();
  const map = new Map();
  for (const r of rows) {
    const key = String(r.destinationRoomId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────────────
// SCHEDULE CREATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Schedule a room transfer to take effect on a FUTURE Manila business date.
 *
 * Preconditions (all enforced here, not just the UI):
 *   - the SAME canonical transfer-intent validation the immediate path runs
 *     (`resolveValidatedRoomTransferIntent`, requireConfirm)
 *   - effectiveTransferDate strictly AFTER today Manila (today => immediate
 *     path; past => rejected by the controller before we get here, and again
 *     defensively here)
 *   - the reservation has NO open (scheduled | action_required) transfer
 *   - no pending future renewal (same guard the immediate transfer applies)
 *
 * Effects (one transaction):
 *   - prepare / reuse the Room Transfer Addendum Draft (generated,
 *     isCurrent:false, amendmentEffectiveDate = the future date)
 *   - place the REAL destination hold (bed "reserved" + atomic occupancy++,
 *     or atomic occupancy++ for a private destination)
 *   - persist a ScheduledRoomTransfer{ status:"scheduled", holdApplied:true }
 *
 * Does NOT touch: the tenant's Stay, Reservation.roomId / selectedBed /
 * monthlyRent / recurringRentRate, the SOURCE room's occupancy, any Bill,
 * TenantCredit, or UtilityReading.
 *
 * @returns {{ scheduledTransfer, addendum, previewSnapshot }}
 */
export async function scheduleRoomTransfer({ reservationId, payload = {}, actorId = null }) {
  // 1. Canonical intent validation (identical to the immediate Stage A).
  const intent = await resolveValidatedRoomTransferIntent({
    reservationId,
    payload,
    requireConfirm: true,
  });
  const {
    reservation,
    targetRoom,
    targetBed,
    predecessorContract,
    activeStay,
    effectiveTransferDate,
    destinationNeedsBed,
  } = intent;

  // 2. Must be a FUTURE date (defensive — controller also checks).
  if (isPastManilaDate(effectiveTransferDate)) {
    throw err("The effective transfer date cannot be in the past.", 400, "PAST_TRANSFER_DATE");
  }
  if (!isFutureManilaDate(effectiveTransferDate)) {
    throw err(
      "A same-day transfer takes effect immediately — use the immediate transfer path.",
      400,
      "NOT_A_FUTURE_TRANSFER",
    );
  }

  // 3. No other open schedule for this reservation (DB partial-unique index is
  //    the hard guard; this gives a clean error before the write).
  const existingOpen = await ScheduledRoomTransfer.findOne({
    reservationId: reservation._id,
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
  }).lean();
  if (existingOpen) {
    throw err(
      "This tenant already has a scheduled room transfer. Cancel it before scheduling another.",
      409,
      "SCHEDULED_TRANSFER_ALREADY_EXISTS",
    );
  }

  // 4. Pending future renewal blocks a transfer (same rule as the immediate
  //    path — transferring the predecessor Contract out from under a renewal
  //    whose frozen currentTerms describe the current room would misdescribe
  //    it). A renewal leaves the tenancy with >1 non-terminal Stay for the
  //    reservation (the old one flipped to "renewed" + the new "active" one),
  //    linked by `previousStayId`. Detect ANY such chain, not just one hung
  //    off whichever Stay `resolveCurrentStayForReservation` happened to
  //    return.
  const reservationStayIds = (
    await Stay.find({ reservationId: reservation._id }).select("_id").lean()
  ).map((s) => s._id);
  const pendingRenewalStay = await Stay.exists({
    reservationId: reservation._id,
    previousStayId: { $in: reservationStayIds },
  });
  if (pendingRenewalStay) {
    throw err(
      "A future renewal already exists for this tenant. Resolve or cancel it before scheduling a transfer.",
      409,
      "FUTURE_RENEWAL_EXISTS",
    );
  }

  // 5. Prepare / reuse the Addendum Draft (mutates nothing physical).
  const { addendum } = await prepareRoomTransferAddendum({
    reservationId: reservation._id,
    payload: {
      targetRoomId: String(targetRoom._id),
      targetBedId: destinationNeedsBed ? String(targetBed?.id || targetBed?._id) : undefined,
      effectiveTransferDate,
    },
    actorId,
  });

  // 6. Canonical financial preview using the FUTURE effective date (audit).
  const previewSnapshot = await computeRoomTransferPreview({
    reservationId: reservation._id,
    targetRoomId: String(targetRoom._id),
    effectiveTransferDate,
  }).catch((e) => {
    logger.warn({ err: e, reservationId: String(reservation._id) }, "[scheduleRoomTransfer] preview computation failed (non-fatal)");
    return null;
  });

  const sourceBedId =
    activeStay?.bedId && !String(activeStay.bedId).startsWith("room-")
      ? String(activeStay.bedId)
      : reservation.selectedBed?.id || null;

  // 6b. Derive the pre-transfer payable — ONLY the deterministically-known
  //     amounts: positive Rent Adjustment + positive Additional Security
  //     Deposit. NEVER electricity / water (those follow the effective-date
  //     cutoff via the normal utility workflow). Zero total => no Bill.
  const rentDue = roundMoney(Math.max(0, Number(previewSnapshot?.rent?.adjustmentDue) || 0));
  const depositDue = roundMoney(Math.max(0, Number(previewSnapshot?.deposit?.balanceDue) || 0));
  const balanceTotal = roundMoney(rentDue + depositDue);
  const effectiveDateObj = toManilaStartOfDay(effectiveTransferDate).toDate();
  const cycleStart = previewSnapshot?.billingCycle?.billingCycleStart || effectiveDateObj;
  const cycleEnd = previewSnapshot?.billingCycle?.billingCycleEnd || effectiveDateObj;

  // 7. Transaction: hold + record (+ Bill if there is one) together.
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      // Re-assert the "no open schedule" guard inside the txn.
      const raceOpen = await ScheduledRoomTransfer.findOne({
        reservationId: reservation._id,
        status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
      }).session(session);
      if (raceOpen) {
        throw err(
          "This tenant already has a scheduled room transfer.",
          409,
          "SCHEDULED_TRANSFER_ALREADY_EXISTS",
        );
      }

      const hold = await applyScheduledTransferHold({
        session,
        destinationRoomId: targetRoom._id,
        destinationBedId: destinationNeedsBed ? String(targetBed?.id || targetBed?._id) : null,
        destinationNeedsBed,
        tenantUserId: reservation.userId?._id || reservation.userId,
        reservationId: reservation._id,
      });

      const [doc] = await ScheduledRoomTransfer.create(
        [
          {
            reservationId: reservation._id,
            tenantId: reservation.userId?._id || reservation.userId,
            branch: targetRoom.branch,
            sourceRoomId: activeStay.roomId,
            sourceBedId,
            destinationRoomId: targetRoom._id,
            destinationBedId: hold.destinationBedId,
            destinationNeedsBed,
            effectiveTransferDate,
            reason: payload.reason || "Room transfer",
            addendumContractId: addendum?.contractId || null,
            previewSnapshot,
            sourceRoomMeterReading:
              payload.sourceRoomMeterReading != null && !Number.isNaN(Number(payload.sourceRoomMeterReading))
                ? Number(payload.sourceRoomMeterReading)
                : null,
            targetRoomMeterReading:
              payload.targetRoomMeterReading != null && !Number.isNaN(Number(payload.targetRoomMeterReading))
                ? Number(payload.targetRoomMeterReading)
                : null,
            status: "scheduled",
            holdApplied: true,
            scheduledBy: actorId,
            scheduledAt: new Date(),
          },
        ],
        { session },
      );
      created = doc;

      // 7b. The Scheduled Room Transfer Balance Bill — one canonical Bill,
      //     billType "transfer_settlement", rent + securityDeposit ONLY, due
      //     on the effective transfer date. Skipped entirely when nothing is
      //     owed (no ₱0 payable Bill).
      if (balanceTotal > 0) {
        const charges = {
          rent: rentDue,
          electricity: 0,
          water: 0,
          applianceFees: 0,
          corkageFees: 0,
          penalty: 0,
          securityDeposit: depositDue,
          discount: 0,
        };
        const total = sumBillCharges(charges);
        const noteParts = [
          `Scheduled Room Transfer: ${previewSnapshot?.fromRoom?.name || "current room"} → ` +
            `${previewSnapshot?.toRoom?.name || "new room"}, effective ` +
            `${toManilaStartOfDay(effectiveTransferDate).format("YYYY-MM-DD")}`,
        ];
        if (rentDue > 0) noteParts.push(`rent adjustment ₱${rentDue.toFixed(2)}`);
        if (depositDue > 0) noteParts.push(`additional security deposit ₱${depositDue.toFixed(2)}`);
        noteParts.push("Electricity and water follow the normal utility billing after the transfer cutoff.");

        const [bill] = await Bill.create(
          [
            {
              billType: "transfer_settlement",
              reservationId: reservation._id,
              userId: reservation.userId?._id || reservation.userId,
              branch: activeStay.branch || targetRoom.branch,
              roomId: activeStay.roomId, // still the SOURCE room until cutover
              billingMonth: effectiveDateObj,
              billingCycleStart: cycleStart,
              billingCycleEnd: cycleEnd,
              dueDate: effectiveDateObj, // on or before the effective transfer date
              charges,
              totalAmount: total,
              grossAmount: total,
              remainingAmount: total,
              paidAmount: 0,
              status: "pending",
              publicationState: "published",
              notes: noteParts.join("; "),
              transferSnapshot: {
                fromRoomId: activeStay.roomId,
                fromRoomName: previewSnapshot?.fromRoom?.name || "",
                fromRoomType: previewSnapshot?.fromRoom?.type || "",
                toRoomId: targetRoom._id,
                toRoomName: previewSnapshot?.toRoom?.name || targetRoom.roomNumber || "",
                toRoomType: targetRoom.type || "",
                effectiveTransferDate: effectiveDateObj,
                // Pre-transfer payable — the executor recomputes the canonical
                // settlement at execution and reconciles any difference.
                scheduledRentAdjustment: rentDue,
                scheduledAdditionalDeposit: depositDue,
                isScheduledTransferBalance: true,
              },
            },
          ],
          { session },
        );
        created.settlementBillId = bill._id;
        await created.save({ session });
      }
    });
  } catch (e) {
    // A duplicate-key error from the partial-unique index => concurrent schedule.
    if (e?.code === 11000) {
      throw err(
        "This tenant already has a scheduled room transfer.",
        409,
        "SCHEDULED_TRANSFER_ALREADY_EXISTS",
      );
    }
    throw e;
  } finally {
    await session.endSession();
  }

  logger.info(
    {
      scheduledTransferId: String(created._id),
      reservationId: String(reservation._id),
      destinationRoomId: String(targetRoom._id),
      destinationBedId: created.destinationBedId,
      effectiveTransferDate,
      settlementBillId: created.settlementBillId ? String(created.settlementBillId) : null,
      balanceTotal,
    },
    "[scheduleRoomTransfer] scheduled",
  );

  return { scheduledTransfer: created, addendum, previewSnapshot, balanceTotal };
}
