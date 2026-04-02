import { describe, expect, test } from "@jest/globals";
import {
  buildWaterCycle,
  buildWaterShareAmounts,
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
  test("charges private rooms in full when there is one recipient", () => {
    expect(buildWaterShareAmounts("private", 600, 1)).toEqual([600]);
  });

  test("splits shared rooms equally and preserves cents", () => {
    expect(buildWaterShareAmounts("double-sharing", 500, 2)).toEqual([250, 250]);
    expect(buildWaterShareAmounts("double-sharing", 100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  test("returns no shares for non-billable room types", () => {
    expect(isWaterBillableRoomType("quadruple-sharing")).toBe(false);
    expect(buildWaterShareAmounts("quadruple-sharing", 500, 4)).toEqual([]);
  });
});
