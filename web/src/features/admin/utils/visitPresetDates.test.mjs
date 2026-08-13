import test from "node:test";
import assert from "node:assert/strict";
import {
  PH_HOLIDAYS_2026,
  PRESET_BUNDLES,
  getBlackoutDateStatus,
  mergeBlackoutPresets,
  filterAndSortBlackouts,
  partitionExpiredBlackouts,
} from "./visitPresetDates.js";

test("visitPresetDates utility test suite", async (t) => {
  await t.test("should provide structured 2026 PH holiday presets", () => {
    assert.equal(PH_HOLIDAYS_2026.length, 17);
    assert.equal(PRESET_BUNDLES.length, 4);

    const first = PH_HOLIDAYS_2026[0];
    assert.equal(first.date, "2026-01-01");
    assert.equal(first.name, "New Year's Day");
  });

  await t.test("should correctly identify date status (past, today, upcoming)", () => {
    const todayStr = "2026-08-13";

    assert.equal(getBlackoutDateStatus("2026-08-10", todayStr), "past");
    assert.equal(getBlackoutDateStatus("2026-08-13", todayStr), "today");
    assert.equal(getBlackoutDateStatus("2026-08-25", todayStr), "upcoming");
  });

  await t.test("should merge preset blackout dates without duplicates", () => {
    const existing = [
      { date: "2026-01-01", reason: "Existing New Year" },
    ];
    const newItems = [
      { date: "2026-01-01", reason: "Regular Holiday - New Year's Day" },
      { date: "2026-12-25", reason: "Regular Holiday - Christmas Day" },
    ];

    const { mergedList, addedCount, skippedCount } = mergeBlackoutPresets(existing, newItems);
    assert.equal(mergedList.length, 2);
    assert.equal(addedCount, 1);
    assert.equal(skippedCount, 1);
    assert.equal(mergedList[0].reason, "Existing New Year");
    assert.equal(mergedList[1].date, "2026-12-25");
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
