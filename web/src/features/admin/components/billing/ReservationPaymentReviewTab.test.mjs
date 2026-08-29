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
  assert.match(component, /Reservation & Move-In Payments/);
  assert.match(component, /Expected/);
  assert.match(component, /Submitted/);
  assert.match(component, /Settlement Variance/);
});

test("Category segmentation buttons and move-in financial breakdown are supported", () => {
  assert.match(component, /All Payments/);
  assert.match(component, /Reservation Fees/);
  assert.match(component, /1-Month Advance & Deposit/);
  assert.match(component, /Move-In Financial Settlement Breakdown/);
  assert.match(component, /1-Mo Advance Rent/);
  assert.match(component, /Security Deposit/);
  assert.match(component, /Reservation Credit/);
  assert.match(component, /Download Move-In Settlement Receipt/);
  assert.match(component, /Download Reservation Receipt/);
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

