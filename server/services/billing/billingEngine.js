/**
 * ============================================================================
 * UNIFIED BILLING ENGINE SERVICE
 * ============================================================================
 *
 * Computes billing costs for UtilityPeriods (Electricity and Water).
 * Uses a Hybrid Strategy:
 * 1. Segment-Based Math: If intermediate readings (move-in/out) exist,
 *    calculates precise costs per reading gap.
 * 2. Graceful Proration Fallback: If no intermediate readings exist,
 *    splits the total cost by calendar days stayed (overlap days).
 */

import dayjs from "dayjs";
import {
  isUtilityEventType,
  readMoveInDate,
  readMoveOutDate,
} from "../../utils/lifecycleNaming.js";
import {
  toCents,
  toPesos,
  hamiltonAllocate,
  verifyReconciliation,
} from "./financialMath.js";

export const truncate4 = (n) => Math.floor(n * 10000) / 10000;
/** @deprecated Use toPesos/toCents from financialMath.js */
export const roundMoney = (n) => Math.round(n * 100) / 100;

const WATER_SHARED_ROOM_TYPES = new Set([
  "double-sharing",
  "quadruple-sharing",
]);

function normalizeRoomType(roomType) {
  return String(roomType || "")
    .trim()
    .toLowerCase();
}

function formatDurationRange(checkInDate, checkOutDate) {
  if (!checkInDate) return "Ongoing";

  const startLabel = dayjs(checkInDate).format("MMM D, YYYY");
  const endLabel = checkOutDate
    ? dayjs(checkOutDate).format("MMM D, YYYY")
    : "Ongoing";
  return `${startLabel} - ${endLabel}`;
}

function getReservationOverlapDays(reservation, cycleStart, cycleEnd) {
  const moveInDate = readMoveInDate(reservation);
  if (!moveInDate) return 0;

  const cycleStartDay = dayjs(cycleStart).startOf("day");
  const cycleEndDay = dayjs(cycleEnd).startOf("day");
  const moveInDay = dayjs(moveInDate).startOf("day");
  const moveOutDay = dayjs(readMoveOutDate(reservation) || cycleEnd).startOf("day");

  const effectiveStart = moveInDay.isAfter(cycleStartDay)
    ? moveInDay
    : cycleStartDay;
  const effectiveEnd = moveOutDay.isBefore(cycleEndDay)
    ? moveOutDay
    : cycleEndDay;

  if (!effectiveStart.isValid() || !effectiveEnd.isValid()) return 0;
  if (!effectiveStart.isBefore(effectiveEnd)) return 0;
  return effectiveEnd.diff(effectiveStart, "day");
}

function buildWaterOccupancyBilling({
  utilityPeriod,
  reservations = [],
  roomType = null,
}) {
  const cycleStart = utilityPeriod?.startDate;
  const cycleEnd = utilityPeriod?.endDate || utilityPeriod?.startDate;
  const totalWaterCharge = truncate4(Number(utilityPeriod?.ratePerUnit || 0));
  const normalizedRoomType = normalizeRoomType(roomType);
  const sharedRoom = WATER_SHARED_ROOM_TYPES.has(normalizedRoomType);

  const buckets = new Map();
  for (const reservation of reservations) {
    const coveredDays = getReservationOverlapDays(
      reservation,
      cycleStart,
      cycleEnd,
    );
    if (coveredDays <= 0) continue;

    const tenantKey = String(
      reservation.userId?._id || reservation.userId || "",
    );
    if (!tenantKey) continue;

    const bucket = buckets.get(tenantKey) || {
      tenantId: tenantKey,
      reservationId: reservation._id || null,
      tenantName: reservation.userId?.firstName
        ? `${reservation.userId.firstName || ""} ${reservation.userId.lastName || ""}`.trim()
        : "Tenant",
      tenantEmail:
        reservation.userId?.email || reservation.billingEmail || null,
      coveredDays: 0,
      firstCheckInDate: readMoveInDate(reservation),
      lastCheckOutDate: readMoveOutDate(reservation),
      overlapStart: readMoveInDate(reservation),
      overlapEnd: readMoveOutDate(reservation),
    };

    bucket.coveredDays += coveredDays;
    if (
      bucket.overlapStart === null ||
      (readMoveInDate(reservation) &&
        new Date(readMoveInDate(reservation)) < new Date(bucket.overlapStart))
    ) {
      bucket.overlapStart = readMoveInDate(reservation) || bucket.overlapStart;
      bucket.firstCheckInDate =
        readMoveInDate(reservation) || bucket.firstCheckInDate;
    }
    if (
      !bucket.overlapEnd ||
      (readMoveOutDate(reservation) &&
        new Date(readMoveOutDate(reservation)) > new Date(bucket.overlapEnd))
    ) {
      bucket.overlapEnd = readMoveOutDate(reservation) || bucket.overlapEnd;
      bucket.lastCheckOutDate =
        readMoveOutDate(reservation) || bucket.lastCheckOutDate;
    }

    buckets.set(tenantKey, bucket);
  }

  const tenantRows = [...buckets.values()].sort((left, right) => {
    const leftDate = new Date(
      left.overlapStart || left.firstCheckInDate || 0,
    ).getTime();
    const rightDate = new Date(
      right.overlapStart || right.firstCheckInDate || 0,
    ).getTime();
    return leftDate - rightDate;
  });

  const totalCoveredDays = tenantRows.reduce(
    (sum, row) => sum + row.coveredDays,
    0,
  );
  const useFixedPrivateRule = !sharedRoom && tenantRows.length === 1;

  const tenantSummaries = tenantRows.map((row) => {
    const shareFactor = useFixedPrivateRule
      ? 1
      : totalCoveredDays > 0
        ? row.coveredDays / totalCoveredDays
        : 0;

    return {
      tenantId: row.tenantId,
      reservationId: row.reservationId,
      tenantName: row.tenantName,
      tenantEmail: row.tenantEmail,
      totalUsage: truncate4(row.coveredDays),
      coveredDays: truncate4(row.coveredDays),
      shareFactor: truncate4(shareFactor),
      allocationRule: useFixedPrivateRule
        ? "private-fixed"
        : "shared-prorated-days",
      billingBasis: "occupancy-overlap",
      overlapStart: row.overlapStart,
      overlapEnd: row.overlapEnd,
      durationRange: formatDurationRange(
        row.firstCheckInDate,
        row.lastCheckOutDate,
      ),
      billAmount: useFixedPrivateRule
        ? totalWaterCharge
        : truncate4(totalWaterCharge * shareFactor),
    };
  });

  if (!useFixedPrivateRule && tenantSummaries.length > 0) {
    const totalCents = Math.max(0, Math.round(totalWaterCharge * 100));
    const rawShares = tenantRows.map((row) => {
      const shareFactor =
        totalCoveredDays > 0 ? row.coveredDays / totalCoveredDays : 0;
      return shareFactor * totalCents;
    });
    const baseShares = rawShares.map(Math.floor);
    let remainder =
      totalCents - baseShares.reduce((sum, cents) => sum + cents, 0);
    const fractionals = rawShares.map((raw, index) => ({
      index,
      frac: raw - baseShares[index],
      days: tenantSummaries[index].coveredDays || 0,
    }));
    fractionals.sort((left, right) => {
      if (right.frac !== left.frac) return right.frac - left.frac;
      if (right.days !== left.days) return right.days - left.days;
      return left.index - right.index;
    });
    for (let i = 0; i < remainder; i += 1) {
      baseShares[fractionals[i].index] += 1;
    }
    tenantSummaries.forEach((summary, index) => {
      summary.billAmount = baseShares[index] / 100;
    });
  }

  const sumTenantCharges = tenantSummaries.reduce(
    (sum, entry) => sum + Number(entry.billAmount || 0),
    0,
  );

  return {
    strategy: "occupancy-day-proration",
    segments: [],
    tenantSummaries,
    computedTotalUsage: truncate4(totalCoveredDays),
    computedTotalCost: totalWaterCharge,
    verified:
      Math.abs(sumTenantCharges - totalWaterCharge) <= 0.01 ||
      totalWaterCharge === 0,
  };
}

export function sortReadings(readings) {
  const eventPriority = {
    moveOut: 0,
    regularBilling: 1,
    periodStart: 1,
    periodEnd: 1,
    manualAdjustment: 1,
    moveIn: 2,
  };
  return [...readings].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) return dateA - dateB;

    const typePriorityDelta =
      (eventPriority[a.eventType] || 1) - (eventPriority[b.eventType] || 1);
    if (typePriorityDelta !== 0) return typePriorityDelta;

    const createdAtA = new Date(a.createdAt || 0).getTime();
    const createdAtB = new Date(b.createdAt || 0).getTime();
    if (createdAtA !== createdAtB) return createdAtA - createdAtB;

    const readingA = Number(a.reading || 0);
    const readingB = Number(b.reading || 0);
    if (readingA !== readingB) return readingA - readingB;

    return String(a._id || "").localeCompare(String(b._id || ""));
  });
}

function getActiveTenantsForSegment(segmentStartReading, tenantEvents) {
  return tenantEvents.filter((t) => {
    const movedIn = t.moveInReading <= segmentStartReading;
    const notMovedOut =
      t.moveOutReading === null ||
      t.moveOutReading === undefined ||
      t.moveOutReading > segmentStartReading;
    return movedIn && notMovedOut;
  });
}

function formatPeriodLabel(start, end) {
  const opts = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-US", opts);
  const e = end.toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

/**
 * Detect duplicate timestamps in the reading sequence.
 * Returns an array of { date, eventType } objects for duplicates.
 * @param {Array} sortedReadings
 * @returns {{ date: Date, eventType: string }[]}
 */
export function detectDuplicateTimestamps(sortedReadings) {
  const seen = new Map();
  const duplicates = [];
  for (const reading of sortedReadings) {
    const key = `${new Date(reading.date).getTime()}:${reading.eventType || ""}`;
    if (seen.has(key)) {
      duplicates.push({ date: new Date(reading.date), eventType: reading.eventType });
    } else {
      seen.set(key, true);
    }
  }
  return duplicates;
}

export function buildSegments(sortedReadings, tenantEvents) {
  if (!sortedReadings || sortedReadings.length < 2) return [];

  // Phase 2: Detect duplicate timestamps before building segments
  const duplicates = detectDuplicateTimestamps(sortedReadings);
  if (duplicates.length > 0) {
    const detail = duplicates.map((d) => `${d.eventType}@${dayjs(d.date).format("YYYY-MM-DD")}`).join(", ");
    throw new Error(
      `DUPLICATE_TIMESTAMP: Duplicate meter reading timestamps detected: ${detail}. Remove duplicates before computing billing.`,
    );
  }

  const segments = [];
  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const startReading = sortedReadings[i];
    const endReading = sortedReadings[i + 1];

    const readingFrom = startReading.reading;
    const readingTo = endReading.reading;
    const unitsConsumed = readingTo - readingFrom;

    if (unitsConsumed < 0) {
      throw new Error(
        `NEGATIVE_DELTA: Invalid reading sequence: reading ${readingTo} is lower than ${readingFrom} (segment ${i + 1}). Possible meter reset — flag for admin review.`,
      );
    }

    const activeTenants = getActiveTenantsForSegment(readingFrom, tenantEvents);
    segments.push({
      segmentIndex: i,
      periodLabel: formatPeriodLabel(
        new Date(startReading.date),
        new Date(endReading.date),
      ),
      readingFrom,
      readingTo,
      unitsConsumed,
      activeTenantIds: activeTenants.map((t) => t.tenantId),
      coveredTenantNames: activeTenants.map((t) => t.tenantName),
      activeTenantCount: activeTenants.length,
      startDate: new Date(startReading.date),
      endDate: new Date(endReading.date),
      startEventType: startReading.eventType || "regularBilling",
      endEventType: endReading.eventType || "regularBilling",
    });
  }
  return segments;
}

export function computeSegmentShares(segment, ratePerUnit) {
  const { unitsConsumed, activeTenantCount } = segment;

  if (unitsConsumed === 0) {
    return { sharePerTenantUnits: 0, sharePerTenantCost: 0, totalCost: 0 };
  }

  // Phase 2: Zero-occupancy with consumption is an explicit anomaly, not a silent zero.
  if (activeTenantCount === 0) {
    return {
      sharePerTenantUnits: 0,
      sharePerTenantCost: 0,
      totalCost: 0,
      exception: "ZERO_OCCUPANCY_WITH_CONSUMPTION",
      exceptionDetail: `Segment consumed ${unitsConsumed} kWh but has no active tenants. Flag for admin review.`,
    };
  }

  const totalCost = truncate4(unitsConsumed * ratePerUnit);

  if (activeTenantCount === 1) {
    return {
      sharePerTenantUnits: unitsConsumed,
      sharePerTenantCost: totalCost,
      totalCost,
    };
  }

  // Phase 1: Use Hamilton cent allocation for multi-tenant splits
  // (equal weights per tenant — units are split evenly)
  const equalWeights = Array(activeTenantCount).fill(1);
  const totalCostCents = toCents(totalCost);
  const tieKeys = segment.activeTenantIds.map(String);
  const centShares = hamiltonAllocate(totalCostCents, equalWeights, tieKeys);

  const unitShare = truncate4(unitsConsumed / activeTenantCount);
  // Cost per tenant derived from Hamilton cents (ensures sum === totalCost exactly)
  const sharePerTenantCost = toPesos(centShares[0]); // representative; per-tenant costs in segments array

  return {
    sharePerTenantUnits: unitShare,
    sharePerTenantCost,
    totalCost,
    // Expose the per-tenant cent shares for aggregation
    _centSharesByTenantIndex: centShares,
  };
}

export function calculateOverlapDays(
  checkInDate,
  checkOutDate,
  cycleStart,
  cycleEnd,
) {
  const start = Math.max(
    dayjs(checkInDate).startOf("day").valueOf(),
    dayjs(cycleStart).startOf("day").valueOf(),
  );
  const end = Math.min(
    dayjs(checkOutDate || cycleEnd)
      .startOf("day")
      .valueOf(),
    dayjs(cycleEnd).startOf("day").valueOf(),
  );

  if (start >= end) return 0;
  return dayjs(end).diff(dayjs(start), "day");
}

function distributeCents(totalAmount, recipientCount) {
  if (recipientCount <= 0) return [];

  const totalCents = Math.max(0, Math.round(Number(totalAmount || 0) * 100));
  const baseShare = Math.floor(totalCents / recipientCount);
  let remainder = totalCents - baseShare * recipientCount;

  return Array.from({ length: recipientCount }, () => {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return share;
  });
}

export function buildProratedShareAmounts(
  totalAmount,
  reservations,
  cycleStart,
  cycleEnd,
) {
  if (reservations.length === 0) return [];

  const tenantDaysArray = reservations.map((res) =>
    calculateOverlapDays(
      readMoveInDate(res),
      readMoveOutDate(res),
      cycleStart,
      cycleEnd,
    ),
  );

  const totalDays = tenantDaysArray.reduce((sum, days) => sum + days, 0);

  if (totalDays <= 0) {
    return distributeCents(totalAmount, reservations.length).map(
      (cents) => cents / 100,
    );
  }

  const totalCents = Math.max(0, Math.round(Number(totalAmount || 0) * 100));
  const rawShares = tenantDaysArray.map(
    (days) => (days / totalDays) * totalCents,
  );
  const baseShares = rawShares.map(Math.floor);

  let remainder = totalCents - baseShares.reduce((a, b) => a + b, 0);
  const fractionals = rawShares.map((raw, index) => ({
    index,
    frac: raw - baseShares[index],
  }));
  fractionals.sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i++) {
    baseShares[fractionals[i].index] += 1;
  }

  return baseShares.map((cents) => cents / 100);
}

export function computeBilling({
  utilityPeriod,
  readings = [],
  reservations = [],
  tenantEvents = [],
  forceSegmented = false,
  utilityType = "electricity",
  roomType = null,
}) {
  const { startDate, endDate, startReading, endReading, ratePerUnit } =
    utilityPeriod;
  if (utilityType === "water") {
    return buildWaterOccupancyBilling({
      utilityPeriod,
      reservations,
      roomType,
    });
  }

  const totalUnits = endReading - startReading;
  const totalCost = truncate4(totalUnits * ratePerUnit);

  const intermediateReadings = readings.filter(
    (r) =>
      isUtilityEventType(r.eventType, "moveIn") ||
      isUtilityEventType(r.eventType, "moveOut"),
  );

  if (forceSegmented || intermediateReadings.length > 0) {
    const sorted = sortReadings(readings);
    const rawSegments = buildSegments(sorted, tenantEvents);

    if (forceSegmented && rawSegments.length === 0) {
      throw new Error(
        "Cannot compute segmented billing without at least two ordered meter events (period start and period end).",
      );
    }

    const allPeriodTenantIds = tenantEvents.map((t) => t.tenantId);
    const segmentExceptions = [];

    const computedSegments = rawSegments.map((seg) => {
      let activeTenantIds = seg.activeTenantIds;
      let activeTenantCount = seg.activeTenantCount;
      let coveredTenantNames = seg.coveredTenantNames;

      // Fallback for vacant/gap segments: if segment has consumption but 0 native active tenants,
      // attribute consumption to the period's active occupants if available.
      if (
        seg.unitsConsumed > 0 &&
        activeTenantCount === 0 &&
        allPeriodTenantIds.length > 0
      ) {
        activeTenantIds = allPeriodTenantIds;
        activeTenantCount = allPeriodTenantIds.length;
        coveredTenantNames = tenantEvents.map((t) => t.tenantName);
      }

      if (seg.unitsConsumed > 0 && activeTenantCount === 0) {
        // Phase 2: Zero occupancy with consumption — explicit exception.
        const excDetail = `Segment ${seg.segmentIndex + 1}: ${seg.unitsConsumed} kWh consumed but no active tenants.`;
        segmentExceptions.push({ code: "ZERO_OCCUPANCY_WITH_CONSUMPTION", detail: excDetail });
        if (forceSegmented) {
          throw new Error(
            `ZERO_OCCUPANCY_WITH_CONSUMPTION: ${excDetail} Check occupancy and lifecycle meter events.`,
          );
        }
      }

      const segmentWithTenants = {
        ...seg,
        activeTenantIds,
        activeTenantCount,
        coveredTenantNames,
      };

      const shares = computeSegmentShares(segmentWithTenants, ratePerUnit);
      // Propagate exception from computeSegmentShares
      if (shares.exception) {
        segmentExceptions.push({ code: shares.exception, detail: shares.exceptionDetail });
      }
      return { ...segmentWithTenants, ...shares, ratePerUnit };
    });

    const segments = computedSegments
      .filter((segment) => segment.unitsConsumed > 0)
      .map((segment, segmentIndex) => ({
        ...segment,
        segmentIndex,
      }));

    // Phase 1: Aggregate per-tenant kWh, then apply Hamilton cent allocation for bill amounts.
    const tenantKwhMap = new Map();
    const tenantCentMap = new Map(); // Accumulate per-tenant cents from _centSharesByTenantIndex
    for (const segment of segments) {
      for (let ti = 0; ti < segment.activeTenantIds.length; ti++) {
        const tenantId = segment.activeTenantIds[ti];
        const key = String(tenantId);
        tenantKwhMap.set(
          key,
          (tenantKwhMap.get(key) || 0) + segment.sharePerTenantUnits,
        );
        // Accumulate Hamilton cents from the segment's per-tenant allocation
        const centShare = segment._centSharesByTenantIndex?.[ti] ?? toCents(segment.sharePerTenantCost);
        tenantCentMap.set(key, (tenantCentMap.get(key) || 0) + centShare);
      }
    }

    const tenantSummaries = [];
    for (const [tenantIdStr, rawKwh] of tenantKwhMap) {
      const totalUsage = truncate4(rawKwh);
      // Use accumulated Hamilton cents; convert to pesos for the API surface
      const billAmount = toPesos(tenantCentMap.get(tenantIdStr) || 0);
      const event = tenantEvents.find(
        (t) => String(t.tenantId) === tenantIdStr,
      );

      const reservation = reservations.find(
        (r) => String(r.userId?._id || r.userId) === tenantIdStr,
      );

      tenantSummaries.push({
        tenantId: tenantIdStr,
        reservationId: reservation?._id || null,
        tenantName: event?.tenantName || "Unknown Tenant",
        tenantEmail:
          reservation?.userId?.email ||
          reservation?.billingEmail ||
          event?.tenantEmail ||
          null,
        durationRange: formatDurationRange(
          readMoveInDate(reservation) || event?.moveInDate || null,
          readMoveOutDate(reservation) || event?.moveOutDate || null,
        ),
        totalUsage,
        billAmount,
      });
    }

    const sumTenantKwh = tenantSummaries.reduce(
      (sum, t) => sum + t.totalUsage,
      0,
    );
    // Phase 1: Strict cent-level reconciliation (not ±0.01 float tolerance)
    const totalCostCents = toCents(totalCost);
    const sumTenantCents = tenantSummaries.reduce((sum, t) => sum + toCents(t.billAmount), 0);
    const reconciliation = verifyReconciliation(
      tenantSummaries.map((t) => toCents(t.billAmount)),
      totalCostCents,
    );

    return {
      strategy: forceSegmented ? "segment-based-strict" : "segment-based",
      segments,
      tenantSummaries,
      computedTotalUsage: totalUnits,
      computedTotalCost: totalCost,
      verified: reconciliation.valid && Math.abs(sumTenantKwh - totalUnits) <= 0.01,
      reconciliationDeltaCents: reconciliation.delta,
      exceptions: segmentExceptions,
    };
  } else {
    const shareAmounts = buildProratedShareAmounts(
      totalCost,
      reservations,
      startDate,
      endDate,
    );
    const tenantCount = reservations.length;

    const tenantSummaries = reservations.map((res, i) => {
      const user = res.userId;
      const tenantName = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
        : "Tenant";
      const shareAmount = shareAmounts[i] || 0;

      const shareProportion =
        totalCost > 0 ? shareAmount / totalCost : 1 / (tenantCount || 1);
      const totalUsage = truncate4(totalUnits * shareProportion);

      return {
        tenantId: user?._id || null,
        reservationId: res._id,
        tenantName,
        tenantEmail: user?.email || res?.billingEmail || null,
        durationRange: formatDurationRange(
          readMoveInDate(res),
          readMoveOutDate(res),
        ),
        totalUsage,
        billAmount: shareAmount,
      };
    });

    const fallbackSegment = {
      segmentIndex: 0,
      periodLabel: formatPeriodLabel(new Date(startDate), new Date(endDate)),
      readingFrom: startReading,
      readingTo: endReading,
      unitsConsumed: totalUnits,
      totalCost,
      ratePerUnit,
      activeTenantCount: tenantCount,
      sharePerTenantUnits: truncate4(totalUnits / (tenantCount || 1)),
      sharePerTenantCost: truncate4(totalCost / (tenantCount || 1)),
      startDate,
      endDate,
      activeTenantIds: tenantSummaries.map((t) => t.tenantId).filter(Boolean),
      coveredTenantNames: tenantSummaries.map((t) => t.tenantName),
    };

    return {
      strategy: "proration",
      segments: [fallbackSegment],
      tenantSummaries,
      computedTotalUsage: totalUnits,
      computedTotalCost: totalCost,
      verified: true,
    };
  }
}
