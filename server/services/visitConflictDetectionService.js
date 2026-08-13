import { Reservation, Room } from "../models/index.js";
import { reservationStatusesForQuery } from "../utils/lifecycleNaming.js";
import { toDateKey, getDateRangeForKey } from "../utils/visitAvailability.js";

const ACTIVE_VISIT_STATUSES = reservationStatusesForQuery(
  "pending",
  "viewing_preference_selected",
  "visit_pending",
  "visit_approved",
);

/**
 * Format a reservation document into a structured affected detail item.
 */
const formatAffectedReservation = (res) => ({
  reservationId: res._id,
  tenantName: res.tenantName || res.fullName || "Applicant",
  visitDate: toDateKey(res.visitDate),
  visitSlot: res.visitTime || res.visitSlot || "N/A",
  status: res.status || "pending",
  userEmail: res.email || res.userEmail || "",
  userPhone: res.phone || res.userPhone || "",
});

/**
 * Detects reservations that conflict with proposed availability rule changes.
 *
 * @param {string} branch - Branch identifier (e.g., "gil-puyat", "guadalupe")
 * @param {object} proposedChanges - New draft settings payload
 * @param {object} currentSettings - Active settings from DB
 * @param {object} [options] - Config options ({ lookaheadDays })
 * @returns {Promise<{ hasConflicts: boolean, totalAffected: number, conflicts: Array }>}
 */
export async function detectVisitConflicts(
  branch,
  proposedChanges,
  currentSettings,
  options = {},
) {
  const lookaheadDays = options.lookaheadDays || 60;
  const conflicts = [];

  const roomIds = await Room.find({ branch }).distinct("_id");
  const branchFilter =
    roomIds.length > 0
      ? { $or: [{ branch }, { roomId: { $in: roomIds } }] }
      : { branch };

  const baseQuery = {
    ...branchFilter,
    status: { $in: ACTIVE_VISIT_STATUSES },
    isArchived: { $ne: true },
  };

  // 1. Detect blackout date additions
  const currentBlackoutKeys = new Set(
    (currentSettings?.blackoutDates || []).map((b) =>
      typeof b === "string" ? b : b.date,
    ),
  );
  const newBlackouts = (proposedChanges?.blackoutDates || []).filter((b) => {
    const key = typeof b === "string" ? b : b.date;
    return key && !currentBlackoutKeys.has(key);
  });

  if (newBlackouts.length > 0) {
    const newBlackoutKeys = newBlackouts.map((b) =>
      typeof b === "string" ? b : b.date,
    );

    const dateConditions = newBlackoutKeys
      .map((key) => {
        const range = getDateRangeForKey(key);
        return range
          ? { visitDate: { $gte: range.start, $lt: range.end } }
          : null;
      })
      .filter(Boolean);

    if (dateConditions.length > 0) {
      const blackoutReservations = await Reservation.find({
        ...baseQuery,
        $or: dateConditions,
      })
        .select(
          "_id tenantName fullName visitDate visitTime visitSlot status email userEmail phone userPhone",
        )
        .lean();

      if (blackoutReservations.length > 0) {
        conflicts.push({
          type: "blackout_date_conflict",
          trigger: `Added blackout date(s): ${newBlackoutKeys.join(", ")}`,
          affectedCount: blackoutReservations.length,
          affectedDates: newBlackoutKeys,
          reservations: blackoutReservations.map(formatAffectedReservation),
        });
      }
    }
  }

  // 2. Detect removed weekday conflicts
  const currentWeekdays = currentSettings?.enabledWeekdays || [1, 2, 3, 4, 5];
  const proposedWeekdays = proposedChanges?.enabledWeekdays || [];
  const removedWeekdays = currentWeekdays.filter(
    (day) => !proposedWeekdays.includes(day),
  );

  if (removedWeekdays.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lookaheadDate = new Date(today);
    lookaheadDate.setDate(lookaheadDate.getDate() + lookaheadDays);

    const upcomingReservations = await Reservation.find({
      ...baseQuery,
      visitDate: { $gte: today, $lt: lookaheadDate },
    })
      .select(
        "_id tenantName fullName visitDate visitTime visitSlot status email userEmail phone userPhone",
      )
      .lean();

    const affectedByWeekday = upcomingReservations.filter((res) => {
      if (!res.visitDate) return false;
      const dateObj =
        res.visitDate instanceof Date ? res.visitDate : new Date(res.visitDate);
      const dayOfWeek = dateObj.getDay();
      return removedWeekdays.includes(dayOfWeek);
    });

    if (affectedByWeekday.length > 0) {
      const weekdayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const removedNames = removedWeekdays
        .map((d) => weekdayNames[d] ?? d)
        .join(", ");

      conflicts.push({
        type: "weekday_removal_conflict",
        trigger: `Disabled operating weekday(s): ${removedNames}`,
        affectedCount: affectedByWeekday.length,
        removedWeekdays,
        reservations: affectedByWeekday.map(formatAffectedReservation),
      });
    }
  }

  // 3. Detect slot disablement conflicts
  const currentSlots = currentSettings?.slots || [];
  const proposedSlots = proposedChanges?.slots || [];

  const disabledSlotLabels = currentSlots
    .filter((cSlot) => {
      if (!cSlot.enabled) return false;
      const pSlot = proposedSlots.find((s) => s.label === cSlot.label);
      return pSlot && !pSlot.enabled;
    })
    .map((s) => s.label);

  if (disabledSlotLabels.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const affectedSlotReservations = await Reservation.find({
      ...baseQuery,
      visitDate: { $gte: today },
      $or: [
        { visitTime: { $in: disabledSlotLabels } },
        { visitSlot: { $in: disabledSlotLabels } },
      ],
    })
      .select(
        "_id tenantName fullName visitDate visitTime visitSlot status email userEmail phone userPhone",
      )
      .lean();

    if (affectedSlotReservations.length > 0) {
      conflicts.push({
        type: "slot_disabled_conflict",
        trigger: `Disabled time slot(s): ${disabledSlotLabels.join(", ")}`,
        affectedCount: affectedSlotReservations.length,
        disabledSlots: disabledSlotLabels,
        reservations: affectedSlotReservations.map(formatAffectedReservation),
      });
    }
  }

  const totalAffected = conflicts.reduce(
    (sum, c) => sum + c.affectedCount,
    0,
  );

  return {
    hasConflicts: conflicts.length > 0,
    totalAffected,
    conflicts,
  };
}
