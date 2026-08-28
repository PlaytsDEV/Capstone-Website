import test from "node:test";
import assert from "node:assert/strict";
import { getNextRecommendedStageAction } from "../../../../shared/utils/maintenanceConfig.js";

test("getNextRecommendedStageAction: returns Mark Work Done & Upload Proof for scheduled status", () => {
  const req = { status: "scheduled" };
  const action = getNextRecommendedStageAction(req);
  assert.ok(action, "Should return a recommended action for scheduled status");
  assert.equal(action.actionKey, "upload_proof");
  assert.equal(action.actionLabel, "Mark Work Done & Upload Proof");
});

test("getNextRecommendedStageAction: returns Mark Work Done & Upload Proof for provider_assigned status", () => {
  const req = { status: "provider_assigned" };
  const action = getNextRecommendedStageAction(req);
  assert.ok(action, "Should return a recommended action for provider_assigned status");
  assert.equal(action.actionKey, "upload_proof");
  assert.equal(action.actionLabel, "Mark Work Done & Upload Proof");
});

test("getNextRecommendedStageAction: returns Mark Work Done & Upload Proof for in_progress status", () => {
  const req = { status: "in_progress" };
  const action = getNextRecommendedStageAction(req);
  assert.ok(action, "Should return a recommended action for in_progress status");
  assert.equal(action.actionKey, "upload_proof");
  assert.equal(action.actionLabel, "Mark Work Done & Upload Proof");
});
