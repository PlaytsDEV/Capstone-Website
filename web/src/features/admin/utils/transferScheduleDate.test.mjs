/**
 * Unit coverage for transferScheduleDate.js — the REAL canonical-date helpers
 * the Transfer Tenant wizard uses to decide "is this a future (scheduled)
 * transfer?". Production QA (Aug 2026) reported a future-dated transfer still
 * rendering the Meter Readings step; the wizard code was correct and deployed,
 * so this pins the exact date-comparison contract against regression and
 * against ever comparing locale-formatted strings.
 *
 * Executed by web/scripts/run-tests.mjs (node --test).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  toDateInputValue,
  localTodayStr,
  minScheduleDateStr,
  isScheduledTransferDate,
  timeStrToMinutes,
  minutesToTimeStr,
  isoWeekdayOf,
  checkScheduleWithinOfficeHours,
  checkSameDayOfficeHours,
} from "./transferScheduleDate.js";

// A fixed "now" so the assertions are deterministic. Local noon avoids any
// midnight-rollover ambiguity.
const AUG_29_2026 = new Date(2026, 7, 29, 12, 0, 0); // months are 0-indexed

test("toDateInputValue emits canonical YYYY-MM-DD from local calendar fields", () => {
  assert.equal(toDateInputValue(AUG_29_2026), "2026-08-29");
  assert.equal(toDateInputValue(new Date(2026, 8, 5, 12, 0, 0)), "2026-09-05");
  // zero-padding
  assert.equal(toDateInputValue(new Date(2026, 0, 1, 12, 0, 0)), "2026-01-01");
  // nullish / unparseable -> ""
  assert.equal(toDateInputValue(null), "");
  assert.equal(toDateInputValue(undefined), "");
  assert.equal(toDateInputValue("not-a-date"), "");
});

test("localTodayStr is toDateInputValue(now)", () => {
  assert.equal(localTodayStr(AUG_29_2026), "2026-08-29");
});

test("minScheduleDateStr is TODAY (local calendar) — same-day transfers are allowed", () => {
  assert.equal(minScheduleDateStr(AUG_29_2026), "2026-08-29");
  assert.equal(minScheduleDateStr(new Date(2026, 7, 31, 12, 0, 0)), "2026-08-31");
  assert.equal(minScheduleDateStr(new Date(2026, 11, 31, 12, 0, 0)), "2026-12-31");
  // equals today (same-day allowed, office-hours gated by the backend)
  assert.equal(minScheduleDateStr(AUG_29_2026), localTodayStr(AUG_29_2026));
  // unparseable now -> ""
  assert.equal(minScheduleDateStr(new Date("nope")), "");
});

test("PRODUCTION CASE: effective '2026-09-05' vs Manila today 2026-08-29 → scheduled (true)", () => {
  // today = Aug 29, 2026; effective date = Sep 5, 2026 → isScheduledTransfer MUST be true.
  assert.equal(isScheduledTransferDate("2026-09-05", AUG_29_2026), true);
});

test("same day → immediate (false)", () => {
  assert.equal(isScheduledTransferDate("2026-08-29", AUG_29_2026), false);
});

test("past date → immediate (false) (executor/controller reject separately)", () => {
  assert.equal(isScheduledTransferDate("2026-08-28", AUG_29_2026), false);
});

test("empty / missing effective date → immediate (false)", () => {
  assert.equal(isScheduledTransferDate("", AUG_29_2026), false);
  assert.equal(isScheduledTransferDate(undefined, AUG_29_2026), false);
  assert.equal(isScheduledTransferDate(null, AUG_29_2026), false);
});

test("month/year boundary is handled by canonical string comparison, not numeric", () => {
  // "2027-01-01" > "2026-12-31" lexicographically AND chronologically.
  assert.equal(isScheduledTransferDate("2027-01-01", new Date(2026, 11, 31, 12, 0, 0)), true);
  // next-day across a month boundary
  assert.equal(isScheduledTransferDate("2026-09-01", new Date(2026, 7, 31, 12, 0, 0)), true);
});

test("does NOT accept a locale-formatted display string for business logic", () => {
  // "09/05/2026" is not YYYY-MM-DD; new Date("09/05/2026") happens to parse in
  // V8, so normalization catches it and still yields the correct answer — but
  // the point is the function never string-compares "09/05/2026" directly
  // (which would sort before "2026-...").
  const result = isScheduledTransferDate("09/05/2026", AUG_29_2026);
  // normalized to 2026-09-05 -> future
  assert.equal(result, true);
  // and a raw lexicographic compare of the locale string would have been wrong:
  assert.equal("09/05/2026" > "2026-08-29", false);
});

test("a Date object (not a string) is normalized before comparison", () => {
  assert.equal(isScheduledTransferDate(new Date(2026, 8, 5, 12, 0, 0), AUG_29_2026), true);
  assert.equal(isScheduledTransferDate(new Date(2026, 7, 29, 12, 0, 0), AUG_29_2026), false);
});

test("timeStrToMinutes / minutesToTimeStr round-trip", () => {
  assert.equal(timeStrToMinutes("09:00"), 540);
  assert.equal(timeStrToMinutes("00:00"), 0);
  assert.equal(timeStrToMinutes("23:59"), 1439);
  assert.equal(timeStrToMinutes("24:00"), null);
  assert.equal(timeStrToMinutes(""), null);
  assert.equal(timeStrToMinutes("bad"), null);
  assert.equal(minutesToTimeStr(540), "09:00");
  assert.equal(minutesToTimeStr(0), "00:00");
});

// ── Audit item 1: EVERY planned date + time is office-hours validated ──────
const OH = { startMinutes: 8 * 60, endMinutes: 20 * 60, days: [1, 2, 3, 4, 5, 6] };

test("isoWeekdayOf: YYYY-MM-DD -> ISO weekday (Mon=1..Sun=7)", () => {
  assert.equal(isoWeekdayOf("2026-08-29"), 6); // Saturday
  assert.equal(isoWeekdayOf("2026-08-30"), 7); // Sunday
  assert.equal(isoWeekdayOf("2026-08-31"), 1); // Monday
  assert.equal(isoWeekdayOf("bad"), null);
});

test("checkScheduleWithinOfficeHours: FUTURE date still requires a valid in-hours time", () => {
  // No time on a future date => not ok (was previously auto-ok).
  assert.equal(checkScheduleWithinOfficeHours("2026-09-07", "", OH, AUG_29_2026).ok, false);
  // 2026-09-07 is a Monday — in-hours time ok.
  assert.equal(checkScheduleWithinOfficeHours("2026-09-07", "10:00", OH, AUG_29_2026).ok, true);
  // Future date, after close => rejected at scheduling.
  assert.equal(checkScheduleWithinOfficeHours("2026-09-07", "21:00", OH, AUG_29_2026).ok, false);
  // Future date, end-exclusive.
  assert.equal(checkScheduleWithinOfficeHours("2026-09-07", "20:00", OH, AUG_29_2026).ok, false);
});

test("checkScheduleWithinOfficeHours: FUTURE date on a NON-office day is rejected", () => {
  // 2026-09-06 is a Sunday; OH.days is Mon–Sat.
  assert.equal(isoWeekdayOf("2026-09-06"), 7);
  const r = checkScheduleWithinOfficeHours("2026-09-06", "10:00", OH, AUG_29_2026);
  assert.equal(r.ok, false);
  assert.match(r.reason, /closed on that day/i);
});

test("checkScheduleWithinOfficeHours: past date rejected", () => {
  assert.equal(checkScheduleWithinOfficeHours("2026-08-28", "10:00", OH, AUG_29_2026).ok, false);
});

test("checkScheduleWithinOfficeHours: same-day inside office hours ok, outside rejected", () => {
  // Aug 29 2026 is a Saturday (ISO weekday 6) — in OH.days.
  assert.equal(checkScheduleWithinOfficeHours("2026-08-29", "10:00", OH, AUG_29_2026).ok, true);
  assert.equal(checkScheduleWithinOfficeHours("2026-08-29", "21:00", OH, AUG_29_2026).ok, false);
  assert.equal(checkScheduleWithinOfficeHours("2026-08-29", "20:00", OH, AUG_29_2026).ok, false);
});

test("checkScheduleWithinOfficeHours: same-day on a closed weekday rejected", () => {
  const ohWeekdaysOnly = { startMinutes: 8 * 60, endMinutes: 20 * 60, days: [1, 2, 3, 4, 5] };
  assert.equal(checkScheduleWithinOfficeHours("2026-08-29", "10:00", ohWeekdaysOnly, AUG_29_2026).ok, false);
});

test("checkSameDayOfficeHours is an alias of checkScheduleWithinOfficeHours", () => {
  assert.equal(checkSameDayOfficeHours, checkScheduleWithinOfficeHours);
});
