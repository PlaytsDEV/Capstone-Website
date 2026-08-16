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

test("Reservation payments tab is mounted in the active Billing workspace", () => {
  assert.match(page, /ReservationPaymentReviewTab/);
  assert.match(page, /reservation-payments/);
  assert.match(component, /Reservation Payments/);
  assert.match(component, /Expected/);
  assert.match(component, /Submitted/);
  assert.match(component, /Settlement Variance/);
});

test("PayMongo automated entries are informational and manual proof is removed", () => {
  assert.match(component, /Verified via PayMongo/);
  assert.doesNotMatch(component, /Manual Proofs/);
  assert.doesNotMatch(component, /Financial Review Decision/);
  assert.doesNotMatch(component, /View Payment Proof Receipt/);
});

test("alert banner handles request errors without raw exceptions", () => {
  assert.match(component, /role="alert"/);
  assert.match(component, /setError\(errorMessage\(requestError\)\)/);
  assert.match(component, /currentPage/);
  assert.match(component, /itemsPerPage/);
});

test("frontend calls payment ledger and does not mutate reservation status directly", () => {
  assert.match(api, /listPaymentProofReviews/);
  assert.doesNotMatch(component, /paymentStatus\s*:/);
  assert.doesNotMatch(component, /status\s*:\s*"reserved"/);
});
