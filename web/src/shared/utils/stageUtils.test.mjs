import test from "node:test";
import assert from "node:assert/strict";
import {
  getStageFractionInfo,
  formatStageStatus,
  STAGE_CONFIGURATIONS,
} from "./stageUtils.js";

test("stageUtils: maintenance module fractional stages", () => {
  // Stage 1
  const pending = getStageFractionInfo("maintenance", "pending_review");
  assert.equal(pending.stageNum, 1);
  assert.equal(pending.totalStages, 5);
  assert.equal(pending.formattedLabel, "Pending Review [1/5]");
  assert.equal(pending.isStage, true);

  // Stage 2
  const reviewed = getStageFractionInfo("maintenance", "reviewed");
  assert.equal(reviewed.stageNum, 2);
  assert.equal(reviewed.totalStages, 5);
  assert.equal(reviewed.formattedLabel, "Under Review [2/5]");

  // Stage 3
  const provider = getStageFractionInfo("maintenance", "provider_assigned");
  assert.equal(provider.stageNum, 3);
  assert.equal(provider.totalStages, 5);
  assert.equal(provider.formattedLabel, "Provider Assigned [3/5]");

  const inProgress = getStageFractionInfo("maintenance", "in_progress");
  assert.equal(inProgress.stageNum, 3);
  assert.equal(inProgress.formattedLabel, "In Progress [3/5]");

  // Stage 4
  const resolved = getStageFractionInfo("maintenance", "resolved");
  assert.equal(resolved.stageNum, 4);
  assert.equal(resolved.totalStages, 5);
  assert.equal(resolved.formattedLabel, "Resolved [4/5]");

  // Stage 5
  const completed = getStageFractionInfo("maintenance", "completed");
  assert.equal(completed.stageNum, 5);
  assert.equal(completed.totalStages, 5);
  assert.equal(completed.formattedLabel, "Completed [5/5]");

  // Terminal states (no fraction)
  const rejected = getStageFractionInfo("maintenance", "rejected");
  assert.equal(rejected.isTerminal, true);
  assert.equal(rejected.stageNum, null);
  assert.equal(rejected.formattedLabel, "Rejected");

  const cancelled = getStageFractionInfo("maintenance", "cancelled");
  assert.equal(cancelled.isTerminal, true);
  assert.equal(cancelled.stageNum, null);
  assert.equal(cancelled.formattedLabel, "Cancelled");
});

test("stageUtils: reservation module fractional stages", () => {
  assert.equal(formatStageStatus("reservation", "pending"), "Room Selected [1/5]");
  assert.equal(
    formatStageStatus("reservation", "approved_for_payment"),
    "Approved for Payment [2/5]",
  );
  assert.equal(
    formatStageStatus("reservation", "payment_pending"),
    "Payment Pending [3/5]",
  );
  assert.equal(
    formatStageStatus("reservation", "reserved"),
    "Reserved [4/5]",
  );
  assert.equal(formatStageStatus("reservation", "moveIn"), "Move In [5/5]");

  // Terminal
  assert.equal(formatStageStatus("reservation", "cancelled"), "Cancelled");
  assert.equal(formatStageStatus("reservation", "overdue"), "Overdue");
});

test("stageUtils: contract module fractional stages", () => {
  assert.equal(formatStageStatus("contract", "draft"), "Draft [1/5]");
  assert.equal(formatStageStatus("contract", "generated"), "Prepared [2/5]");
  assert.equal(
    formatStageStatus("contract", "awaiting_signatures"),
    "Awaiting Signatures [3/5]",
  );
  assert.equal(
    formatStageStatus("contract", "ready_for_publication"),
    "Ready for Publication [4/5]",
  );
  assert.equal(formatStageStatus("contract", "active"), "Active [5/5]");

  // Terminal
  assert.equal(formatStageStatus("contract", "expired"), "Expired");
  assert.equal(formatStageStatus("contract", "terminated"), "Terminated");
});

test("stageUtils: visit module fractional stages", () => {
  assert.equal(
    formatStageStatus("visit", "visit_pending"),
    "Visit Pending [1/3]",
  );
  assert.equal(
    formatStageStatus("visit", "visit_approved"),
    "Visit Confirmed [2/3]",
  );
  assert.equal(formatStageStatus("visit", "completed"), "Completed [3/3]");

  // Terminal
  assert.equal(formatStageStatus("visit", "no-show"), "No Show");
  assert.equal(formatStageStatus("visit", "cancelled"), "Cancelled");
});

test("stageUtils: customLabel preservation", () => {
  const result = getStageFractionInfo(
    "contract",
    "generated",
    "Prepared Document",
  );
  assert.equal(result.formattedLabel, "Prepared Document [2/5]");
});
