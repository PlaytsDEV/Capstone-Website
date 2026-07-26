import test from "node:test";
import assert from "node:assert/strict";
import {
  formatContractHistoryReason,
  getContractBlockers,
  getReadinessCopy,
  mapContractBlocker,
} from "./contractReadiness.mjs";

test("maps backend validation into administrator tasks without raw codes", () => {
  assert.deepEqual(mapContractBlocker({ code: "RESERVATION_NOT_APPROVED" }), {
    kind: "reservation",
    title: "Approve Reservation and Application",
    description: "The reservation and application must be approved before Contract generation.",
    action: "Open Reservation",
  });
  assert.equal(mapContractBlocker({ code: "PRICING_APPROVAL_REQUIRED" }).action, "Review Pricing");
  assert.equal(mapContractBlocker({ code: "ROOM_ASSIGNMENT_MISSING" }).action, "Open Tenant Assignment");
  assert.doesNotMatch(JSON.stringify(getContractBlockers({
    valid: false, errors: [{ code: "LEASE_DATES_MISSING" }],
  })), /LEASE_DATES_MISSING/);
});

test("readiness uses task-based lifecycle states", () => {
  assert.equal(getReadinessCopy({ status: "incomplete" }, {
    valid: false, errors: [{ code: "RESERVATION_NOT_APPROVED" }],
  }).title, "Contract Needs Attention");
  assert.equal(getReadinessCopy({ status: "ready_for_generation" }, { valid: true }).title, "Ready to Generate");
  assert.equal(getReadinessCopy({ status: "generated" }, null).title, "Prepared Contract Available");
  assert.equal(getReadinessCopy({ status: "notarized" }, null).title, "Ready to Publish");
});

test("technical migration reasons are presented in administrator language", () => {
  assert.equal(
    formatContractHistoryReason("New official Version 1 template requires approved legal pricing review"),
    "Contract returned for pricing approval before generation.",
  );
  assert.equal(
    formatContractHistoryReason("Prepared test-document reset: Replace obsolete unsigned generated copy"),
    "Prepared test copy was reset for regeneration using the updated official template.",
  );
});
