import test from "node:test";
import assert from "node:assert/strict";
import {
  getTodayISO,
  getTomorrowISO,
  formatBlackoutDateDisplay,
  getBlackoutDateStatus,
  filterAndSortBlackouts,
  partitionExpiredBlackouts,
} from "./visitPresetDates.js";

test("visitPresetDates utility test suite", async (t) => {
  await t.test("should return valid YYYY-MM-DD for today and tomorrow ISO helpers", () => {
    const today = getTodayISO();
    const tomorrow = getTomorrowISO();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(tomorrow, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("should format ISO dates into human-readable display text", () => {
    assert.equal(formatBlackoutDateDisplay("2026-12-25"), "Dec 25, 2026");
    assert.equal(formatBlackoutDateDisplay(""), "—");
  });

  await t.test("should correctly identify date status (past, today, upcoming)", () => {
    const todayStr = "2026-08-13";

    assert.equal(getBlackoutDateStatus("2026-08-10", todayStr), "past");
    assert.equal(getBlackoutDateStatus("2026-08-13", todayStr), "today");
    assert.equal(getBlackoutDateStatus("2026-08-25", todayStr), "upcoming");
  });

  await t.test("should filter and sort blackout dates cleanly", () => {
    const dates = [
      { date: "2026-12-25", reason: "Christmas" },
      { date: "2026-01-01", reason: "New Year" },
      { date: "2026-04-09", reason: "Araw ng Kagitingan" },
    ];

    const todayStr = "2026-04-01";
    const filtered = filterAndSortBlackouts(
      dates,
      { search: "", statusFilter: "all", sortOrder: "asc" },
      todayStr
    );

    assert.equal(filtered[0].date, "2026-01-01");
    assert.equal(filtered[1].date, "2026-04-09");
    assert.equal(filtered[2].date, "2026-12-25");
  });

  await t.test("should partition expired dates from active dates", () => {
    const dates = [
      { date: "2026-01-01", reason: "Past New Year" },
      { date: "2026-08-13", reason: "Today" },
      { date: "2026-12-25", reason: "Future Christmas" },
    ];

    const todayStr = "2026-08-13";
    const { active, expired } = partitionExpiredBlackouts(dates, todayStr);

    assert.equal(expired.length, 1);
    assert.equal(expired[0].date, "2026-01-01");
    assert.equal(active.length, 2);
    assert.equal(active[0].date, "2026-08-13");
    assert.equal(active[1].date, "2026-12-25");
  });
});
