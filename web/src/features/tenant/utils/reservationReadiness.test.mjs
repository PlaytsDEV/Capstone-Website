import test from "node:test";
import assert from "node:assert/strict";
import {
  getReservationFeeStatusLabel,
  getStructuredMoveInReadiness,
  resolveDisplayMoveInDate,
} from "./reservationReadiness.js";

const STRUCTURED = "structured-initial-payment-v1";

// A fully-ready structured reservation — mirrors the backend fixture in
// server/services/structuredMoveInReadiness.test.js (readyReservation()).
const readyReservation = (overrides = {}) => ({
  financialWorkflowVersion: STRUCTURED,
  reservationFeePaymentStatus: "verified",
  initialPaymentStatus: "paid",
  pricingSnapshot: { approvedAt: "2026-08-02T00:00:00.000Z" },
  emergencyContact: { name: "Emergency Contact", contactNumber: "09170000000" },
  selfiePhotoUrl: "private://selfie",
  validIDFrontUrl: "private://front",
  validIDBackUrl: "private://back",
  agreedToPrivacy: true,
  agreedToCertification: true,
  houseRulesPreparedAt: "2026-08-02T00:00:00.000Z",
  ...overrides,
});

test("legacy (non-structured) workflow keeps the original 'Payment verified' wording", () => {
  assert.equal(getReservationFeeStatusLabel({ status: "reserved" }), "Payment verified");
});

test("fee-only-paid structured reservation shows 'Reservation fee verified', not 'Payment verified'", () => {
  const reservation = readyReservation({ initialPaymentStatus: "not_created", houseRulesPreparedAt: null });
  assert.equal(getReservationFeeStatusLabel(reservation), "Reservation fee verified");
});

test("fee not yet verified shows 'Reservation fee pending'", () => {
  const reservation = readyReservation({ reservationFeePaymentStatus: "pending" });
  assert.equal(getReservationFeeStatusLabel(reservation), "Reservation fee pending");
});

test("readiness: fee-only-paid state (Bill not created) is NOT move-in ready", () => {
  const reservation = readyReservation({ initialPaymentStatus: "not_created" });
  const { ready, reasons } = getStructuredMoveInReadiness(reservation);
  assert.equal(ready, false);
  assert.ok(reasons.includes("Structured initial-payment Bill is not fully paid"));
});

test("readiness: Bill unpaid/partial -> not ready, pending reason surfaced", () => {
  const reservation = readyReservation({ initialPaymentStatus: "partial" });
  const { ready, reasons } = getStructuredMoveInReadiness(reservation);
  assert.equal(ready, false);
  assert.ok(reasons.includes("Structured initial-payment Bill is not fully paid"));
});

test("readiness: Bill paid but documents/contract-prep incomplete -> not ready", () => {
  const reservation = readyReservation({ selfiePhotoUrl: null });
  const { ready, reasons } = getStructuredMoveInReadiness(reservation);
  assert.equal(ready, false);
  assert.ok(reasons.includes("Required documents are incomplete"));
});

test("readiness: all conditions clear -> ready with no reasons", () => {
  const { ready, reasons } = getStructuredMoveInReadiness(readyReservation());
  assert.equal(ready, true);
  assert.deepEqual(reasons, []);
});

test("readiness: legacy (non-structured) reservations report ready=null (not evaluated), not false", () => {
  const { ready, reasons } = getStructuredMoveInReadiness({ status: "reserved" });
  assert.equal(ready, null);
  assert.deepEqual(reasons, []);
});

test("readiness fails closed on missing/malformed data instead of claiming ready", () => {
  assert.equal(getStructuredMoveInReadiness(null).ready, false);
  assert.equal(getStructuredMoveInReadiness(undefined).ready, false);
  assert.equal(getStructuredMoveInReadiness("not-an-object").ready, false);
});

// ── date labeling ──────────────────────────────────────────────────────────

const readMoveInDate = (r) =>
  r?.confirmedMoveInDate ?? r?.moveInDate ?? r?.intendedMoveInDate ?? r?.targetMoveInDate ?? null;
const formatDate = (d) => new Date(d).toISOString().slice(0, 10);

test("date labeling: confirmed date is primary, requested date not shown when they match", () => {
  const reservation = { moveInDate: "2026-09-05", targetMoveInDate: "2026-09-05" };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, "2026-09-05");
  assert.equal(result.showRequested, false);
});

test("date labeling: confirmed date differs from requested -> both shown, requested labeled separately", () => {
  const reservation = { moveInDate: "2026-09-05", targetMoveInDate: "2026-08-10" };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, "2026-09-05");
  assert.equal(result.showRequested, true);
  assert.equal(result.requestedDate, "2026-08-10");
});

test("date labeling: no confirmed date yet -> falls back to requested as primary, not shown twice", () => {
  const reservation = { targetMoveInDate: "2026-08-10" };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, "2026-08-10");
  assert.equal(result.showRequested, false);
});

test("date labeling: neither date present -> no primary date", () => {
  const result = resolveDisplayMoveInDate({}, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, null);
  assert.equal(result.showRequested, false);
});
