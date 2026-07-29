import assert from "node:assert/strict";
import {
  applyMoveInFilter,
  applyAppDateFilter,
  applyQuickChip,
} from "./reservationRows.js";

const mockNow = new Date("2026-07-27T12:00:00.000Z");

// applyMoveInFilter tests
assert.equal(applyMoveInFilter({ moveInDate: "2026-08-01" }, { moveIn: "any" }, mockNow), true);
assert.equal(applyMoveInFilter({}, {}, mockNow), true);

assert.equal(applyMoveInFilter({ moveInDate: "2026-07-27" }, { moveIn: "today" }, mockNow), true);
assert.equal(applyMoveInFilter({ moveInDate: "2026-07-28" }, { moveIn: "today" }, mockNow), false);

assert.equal(applyMoveInFilter({ moveInDate: "2026-07-15" }, { moveIn: "this_month" }, mockNow), true);
assert.equal(applyMoveInFilter({ moveInDate: "2026-08-01" }, { moveIn: "this_month" }, mockNow), false);

assert.equal(applyMoveInFilter({ moveInDate: "2026-08-10" }, { moveIn: "next_30_days" }, mockNow), true);
assert.equal(applyMoveInFilter({ moveInDate: "2026-09-15" }, { moveIn: "next_30_days" }, mockNow), false);

const customMoveInFilters = {
  moveIn: "custom",
  moveInStart: "2026-08-01",
  moveInEnd: "2026-08-15",
};
assert.equal(applyMoveInFilter({ moveInDate: "2026-08-05" }, customMoveInFilters, mockNow), true);
assert.equal(applyMoveInFilter({ moveInDate: "2026-07-20" }, customMoveInFilters, mockNow), false);
assert.equal(applyMoveInFilter({ moveInDate: "2026-08-20" }, customMoveInFilters, mockNow), false);

// applyAppDateFilter tests
assert.equal(applyAppDateFilter({ createdAt: "2026-07-01" }, { applicationDate: "any" }, mockNow), true);

const freshDate = new Date(mockNow.getTime() - 2 * 60 * 60 * 1000).toISOString();
const oldDate = new Date(mockNow.getTime() - 30 * 60 * 60 * 1000).toISOString();
assert.equal(applyAppDateFilter({ createdAt: freshDate }, { applicationDate: "last_24h" }, mockNow), true);
assert.equal(applyAppDateFilter({ createdAt: oldDate }, { applicationDate: "last_24h" }, mockNow), false);

const inside7d = new Date(mockNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
const outside7d = new Date(mockNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
assert.equal(applyAppDateFilter({ createdAt: inside7d }, { applicationDate: "last_7d" }, mockNow), true);
assert.equal(applyAppDateFilter({ createdAt: outside7d }, { applicationDate: "last_7d" }, mockNow), false);

// applyQuickChip tests
assert.equal(applyQuickChip({ isNew: false }, null), true);
assert.equal(applyQuickChip({ isNew: true }, "new"), true);
assert.equal(applyQuickChip({ isNew: false }, "new"), false);

assert.equal(applyQuickChip({ cancellationRequested: true, cancellationStatus: "pending" }, "cancellation"), true);
assert.equal(applyQuickChip({ cancellationRequested: false }, "cancellation"), false);

assert.equal(applyQuickChip({ paymentStatus: "pending", status: "approved_for_payment" }, "awaiting_payment"), true);
assert.equal(applyQuickChip({ paymentStatus: "paid", status: "approved_for_payment" }, "awaiting_payment"), false);

assert.equal(applyQuickChip({ paymentStatus: "proof_uploaded" }, "proof_uploaded"), true);
assert.equal(applyQuickChip({ paymentStatus: "pending" }, "proof_uploaded"), false);

console.log("reservationFilters tests passed");
