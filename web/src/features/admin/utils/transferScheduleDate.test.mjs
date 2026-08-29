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

test("minScheduleDateStr is tomorrow (local calendar) — the future-only wizard's date-picker min", () => {
  assert.equal(minScheduleDateStr(AUG_29_2026), "2026-08-30");
  // month rollover
  assert.equal(minScheduleDateStr(new Date(2026, 7, 31, 12, 0, 0)), "2026-09-01");
  // year rollover
  assert.equal(minScheduleDateStr(new Date(2026, 11, 31, 12, 0, 0)), "2027-01-01");
  // never today
  assert.notEqual(minScheduleDateStr(AUG_29_2026), localTodayStr(AUG_29_2026));
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
