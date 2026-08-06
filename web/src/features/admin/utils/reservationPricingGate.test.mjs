import test from "node:test";
import assert from "node:assert/strict";
import { resolveReservationApprovalPricingGate } from "./reservationPricingGate.js";

test("missing pricingDisplay (undefined) fails closed and blocks approval", () => {
  const gate = resolveReservationApprovalPricingGate(undefined);
  assert.equal(gate.pricingIsUsable, false);
  assert.equal(gate.pricingIsMissing, true);
  assert.equal(gate.pricingBlocksApproval, true);
});

test("missing pricingDisplay (null) fails closed and blocks approval", () => {
  const gate = resolveReservationApprovalPricingGate(null);
  assert.equal(gate.pricingIsUsable, false);
  assert.equal(gate.pricingIsMissing, true);
  assert.equal(gate.pricingBlocksApproval, true);
});

test('pricingDisplay.status === "unavailable" blocks approval (present but unresolved)', () => {
  const gate = resolveReservationApprovalPricingGate({
    status: "unavailable",
    reason: "LEASE_DURATION_INVALID",
  });
  assert.equal(gate.pricingIsUsable, false);
  assert.equal(gate.pricingIsMissing, false, "pricingDisplay object is present, just unusable");
  assert.equal(gate.pricingBlocksApproval, true);
});

test('pricingDisplay.status === "preview" allows the normal approval flow', () => {
  const gate = resolveReservationApprovalPricingGate({
    status: "preview",
    finalMonthlyRate: 5400,
  });
  assert.equal(gate.pricingIsUsable, true);
  assert.equal(gate.pricingBlocksApproval, false);
});

test('pricingDisplay.status === "snapshotted" allows the normal approval flow', () => {
  const gate = resolveReservationApprovalPricingGate({
    status: "snapshotted",
    finalMonthlyRate: 5400,
  });
  assert.equal(gate.pricingIsUsable, true);
  assert.equal(gate.pricingBlocksApproval, false);
});

test("an unrecognized status string is treated as unusable, not silently allowed", () => {
  const gate = resolveReservationApprovalPricingGate({ status: "pending_recalculation" });
  assert.equal(gate.pricingIsUsable, false);
  assert.equal(gate.pricingBlocksApproval, true);
});
