import { describe, expect, test } from "@jest/globals";
import {
  APP_TIMEZONE,
  diffManilaDays,
  formatManilaDate,
  getManilaDayjs,
  getManilaToday,
  toManilaStartOfDay,
} from "./dateUtils.js";

describe("utils/dateUtils", () => {
  test("exports APP_TIMEZONE as Asia/Manila", () => {
    expect(APP_TIMEZONE).toBe("Asia/Manila");
  });

  test("toManilaStartOfDay normalizes midnight to Manila time boundary", () => {
    // 2026-08-15 00:00:00 PHT is 2026-08-14 16:00:00 UTC
    const dateUtc = new Date("2026-08-14T16:00:00.000Z");
    const manilaStart = toManilaStartOfDay(dateUtc);

    expect(manilaStart.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-08-15 00:00:00");
  });

  test("diffManilaDays calculates calendar day difference in Manila time correctly", () => {
    // Due date: Aug 15, 2026 PHT
    const dueDate = new Date("2026-08-15T00:00:00+08:00");
    // Evaluation date: Aug 16, 2026 01:00 AM PHT (which is Aug 15 17:00 UTC)
    const evalDateUtc = new Date("2026-08-15T17:00:00.000Z");

    const daysLate = diffManilaDays(evalDateUtc, dueDate);
    expect(daysLate).toBe(1);
  });

  test("formatManilaDate formats nicely in Manila PHT", () => {
    const utcDate = new Date("2026-08-15T17:00:00.000Z"); // 01:00 AM Aug 16 in Manila
    expect(formatManilaDate(utcDate, "YYYY-MM-DD HH:mm")).toBe("2026-08-16 01:00");
    expect(formatManilaDate(utcDate, "MMMM D, YYYY")).toBe("August 16, 2026");
  });
});
