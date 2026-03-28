/**
 * ============================================================================
 * BILLING ENGINE — Unit Tests
 * ============================================================================
 *
 * Tests all PRD v1.1.1 scenarios + edge cases using Jest.
 * Run: npm test
 *
 * ============================================================================
 */

import { jest } from "@jest/globals";
import {
  truncate4,
  sortReadings,
  buildSegments,
  getActiveTenantsForSegment,
  computeSegmentShares,
  computeTenantSummaries,
  validateAllocation,
  computeBilling,
} from "./billingEngine.js";

// ============================================================================
// HELPER: Create tenant events from test data
// ============================================================================

function makeTenantEvents(tenants) {
  return tenants.map((t) => ({
    tenantId: t.id,
    tenantName: t.name,
    moveInReading: t.moveInReading,
    moveOutReading: t.moveOutReading ?? null,
  }));
}

function makeReadings(entries) {
  return entries.map((e) => ({
    date: new Date(e.date),
    reading: e.reading,
    eventType: e.eventType,
    tenantId: e.tenantId || null,
  }));
}

// ============================================================================
// UTILITY TESTS
// ============================================================================

describe("truncate4", () => {
  test("truncates to 4 decimal places without rounding up", () => {
    expect(truncate4(33.33335)).toBe(33.3333);
    expect(truncate4(100 / 3)).toBe(33.3333);
    expect(truncate4(1.23456789)).toBe(1.2345);
    expect(truncate4(5)).toBe(5);
    expect(truncate4(0)).toBe(0);
  });
});

describe("sortReadings", () => {
  test("sorts by date ascending", () => {
    const readings = makeReadings([
      { date: "2026-03-15", reading: 1450, eventType: "regular-billing" },
      { date: "2026-02-15", reading: 1350, eventType: "regular-billing" },
    ]);
    const sorted = sortReadings(readings);
    expect(sorted[0].reading).toBe(1350);
    expect(sorted[1].reading).toBe(1450);
  });

  test("on same date: move-out before move-in", () => {
    const readings = makeReadings([
      { date: "2026-05-22", reading: 2030, eventType: "move-in" },
      { date: "2026-05-22", reading: 2030, eventType: "move-out" },
    ]);
    const sorted = sortReadings(readings);
    expect(sorted[0].eventType).toBe("move-out");
    expect(sorted[1].eventType).toBe("move-in");
  });
});

// ============================================================================
// PRD SCENARIO A — Tenant Moves Out Mid-Month (§4.1)
// ============================================================================

describe("Scenario A: Tenant moves out mid-month", () => {
  const RATE = 16;

  // Quadruple room: 4 tenants. One moves out Feb 27.
  // Feb 15 reading: 1350, Feb 27 reading: 1370, Mar 15 reading: 1450
  const readings = makeReadings([
    { date: "2026-02-15", reading: 1350, eventType: "regular-billing" },
    { date: "2026-02-27", reading: 1370, eventType: "move-out", tenantId: "D" },
    { date: "2026-03-15", reading: 1450, eventType: "regular-billing" },
  ]);

  // All 4 moved in at or before reading 1350. Tenant D moved out at reading 1370.
  const tenantEvents = makeTenantEvents([
    { id: "A", name: "Tenant A", moveInReading: 0 },
    { id: "B", name: "Tenant B", moveInReading: 0 },
    { id: "C", name: "Tenant C", moveInReading: 0 },
    { id: "D", name: "Tenant D (departed)", moveInReading: 0, moveOutReading: 1370 },
  ]);

  let result;
  beforeAll(() => {
    result = computeBilling({
      meterReadings: readings,
      tenantEvents,
      ratePerKwh: RATE,
      startReading: 1350,
      endReading: 1450,
    });
  });

  test("produces 2 segments", () => {
    expect(result.segments).toHaveLength(2);
  });

  test("Segment 1: 20 kWh, 4 tenants, ₱80/tenant", () => {
    const seg = result.segments[0];
    expect(seg.kwhConsumed).toBe(20);
    expect(seg.activeTenantCount).toBe(4);
    expect(seg.sharePerTenantKwh).toBe(5); // 20/4
    expect(seg.sharePerTenantCost).toBe(80); // 320/4
  });

  test("Segment 2: 80 kWh, 3 tenants, ₱426.6666/tenant", () => {
    const seg = result.segments[1];
    expect(seg.kwhConsumed).toBe(80);
    expect(seg.activeTenantCount).toBe(3);
    expect(seg.sharePerTenantKwh).toBe(truncate4(80 / 3)); // 26.6666
    expect(seg.sharePerTenantCost).toBe(truncate4(1280 / 3)); // 426.6666
  });

  test("Departed tenant D pays only ₱80.00", () => {
    const tenantD = result.tenantSummaries.find((t) => t.tenantId === "D");
    expect(tenantD.totalKwh).toBe(5); // Only segment 1
    expect(tenantD.billAmount).toBe(80);
  });

  test("Remaining tenants pay ₱506.6666 each", () => {
    const tenantA = result.tenantSummaries.find((t) => t.tenantId === "A");
    // 5 + 26.6666 = 31.6666 kWh → 31.6666 * 16 = 506.6656
    expect(tenantA.totalKwh).toBe(truncate4(5 + truncate4(80 / 3)));
    expect(tenantA.billAmount).toBe(truncate4(tenantA.totalKwh * RATE));
  });

  test("total room kWh = 100", () => {
    expect(result.totalRoomKwh).toBe(100);
  });

  test("allocation is verified", () => {
    expect(result.verified).toBe(true);
  });
});

// ============================================================================
// PRD SCENARIO B — New Tenant Moves In Mid-Month (§4.2)
// ============================================================================

describe("Scenario B: New tenant moves in mid-month", () => {
  const RATE = 16;

  // Quadruple room: 3 existing tenants. New tenant moves in Mar 25.
  // Mar 15 reading: 1450, Mar 25 reading: 1490, Apr 15 reading: 1570
  const readings = makeReadings([
    { date: "2026-03-15", reading: 1450, eventType: "regular-billing" },
    { date: "2026-03-25", reading: 1490, eventType: "move-in", tenantId: "D" },
    { date: "2026-04-15", reading: 1570, eventType: "regular-billing" },
  ]);

  const tenantEvents = makeTenantEvents([
    { id: "A", name: "Tenant A", moveInReading: 0 },
    { id: "B", name: "Tenant B", moveInReading: 0 },
    { id: "C", name: "Tenant C", moveInReading: 0 },
    { id: "D", name: "New Tenant", moveInReading: 1490 }, // Moves in at 1490
  ]);

  let result;
  beforeAll(() => {
    result = computeBilling({
      meterReadings: readings,
      tenantEvents,
      ratePerKwh: RATE,
      startReading: 1450,
      endReading: 1570,
    });
  });

  test("produces 2 segments", () => {
    expect(result.segments).toHaveLength(2);
  });

  test("Segment 1: 40 kWh, 3 tenants", () => {
    const seg = result.segments[0];
    expect(seg.kwhConsumed).toBe(40);
    expect(seg.activeTenantCount).toBe(3);
  });

  test("Segment 2: 80 kWh, 4 tenants", () => {
    const seg = result.segments[1];
    expect(seg.kwhConsumed).toBe(80);
    expect(seg.activeTenantCount).toBe(4);
  });

  test("New tenant D pays only for Segment 2", () => {
    const tenantD = result.tenantSummaries.find((t) => t.tenantId === "D");
    expect(tenantD.totalKwh).toBe(20); // 80/4
    expect(tenantD.billAmount).toBe(320); // 20 * 16
  });

  test("Existing tenants pay for both segments", () => {
    const tenantA = result.tenantSummaries.find((t) => t.tenantId === "A");
    // Segment 1: 40/3 = 13.3333 kWh, Segment 2: 80/4 = 20 kWh
    const expectedKwh = truncate4(truncate4(40 / 3) + 20);
    expect(tenantA.totalKwh).toBe(expectedKwh);
  });

  test("allocation is verified", () => {
    expect(result.verified).toBe(true);
  });
});

// ============================================================================
// PRD SCENARIO C — Move-Out and Move-In Same Period (§4.3)
// ============================================================================

describe("Scenario C: Move-out and move-in within same billing period", () => {
  const RATE = 16;

  // Quadruple room: 4 tenants. Tenant D moves out May 22. Tenant E moves in May 30.
  // May 15: 2000, May 22: 2030, May 30: 2060, Jun 15: 2140
  const readings = makeReadings([
    { date: "2026-05-15", reading: 2000, eventType: "regular-billing" },
    { date: "2026-05-22", reading: 2030, eventType: "move-out", tenantId: "D" },
    { date: "2026-05-30", reading: 2060, eventType: "move-in", tenantId: "E" },
    { date: "2026-06-15", reading: 2140, eventType: "regular-billing" },
  ]);

  const tenantEvents = makeTenantEvents([
    { id: "A", name: "Tenant A", moveInReading: 0 },
    { id: "B", name: "Tenant B", moveInReading: 0 },
    { id: "C", name: "Tenant C", moveInReading: 0 },
    { id: "D", name: "Departed Tenant", moveInReading: 0, moveOutReading: 2030 },
    { id: "E", name: "New Tenant", moveInReading: 2060 },
  ]);

  let result;
  beforeAll(() => {
    result = computeBilling({
      meterReadings: readings,
      tenantEvents,
      ratePerKwh: RATE,
      startReading: 2000,
      endReading: 2140,
    });
  });

  test("produces 3 segments", () => {
    expect(result.segments).toHaveLength(3);
  });

  test("Segment 1: 30 kWh, 4 tenants, ₱120/tenant", () => {
    const seg = result.segments[0];
    expect(seg.kwhConsumed).toBe(30);
    expect(seg.activeTenantCount).toBe(4);
    expect(seg.sharePerTenantCost).toBe(120); // 480/4
  });

  test("Segment 2: 30 kWh, 3 tenants, ₱160/tenant", () => {
    const seg = result.segments[1];
    expect(seg.kwhConsumed).toBe(30);
    expect(seg.activeTenantCount).toBe(3);
    expect(seg.sharePerTenantCost).toBe(160); // 480/3
  });

  test("Segment 3: 80 kWh, 4 tenants, ₱320/tenant", () => {
    const seg = result.segments[2];
    expect(seg.kwhConsumed).toBe(80);
    expect(seg.activeTenantCount).toBe(4);
    expect(seg.sharePerTenantCost).toBe(320); // 1280/4
  });

  test("Departed tenant D = ₱120 total", () => {
    const tenantD = result.tenantSummaries.find((t) => t.tenantId === "D");
    expect(tenantD.billAmount).toBe(120);
  });

  test("Existing tenants A,B,C = ₱600 total", () => {
    const tenantA = result.tenantSummaries.find((t) => t.tenantId === "A");
    expect(tenantA.billAmount).toBe(600); // 120 + 160 + 320
  });

  test("New tenant E = ₱320 total", () => {
    const tenantE = result.tenantSummaries.find((t) => t.tenantId === "E");
    expect(tenantE.billAmount).toBe(320);
  });

  test("total room kWh = 140", () => {
    expect(result.totalRoomKwh).toBe(140);
  });

  test("allocation is verified", () => {
    expect(result.verified).toBe(true);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge cases", () => {
  test("zero consumption segment: all shares = 0, no error", () => {
    const readings = makeReadings([
      { date: "2026-01-01", reading: 500, eventType: "regular-billing" },
      { date: "2026-01-15", reading: 500, eventType: "regular-billing" },
    ]);
    const tenantEvents = makeTenantEvents([
      { id: "A", name: "Tenant A", moveInReading: 0 },
    ]);
    const result = computeBilling({
      meterReadings: readings,
      tenantEvents,
      ratePerKwh: 16,
      startReading: 500,
      endReading: 500,
    });
    expect(result.segments[0].kwhConsumed).toBe(0);
    expect(result.segments[0].sharePerTenantKwh).toBe(0);
    expect(result.tenantSummaries[0].billAmount).toBe(0);
    expect(result.verified).toBe(true);
  });

  test("single tenant room: full consumption assigned", () => {
    const readings = makeReadings([
      { date: "2026-01-01", reading: 100, eventType: "regular-billing" },
      { date: "2026-02-01", reading: 200, eventType: "regular-billing" },
    ]);
    const tenantEvents = makeTenantEvents([
      { id: "A", name: "Solo Tenant", moveInReading: 0 },
    ]);
    const result = computeBilling({
      meterReadings: readings,
      tenantEvents,
      ratePerKwh: 16,
      startReading: 100,
      endReading: 200,
    });
    expect(result.tenantSummaries).toHaveLength(1);
    expect(result.tenantSummaries[0].totalKwh).toBe(100);
    expect(result.tenantSummaries[0].billAmount).toBe(1600);
    expect(result.verified).toBe(true);
  });

  test("reading sequence violation throws descriptive error", () => {
    const readings = makeReadings([
      { date: "2026-01-01", reading: 600, eventType: "regular-billing" },
      { date: "2026-02-01", reading: 500, eventType: "regular-billing" },
    ]);
    const tenantEvents = makeTenantEvents([
      { id: "A", name: "Tenant A", moveInReading: 0 },
    ]);
    expect(() =>
      computeBilling({
        meterReadings: readings,
        tenantEvents,
        ratePerKwh: 16,
        startReading: 600,
        endReading: 500,
      }),
    ).toThrow(/lower than previous reading/i);
  });

  test("validation detects mismatched allocation", () => {
    const fakeSummaries = [
      { tenantId: "A", tenantName: "A", totalKwh: 50, billAmount: 800 },
      { tenantId: "B", tenantName: "B", totalKwh: 30, billAmount: 480 },
    ];
    // Total should be 100, but sum is 80
    const result = validateAllocation(fakeSummaries, 100);
    expect(result.valid).toBe(false);
    expect(result.delta).toBe(20);
  });
});
