import { describe, expect, test } from "@jest/globals";
import dayjs from "dayjs";
import {
  assertUtilityClosingDate,
  assertUtilityPeriodSendable,
  assertUtilityReadingDate,
  assertUtilityStartDate,
} from "./utilityDateIntegrity.js";

const NOW = new Date("2026-08-18T12:00:00+08:00");

/** Interval overlap detection matching the updated controller/frontend logic */
function isContinuousPeriodOverlapping(existingStart, existingEnd, newStart, newEnd) {
  const eS = dayjs(existingStart).startOf("day");
  const eE = dayjs(existingEnd).startOf("day");
  const nS = dayjs(newStart).startOf("day");
  const nE = dayjs(newEnd).startOf("day");

  return nS.isBefore(eE) && nE.isAfter(eS);
}

/** Open period start date check matching openUtilityPeriod */
function isPeriodStartOverlapping(existingStart, existingEnd, newStart) {
  const eS = dayjs(existingStart).startOf("day");
  const eE = dayjs(existingEnd).startOf("day");
  const nS = dayjs(newStart).startOf("day");

  return (nS.isSame(eS) || nS.isAfter(eS)) && nS.isBefore(eE);
}

describe("utility billing date integrity", () => {
  test("allows actual/current and historical utility dates", () => {
    expect(assertUtilityStartDate("2026-08-01")).toBeInstanceOf(Date);
    expect(assertUtilityReadingDate("2026-08-18", { periodStart: "2026-08-01" })).toBeInstanceOf(Date);
    expect(assertUtilityClosingDate("2026-08-01", "2026-08-18")).toBeInstanceOf(Date);
  });

  test("allows future start dates, reading dates, and end dates for advance billing", () => {
    expect(assertUtilityStartDate("2026-09-01")).toBeInstanceOf(Date);
    expect(assertUtilityReadingDate("2026-09-18", { periodStart: "2026-09-01" })).toBeInstanceOf(Date);
    expect(assertUtilityClosingDate("2026-08-18", "2026-09-18")).toBeInstanceOf(Date);
    expect(assertUtilityClosingDate("2026-09-01", "2026-10-01")).toBeInstanceOf(Date);
  });

  test("allows advance/future periods to be sent", () => {
    expect(() => assertUtilityPeriodSendable({
      startDate: "2026-08-18",
      endDate: "2026-09-18",
      closedAt: "2026-08-18",
    })).not.toThrow();
  });

  test("rejects a reading recorded before the period start date", () => {
    expect(() => assertUtilityReadingDate("2026-07-31", { periodStart: "2026-08-01" }))
      .toThrow(expect.objectContaining({ code: "UTILITY_READING_BEFORE_PERIOD", statusCode: 400 }));
  });

  test("rejects a reversed period", () => {
    expect(() => assertUtilityClosingDate("2026-08-18", "2026-08-17"))
      .toThrow(expect.objectContaining({ code: "UTILITY_PERIOD_REVERSED", statusCode: 400 }));
  });
});

describe("Continuous Point-in-Time Utility Billing Date Continuity", () => {
  describe("Boundary Overlap & Transition Tests", () => {
    const period1Start = "2026-08-19";
    const period1End = "2026-09-19";

    test("allows consecutive cycle starting on previous cycle end date (Aug 19–Sep 19 -> Sep 19–Oct 19)", () => {
      const period2Start = "2026-09-19";
      const period2End = "2026-10-19";

      expect(isPeriodStartOverlapping(period1Start, period1End, period2Start)).toBe(false);
      expect(isContinuousPeriodOverlapping(period1Start, period1End, period2Start, period2End)).toBe(false);
    });

    test("rejects a cycle that starts inside an existing closed cycle (Sep 10)", () => {
      const invalidStart = "2026-09-10";
      const invalidEnd = "2026-10-10";

      expect(isPeriodStartOverlapping(period1Start, period1End, invalidStart)).toBe(true);
      expect(isContinuousPeriodOverlapping(period1Start, period1End, invalidStart, invalidEnd)).toBe(true);
    });

    test("rejects an identical duplicate cycle range (Aug 19 – Sep 19)", () => {
      expect(isPeriodStartOverlapping(period1Start, period1End, period1Start)).toBe(true);
      expect(isContinuousPeriodOverlapping(period1Start, period1End, period1Start, period1End)).toBe(true);
    });
  });

  describe("February Non-Leap Year (2026) Date Calculations", () => {
    test("calculates exact 28 days for Feb 19 – Mar 19 in 2026", () => {
      const start = dayjs("2026-02-19").startOf("day");
      const end = dayjs("2026-03-19").startOf("day");
      expect(end.diff(start, "day")).toBe(28);
    });

    test("calculates exact 28 days for Jan 31 – Feb 28 in 2026", () => {
      const start = dayjs("2026-01-31").startOf("day");
      const end = dayjs("2026-02-28").startOf("day");
      expect(end.diff(start, "day")).toBe(28);
    });

    test("allows continuous transition from Feb 28 to Mar 31", () => {
      const febStart = "2026-01-31";
      const febEnd = "2026-02-28";
      const marStart = "2026-02-28";
      const marEnd = "2026-03-31";

      expect(isPeriodStartOverlapping(febStart, febEnd, marStart)).toBe(false);
      expect(isContinuousPeriodOverlapping(febStart, febEnd, marStart, marEnd)).toBe(false);
    });
  });

  describe("February Leap Year (2028) Date Calculations", () => {
    test("calculates exact 29 days for Feb 19 – Mar 19 in 2028", () => {
      const start = dayjs("2028-02-19").startOf("day");
      const end = dayjs("2028-03-19").startOf("day");
      expect(end.diff(start, "day")).toBe(29);
    });

    test("calculates exact 29 days for Jan 31 – Feb 29 in 2028", () => {
      const start = dayjs("2028-01-31").startOf("day");
      const end = dayjs("2028-02-29").startOf("day");
      expect(end.diff(start, "day")).toBe(29);
    });

    test("allows continuous transition from Feb 29 to Mar 29 in leap year", () => {
      const febStart = "2028-01-29";
      const febEnd = "2028-02-29";
      const marStart = "2028-02-29";
      const marEnd = "2028-03-29";

      expect(isPeriodStartOverlapping(febStart, febEnd, marStart)).toBe(false);
      expect(isContinuousPeriodOverlapping(febStart, febEnd, marStart, marEnd)).toBe(false);
    });
  });
});
