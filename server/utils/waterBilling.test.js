import { describe, expect, test } from "@jest/globals";
import {
  buildWaterResult,
  buildWaterCycle,
  buildWaterShareAmounts,
  calculateOverlapDays,
  computeWaterAmount,
  computeWaterUsage,
  getNextScheduledWaterCycleEnd,
  isWaterBillableRoomType,
  validateWaterCycleWindow,
} from "./waterBilling.js";

const localYmd = (date) => [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
].join("-");

describe("buildWaterCycle", () => {
  test("uses the latest cycle end as the next cycle start", () => {
    const cycle = buildWaterCycle({
      cycleEnd: new Date("2026-07-15T00:00:00.000Z"),
      latestRecord: {
        cycleEnd: new Date("2026-06-15T00:00:00.000Z"),
      },
    });

    expect(localYmd(cycle.cycleStart)).toBe("2026-6-15");
    expect(localYmd(cycle.cycleEnd)).toBe("2026-7-15");
  });

  test("defaults the first cycle start to one month before the reading date", () => {
    const cycle = buildWaterCycle({
      cycleEnd: new Date("2026-07-15T00:00:00.000Z"),
    });

    expect(localYmd(cycle.cycleStart)).toBe("2026-6-15");
    expect(localYmd(cycle.cycleEnd)).toBe("2026-7-15");
  });

  test("auto-schedules the first cycle on the 15th when no cycle end is supplied", () => {
    const scheduledEnd = getNextScheduledWaterCycleEnd(null, new Date("2026-03-31T00:00:00.000Z"));
    const cycle = buildWaterCycle({
      latestRecord: null,
      referenceDate: new Date("2026-03-31T00:00:00.000Z"),
    });

    expect(localYmd(scheduledEnd)).toBe("2026-4-15");
    expect(localYmd(cycle.cycleStart)).toBe("2026-3-15");
    expect(localYmd(cycle.cycleEnd)).toBe("2026-4-15");
  });

  test("keeps the first cycle aligned to the fixed 15th-to-15th schedule", () => {
    const cycle = buildWaterCycle({
      cycleEnd: new Date(2026, 3, 15, 8, 0, 0),
    });

    expect(localYmd(cycle.cycleStart)).toBe("2026-3-15");
    expect(localYmd(cycle.cycleEnd)).toBe("2026-4-15");
  });

  test("rejects non-15th water cycle windows", () => {
    expect(() => validateWaterCycleWindow({
      cycleStart: new Date(2026, 2, 15, 0, 0, 0),
      cycleEnd: new Date(2026, 3, 16, 0, 0, 0),
    })).toThrow("Water billing periods must follow the fixed 15th-to-15th cycle.");
  });
});

describe("water amount helpers", () => {
  test("computes usage and amount from readings and rate", () => {
    const usage = computeWaterUsage(120, 135.5);
    const amount = computeWaterAmount(usage, 32.25);

    expect(usage).toBe(15.5);
    expect(amount).toBe(499.88);
  });

  test("rejects decreasing readings", () => {
    expect(() => computeWaterUsage(250, 200)).toThrow(
      "Current reading cannot be lower than the previous reading.",
    );
  });
});

describe("buildWaterShareAmounts", () => {
  const cycleStart = new Date("2026-03-15T00:00:00.000Z");
  const cycleEnd = new Date("2026-04-15T00:00:00.000Z");

  test("charges private rooms in full when there is one recipient", () => {
    const reservations = [{ checkInDate: new Date("2026-03-01T00:00:00.000Z"), checkOutDate: null }];
    expect(buildWaterShareAmounts("private", 600, reservations, cycleStart, cycleEnd)).toEqual([600]);
  });

  test("splits shared rooms pro-rata based on days and preserves cents", () => {
    const fullRes = [
      { checkInDate: cycleStart, checkOutDate: cycleEnd },
      { checkInDate: cycleStart, checkOutDate: cycleEnd },
    ];
    expect(buildWaterShareAmounts("double-sharing", 500, fullRes, cycleStart, cycleEnd)).toEqual([250, 250]);
    
    const oddSplitRes = [fullRes[0], fullRes[0], fullRes[0]];
    expect(buildWaterShareAmounts("double-sharing", 100, oddSplitRes, cycleStart, cycleEnd)).toEqual([33.34, 33.33, 33.33]);
  });

  test("splits shared rooms proportionally based on actual days stayed", () => {
    const partialRes = [
      { checkInDate: new Date("2026-03-15T00:00:00.000Z"), checkOutDate: new Date("2026-03-25T00:00:00.000Z") }, // 10 days
      { checkInDate: new Date("2026-03-25T00:00:00.000Z"), checkOutDate: new Date("2026-04-15T00:00:00.000Z") }, // 21 days
    ];
    // 10/31 = 32.258%, 21/31 = 67.741%
    expect(buildWaterShareAmounts("double-sharing", 100, partialRes, cycleStart, cycleEnd)).toEqual([32.26, 67.74]);
  });

  test("normalizes timestamped move-out boundaries before proration", () => {
    const partialRes = [
      {
        checkInDate: new Date("2026-03-15T09:00:00.000Z"),
        checkOutDate: new Date("2026-03-25T10:00:00.000Z"),
      },
      {
        checkInDate: new Date("2026-03-25T15:00:00.000Z"),
        checkOutDate: new Date("2026-04-15T08:00:00.000Z"),
      },
    ];

    expect(calculateOverlapDays(
      partialRes[0].checkInDate,
      partialRes[0].checkOutDate,
      cycleStart,
      cycleEnd,
    )).toBe(10);
    expect(calculateOverlapDays(
      partialRes[1].checkInDate,
      partialRes[1].checkOutDate,
      cycleStart,
      cycleEnd,
    )).toBe(21);
    expect(buildWaterShareAmounts("double-sharing", 100, partialRes, cycleStart, cycleEnd)).toEqual([32.26, 67.74]);
  });

  test("returns no shares for non-billable room types", () => {
    expect(isWaterBillableRoomType("quadruple-sharing")).toBe(false);
    expect(buildWaterShareAmounts("quadruple-sharing", 500, [{}], cycleStart, cycleEnd)).toEqual([]);
  });
});

describe("buildWaterResult", () => {
  test("marks per-tenant segment values as varying when shares are prorated", () => {
    const result = buildWaterResult({
      _id: "water-1",
      roomId: "room-1",
      branch: "gil-puyat",
      cycleStart: new Date("2026-03-15T00:00:00.000Z"),
      cycleEnd: new Date("2026-04-15T00:00:00.000Z"),
      previousReading: 100,
      currentReading: 120,
      usage: 20,
      ratePerUnit: 30,
      finalAmount: 100,
      tenantShares: [
        { tenantId: "tenant-1", tenantName: "Ava Tenant", shareAmount: 32.26, billId: null },
        { tenantId: "tenant-2", tenantName: "Bea Tenant", shareAmount: 67.74, billId: null },
      ],
    }, null);

    expect(result.segments[0].sharePerTenantUnits).toBeNull();
    expect(result.segments[0].sharePerTenantCost).toBeNull();
    expect(result.tenantSummaries).toEqual([
      expect.objectContaining({ tenantId: "tenant-1", totalUsage: 6.45, billAmount: 32.26 }),
      expect.objectContaining({ tenantId: "tenant-2", totalUsage: 13.55, billAmount: 67.74 }),
    ]);
  });
});
