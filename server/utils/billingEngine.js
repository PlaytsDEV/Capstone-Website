/**
 * ============================================================================
 * BILLING ENGINE — Segment-Based Electricity Computation
 * ============================================================================
 *
 * Pure, stateless utility module. No database calls — only receives data
 * and returns computed results. This makes it independently testable.
 *
 * FORMULAS (from PRD v1.1.1):
 *   SC_n = MR_n − MR_(n-1)              Segment Consumption
 *   SS_n = SC_n ÷ AT_n                   Segment Share per Tenant
 *   TTC  = Σ SS                          Total Tenant Consumption
 *   TB   = TTC × ER                      Tenant Bill
 *
 * ROUNDING:
 *   All intermediate values are truncated to 4 decimal places max.
 *   No rounding up — uses Math.floor(x * 10000) / 10000.
 *
 * SAME-DAY EVENTS:
 *   Move-out is processed before move-in on the same date.
 *   This prevents double-counting of tenants.
 *
 * ============================================================================
 */

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Truncate a number to 4 decimal places (no rounding up).
 * @param {number} n
 * @returns {number}
 */
export const truncate4 = (n) => Math.floor(n * 10000) / 10000;

// ============================================================================
// SEGMENT BUILDING
// ============================================================================

/**
 * Sort meter readings by date, with same-day move-out before move-in.
 * @param {Array} readings - Array of { date, reading, eventType, ... }
 * @returns {Array} Sorted readings
 */
export function sortReadings(readings) {
  const eventPriority = { "move-out": 0, "regular-billing": 1, "move-in": 2 };
  return [...readings].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    // Same date: move-out before move-in
    return (eventPriority[a.eventType] || 1) - (eventPriority[b.eventType] || 1);
  });
}

/**
 * Build consumption segments from consecutive meter reading pairs.
 *
 * Each segment represents the electricity consumed between two consecutive
 * meter readings. The activeTenantIds for each segment are determined by
 * who was present during that interval.
 *
 * @param {Array} sortedReadings - Meter readings sorted by sortReadings()
 * @param {Array} tenantEvents   - Array of { tenantId, tenantName, moveInReading, moveOutReading? }
 * @returns {Array} segments - Array of segment objects
 */
export function buildSegments(sortedReadings, tenantEvents) {
  if (!sortedReadings || sortedReadings.length < 2) {
    return [];
  }

  const segments = [];

  for (let i = 0; i < sortedReadings.length - 1; i++) {
    const startReading = sortedReadings[i];
    const endReading = sortedReadings[i + 1];

    const readingFrom = startReading.reading;
    const readingTo = endReading.reading;
    const kwhConsumed = readingTo - readingFrom;

    if (kwhConsumed < 0) {
      throw new Error(
        `Invalid reading sequence: reading ${readingTo} at index ${i + 1} ` +
        `is lower than previous reading ${readingFrom} at index ${i}. ` +
        `Meter readings must be non-decreasing.`
      );
    }

    // Determine active tenants for this segment
    const activeTenants = getActiveTenantsForSegment(
      readingFrom,
      tenantEvents,
    );

    const startDate = new Date(startReading.date);
    const endDate = new Date(endReading.date);

    segments.push({
      segmentIndex: i,
      periodLabel: formatPeriodLabel(startDate, endDate),
      readingFrom,
      readingTo,
      kwhConsumed,
      activeTenantIds: activeTenants.map((t) => t.tenantId),
      coveredTenantNames: activeTenants.map((t) => t.tenantName),
      activeTenantCount: activeTenants.length,
      startDate,
      endDate,
    });
  }

  return segments;
}

// ============================================================================
// ACTIVE TENANT RESOLUTION
// ============================================================================

/**
 * Determine which tenants were active during a segment.
 *
 * A tenant is active in a segment if:
 *   moveInReading <= segmentStartReading
 *   AND (no moveOutReading OR moveOutReading > segmentStartReading)
 *
 * @param {number} segmentStartReading - The meter reading at segment start
 * @param {Array} tenantEvents - Array of { tenantId, tenantName, moveInReading, moveOutReading? }
 * @returns {Array} Active tenant objects
 */
export function getActiveTenantsForSegment(segmentStartReading, tenantEvents) {
  return tenantEvents.filter((t) => {
    const movedIn = t.moveInReading <= segmentStartReading;
    const notMovedOut =
      t.moveOutReading === null ||
      t.moveOutReading === undefined ||
      t.moveOutReading > segmentStartReading;
    return movedIn && notMovedOut;
  });
}

// ============================================================================
// SHARE COMPUTATION
// ============================================================================

/**
 * Compute per-tenant kWh and cost shares for a single segment.
 *
 * @param {Object} segment - { kwhConsumed, activeTenantCount }
 * @param {number} ratePerKwh - Electricity rate in ₱/kWh
 * @returns {Object} { sharePerTenantKwh, sharePerTenantCost, totalCost }
 */
export function computeSegmentShares(segment, ratePerKwh) {
  const { kwhConsumed, activeTenantCount } = segment;

  if (kwhConsumed === 0 || activeTenantCount === 0) {
    return {
      sharePerTenantKwh: 0,
      sharePerTenantCost: 0,
      totalCost: 0,
    };
  }

  if (activeTenantCount === 1) {
    // Single tenant — no division needed
    const totalCost = truncate4(kwhConsumed * ratePerKwh);
    return {
      sharePerTenantKwh: kwhConsumed,
      sharePerTenantCost: totalCost,
      totalCost,
    };
  }

  const sharePerTenantKwh = truncate4(kwhConsumed / activeTenantCount);
  const totalCost = truncate4(kwhConsumed * ratePerKwh);
  const sharePerTenantCost = truncate4(totalCost / activeTenantCount);

  return {
    sharePerTenantKwh,
    sharePerTenantCost,
    totalCost,
  };
}

// ============================================================================
// TENANT SUMMARIES
// ============================================================================

/**
 * Compute the total kWh and bill amount for each tenant across all segments.
 *
 * TTC = Σ SS (sum of segment shares for this tenant)
 * TB  = TTC × ER
 *
 * @param {Array} segments   - Built segments from buildSegments()
 * @param {number} ratePerKwh - Electricity rate in ₱/kWh
 * @param {Array} tenantEvents - For tenant name lookup
 * @returns {Array} tenantSummaries - [{ tenantId, tenantName, totalKwh, billAmount }]
 */
export function computeTenantSummaries(segments, ratePerKwh, tenantEvents) {
  // Accumulate kWh per tenant
  const tenantKwhMap = new Map();

  for (const segment of segments) {
    const { sharePerTenantKwh } = computeSegmentShares(segment, ratePerKwh);

    for (const tenantId of segment.activeTenantIds) {
      const key = String(tenantId);
      const current = tenantKwhMap.get(key) || 0;
      tenantKwhMap.set(key, current + sharePerTenantKwh);
    }
  }

  // Build summaries
  const summaries = [];
  for (const [tenantIdStr, rawKwh] of tenantKwhMap) {
    const totalKwh = truncate4(rawKwh);
    const billAmount = truncate4(totalKwh * ratePerKwh);
    const event = tenantEvents.find((t) => String(t.tenantId) === tenantIdStr);

    summaries.push({
      tenantId: tenantIdStr,
      tenantName: event?.tenantName || "Unknown Tenant",
      totalKwh,
      billAmount,
    });
  }

  return summaries;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Verify that the sum of all tenant kWh allocations equals the total room
 * consumption within a 0.01 kWh tolerance.
 *
 * @param {Array} tenantSummaries - [{ totalKwh }]
 * @param {number} totalRoomKwh   - Total room consumption (endReading - startReading)
 * @returns {{ valid: boolean, delta: number, sumTenantKwh: number }}
 */
export function validateAllocation(tenantSummaries, totalRoomKwh) {
  const sumTenantKwh = tenantSummaries.reduce((sum, t) => sum + t.totalKwh, 0);
  const delta = Math.abs(sumTenantKwh - totalRoomKwh);

  return {
    valid: delta <= 0.01,
    delta: truncate4(delta),
    sumTenantKwh: truncate4(sumTenantKwh),
  };
}

// ============================================================================
// FULL COMPUTATION PIPELINE
// ============================================================================

/**
 * Run the full billing computation pipeline.
 *
 * This is the main entry point that orchestrates all steps:
 * 1. Sort readings
 * 2. Build segments
 * 3. Compute segment shares
 * 4. Compute tenant summaries
 * 5. Validate allocation
 *
 * @param {Object} params
 * @param {Array}  params.meterReadings  - Raw meter reading documents
 * @param {Array}  params.tenantEvents   - [{ tenantId, tenantName, moveInReading, moveOutReading? }]
 * @param {number} params.ratePerKwh     - Electricity rate in ₱/kWh
 * @param {number} params.startReading   - Period start reading (for total calc)
 * @param {number} params.endReading     - Period end reading (for total calc)
 * @returns {Object} { segments, tenantSummaries, totalRoomKwh, totalRoomCost, verified, delta }
 */
export function computeBilling({
  meterReadings,
  tenantEvents,
  ratePerKwh,
  startReading,
  endReading,
}) {
  // 1. Sort readings
  const sorted = sortReadings(meterReadings);

  // 2. Build segments
  const rawSegments = buildSegments(sorted, tenantEvents);

  // 3. Compute shares for each segment
  const segments = rawSegments.map((seg) => {
    const shares = computeSegmentShares(seg, ratePerKwh);
    return {
      ...seg,
      sharePerTenantKwh: shares.sharePerTenantKwh,
      sharePerTenantCost: shares.sharePerTenantCost,
      totalCost: shares.totalCost,
    };
  });

  // 4. Compute tenant summaries
  const tenantSummaries = computeTenantSummaries(
    rawSegments,
    ratePerKwh,
    tenantEvents,
  );

  // 5. Total room consumption
  const totalRoomKwh = endReading - startReading;
  const totalRoomCost = truncate4(totalRoomKwh * ratePerKwh);

  // 6. Validate
  const validation = validateAllocation(tenantSummaries, totalRoomKwh);

  return {
    segments,
    tenantSummaries,
    totalRoomKwh,
    totalRoomCost,
    verified: validation.valid,
    delta: validation.delta,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format a period label like "Mar 15 – Mar 25"
 * @param {Date} start
 * @param {Date} end
 * @returns {string}
 */
function formatPeriodLabel(start, end) {
  const opts = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-US", opts);
  const e = end.toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}
