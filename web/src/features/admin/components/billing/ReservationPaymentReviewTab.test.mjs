import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const component = fs.readFileSync(
  path.resolve("src/features/admin/components/billing/ReservationPaymentReviewTab.jsx"),
  "utf8",
);
const page = fs.readFileSync(
  path.resolve("src/features/admin/pages/AdminBillingPage.jsx"),
  "utf8",
);
const api = fs.readFileSync(
  path.resolve("src/shared/api/reservationApi.js"),
  "utf8",
);

test("manual Reservation proof review is mounted in the active Billing workspace", () => {
  assert.match(page, /ReservationPaymentReviewTab/);
  assert.match(page, /reservation-payments/);
  assert.match(component, /Reservation Payment Review/);
  assert.match(component, /Expected/);
  assert.match(component, /Submitted/);
  assert.match(component, /View Payment Proof/);
});

test("manual approval is gated and confirmed PayMongo entries are informational", () => {
  assert.match(
    component,
    /payment\.source === "manual_proof" && payment\.status === "under_review"/,
  );
  assert.match(component, /Automatically confirmed by PayMongo/);
  assert.match(component, /No manual approval action available for this payment/);
});

test("decision modal preserves backend errors and prevents duplicate clicks", () => {
  assert.match(component, /role="alert"/);
  assert.match(component, /setError\(errorMessage\(requestError\)\)/);
  assert.match(component, /if \(!decision \|\| saving\) return/);
  assert.match(component, /PAYMENT_REJECTION_REASON_REQUIRED/);
  assert.match(component, /disabled=\{saving\}/);
});

test("frontend calls only dedicated proof decision endpoints", () => {
  assert.match(api, /listPaymentProofReviews/);
  assert.match(api, /approvePaymentProof/);
  assert.match(api, /rejectPaymentProof/);
  assert.doesNotMatch(component, /paymentStatus\s*:/);
  assert.doesNotMatch(component, /status\s*:\s*"reserved"/);
});
