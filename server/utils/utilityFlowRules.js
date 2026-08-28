import {
  BILLABLE_RESERVATION_STATUS_QUERY,
  hasReservationStatus,
  isUtilityEventType,
  readMoveInDate,
  readMoveOutDate,
} from "./lifecycleNaming.js";

// ── Room-scoped occupancy boundaries (Phase 4) ─────────────────────────────
// A ROOM TRANSFER is not a dorm move-out: the Reservation's global
// moveInDate/moveOutDate keep describing the tenancy as a whole, so they
// cannot express "this tenant occupied THIS room only between X and Y".
// BedHistory already records exactly that, per (roomId, reservationId), and
// is written atomically inside the transfer transaction (status:"transferred"
// + effectiveEndDate on the old room, a fresh status:"active" row with
// moveInDate = transfer date on the new room). The utility close/recompute
// path stamps each reservation it is about to bill with the matching
// BedHistory row's boundaries as `_roomScopedMoveInDate` /
// `_roomScopedMoveOutDate`; these readers prefer that stamp and fall back to
// the global reservation dates when it is absent (a tenant with no
// BedHistory row for the room — e.g. a private-room move-in, which today
// does not create one — is unaffected).
export const readRoomScopedMoveInDate = (reservation) =>
  reservation?._roomScopedMoveInDate ?? readMoveInDate(reservation);

export const readRoomScopedMoveOutDate = (reservation) =>
  reservation?._roomScopedMoveOutDate ?? readMoveOutDate(reservation);

const WATER_BILLABLE_ROOM_TYPES = new Set([
  "private",
  "double-sharing",
]);

const BILLABLE_RESERVATION_STATUSES = new Set(BILLABLE_RESERVATION_STATUS_QUERY);

function startOfDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTenantKey(value) {
  if (!value) return null;
  return String(value._id || value);
}

function fallsWithinCycle(dateValue, cycleStart, cycleEnd) {
  const date = startOfDay(dateValue);
  const start = startOfDay(cycleStart);
  const end = startOfDay(cycleEnd);

  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

/**
 * Strictly within cycle — date is AFTER start and ON or BEFORE end.
 * Used for move-in checks: tenants who moved in ON the cycle start date
 * are treated as "already present" and don't need a separate move-in reading.
 */
function fallsStrictlyAfterCycleStart(dateValue, cycleStart, cycleEnd) {
  const date = startOfDay(dateValue);
  const start = startOfDay(cycleStart);
  const end = startOfDay(cycleEnd);

  if (!date || !start || !end) return false;
  return date > start && date <= end;
}

function isSameDay(left, right) {
  const l = startOfDay(left);
  const r = startOfDay(right);
  if (!l || !r) return false;
  return l.getTime() === r.getTime();
}

function getBedKey(reservation) {
  const selectedBed = reservation?.selectedBed;
  if (!selectedBed) return null;
  return String(selectedBed.id || selectedBed.position || "").trim() || null;
}

function overlapRange(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function isWaterBillableRoom(roomOrType) {
  const roomType =
    typeof roomOrType === "string" ? roomOrType : roomOrType?.type;
  return WATER_BILLABLE_ROOM_TYPES.has(roomType);
}

export function filterBillableReservationsForPeriod({
  reservations = [],
  cycleStart,
  cycleEnd,
} = {}) {
  const start = startOfDay(cycleStart);
  const end = startOfDay(cycleEnd);
  if (!start || !end) return [];

  return reservations.filter((reservation) => {
    if (!reservation?.userId) return false;
    if (!BILLABLE_RESERVATION_STATUSES.has(reservation.status)) return false;

    // Room-scoped: for a transferred tenant these are the BedHistory
    // boundaries for THIS room, not the whole-tenancy dates.
    const checkInDate = startOfDay(readRoomScopedMoveInDate(reservation));
    const checkOutDate = startOfDay(readRoomScopedMoveOutDate(reservation));
    if (!checkInDate || checkInDate >= end) return false;
    if (checkOutDate && checkOutDate <= start) return false;
    return true;
  });
}

export function findMissingElectricityLifecycleReadings({
  period,
  reservations = [],
  readings = [],
} = {}) {
  const cycleReservations = filterBillableReservationsForPeriod({
    reservations,
    cycleStart: period?.startDate,
    cycleEnd: period?.endDate,
  });

  const moveInReadingsByTenant = new Map();
  const moveOutReadingsByTenant = new Map();

  for (const reading of readings) {
    const tenantKey = getTenantKey(reading?.tenantId);
    if (!tenantKey) continue;

    if (isUtilityEventType(reading.eventType, "moveIn")) {
      const arr = moveInReadingsByTenant.get(tenantKey) || [];
      arr.push(reading);
      moveInReadingsByTenant.set(tenantKey, arr);
    }

    if (isUtilityEventType(reading.eventType, "moveOut")) {
      const arr = moveOutReadingsByTenant.get(tenantKey) || [];
      arr.push(reading);
      moveOutReadingsByTenant.set(tenantKey, arr);
    }
  }

  const missingMoveInReadings = [];
  const missingMoveOutReadings = [];

  for (const reservation of cycleReservations) {
    const tenantKey = getTenantKey(reservation.userId);
    if (!tenantKey) continue;

    const tenantName = reservation.userId?.firstName
      ? `${reservation.userId.firstName || ""} ${reservation.userId.lastName || ""}`.trim()
      : "Tenant";

    const tenantMoveInReadings = moveInReadingsByTenant.get(tenantKey) || [];
    const scopedMoveIn = readRoomScopedMoveInDate(reservation);
    if (
      fallsStrictlyAfterCycleStart(
        scopedMoveIn,
        period?.startDate,
        period?.endDate,
      ) &&
      !tenantMoveInReadings.some((entry) => isSameDay(entry.date, scopedMoveIn))
    ) {
      missingMoveInReadings.push({
        reservationId: reservation._id,
        tenantId: tenantKey,
        tenantName,
        moveInDate: scopedMoveIn,
        reason: "missing exact-date move-in reading",
      });
    }

    const tenantMoveOutReadings = moveOutReadingsByTenant.get(tenantKey) || [];
    const scopedMoveOut = readRoomScopedMoveOutDate(reservation);
    // A room transfer stamps _roomScopedMoveOutDate for this room even though
    // the tenancy has NOT moved out of the dorm — so the exact-date move-out
    // reading is required whenever a room-scoped move-out date lands in the
    // cycle, not only when the reservation status is "moveOut".
    const endsInThisRoomDuringCycle =
      (hasReservationStatus(reservation.status, "moveOut") ||
        reservation?._roomScopedMoveOutDate != null) &&
      fallsWithinCycle(scopedMoveOut, period?.startDate, period?.endDate);
    if (
      endsInThisRoomDuringCycle &&
      !tenantMoveOutReadings.some((entry) => isSameDay(entry.date, scopedMoveOut))
    ) {
      missingMoveOutReadings.push({
        reservationId: reservation._id,
        tenantId: tenantKey,
        tenantName,
        moveOutDate: scopedMoveOut,
        reason: "missing exact-date move-out reading",
      });
    }
  }

  return {
    missingMoveInReadings,
    missingMoveOutReadings,
    hasMissingReadings:
      missingMoveInReadings.length > 0 || missingMoveOutReadings.length > 0,
  };
}

export function buildTenantEventsForPeriod({
  period,
  reservations = [],
  readings = [],
} = {}) {
  const cycleReservations = filterBillableReservationsForPeriod({
    reservations,
    cycleStart: period?.startDate,
    cycleEnd: period?.endDate,
  });

  const moveInReadingsByTenant = new Map();
  const moveOutReadingsByTenant = new Map();

  for (const reading of readings) {
    const tenantKey = getTenantKey(reading?.tenantId);
    if (!tenantKey) continue;

    if (isUtilityEventType(reading.eventType, "moveIn")) {
      const existing = moveInReadingsByTenant.get(tenantKey);
      if (!existing || new Date(reading.date) < new Date(existing.date)) {
        moveInReadingsByTenant.set(tenantKey, reading);
      }
    }

    if (isUtilityEventType(reading.eventType, "moveOut")) {
      const existing = moveOutReadingsByTenant.get(tenantKey);
      if (!existing || new Date(reading.date) > new Date(existing.date)) {
        moveOutReadingsByTenant.set(tenantKey, reading);
      }
    }
  }

  return cycleReservations
    .map((reservation) => {
      const tenantKey = getTenantKey(reservation.userId);
      if (!tenantKey) return null;

      const tenantName = reservation.userId?.firstName
        ? `${reservation.userId.firstName || ""} ${reservation.userId.lastName || ""}`.trim()
        : "Tenant";
      const moveInReading = moveInReadingsByTenant.get(tenantKey)?.reading;
      const moveOutReading = moveOutReadingsByTenant.get(tenantKey)?.reading;
      // Room-scoped: a tenant who TRANSFERRED INTO this room mid-period has a
      // whole-tenancy moveInDate before the cycle, but their occupancy of
      // THIS room starts at the transfer date — so they must NOT be treated
      // as "present from the period start reading".
      const checkInDay = startOfDay(readRoomScopedMoveInDate(reservation));
      const cycleStartDay = startOfDay(period?.startDate);
      const checkedInBeforeCycle =
        checkInDay && cycleStartDay && checkInDay <= cycleStartDay;

      // Explicit room-scoped occupancy bounds (populated only for a tenant
      // stamped with _roomScopedMoveInDate/_roomScopedMoveOutDate by the
      // utility close). The billing engine's gap-fallback uses these to avoid
      // charging a transferred tenant for consumption outside their occupancy
      // of THIS room. Null for a normal tenant -> engine behaviour unchanged.
      const roomScopedFromReading =
        reservation?._roomScopedMoveInDate != null
          ? (checkedInBeforeCycle
              ? Number(period?.startReading || 0)
              : (moveInReading ?? null))
          : null;
      const roomScopedToReading =
        reservation?._roomScopedMoveOutDate != null ? (moveOutReading ?? null) : null;

      return {
        tenantId: tenantKey,
        reservationId: reservation._id,
        tenantName,
        moveInReading: checkedInBeforeCycle
          ? Number(period?.startReading || 0)
          : (moveInReading ?? null),
        moveOutReading: moveOutReading ?? null,
        roomScopedFromReading,
        roomScopedToReading,
      };
    })
    .filter(
      (entry) =>
        entry &&
        entry.moveInReading !== null &&
        entry.moveInReading !== undefined,
    );
}

export function findBedOccupancyOverlaps({
  reservations = [],
  cycleStart,
  cycleEnd,
} = {}) {
  const cycleReservations = filterBillableReservationsForPeriod({
    reservations,
    cycleStart,
    cycleEnd,
  });

  const start = startOfDay(cycleStart);
  const end = startOfDay(cycleEnd);
  if (!start || !end) {
    return { hasOverlaps: false, overlaps: [] };
  }

  const byBed = new Map();
  for (const reservation of cycleReservations) {
    const bedKey = getBedKey(reservation);
    if (!bedKey) continue;

    const effectiveStart = startOfDay(readRoomScopedMoveInDate(reservation));
    const rawEnd = startOfDay(readRoomScopedMoveOutDate(reservation)) || end;
    if (!effectiveStart) continue;

    const overlapStart = effectiveStart > start ? effectiveStart : start;
    const overlapEnd = rawEnd < end ? rawEnd : end;
    if (overlapStart >= overlapEnd) continue;

    const bucket = byBed.get(bedKey) || [];
    bucket.push({
      reservationId: reservation._id,
      tenantId: getTenantKey(reservation.userId),
      tenantName: reservation.userId?.firstName
        ? `${reservation.userId.firstName || ""} ${reservation.userId.lastName || ""}`.trim()
        : "Tenant",
      bedKey,
      start: overlapStart,
      end: overlapEnd,
    });
    byBed.set(bedKey, bucket);
  }

  const overlaps = [];
  for (const [bedKey, entries] of byBed.entries()) {
    entries.sort((a, b) => a.start - b.start);
    for (let i = 0; i < entries.length - 1; i++) {
      const current = entries[i];
      const next = entries[i + 1];
      if (overlapRange(current.start, current.end, next.start, next.end)) {
        overlaps.push({
          bedKey,
          firstReservationId: current.reservationId,
          firstTenantId: current.tenantId,
          firstTenantName: current.tenantName,
          firstStart: current.start,
          firstEnd: current.end,
          secondReservationId: next.reservationId,
          secondTenantId: next.tenantId,
          secondTenantName: next.tenantName,
          secondStart: next.start,
          secondEnd: next.end,
        });
      }
    }
  }

  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
  };
}

/**
 * Validate a raw meter reading sequence and return typed issues.
 * Does NOT throw — returns structured issues so callers can decide
 * whether to block or warn.
 *
 * Issue codes:
 *   NEGATIVE_DELTA        — a reading is lower than the previous one
 *   DUPLICATE_TIMESTAMP   — two readings share the same date + eventType
 *   MISSING_BOUNDARY      — readings array is empty or has fewer than 2 entries
 *
 * @param {Array<{ reading: number, date: Date|string, eventType?: string }>} readings
 * @returns {{ valid: boolean, issues: Array<{ code: string, detail: string, index?: number }> }}
 */
export function validateMeterSequence(readings = []) {
  const issues = [];

  if (!Array.isArray(readings) || readings.length === 0) {
    issues.push({ code: "MISSING_BOUNDARY", detail: "No readings provided." });
    return { valid: false, issues };
  }

  if (readings.length < 2) {
    issues.push({
      code: "MISSING_BOUNDARY",
      detail: "At least two readings (period start and period end) are required.",
    });
    return { valid: false, issues };
  }

  // Sort by date ascending for sequential validation
  const sorted = [...readings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Check for duplicate timestamps (same date + same eventType)
  const seen = new Map();
  for (const reading of sorted) {
    const key = `${new Date(reading.date).getTime()}:${reading.eventType || ""}`;
    if (seen.has(key)) {
      issues.push({
        code: "DUPLICATE_TIMESTAMP",
        detail: `Duplicate reading at ${reading.date} (eventType: ${reading.eventType || "unknown"}).`,
      });
    } else {
      seen.set(key, true);
    }
  }

  // Check for negative deltas
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const delta = Number(curr.reading) - Number(prev.reading);
    if (delta < 0) {
      issues.push({
        code: "NEGATIVE_DELTA",
        detail: `Reading at index ${i} (${curr.reading}) is lower than index ${i - 1} (${prev.reading}). Possible meter reset.`,
        index: i,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export { WATER_BILLABLE_ROOM_TYPES };
