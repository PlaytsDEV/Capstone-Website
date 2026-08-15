import test from "node:test";
import assert from "node:assert/strict";

import {
  ANNOUNCEMENT_CSV_COLUMNS,
  formatAnnouncementsForCSV,
} from "./announcementExportUtils.js";

test("ANNOUNCEMENT_CSV_COLUMNS has required fields", () => {
  const keys = ANNOUNCEMENT_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("title"));
  assert.ok(keys.includes("contentType"));
  assert.ok(keys.includes("category"));
  assert.ok(keys.includes("targetBranch"));
  assert.ok(keys.includes("publicationStatus"));
  assert.ok(keys.includes("requiresAcknowledgment"));
  assert.ok(keys.includes("isPinned"));
});

test("formatAnnouncementsForCSV formats announcement rows correctly", () => {
  const sampleAnnouncements = [
    {
      title: "Water Service Interruption",
      content: "Maintenance scheduled on Saturday.",
      contentType: "announcement",
      category: "maintenance",
      targetBranch: "both",
      publicationStatus: "published",
      startsAt: "2026-08-20T08:00:00.000Z",
      endsAt: "2026-08-20T17:00:00.000Z",
      isPinned: true,
      requiresAcknowledgment: true,
      acknowledgmentCount: 10,
      recipientCount: 15,
      acknowledgmentCompletionPercent: 67,
      createdAt: "2026-08-16T00:00:00.000Z",
    },
    {
      title: "Quiet Hours Policy",
      content: "Quiet hours start at 10 PM.",
      contentType: "policy",
      category: "policy",
      targetBranch: "gil-puyat",
      publicationStatus: "published",
      policyKey: "quiet-hours",
      version: 2,
      effectiveDate: "2026-09-01T00:00:00.000Z",
      isPinned: false,
      requiresAcknowledgment: false,
      createdAt: "2026-08-16T00:00:00.000Z",
    },
  ];

  const formatted = formatAnnouncementsForCSV(sampleAnnouncements);
  assert.equal(formatted.length, 2);

  // Check notice
  assert.equal(formatted[0].title, "Water Service Interruption");
  assert.equal(formatted[0].contentType, "General Notice");
  assert.equal(formatted[0].category, "Maintenance");
  assert.equal(formatted[0].targetBranch, "All Branches");
  assert.equal(formatted[0].publicationStatus, "Published");
  assert.equal(formatted[0].isPinned, "Yes");
  assert.equal(formatted[0].requiresAcknowledgment, "Yes");
  assert.equal(formatted[0].acknowledgmentCount, 10);
  assert.equal(formatted[0].recipientCount, 15);
  assert.equal(formatted[0].acknowledgmentCompletionPercent, "67%");

  // Check policy
  assert.equal(formatted[1].title, "Quiet Hours Policy");
  assert.equal(formatted[1].contentType, "Official Policy");
  assert.equal(formatted[1].policyKey, "quiet-hours");
  assert.equal(formatted[1].version, 2);
  assert.equal(formatted[1].isPinned, "No");
  assert.equal(formatted[1].requiresAcknowledgment, "No");
});
