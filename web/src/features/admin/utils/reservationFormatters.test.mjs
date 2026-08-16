import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPaymentStatus,
  getPaymentStatusBadgeConfig,
  formatRoomType,
  formatPhpCurrency,
  resolveReservationFeeStatus,
  resolveMoveInPaymentStatus,
} from "./reservationFormatters.js";

test("formatPaymentStatus: formats raw snake_case and status codes properly", () => {
  assert.equal(formatPaymentStatus("paid_in_full"), "Paid in Full");
  assert.equal(formatPaymentStatus("paid"), "Paid");
  assert.equal(formatPaymentStatus("partial"), "Partially Paid");
  assert.equal(formatPaymentStatus("pending"), "Pending Payment");
  assert.equal(formatPaymentStatus("payment_pending"), "Payment Pending");
  assert.equal(formatPaymentStatus("proof_uploaded"), "Proof Uploaded");
  assert.equal(formatPaymentStatus("verified"), "Verified");
  assert.equal(formatPaymentStatus("overdue"), "Overdue");
  assert.equal(formatPaymentStatus("failed"), "Payment Failed");
  assert.equal(formatPaymentStatus("refunded"), "Refunded");
  assert.equal(formatPaymentStatus("not_created"), "Unbilled");
  assert.equal(formatPaymentStatus("custom_status_test"), "Custom Status Test");
  assert.equal(formatPaymentStatus(null), "—");
  assert.equal(formatPaymentStatus(undefined), "—");
  assert.equal(formatPaymentStatus(""), "—");
});

test("getPaymentStatusBadgeConfig: returns valid solid styling object without gradients", () => {
  const paidBadge = getPaymentStatusBadgeConfig("paid_in_full");
  assert.equal(paidBadge.label, "Paid in Full");
  assert.equal(paidBadge.color, "#047857");
  assert.equal(paidBadge.bg, "#ECFDF5");
  assert.equal(paidBadge.border, "#A7F3D0");

  const pendingBadge = getPaymentStatusBadgeConfig("pending");
  assert.equal(pendingBadge.label, "Pending Payment");
  assert.equal(pendingBadge.color, "#B45309");

  const partialBadge = getPaymentStatusBadgeConfig("partial");
  assert.equal(partialBadge.label, "Partially Paid");

  const nullBadge = getPaymentStatusBadgeConfig(null);
  assert.equal(nullBadge.label, "—");
});

test("formatRoomType: formats kebab-case and custom room types cleanly", () => {
  assert.equal(formatRoomType("quadruple-sharing"), "Quadruple Sharing");
  assert.equal(formatRoomType("quadruple_sharing"), "Quadruple Sharing");
  assert.equal(formatRoomType("double-sharing"), "Double Sharing");
  assert.equal(formatRoomType("single-room"), "Single Room");
  assert.equal(formatRoomType("dorm-style"), "Dorm Style");
  assert.equal(formatRoomType("studio_deluxe"), "Studio Deluxe");
  assert.equal(formatRoomType(null), "—");
  assert.equal(formatRoomType(""), "—");
});

test("formatPhpCurrency: formats PHP amounts consistently", () => {
  assert.equal(formatPhpCurrency(5400), "PHP 5,400.00");
  assert.equal(formatPhpCurrency("2000"), "PHP 2,000.00");
  assert.equal(formatPhpCurrency(8800.5), "PHP 8,800.50");
  assert.equal(formatPhpCurrency(0), "PHP 0.00");
  assert.equal(formatPhpCurrency(null), "—");
  assert.equal(formatPhpCurrency(undefined), "—");
  assert.equal(formatPhpCurrency("invalid"), "—");
});

test("resolveReservationFeeStatus: distinguishes holding fee status accurately", () => {
  assert.equal(resolveReservationFeeStatus({ reservationFeePaymentStatus: "verified" }), "verified");
  assert.equal(resolveReservationFeeStatus({ reservationFeePaymentStatus: "pending" }), "pending");
  assert.equal(resolveReservationFeeStatus({ status: "reserved" }), "verified");
  assert.equal(resolveReservationFeeStatus({ status: "reserved", reservationFeePaymentStatus: "pending" }), "verified");
  assert.equal(resolveReservationFeeStatus({ initialPaymentStatus: "paid", reservationFeePaymentStatus: "pending" }), "verified");
  assert.equal(resolveReservationFeeStatus({ paymentStatus: "paid_in_full", reservationFeePaymentStatus: "pending" }), "verified");
  assert.equal(resolveReservationFeeStatus({ status: "moveIn" }), "verified");
  assert.equal(resolveReservationFeeStatus({ paidAt: "2026-08-01" }), "verified");
  assert.equal(resolveReservationFeeStatus({ paymentProof: "url", status: "pending" }), "proof_uploaded");
  assert.equal(resolveReservationFeeStatus({ reservationFeePaymentStatus: "reconciliation_required", status: "pending" }), "reconciliation_required");
  assert.equal(resolveReservationFeeStatus({ reservationFeePaymentStatus: "failed", status: "pending" }), "failed");
  assert.equal(resolveReservationFeeStatus(null), "pending");
});

test("resolveMoveInPaymentStatus: separates advance and deposit balance status from reservation fee", () => {
  assert.equal(resolveMoveInPaymentStatus({ initialPaymentStatus: "paid" }), "paid_in_full");
  assert.equal(resolveMoveInPaymentStatus({ initialPaymentStatus: "partial" }), "partial");
  assert.equal(resolveMoveInPaymentStatus({ paymentStatus: "paid_in_full" }), "paid_in_full");
  assert.equal(resolveMoveInPaymentStatus({ status: "moveIn" }), "paid_in_full");
  assert.equal(resolveMoveInPaymentStatus({ status: "approved_for_payment" }), "pending");
  assert.equal(resolveMoveInPaymentStatus({ status: "reserved", paymentStatus: "paid" }), "pending");
  assert.equal(resolveMoveInPaymentStatus({ status: "pending" }), "not_created");
  assert.equal(resolveMoveInPaymentStatus({ status: "pending_application_review" }), "not_created");
  assert.equal(resolveMoveInPaymentStatus(null), "not_created");
});

