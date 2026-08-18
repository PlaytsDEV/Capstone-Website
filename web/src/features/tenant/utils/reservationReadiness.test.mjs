import test from "node:test";
import assert from "node:assert/strict";
import {
  getReservationFeeStatusLabel,
  getStructuredMoveInReadiness,
  getAuthoritativeMoveInStatus,
  getMoveInReadinessLabel,
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

// ── authoritative backend readiness ─────────────────────────────────────────

test("getAuthoritativeMoveInStatus: no moveInReadiness field attached yet -> unknown, not ready", () => {
  const result = getAuthoritativeMoveInStatus(readyReservation());
  assert.equal(result.status, "unknown");
  assert.deepEqual(result.blockers, []);
});

test("getAuthoritativeMoveInStatus: malformed moveInReadiness (missing status) -> unknown", () => {
  const result = getAuthoritativeMoveInStatus(readyReservation({ moveInReadiness: {} }));
  assert.equal(result.status, "unknown");
});

test("getAuthoritativeMoveInStatus: backend-confirmed ready is passed through as-is", () => {
  const result = getAuthoritativeMoveInStatus(
    readyReservation({ moveInReadiness: { status: "ready", blockers: [] } }),
  );
  assert.equal(result.status, "ready");
});

test("getAuthoritativeMoveInStatus: backend-reported blockers (e.g. room/bed/occupancy conflict) are surfaced", () => {
  const result = getAuthoritativeMoveInStatus(
    readyReservation({
      moveInReadiness: {
        status: "blocked",
        blockers: ["A conflicting active Reservation already uses this room or bed."],
      },
    }),
  );
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.blockers, [
    "A conflicting active Reservation already uses this room or bed.",
  ]);
});

// ── composed dashboard label — the only function allowed to say "Move-in ready!" ──

test("getMoveInReadinessLabel: legacy (non-structured) workflow keeps unchanged 'Move-in ready!' wording", () => {
  assert.equal(getMoveInReadinessLabel({ status: "reserved" }), "Move-in ready!");
});

test("getMoveInReadinessLabel: applicant-side requirements complete alone (no authoritative data yet) must NOT claim final readiness", () => {
  // Applicant-side mirror reports ready=true, but the server hasn't attached
  // moveInReadiness (e.g. list-endpoint data, or the detail fetch hasn't
  // resolved yet) — this must never render "Move-in ready!" on its own.
  const label = getMoveInReadinessLabel(readyReservation());
  assert.notEqual(label, "Move-in ready!");
  assert.equal(label, "Applicant requirements complete — final confirmation pending");
});

test("getMoveInReadinessLabel: authoritative backend 'ready' status produces the final readiness claim", () => {
  const reservation = readyReservation({ moveInReadiness: { status: "ready", blockers: [] } });
  assert.equal(getMoveInReadinessLabel(reservation), "Move-in ready!");
});

test("getMoveInReadinessLabel: authoritative backend 'blocked' status (e.g. occupancy conflict the frontend mirror can't see) produces a blocked/pending label, never 'Move-in ready!'", () => {
  const reservation = readyReservation({
    moveInReadiness: {
      status: "blocked",
      blockers: ["A conflicting active Stay already uses this room or bed."],
    },
  });
  const label = getMoveInReadinessLabel(reservation);
  assert.notEqual(label, "Move-in ready!");
  assert.equal(label, "Reservation secured — move-in requirements pending");
});

test("getMoveInReadinessLabel: applicant-side requirements incomplete and no authoritative data -> pending label, not the awaiting-confirmation wording", () => {
  const reservation = readyReservation({ initialPaymentStatus: "not_created" });
  assert.equal(
    getMoveInReadinessLabel(reservation),
    "Reservation secured — move-in requirements pending",
  );
});

test("getMoveInReadinessLabel: stale authoritative 'blocked' wins even if applicant-side fields now look complete", () => {
  // Guards against a stale/cached moveInReadiness silently being ignored in
  // favor of an over-eager applicant-side read.
  const reservation = readyReservation({
    moveInReadiness: { status: "blocked", blockers: ["Bed or slot assignment is missing."] },
  });
  assert.equal(
    getMoveInReadinessLabel(reservation),
    "Reservation secured — move-in requirements pending",
  );
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
  assert.equal(result.dateType, "preferred");
  assert.equal(result.displayLabel, "Preferred Move-in");
  assert.equal(result.showRequested, false);
});

test("date labeling: confirmed reservation produces confirmed dateType and label", () => {
  const reservation = { status: "reserved", confirmedMoveInDate: "2026-09-01" };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, "2026-09-01");
  assert.equal(result.dateType, "confirmed");
  assert.equal(result.displayLabel, "Confirmed Move-in");
});

test("date labeling: neither date present -> unset dateType and to-be-scheduled label", () => {
  const result = resolveDisplayMoveInDate({}, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, null);
  assert.equal(result.dateType, "unset");
  assert.equal(result.displayLabel, "To be scheduled");
  assert.equal(result.showRequested, false);
});

test("date labeling: draft reservation in early step with unsubmitted application ignores legacy date", () => {
  const reservation = {
    status: "pending",
    moveInDate: "2026-09-17",
    intendedMoveInDate: "2026-09-17",
    viewingPreference: "physical_visit",
  };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, null);
  assert.equal(result.dateType, "unset");
  assert.equal(result.displayLabel, "To be scheduled");
  assert.equal(result.showRequested, false);
});

test("date labeling: submitted application in review displays preferred move-in date", () => {
  const reservation = {
    status: "pending_application_review",
    intendedMoveInDate: "2026-09-25",
    applicationSubmittedAt: new Date(),
  };
  const result = resolveDisplayMoveInDate(reservation, readMoveInDate, formatDate);
  assert.equal(result.primaryDate, "2026-09-25");
  assert.equal(result.dateType, "preferred");
  assert.equal(result.displayLabel, "Preferred Move-in");
  assert.equal(result.showRequested, false);
});
