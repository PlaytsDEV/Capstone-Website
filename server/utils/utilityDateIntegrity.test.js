import { describe, expect, test } from "@jest/globals";
import {
  assertUtilityClosingDate,
  assertUtilityPeriodSendable,
  assertUtilityReadingDate,
  assertUtilityStartDate,
} from "./utilityDateIntegrity.js";

const NOW = new Date("2026-08-18T12:00:00+08:00");

describe("utility billing date integrity", () => {
  test("allows actual/current and historical utility dates", () => {
    expect(assertUtilityStartDate("2026-08-01", { now: NOW })).toBeInstanceOf(Date);
    expect(assertUtilityReadingDate("2026-08-18", { periodStart: "2026-08-01", now: NOW })).toBeInstanceOf(Date);
    expect(assertUtilityClosingDate("2026-08-01", "2026-08-18", { now: NOW })).toBeInstanceOf(Date);
  });

  test.each([
    ["start", () => assertUtilityStartDate("2026-08-19", { now: NOW }), "UTILITY_START_DATE_IN_FUTURE"],
    ["reading", () => assertUtilityReadingDate("2026-09-18", { periodStart: "2026-08-18", now: NOW }), "UTILITY_READING_DATE_IN_FUTURE"],
    ["end", () => assertUtilityClosingDate("2026-08-18", "2026-09-18", { now: NOW }), "UTILITY_END_DATE_IN_FUTURE"],
  ])("rejects a future %s date", (_label, action, code) => {
    expect(action).toThrow(expect.objectContaining({ code, statusCode: 400 }));
  });

  test("rejects a reversed period", () => {
    expect(() => assertUtilityClosingDate("2026-08-18", "2026-08-17", { now: NOW }))
      .toThrow(expect.objectContaining({ code: "UTILITY_PERIOD_REVERSED" }));
  });

  test("blocks an already-corrupt finalized period at the last send boundary", () => {
    expect(() => assertUtilityPeriodSendable({
      startDate: "2026-08-18",
      endDate: "2026-09-18",
    }, { now: NOW })).toThrow(expect.objectContaining({
      code: "UTILITY_PERIOD_REQUIRES_DATE_REVIEW",
      statusCode: 409,
    }));
  });
});
