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
  ScheduledRoomTransfer,
} from "../models/index.js";
import { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } from "../models/ScheduledRoomTransfer.js";
import { getManilaToday, toManilaStartOfDay, composeManilaDateTime } from "../utils/dateUtils.js";
import { isWithinOfficeHours, resolveOfficeHoursForBranch } from "../utils/businessSettings.js";
import {
  resolveValidatedRoomTransferIntent,
  prepareRoomTransferAddendum,
  computeRoomTransferPreview,
} from "../utils/tenantActionService.js";

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
  if (!isFutureManilaDate(effectiveTransferDate)) {
    // Same Manila day => must be within office hours (backend-authoritative).
    const cutoverAt = composeManilaDateTime(effectiveTransferDate, effectiveTransferTimeMinutes);
    const officeHours = await resolveOfficeHoursForBranch(targetRoom.branch);
    if (!isWithinOfficeHours(cutoverAt, targetRoom.branch, { officeHours })) {
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      throw err(
        `Same-day room transfers can only be scheduled during office hours ` +
          `(${fmt(officeHours.startMinutes)}–${fmt(officeHours.endMinutes)}, Asia/Manila). ` +
          `Choose a time within office hours, or a future date.`,
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

  // Same-day => office hours (backend-authoritative).
  if (!newDate.isAfter(getManilaToday(), "day")) {
    const cutoverAt = composeManilaDateTime(newDate.toDate(), newTimeMinutes);
    const officeHours = await resolveOfficeHoursForBranch(record.branch);
    if (!isWithinOfficeHours(cutoverAt, record.branch, { officeHours })) {
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      throw err(
        `A same-day room transfer can only be scheduled during office hours ` +
          `(${fmt(officeHours.startMinutes)}–${fmt(officeHours.endMinutes)}, Asia/Manila).`,
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
  if (record.addendumContractId) {
    try {
      const { Contract } = await import("../models/index.js");
      await Contract.updateOne(
        { _id: record.addendumContractId, isCurrent: { $ne: true } },
        { $set: { amendmentEffectiveDate: newDate.toDate() } },
      );
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
