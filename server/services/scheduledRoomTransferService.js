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
async function upsertTransferSettlementBill({ record, reservation, preview, actorId }) {
  const rentDue = roundMoney(Math.max(0, Number(preview?.rent?.adjustmentDue) || 0));
  const depositDue = roundMoney(Math.max(0, Number(preview?.deposit?.balanceDue) || 0));
  const total = roundMoney(rentDue + depositDue);
  const effectiveDateObj = toManilaStartOfDay(record.effectiveTransferDate).toDate();
  const cycleStart = preview?.billingCycle?.billingCycleStart || effectiveDateObj;
  const cycleEnd = preview?.billingCycle?.billingCycleEnd || effectiveDateObj;

  let bill = record.settlementBillId
    ? await Bill.findById(record.settlementBillId)
    : null;
  if (bill && (bill.isArchived === true || bill.status === "voided")) bill = null;

  if (!bill) {
    if (total <= 0) return null; // nothing owed, no Bill needed
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
        notes:
          `Room Transfer settlement: ${preview?.fromRoom?.name || "current room"} → ` +
          `${preview?.toRoom?.name || "new room"} on ` +
          `${toManilaStartOfDay(record.effectiveTransferDate).format("YYYY-MM-DD")}; ` +
          `rent adjustment ₱${rentDue.toFixed(2)}, additional security deposit ₱${depositDue.toFixed(2)}. ` +
          `Electricity and water follow the normal utility billing after the transfer cutoff.`,
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
    bill.charges.electricity = 0;
    bill.charges.water = 0;
    bill.transferSnapshot = {
      ...(bill.transferSnapshot || {}),
      scheduledRentAdjustment: rentDue,
      scheduledAdditionalDeposit: depositDue,
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
  const cutoverAt = composeManilaDateTime(record.effectiveTransferDate, record.effectiveTransferTimeMinutes);
  if (!isManilaDateTimeReached(cutoverAt)) {
    throw err(
      `This transfer is scheduled for ${toManilaStartOfDay(record.effectiveTransferDate).format("MMM D, YYYY")} ` +
        `at ${String(Math.floor(record.effectiveTransferTimeMinutes / 60)).padStart(2, "0")}:` +
        `${String(record.effectiveTransferTimeMinutes % 60).padStart(2, "0")}. ` +
        `It cannot be completed before then.`,
      400,
      "TRANSFER_NOT_YET_DUE",
    );
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

  // 3. Meter readings. A closing source reading is REQUIRED when the source
  //    branch bills electricity separately (sub-metered). The destination
  //    opening reading is optional — the cutover engine falls back to the
  //    latest canonical reading dated ≤ the effective date.
  const sourceMeterReading = payload.sourceRoomMeterReading;
  const targetMeterReading = payload.targetRoomMeterReading;
  const sourceMetered = branchSupportsSeparateUtilityBilling(record.branch, "electricity");
  if (sourceMetered) {
    if (sourceMeterReading == null || Number.isNaN(Number(sourceMeterReading))) {
      throw err(
        "Enter the current (closing) electricity meter reading of the tenant's current room before completing the transfer.",
        400,
        "METER_READING_REQUIRED",
      );
    }
  }

  // 4. Recompute the canonical settlement at the REAL cutover.
  const preview = await computeRoomTransferPreview({
    reservationId,
    targetRoomId: String(record.destinationRoomId),
    effectiveTransferDate: record.effectiveTransferDate,
  });
  if (!preview) {
    throw err("The transfer settlement could not be computed. Review the tenant's billing/lease state.", 409, "OPERATIONAL_VALIDATION_FAILED");
  }
  const totalImmediateDue = roundMoney(Number(preview.totalImmediateDue) || 0);

  // 5. Settlement gate — the transfer-settlement Bill (rent + deposit) must be
  //    fully paid before the physical cutover. Unrelated historical balances
  //    are NOT merged here and do NOT block the cutover (spec §9).
  if (totalImmediateDue > 0) {
    const bill = await upsertTransferSettlementBill({ record, reservation, preview, actorId });
    const paid = roundMoney(Number(bill?.paidAmount || 0));
    const billTotal = roundMoney(Number(bill?.totalAmount || 0));

    if (!bill || paid + 0.01 < billTotal) {
      // Not settled yet — surface the Bill; admin settles via the normal
      // payment flow, then re-invokes Complete Transfer.
      await ScheduledRoomTransfer.updateOne(
        { _id: record._id, status: "scheduled" },
        { $set: { status: "action_required", lastError: "TRANSFER_BALANCE_UNPAID", lastAttemptAt: new Date() } },
      );
      const fresh = await ScheduledRoomTransfer.findById(record._id);
      return {
        outcome: "awaiting_settlement",
        reason: "TRANSFER_BALANCE_UNPAID",
        scheduledTransfer: fresh,
        bill,
        message:
          `Settle the Room Transfer balance of ₱${roundMoney(billTotal - paid).toFixed(2)} ` +
          `then complete the transfer.`,
      };
    }
    // Paid — but if the recomputed amount is HIGHER than what was paid, that is
    // a financial adjustment, not a completable state.
    if (billTotal + 0.01 < totalImmediateDue) {
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
        message: "The transfer settlement recomputed higher than the amount already paid. Settle the difference, then complete.",
      };
    }
  }

  // 6. Cutover — release the hold in its own tiny txn, then run the ONE
  //    canonical engine (no forceOverride; the settlement gate above is the
  //    only financial gate). The engine re-takes the slot/bed atomically and
  //    reuses the linked Bill.
  const reusableBillId = record.settlementBillId ? String(record.settlementBillId) : undefined;
  const depositHeldOverride = null; // Bill funds securityDepositHeld on payment; no pre-funding split needed here.

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
        depositHeldOverride: depositHeldOverride ?? undefined,
        __scheduledTransferId: String(record._id),
      },
      actorId,
    });
  } catch (e) {
    // The engine's own transaction rolled back every physical mutation.
    // Restore the destination hold so the admin's fix has a slot to land in.
    await restoreHoldOwnTxn(record).catch((re) =>
      logger.error({ err: re, scheduledTransferId: String(record._id) }, "[completeRoomTransfer] hold restore failed"),
    );
    await ScheduledRoomTransfer.updateOne(
      { _id: record._id },
      {
        $set: {
          status: "action_required",
          lastError: `EXECUTION_FAILED: ${e.code || e.message || "unknown"}`,
          lastAttemptAt: new Date(),
          holdApplied: true,
        },
      },
    );
    throw err(e.message || "The room transfer could not be completed.", e.statusCode || 500, e.code || "TRANSFER_COMPLETION_FAILED");
  }

  // 7. Success — record the executed settlement + flip to executed.
  const settlementBillId = transferResult?.billingSnapshot?.transferBillId || record.settlementBillId || null;
  const executedSettlement = {
    rentAdjustmentDue: roundMoney(transferResult?.billingSnapshot?.rentComponentDue ?? preview.rent?.adjustmentDue ?? 0),
    additionalDepositDue: roundMoney(transferResult?.billingSnapshot?.depositComponentDue ?? preview.deposit?.balanceDue ?? 0),
    excessRentCredit: roundMoney(transferResult?.billingSnapshot?.excessRentCredit ?? preview.rent?.excessCredit ?? 0),
    excessDepositHeld: roundMoney(transferResult?.billingSnapshot?.excessDepositHeld ?? preview.deposit?.excessHeld ?? 0),
    totalImmediateDue: roundMoney(transferResult?.billingSnapshot?.totalImmediateDue ?? totalImmediateDue),
    settlementBillId: settlementBillId ? String(settlementBillId) : null,
    sourceRoomMeterReading: sourceMeterReading != null ? Number(sourceMeterReading) : null,
    targetRoomMeterReading: targetMeterReading != null ? Number(targetMeterReading) : null,
    completedBy: actorId ? String(actorId) : null,
    computedAt: new Date(),
  };

  await ScheduledRoomTransfer.updateOne(
    { _id: record._id },
    {
      $set: {
        status: "executed",
        executedAt: new Date(),
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
