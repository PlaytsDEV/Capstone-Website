import { describe, expect, test } from "@jest/globals";

// Pure resolver/enforcement helpers — no DB, no mocks needed.
const {
  resolveOfficeHours,
  isWithinOfficeHours,
  DEFAULT_OFFICE_HOURS,
} = await import("./businessSettings.js");

// A Manila wall-clock time as an ISO string with the +08:00 offset so the
// helper's tz conversion lands on exactly that local time regardless of the
// test host's TZ.
const manila = (isoLocal) => new Date(`${isoLocal}+08:00`);

describe("resolveOfficeHours", () => {
  test("falls back to the hard defaults when nothing is configured", () => {
    const w = resolveOfficeHours("gil-puyat", null);
    expect(w).toEqual({
      startMinutes: DEFAULT_OFFICE_HOURS.officeHoursStartMinutes,
      endMinutes: DEFAULT_OFFICE_HOURS.officeHoursEndMinutes,
      days: DEFAULT_OFFICE_HOURS.officeDaysOfWeek,
    });
  });

  test("uses the global setting", () => {
    const w = resolveOfficeHours("gil-puyat", {
      officeHoursStartMinutes: 9 * 60,
      officeHoursEndMinutes: 18 * 60,
      officeDaysOfWeek: [1, 2, 3, 4, 5],
    });
    expect(w).toEqual({ startMinutes: 540, endMinutes: 1080, days: [1, 2, 3, 4, 5] });
  });

  test("an inverted window falls back rather than becoming empty", () => {
    const w = resolveOfficeHours("gil-puyat", {
      officeHoursStartMinutes: 20 * 60,
      officeHoursEndMinutes: 8 * 60, // end <= start
    });
    expect(w.endMinutes).toBeGreaterThan(w.startMinutes);
  });
});

describe("isWithinOfficeHours", () => {
  const settings = {
    officeHoursStartMinutes: 8 * 60,
    officeHoursEndMinutes: 20 * 60,
    officeDaysOfWeek: [1, 2, 3, 4, 5, 6], // Mon–Sat
  };

  test("inside the window on an open day", () => {
    // 2026-09-02 is a Wednesday.
    expect(isWithinOfficeHours(manila("2026-09-02T14:00:00"), "gp", { settingsLike: settings })).toBe(true);
  });

  test("end minute is exclusive", () => {
    expect(isWithinOfficeHours(manila("2026-09-02T19:59:00"), "gp", { settingsLike: settings })).toBe(true);
    expect(isWithinOfficeHours(manila("2026-09-02T20:00:00"), "gp", { settingsLike: settings })).toBe(false);
  });

  test("before opening is rejected", () => {
    expect(isWithinOfficeHours(manila("2026-09-02T07:59:00"), "gp", { settingsLike: settings })).toBe(false);
  });

  test("a closed day is rejected even at a valid time", () => {
    // 2026-09-06 is a Sunday (ISO day 7), not in Mon–Sat.
    expect(isWithinOfficeHours(manila("2026-09-06T12:00:00"), "gp", { settingsLike: settings })).toBe(false);
  });

  test("invalid input is rejected, never throws", () => {
    expect(isWithinOfficeHours(null, "gp", { settingsLike: settings })).toBe(false);
    expect(isWithinOfficeHours("not-a-date", "gp", { settingsLike: settings })).toBe(false);
  });
});
