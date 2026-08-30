/**
 * ============================================================================
 * SCHEDULED ROOM TRANSFER SERVICE
 * ============================================================================
 *
 *   - applyScheduledTransferHold / releaseScheduledTransferHold — the real,
 *     availability-affecting destination-capacity hold.
 *   - scheduleRoomTransfer — validate a transfer intent (same-day within
 *     office hours, or future), prepare the Addendum Draft, place the hold,
 *     snapshot the preview, and persist a ScheduledRoomTransfer. Mutates
 *     NOTHING about the tenant's current Stay / room / rent / utilities and
 *     creates NO Bill.
 *   - rescheduleRoomTransfer — move an open schedule's date/time on the SAME
 *     destination (revalidate intent + hold + office hours; append history).
 *   - completeRoomTransfer — the admin-driven, transfer-day cutover: enter the
 *     closing/opening meter readings, compute the settlement, require the
 *     transfer-settlement Bill paid, then run the canonical
 *     `transferStayWorkflow`. This REPLACES the old cron auto-executor's
 *     cutover.
 *   - countOpenDestinationHolds / openHoldBackedBedKeys — helpers the
 *     occupancy reconcilers use so an open hold is not reconciled away.
 * ============================================================================
 */

import mongoose from "mongoose";
import logger from "../middleware/logger.js";
import {
  Room,
  Stay,
  Bill,
  Reservation,
  ScheduledRoomTransfer,
} from "../models/index.js";
import { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } from "../models/ScheduledRoomTransfer.js";
import {
  getManilaToday,
  toManilaStartOfDay,
  composeManilaDateTime,
  isManilaDateTimeReached,
} from "../utils/dateUtils.js";
import { isWithinOfficeHours, resolveOfficeHoursForBranch } from "../utils/businessSettings.js";
import { branchSupportsSeparateUtilityBilling } from "../config/branches.js";
import { sumBillCharges, syncBillAmounts } from "./billing/billingPolicy.js";
import {
  resolveValidatedRoomTransferIntent,
  prepareRoomTransferAddendum,
  computeRoomTransferPreview,
  transferStayWorkflow,
} from "../utils/tenantActionService.js";

const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;

const DEFAULT_TRANSFER_TIME_MINUTES = 9 * 60; // 09:00 Asia/Manila

/**
 * Normalize a caller-supplied transfer time. Accepts a minutes-from-midnight
 * number, or an "HH:mm" string. Falls back to 09:00.
 */
export function normalizeTransferTimeMinutes(value) {
  if (value == null || value === "") return DEFAULT_TRANSFER_TIME_MINUTES;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(Math.round(value), 0), 24 * 60 - 1);
  }
  const m = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const mins = Number(m[1]) * 60 + Number(m[2]);
    if (Number.isFinite(mins) && mins >= 0 && mins < 24 * 60) return mins;
  }
  return DEFAULT_TRANSFER_TIME_MINUTES;
}

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
 * Schedule a room transfer to take effect on a chosen Manila business date +
 * time. Same-day is allowed provided the chosen date/time is still within
 * configured office hours; a future date is always allowed; a past date is
 * rejected.
 *
 * Preconditions (all enforced here, not just the UI):
 *   - the SAME canonical transfer-intent validation the cutover engine runs
 *     (`resolveValidatedRoomTransferIntent`, requireConfirm)
 *   - effectiveTransferDate is today or later (Manila); if today, the
 *     effectiveTransferTime must be within office hours
 *   - the reservation has NO open (scheduled | action_required) transfer
 *   - no pending future renewal (same guard the immediate transfer applies)
 *
 * Effects (one transaction):
 *   - prepare / reuse the Room Transfer Addendum Draft (generated,
 *     isCurrent:false, amendmentEffectiveDate = the effective date)
 *   - place the REAL destination hold (bed "reserved" + atomic occupancy++,
 *     or atomic occupancy++ for a private destination)
 *   - persist a ScheduledRoomTransfer{ status:"scheduled", holdApplied:true,
 *     scheduleHistory:[{ kind:"scheduled", ... }] }
 *
 * Does NOT touch: the tenant's Stay, Reservation.roomId / selectedBed /
 * monthlyRent / recurringRentRate, the SOURCE room's occupancy, any Bill,
 * TenantCredit, or UtilityReading. **The transfer-settlement Bill is NOT
 * created here** — it is created (if anything is owed) during the admin
 * Complete Transfer flow on the effective date.
 *
 * @returns {{ scheduledTransfer, addendum, previewSnapshot }}
 */
export async function scheduleRoomTransfer({ reservationId, payload = {}, actorId = null }) {
  // 1. Canonical intent validation (identical to the cutover engine's Stage A).
  const intent = await resolveValidatedRoomTransferIntent({
    reservationId,
    payload,
    requireConfirm: true,
    // Committing path: a scheduled transfer places a real destination hold and
    // persists a ScheduledRoomTransfer, and the Complete Transfer flow later
    // runs the same ensureActiveStay. Materialize the Stay now so a
    // legitimately moved-in tenant whose first lifecycle action is a scheduled
    // transfer is not blocked by a missing lazily-created Stay row.
    materializeStay: true,
    actorId,
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

  const effectiveTransferTimeMinutes = normalizeTransferTimeMinutes(
    payload.effectiveTransferTimeMinutes ?? payload.effectiveTransferTime,
  );

  // 2. Date/time window rules.
  if (isPastManilaDate(effectiveTransferDate)) {
    throw err("The effective transfer date cannot be in the past.", 400, "PAST_TRANSFER_DATE");
  }
  // EVERY planned transfer date + time — today, tomorrow, or any future date —
  // must land inside canonical office hours (BusinessSettings, Asia/Manila,
  // backend-authoritative). An impossible schedule is rejected here, not
  // deferred to Complete Transfer. The transaction-local cutoverAt check in
  // transferStayWorkflow still independently validates the REAL physical time.
  {
    const cutoverAt = composeManilaDateTime(effectiveTransferDate, effectiveTransferTimeMinutes);
    const officeHours = await resolveOfficeHoursForBranch(targetRoom.branch);
    if (!isWithinOfficeHours(cutoverAt, targetRoom.branch, { officeHours })) {
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      throw err(
        `Room transfers can only be scheduled for a time within office hours ` +
          `(${fmt(officeHours.startMinutes)}–${fmt(officeHours.endMinutes)}, Asia/Manila) ` +
          `on an office day. Choose a valid date and time.`,
        400,
        "OUTSIDE_OFFICE_HOURS",
      );
    }
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

  // 6. Canonical financial preview using the chosen effective date (audit
  //    snapshot only — the Complete Transfer flow recomputes at cutover and is
  //    the sole charging authority).
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

  const nowTs = new Date();

  // 7. Transaction: destination hold + ScheduledRoomTransfer record. NO Bill is
  //    created here — the transfer-settlement Bill (if anything is owed) is
  //    created during the admin Complete Transfer flow on the effective date,
  //    from the settlement recomputed at the real cutover.
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
            effectiveTransferTimeMinutes,
            reason: payload.reason || "Room transfer",
            addendumContractId: addendum?.contractId || null,
            previewSnapshot,
            // Meter readings are captured by the admin during the Complete
            // Transfer flow at the real cutover — never at scheduling time.
            sourceRoomMeterReading: null,
            targetRoomMeterReading: null,
            status: "scheduled",
            holdApplied: true,
            scheduledBy: actorId,
            scheduledAt: nowTs,
            scheduleHistory: [
              {
                previousDate: null,
                previousTimeMinutes: null,
                newDate: toManilaStartOfDay(effectiveTransferDate).toDate(),
                newTimeMinutes: effectiveTransferTimeMinutes,
                actorId: actorId || null,
                at: nowTs,
                reason: payload.reason || "Room transfer",
                kind: "scheduled",
              },
            ],
          },
        ],
        { session },
      );
      created = doc;
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
      effectiveTransferTimeMinutes,
    },
    "[scheduleRoomTransfer] scheduled",
  );

  return { scheduledTransfer: created, addendum, previewSnapshot };
}

// ────────────────────────────────────────────────────────────────────────────
// RESCHEDULE (date/time only — same destination)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Move an OPEN scheduled transfer to a new Manila date + time, keeping the
 * SAME destination room/bed (and therefore the SAME hold and the SAME
 * Addendum). Changing the destination is not a reschedule — cancel and create
 * a new scheduled transfer for that.
 *
 * Revalidates:
 *   - the record is still OPEN and not executed
 *   - the same canonical transfer intent still holds (branch/type/bed/lease/
 *     renewal) — the destination bed hold must still be in place
 *   - the new date is today or later; if today, within office hours
 *
 * Effects: appends a `scheduleHistory` entry, updates
 * `effectiveTransferDate` / `effectiveTransferTimeMinutes`, refreshes
 * `previewSnapshot` for the new date, and re-points the Addendum's
 * `amendmentEffectiveDate`. Touches no Stay / occupancy / Bill.
 *
 * @returns {{ scheduledTransfer }}
 */
export async function rescheduleRoomTransfer({ reservationId, payload = {}, actorId = null }) {
  const record = await ScheduledRoomTransfer.findOne({
    reservationId,
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    isArchived: { $ne: true },
  }).sort({ createdAt: -1 });
  if (!record) {
    throw err("No open scheduled room transfer to reschedule.", 404, "NO_SCHEDULED_TRANSFER");
  }
  if (record.status === "executed") {
    throw err("This room transfer has already been completed.", 409, "TRANSFER_ALREADY_COMPLETED");
  }

  const newDate = toManilaStartOfDay(payload.effectiveTransferDate);
  if (!newDate) {
    throw err("A new effective transfer date is required.", 400, "MISSING_TRANSFER_FIELDS");
  }
  if (newDate.isBefore(getManilaToday(), "day")) {
    throw err("The new effective transfer date cannot be in the past.", 400, "PAST_TRANSFER_DATE");
  }
  const newTimeMinutes = normalizeTransferTimeMinutes(
    payload.effectiveTransferTimeMinutes ?? payload.effectiveTransferTime,
  );

  // EVERY rescheduled date + time must land inside canonical office hours
  // (today, tomorrow, or any future date) — same rule as scheduleRoomTransfer.
  {
    const cutoverAt = composeManilaDateTime(newDate.toDate(), newTimeMinutes);
    const officeHours = await resolveOfficeHoursForBranch(record.branch);
    if (!isWithinOfficeHours(cutoverAt, record.branch, { officeHours })) {
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      throw err(
        `Room transfers can only be scheduled for a time within office hours ` +
          `(${fmt(officeHours.startMinutes)}–${fmt(officeHours.endMinutes)}, Asia/Manila) on an office day.`,
        400,
        "OUTSIDE_OFFICE_HOURS",
      );
    }
  }

  // Revalidate the canonical intent + that the destination hold is still ours.
  const intent = await resolveValidatedRoomTransferIntent({
    reservationId,
    payload: {
      confirm: true,
      targetRoomId: String(record.destinationRoomId),
      targetBedId: record.destinationNeedsBed ? record.destinationBedId : undefined,
      effectiveTransferDate: newDate.toDate(),
    },
    requireConfirm: true,
    materializeStay: true,
    actorId,
  });

  if (record.destinationNeedsBed) {
    const destRoom = await Room.findById(record.destinationRoomId).lean();
    const bed = (destRoom?.beds || []).find((b) => String(b.id) === String(record.destinationBedId));
    if (!bed || bed.status !== "reserved" || String(bed.occupiedBy?.reservationId || "") !== String(reservationId)) {
      throw err(
        "The reserved destination bed is no longer held for this transfer. Cancel and re-schedule.",
        409,
        "DESTINATION_HOLD_LOST",
      );
    }
  }

  const prevDate = record.effectiveTransferDate;
  const prevTime = record.effectiveTransferTimeMinutes;
  const nowTs = new Date();

  // Refresh the audit preview for the new date (non-fatal).
  const previewSnapshot = await computeRoomTransferPreview({
    reservationId,
    targetRoomId: String(record.destinationRoomId),
    effectiveTransferDate: newDate.toDate(),
  }).catch(() => record.previewSnapshot || null);

  record.effectiveTransferDate = newDate.toDate();
  record.effectiveTransferTimeMinutes = newTimeMinutes;
  record.previewSnapshot = previewSnapshot;
  record.reason = payload.reason || record.reason;
  record.scheduleHistory.push({
    previousDate: prevDate,
    previousTimeMinutes: prevTime,
    newDate: newDate.toDate(),
    newTimeMinutes: newTimeMinutes,
    actorId: actorId || null,
    at: nowTs,
    reason: payload.reason || "",
    kind: "rescheduled",
  });
  await record.save();

  // Re-point the Addendum's effective date so the document reflects the change.
  // The Addendum is only current/acknowledged AFTER a transfer completes, so a
  // pre-completion reschedule normally hits an unacknowledged draft. Defensively:
  // if any acknowledgement rows exist for it, drop them so the corrected date
  // requires a fresh acknowledgement (never leave a stale one silently applied).
  if (record.addendumContractId) {
    try {
      const { Contract, ContractAcknowledgement } = await import("../models/index.js");
      const upd = await Contract.updateOne(
        { _id: record.addendumContractId, isCurrent: { $ne: true } },
        { $set: { amendmentEffectiveDate: newDate.toDate() } },
      );
      if (upd.modifiedCount > 0) {
        await ContractAcknowledgement.deleteMany({ contractId: record.addendumContractId });
      }
    } catch (e) {
      logger.warn(
        { err: e, scheduledTransferId: String(record._id) },
        "[rescheduleRoomTransfer] addendum effective-date update failed (non-fatal)",
      );
    }
  }

  void intent;
  logger.info(
    {
      scheduledTransferId: String(record._id),
      reservationId: String(reservationId),
      from: { date: prevDate, time: prevTime },
      to: { date: record.effectiveTransferDate, time: newTimeMinutes },
    },
    "[rescheduleRoomTransfer] rescheduled",
  );

  return { scheduledTransfer: record };
}

// ────────────────────────────────────────────────────────────────────────────
// COMPLETE TRANSFER (admin-driven, transfer-day)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build/refresh the transfer-settlement Bill for a scheduled transfer from a
 * freshly-computed preview. Rent + security-deposit components ONLY —
 * electricity/water follow the normal utility period close. Never touches
 * paidAmount / payment history on an existing Bill.
 *
 * @returns {Promise<import("mongoose").Document|null>} the Bill, or null when
 *   nothing is owed and no Bill exists.
 */
async function upsertTransferSettlementBill({ record, reservation, preview, finalizedElectricity, asOfCutoverDay, actorId }) {
  const rentDue = roundMoney(Math.max(0, Number(preview?.rent?.adjustmentDue) || 0));
  const depositDue = roundMoney(Math.max(0, Number(preview?.deposit?.balanceDue) || 0));
  // Finalized source-room electricity (sub-metered branch) — settled on THIS
  // Bill, before cutover. 0 for a non-sub-metered branch. Water is NEVER on
  // this Bill (cannot be finalized before period close).
  const electricityDue = roundMoney(Math.max(0, Number(finalizedElectricity?.amount) || 0));
  const total = roundMoney(rentDue + depositDue + electricityDue);
  // The Bill's dates follow the ACTUAL cutover day (today) when supplied — a
  // delayed completion bills as of when it actually happens, matching the
  // preview's rent-cycle. Falls back to the scheduled date.
  const effectiveDateObj = toManilaStartOfDay(asOfCutoverDay || record.effectiveTransferDate).toDate();
  const cycleStart = preview?.billingCycle?.billingCycleStart || effectiveDateObj;
  const cycleEnd = preview?.billingCycle?.billingCycleEnd || effectiveDateObj;

  let bill = record.settlementBillId
    ? await Bill.findById(record.settlementBillId)
    : null;
  if (bill && (bill.isArchived === true || bill.status === "voided")) bill = null;

  const noteFor = () =>
    `Room Transfer settlement: ${preview?.fromRoom?.name || "current room"} → ` +
    `${preview?.toRoom?.name || "new room"} on ` +
    `${toManilaStartOfDay(asOfCutoverDay || record.effectiveTransferDate).format("YYYY-MM-DD")}; ` +
    `rent adjustment ₱${rentDue.toFixed(2)}, additional security deposit ₱${depositDue.toFixed(2)}` +
    (electricityDue > 0 ? `, final old-room electricity ₱${electricityDue.toFixed(2)}` : "") +
    `. Old-room water (if separately billed) is settled at its normal period close.`;

  const electricitySnapshot = finalizedElectricity?.applicable
    ? {
        finalizedSourceElectricity: {
          utilityPeriodId: finalizedElectricity.utilityPeriodId,
          kwh: finalizedElectricity.kwh,
          amount: electricityDue,
          ratePerUnit: finalizedElectricity.ratePerUnit,
          baselineReading: finalizedElectricity.baselineReading,
          closingReading: finalizedElectricity.closingReading,
        },
      }
    : {};

  if (!bill) {
    if (total <= 0) return null; // nothing owed, no Bill needed
    const charges = {
      rent: rentDue,
      electricity: electricityDue,
      water: 0,
      applianceFees: 0,
      corkageFees: 0,
      penalty: 0,
      securityDeposit: depositDue,
      discount: 0,
    };
    const billTotal = sumBillCharges(charges);
    const [created] = await Bill.create([
      {
        billType: "transfer_settlement",
        reservationId: reservation._id,
        userId: reservation.userId?._id || reservation.userId,
        branch: record.branch,
        roomId: record.sourceRoomId, // still the SOURCE room until cutover
        billingMonth: effectiveDateObj,
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        dueDate: effectiveDateObj,
        charges,
        totalAmount: billTotal,
        grossAmount: billTotal,
        remainingAmount: billTotal,
        paidAmount: 0,
        status: "pending",
        publicationState: "published",
        notes: noteFor(),
        transferSnapshot: {
          fromRoomId: record.sourceRoomId,
          fromRoomName: preview?.fromRoom?.name || "",
          fromRoomType: preview?.fromRoom?.type || "",
          toRoomId: record.destinationRoomId,
          toRoomName: preview?.toRoom?.name || "",
          toRoomType: preview?.toRoom?.type || "",
          effectiveTransferDate: effectiveDateObj,
          scheduledRentAdjustment: rentDue,
          scheduledAdditionalDeposit: depositDue,
          scheduledFinalElectricity: electricityDue,
          ...electricitySnapshot,
          isScheduledTransferBalance: true,
          createdAtCompletion: true,
        },
        createdBy: actorId || null,
      },
    ]);
    record.settlementBillId = created._id;
    await record.save();
    return created;
  }

  // Existing Bill: only re-shape the components while it is still UNPAID. Once
  // it carries a payment, a changed amount is a financial-adjustment case the
  // caller handles — not a silent Bill edit.
  const paid = roundMoney(Number(bill.paidAmount || 0));
  if (paid <= 0) {
    bill.charges.rent = rentDue;
    bill.charges.securityDeposit = depositDue;
    bill.charges.electricity = electricityDue;
    bill.charges.water = 0;
    bill.notes = noteFor();
    bill.transferSnapshot = {
      ...(bill.transferSnapshot || {}),
      scheduledRentAdjustment: rentDue,
      scheduledAdditionalDeposit: depositDue,
      scheduledFinalElectricity: electricityDue,
      ...electricitySnapshot,
      recomputedAtCompletion: true,
    };
    syncBillAmounts(bill, { preserveStatus: false });
    await bill.save();
  }
  return bill;
}

/**
 * Admin-driven room transfer completion. Called on/after the scheduled
 * effective date + time. Runs the meter → settlement → settle → cutover
 * sequence. Idempotent: a second call after `executed` is a no-op success.
 *
 * @param {Object}   opts
 * @param {string}   opts.reservationId
 * @param {Object}   opts.payload
 * @param {number}   [opts.payload.sourceRoomMeterReading]  closing kWh of the OLD room
 * @param {number}   [opts.payload.targetRoomMeterReading]  opening kWh of the NEW room
 * @param {ObjectId} [opts.actorId]
 *
 * @returns {Promise<{ outcome: "executed"|"awaiting_settlement"|"action_required",
 *   scheduledTransfer, bill?, reason?, message?, transferResult? }>}
 */
export async function completeRoomTransfer({ reservationId, payload = {}, actorId = null }) {
  const record = await ScheduledRoomTransfer.findOne({
    reservationId,
    status: { $nin: ["cancelled"] },
    isArchived: { $ne: true },
  }).sort({ createdAt: -1 });
  if (!record) {
    throw err("No scheduled room transfer to complete for this tenant.", 404, "NO_SCHEDULED_TRANSFER");
  }
  if (record.status === "executed") {
    return { outcome: "executed", scheduledTransfer: record, message: "This room transfer is already complete." };
  }
  if (!OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES.includes(record.status)) {
    throw err(`This scheduled room transfer is ${record.status} and cannot be completed.`, 409, "TRANSFER_NOT_COMPLETABLE");
  }

  // 1. The effective date + time must have been reached.
  const scheduledCutover = composeManilaDateTime(record.effectiveTransferDate, record.effectiveTransferTimeMinutes);
  if (!isManilaDateTimeReached(scheduledCutover)) {
    throw err(
      `This transfer is scheduled for ${toManilaStartOfDay(record.effectiveTransferDate).format("MMM D, YYYY")} ` +
        `at ${String(Math.floor(record.effectiveTransferTimeMinutes / 60)).padStart(2, "0")}:` +
        `${String(record.effectiveTransferTimeMinutes % 60).padStart(2, "0")}. ` +
        `It cannot be completed before then.`,
      400,
      "TRANSFER_NOT_YET_DUE",
    );
  }

  // 1b. PRELIMINARY office-hours check (fast UX). This is NOT authoritative —
  //     transferStayWorkflow re-checks with a transaction-local `new Date()`
  //     cutoverAt, and if office hours expire between here and the transaction
  //     the transaction check wins (abort, no cutover, no reading).
  {
    const nowCheck = new Date();
    const officeHours = await resolveOfficeHoursForBranch(record.branch);
    if (!isWithinOfficeHours(nowCheck, record.branch, { officeHours })) {
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return {
        outcome: "action_required",
        reason: "OUTSIDE_OFFICE_HOURS",
        scheduledTransfer: record,
        message:
          `Office hours are ${fmt(officeHours.startMinutes)}–${fmt(officeHours.endMinutes)} (Asia/Manila). ` +
          `Complete the transfer during office hours, or reschedule it.`,
      };
    }
  }

  // 2. Re-validate the canonical intent + the destination hold against LIVE
  //    room state (race guard). The OLD room/bed is derived from the tenant's
  //    ACTUAL current active Stay inside resolveValidatedRoomTransferIntent /
  //    transferStayWorkflow — never from admin input.
  const intent = await resolveValidatedRoomTransferIntent({
    reservationId,
    payload: {
      confirm: true,
      targetRoomId: String(record.destinationRoomId),
      targetBedId: record.destinationNeedsBed ? record.destinationBedId : undefined,
      effectiveTransferDate: record.effectiveTransferDate,
    },
    requireConfirm: true,
    materializeStay: true,
    actorId,
  }).catch((e) => {
    throw err(
      e.message || "The transfer can no longer be validated (room/bed/lease state changed).",
      e.statusCode || 409,
      e.code || "OPERATIONAL_VALIDATION_FAILED",
    );
  });
  const { reservation } = intent;

  if (record.destinationNeedsBed) {
    const destRoom = await Room.findById(record.destinationRoomId).lean();
    const bed = (destRoom?.beds || []).find((b) => String(b.id) === String(record.destinationBedId));
    if (!bed || bed.status !== "reserved" || String(bed.occupiedBy?.reservationId || "") !== String(reservationId)) {
      throw err(
        "The reserved destination bed is no longer available for this transfer. Review the destination room.",
        409,
        "DESTINATION_UNAVAILABLE",
      );
    }
  } else {
    const destRoom = await Room.findById(record.destinationRoomId).lean();
    if (!destRoom) {
      throw err("The destination room no longer exists.", 409, "DESTINATION_UNAVAILABLE");
    }
    // Capacity check excluding this transfer's own hold (it is included in
    // currentOccupancy already, so full-minus-our-hold must be < capacity).
    if (Number(destRoom.currentOccupancy || 0) > Number(destRoom.capacity || 0)) {
      throw err("The destination room is over capacity.", 409, "DESTINATION_UNAVAILABLE");
    }
  }

  // 2b. Audit item 2 (requirement D): catch a reservation / pending move-in
  //     created AFTER scheduling whose occupancy window OVERLAPS the
  //     transferee's expected destination-occupancy interval
  //     `[cutoverDay, transfereeEnd)`. A reservation that begins on/after the
  //     transferee's known lease end does not block (matches the candidate
  //     selector's interval rule).
  {
    const cutoverDay = toManilaStartOfDay(new Date())?.toDate?.() || new Date();
    const transfereeEndRaw =
      intent.activeStay?.leaseEndDate || intent.predecessorContract?.leaseEndDate || null;
    const transfereeEnd = transfereeEndRaw
      ? toManilaStartOfDay(transfereeEndRaw)?.toDate?.() || new Date(transfereeEndRaw)
      : null;

    const otherReservations = await Reservation.find({
      _id: { $ne: reservation._id },
      "roomId": record.destinationRoomId,
      status: { $in: ["reserved", "approved_for_payment", "moveIn"] },
      isArchived: { $ne: true },
    })
      .select("selectedBed status moveInDate expectedMoveInDate leaseStartDate")
      .lean();

    const overlaps = (r) => {
      if (r.status === "moveIn") return true; // already a live occupant
      const startRaw = r.leaseStartDate || r.expectedMoveInDate || r.moveInDate || null;
      const start = startRaw
        ? toManilaStartOfDay(startRaw)?.toDate?.() || new Date(startRaw)
        : cutoverDay;
      if (transfereeEnd && start && start.getTime() >= transfereeEnd.getTime()) return false;
      return true;
    };

    const conflicting = otherReservations.filter((r) => {
      if (!overlaps(r)) return false;
      if (record.destinationNeedsBed) {
        return String(r.selectedBed?.id || "") === String(record.destinationBedId);
      }
      return true;
    });

    if (conflicting.length > 0) {
      throw err(
        record.destinationNeedsBed
          ? "Another reservation now covers the destination bed during this tenant's stay. Reschedule the transfer or pick another bed."
          : "Another reservation now covers the destination room during this tenant's stay. Reschedule the transfer or pick another room.",
        409,
        "DESTINATION_UNAVAILABLE",
      );
    }
  }

  // 3. Meter readings — captured FRESH on every Complete Transfer call (never
  //    reused from an earlier attempt). Sub-metered source branch => the
  //    closing SOURCE reading AND the opening DESTINATION reading are both
  //    REQUIRED (destination is same-branch as source). Non-sub-metered
  //    (guadalupe) => neither is required, no electricity finalization.
  const sourceMeterReading = payload.sourceRoomMeterReading;
  const targetMeterReading = payload.targetRoomMeterReading;
  const sourceMetered = branchSupportsSeparateUtilityBilling(record.branch, "electricity");
  const destRoomForMeter = await Room.findById(record.destinationRoomId).select("branch").lean();
  const destMetered = branchSupportsSeparateUtilityBilling(destRoomForMeter?.branch || record.branch, "electricity");
  if (sourceMetered && (sourceMeterReading == null || Number.isNaN(Number(sourceMeterReading)))) {
    throw err(
      "Enter the current (closing) electricity meter reading of the tenant's current room before completing the transfer.",
      400,
      "METER_READING_REQUIRED",
    );
  }
  if (destMetered && (targetMeterReading == null || Number.isNaN(Number(targetMeterReading)))) {
    throw err(
      "Enter the current electricity meter reading of the destination room — it becomes the tenant's opening baseline there.",
      400,
      "DEST_METER_READING_REQUIRED",
    );
  }

  // 4. Recompute the canonical settlement AS OF THE ACTUAL CUTOVER DAY (today),
  //    NOT the scheduled date. If this transfer was scheduled for an earlier
  //    day but is only being completed now (payment/office-hours delay), the
  //    tenant occupied the old room through today — rent/deposit proration and
  //    the billing cycle follow today. transferStayWorkflow does the same with
  //    its transaction-local cutoverAt, so the reused-Bill invariant matches.
  //    Electricity is finalized separately from the FRESH closing reading.
  const actualCutoverDay = new Date();

  // If a PRIOR completion attempt already created the transfer_settlement Bill
  // and its deposit component was (partly) paid, paymentLedger.reconcile-
  // TransferDepositHeld will have RAISED reservation.securityDepositHeld. On
  // this re-attempt the additional-deposit-due must be recomputed against the
  // held amount as it stood BEFORE that funding — otherwise a paid deposit
  // component reads as "the destination requirement dropped" and the whole
  // settlement looks lower than the (correct) Bill.
  let depositHeldOverride = null;
  if (record.settlementBillId) {
    const freshReservation = await Reservation.findById(reservationId)
      .select("securityDepositLedger")
      .lean();
    const ledgerEntry = (freshReservation?.securityDepositLedger || []).find(
      (e) => e.idempotencyKey === `room_transfer_deposit_settlement:${String(record.settlementBillId)}`,
    );
    if (ledgerEntry && Number.isFinite(Number(ledgerEntry.previousHeld))) {
      depositHeldOverride = roundMoney(Number(ledgerEntry.previousHeld));
    }
  }

  const preview = await computeRoomTransferPreview({
    reservationId,
    targetRoomId: String(record.destinationRoomId),
    effectiveTransferDate: record.effectiveTransferDate, // planning date (fallback)
    asOfCutoverDate: actualCutoverDay,                   // authoritative billing boundary
    depositHeldOverride: depositHeldOverride ?? undefined,
  });
  if (!preview) {
    throw err("The transfer settlement could not be computed. Review the tenant's billing/lease state.", 409, "OPERATIONAL_VALIDATION_FAILED");
  }

  let finalizedElectricity = null;
  if (sourceMetered && sourceMeterReading != null) {
    const { computeTransfereeSourceElectricityLiability } = await import(
      "./billing/transferUtilityFinalization.js"
    );
    finalizedElectricity = await computeTransfereeSourceElectricityLiability({
      reservation,
      sourceRoom: intent.activeStay
        ? await Room.findById(intent.activeStay.roomId).lean()
        : await Room.findById(record.sourceRoomId).lean(),
      cutoverDate: new Date(), // preview boundary only; the authoritative
      // cutoverAt is captured inside transferStayWorkflow. Electricity is
      // meter-bounded by the READING, not by time, so the amount is identical.
      freshSourceClosingReading: Number(sourceMeterReading),
    });
  }
  const finalizedElectricityDue = roundMoney(
    Math.max(0, Number(finalizedElectricity?.applicable ? finalizedElectricity.amount : 0)),
  );

  const totalImmediateDue = roundMoney(
    (Number(preview.totalImmediateDue) || 0) + finalizedElectricityDue,
  );

  // 5. Settlement gate — the transfer-settlement Bill (rent + deposit + final
  //    old-room electricity) must be fully paid before the physical cutover.
  //    Unrelated historical balances are NOT merged and do NOT block (spec §9).
  if (totalImmediateDue > 0) {
    const bill = await upsertTransferSettlementBill({
      record,
      reservation,
      preview,
      finalizedElectricity,
      asOfCutoverDay: actualCutoverDay,
      actorId,
    });
    const paid = roundMoney(Number(bill?.paidAmount || 0));
    const billTotal = roundMoney(Number(bill?.totalAmount || 0));

    // The Bill already carries a real payment AND the fresh (actual-cutover-day)
    // recompute is HIGHER than what the Bill was sized for -> a financial
    // adjustment. upsertTransferSettlementBill did NOT rewrite the paid Bill's
    // charges (unpaid-only reshape). The admin must settle the difference.
    if (paid > 0 && billTotal + 0.01 < totalImmediateDue) {
      await ScheduledRoomTransfer.updateOne(
        { _id: record._id },
        { $set: { status: "action_required", lastError: "ADDITIONAL_BALANCE_DUE", lastAttemptAt: new Date() } },
      );
      const fresh = await ScheduledRoomTransfer.findById(record._id);
      return {
        outcome: "action_required",
        reason: "ADDITIONAL_BALANCE_DUE",
        scheduledTransfer: fresh,
        bill,
        message:
          `The transfer settlement recomputed to ₱${roundMoney(totalImmediateDue).toFixed(2)} ` +
          `(higher than the ₱${billTotal.toFixed(2)} already billed). Settle the additional ` +
          `₱${roundMoney(totalImmediateDue - billTotal).toFixed(2)}, then complete.`,
      };
    }

    // The Bill carries a payment AND the recompute is LOWER — money already
    // collected, no automatic refund/reallocation.
    if (paid > 0 && totalImmediateDue + 0.01 < billTotal) {
      await ScheduledRoomTransfer.updateOne(
        { _id: record._id },
        { $set: { status: "action_required", lastError: "FINANCIAL_ADJUSTMENT_REQUIRED", lastAttemptAt: new Date() } },
      );
      const fresh = await ScheduledRoomTransfer.findById(record._id);
      return {
        outcome: "action_required",
        reason: "FINANCIAL_ADJUSTMENT_REQUIRED",
        scheduledTransfer: fresh,
        bill,
        message:
          "The final transfer amount is lower than what has already been paid. No automatic refund is made — " +
          "please coordinate the settlement with the Administration Office, then complete.",
      };
    }

    // Not fully settled -> surface the Bill; admin pays via the normal flow,
    // then re-invokes Complete Transfer. (Covers: brand-new Bill unpaid;
    // partial payment where the recompute did NOT move.)
    if (!bill || paid + 0.01 < roundMoney(Number(bill?.totalAmount || 0))) {
      await ScheduledRoomTransfer.updateOne(
        { _id: record._id, status: "scheduled" },
        { $set: { status: "action_required", lastError: "TRANSFER_BALANCE_UNPAID", lastAttemptAt: new Date() } },
      );
      const fresh = await ScheduledRoomTransfer.findById(record._id);
      const freshTotal = roundMoney(Number((await Bill.findById(bill?._id).lean())?.totalAmount || billTotal));
      return {
        outcome: "awaiting_settlement",
        reason: "TRANSFER_BALANCE_UNPAID",
        scheduledTransfer: fresh,
        bill,
        message:
          `Settle the Room Transfer balance of ₱${roundMoney(freshTotal - paid).toFixed(2)} ` +
          `then complete the transfer.`,
      };
    }
  }

  // 6. Cutover — release the hold in its own tiny txn, then run the ONE
  //    canonical engine (no forceOverride; the settlement gate above is the
  //    only financial gate). The engine re-takes the slot/bed atomically and
  //    reuses the linked Bill.
  const reusableBillId = record.settlementBillId ? String(record.settlementBillId) : undefined;

  await releaseHoldOwnTxn(record);
  let transferResult;
  try {
    transferResult = await transferStayWorkflow({
      reservationId: String(reservationId),
      payload: {
        confirm: true,
        targetRoomId: String(record.destinationRoomId),
        targetBedId: record.destinationNeedsBed ? record.destinationBedId : undefined,
        effectiveTransferDate: record.effectiveTransferDate,
        reason: record.reason || "Scheduled room transfer",
        notes: payload.notes || "",
        sourceRoomMeterReading: sourceMeterReading ?? undefined,
        targetRoomMeterReading: targetMeterReading ?? undefined,
        scheduledTransferBillId: reusableBillId,
        // Same pre-funding-aware override the preview used — so the workflow's
        // in-txn recompute of the deposit component matches the Bill it reuses.
        depositHeldOverride: depositHeldOverride ?? undefined,
        __scheduledTransferId: String(record._id),
      },
      actorId,
    });
  } catch (e) {
    // The engine's own transaction rolled back every physical mutation (no
    // room/bed change, no UtilityReading, no UtilityFinalization).
    // Restore the destination hold so the admin's fix has a slot to land in.
    await restoreHoldOwnTxn(record).catch((re) =>
      logger.error({ err: re, scheduledTransferId: String(record._id) }, "[completeRoomTransfer] hold restore failed"),
    );
    // The authoritative office-hours re-check inside the transaction is a
    // legitimate "cannot complete now" outcome, not an execution failure.
    const isOfficeHours = e.code === "OUTSIDE_OFFICE_HOURS";
    // The Addendum was already acknowledged/signed for the originally scheduled
    // date and the actual cutover is a different day — the admin must reschedule
    // (which re-issues the Addendum) rather than silently disagree.
    const isAddendumLocked = e.code === "ADDENDUM_EFFECTIVE_DATE_LOCKED";
    await ScheduledRoomTransfer.updateOne(
      { _id: record._id },
      {
        $set: {
          status: "action_required",
          lastError: isOfficeHours
            ? "OUTSIDE_OFFICE_HOURS"
            : isAddendumLocked
              ? "ADDENDUM_EFFECTIVE_DATE_LOCKED"
              : `EXECUTION_FAILED: ${e.code || e.message || "unknown"}`,
          lastAttemptAt: new Date(),
          holdApplied: true,
        },
      },
    );
    if (isOfficeHours || isAddendumLocked) {
      const fresh = await ScheduledRoomTransfer.findById(record._id);
      return {
        outcome: "action_required",
        reason: e.code,
        scheduledTransfer: fresh,
        message: e.message,
      };
    }
    throw err(e.message || "The room transfer could not be completed.", e.statusCode || 500, e.code || "TRANSFER_COMPLETION_FAILED");
  }

  // 7. Success — record the executed settlement + flip to executed. The
  //    AUTHORITATIVE physical cutover timestamp is `transferResult.cutoverAt`
  //    (a `new Date()` captured INSIDE the workflow transaction) — never the
  //    scheduled date/time and never a value assembled here.
  const cutoverAt = transferResult?.cutoverAt || new Date();
  const settlementBillId = transferResult?.billingSnapshot?.transferBillId || record.settlementBillId || null;
  const executedSettlement = {
    rentAdjustmentDue: roundMoney(transferResult?.billingSnapshot?.rentComponentDue ?? preview.rent?.adjustmentDue ?? 0),
    additionalDepositDue: roundMoney(transferResult?.billingSnapshot?.depositComponentDue ?? preview.deposit?.balanceDue ?? 0),
    finalElectricityDue: roundMoney(
      transferResult?.billingSnapshot?.electricityComponentDue ?? finalizedElectricityDue,
    ),
    excessRentCredit: roundMoney(transferResult?.billingSnapshot?.excessRentCredit ?? preview.rent?.excessCredit ?? 0),
    excessDepositHeld: roundMoney(transferResult?.billingSnapshot?.excessDepositHeld ?? preview.deposit?.excessHeld ?? 0),
    totalImmediateDue: roundMoney(transferResult?.billingSnapshot?.totalImmediateDue ?? totalImmediateDue),
    settlementBillId: settlementBillId ? String(settlementBillId) : null,
    sourceRoomMeterReading: sourceMeterReading != null ? Number(sourceMeterReading) : null,
    targetRoomMeterReading: targetMeterReading != null ? Number(targetMeterReading) : null,
    cutoverAt,
    completedBy: actorId ? String(actorId) : null,
    computedAt: new Date(),
  };

  await ScheduledRoomTransfer.updateOne(
    { _id: record._id },
    {
      $set: {
        status: "executed",
        executedAt: cutoverAt,
        executedSettlement,
        settlementBillId: settlementBillId || record.settlementBillId || null,
        sourceRoomMeterReading: sourceMeterReading != null ? Number(sourceMeterReading) : null,
        targetRoomMeterReading: targetMeterReading != null ? Number(targetMeterReading) : null,
        holdApplied: false,
        lastError: null,
        lastAttemptAt: new Date(),
      },
    },
  );

  const fresh = await ScheduledRoomTransfer.findById(record._id);
  logger.info(
    { scheduledTransferId: String(record._id), reservationId: String(reservationId), settlementBillId: String(settlementBillId || "") },
    "[completeRoomTransfer] executed",
  );
  return { outcome: "executed", scheduledTransfer: fresh, transferResult, message: "Room transfer completed." };
}

// ── Hold release / restore in their own tiny transactions (shared helpers) ────
async function releaseHoldOwnTxn(record) {
  if (!record.holdApplied) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await releaseScheduledTransferHold({
        session,
        destinationRoomId: record.destinationRoomId,
        destinationBedId: record.destinationBedId,
        destinationNeedsBed: record.destinationNeedsBed,
        reservationId: record.reservationId,
      });
      await ScheduledRoomTransfer.updateOne({ _id: record._id }, { $set: { holdApplied: false } }, { session });
    });
  } finally {
    await session.endSession();
  }
}

async function restoreHoldOwnTxn(record) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyScheduledTransferHold({
        session,
        destinationRoomId: record.destinationRoomId,
        destinationBedId: record.destinationNeedsBed ? record.destinationBedId : null,
        destinationNeedsBed: record.destinationNeedsBed,
        tenantUserId: record.tenantId,
        reservationId: record.reservationId,
      });
      await ScheduledRoomTransfer.updateOne({ _id: record._id }, { $set: { holdApplied: true } }, { session });
    });
  } finally {
    await session.endSession();
  }
}
