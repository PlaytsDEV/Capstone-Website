import test from "node:test";
import assert from "node:assert/strict";

import {
  VISIT_SCHEDULE_CSV_COLUMNS,
  formatVisitSchedulesForCSV,
  getVisitStatusLabel,
} from "./visitExportUtils.js";

test("VISIT_SCHEDULE_CSV_COLUMNS has required fields", () => {
  const keys = VISIT_SCHEDULE_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("visitorName"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("room"));
  assert.ok(keys.includes("scheduledDate"));
  assert.ok(keys.includes("visitDate"));
  assert.ok(keys.includes("status"));
});

test("getVisitStatusLabel correctly labels active and historical visits", () => {
  const awaiting = { isHistorical: false, visitApproved: false, visitStatus: "physical_visit_scheduled" };
  assert.equal(getVisitStatusLabel(awaiting), "Awaiting Visit");

  const completed = { isHistorical: false, visitApproved: true };
  assert.equal(getVisitStatusLabel(completed), "Visit Completed");

  const noShow = { isHistorical: false, visitStatus: "no_show" };
  assert.equal(getVisitStatusLabel(noShow), "No-Show");

  const rejected = { isHistorical: false, scheduleRejected: true };
  assert.equal(getVisitStatusLabel(rejected), "Rejected");

  const historicalCompleted = { isHistorical: true, historyStatus: "completed" };
  assert.equal(getVisitStatusLabel(historicalCompleted), "Completed");

  const historicalCancelled = { isHistorical: true, historyStatus: "cancelled" };
  assert.equal(getVisitStatusLabel(historicalCancelled), "Cancelled");
});

test("formatVisitSchedulesForCSV formats schedule rows correctly", () => {
  const sampleSchedules = [
    {
      reservationCode: "RES-101",
      customer: "John Doe",
      email: "john@example.com",
      phone: "09171234567",
      branch: "Gil Puyat",
      room: "Room 101",
      scheduledDate: "2026-08-01T10:00:00.000Z",
      visitDate: "2026-08-05T00:00:00.000Z",
      visitTime: "10:00 AM - 11:00 AM",
      visitApproved: false,
      visitStatus: "physical_visit_scheduled",
      actionedAt: null,
    },
  ];

  const formatted = formatVisitSchedulesForCSV(sampleSchedules);
  assert.equal(formatted.length, 1);
  assert.equal(formatted[0].reservationCode, "RES-101");
  assert.equal(formatted[0].visitorName, "John Doe");
  assert.equal(formatted[0].branch, "Gil Puyat");
  assert.equal(formatted[0].room, "Room 101");
  assert.equal(formatted[0].visitTime, "10:00 AM - 11:00 AM");
  assert.equal(formatted[0].status, "Awaiting Visit");
});
