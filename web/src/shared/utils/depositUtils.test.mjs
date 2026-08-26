import test from "node:test";
import assert from "node:assert/strict";
import { resolveReservationFinancials } from "./depositUtils.js";

test("resolveReservationFinancials: does NOT deduct reservation fee when unpaid or pending", () => {
  const reservation = {
    _id: "res_unpaid_123",
    roomType: "quadruple-sharing",
    monthlyRent: 6300,
    reservationFeeAmount: 2000,
    reservationFeePaymentStatus: "pending",
    initialPaymentStatus: "unpaid",
    status: "pending",
  };

  const financials = resolveReservationFinancials(reservation);

  assert.equal(financials.monthlyRent, 6300);
  assert.equal(financials.advanceRent, 6300);
  assert.equal(financials.securityDeposit, 6300);
  assert.equal(financials.grossTotal, 12600);
  assert.equal(financials.isReservationFeePaid, false);
  assert.equal(financials.appliedReservationCredit, 0);
  // Remaining due MUST be full gross total (12600), NOT prematurely discounted to 10600
  assert.equal(financials.remainingDue, 12600);
  assert.equal(financials.isSettled, false);
});

test("resolveReservationFinancials: deducts reservation fee ONLY when reservationFeePaymentStatus is verified", () => {
  const reservation = {
    _id: "res_paid_123",
    roomType: "quadruple-sharing",
    monthlyRent: 6300,
    reservationFeeAmount: 2000,
    reservationFeePaymentStatus: "verified",
    initialPaymentStatus: "unpaid",
    status: "pending",
  };

  const financials = resolveReservationFinancials(reservation);

  assert.equal(financials.monthlyRent, 6300);
  assert.equal(financials.advanceRent, 6300);
  assert.equal(financials.securityDeposit, 6300);
  assert.equal(financials.grossTotal, 12600);
  assert.equal(financials.isReservationFeePaid, true);
  assert.equal(financials.appliedReservationCredit, 2000);
  // Remaining due is grossTotal - 2000 = 10600
  assert.equal(financials.remainingDue, 10600);
  assert.equal(financials.isSettled, false);
});

test("resolveReservationFinancials: remaining due is 0 when initialPaymentStatus is paid", () => {
  const reservation = {
    _id: "res_settled_123",
    roomType: "quadruple-sharing",
    monthlyRent: 6300,
    reservationFeeAmount: 2000,
    reservationFeePaymentStatus: "verified",
    initialPaymentStatus: "paid",
    status: "reserved",
  };

  const financials = resolveReservationFinancials(reservation);

  assert.equal(financials.remainingDue, 0);
  assert.equal(financials.isSettled, true);
  assert.equal(financials.appliedReservationCredit, 2000);
});

test("resolveReservationFinancials: recognizes legacy reservation fee statuses (settled, completed, paid)", () => {
  const legacySettled = {
    _id: "res_legacy_1",
    monthlyRent: 5000,
    reservationFeeAmount: 1500,
    reservationFeePaymentStatus: "settled",
    initialPaymentStatus: "pending",
    status: "pending",
  };
  const legacyCompleted = {
    _id: "res_legacy_2",
    monthlyRent: 5000,
    reservationFeeAmount: 1500,
    reservationFeePaymentStatus: "completed",
    initialPaymentStatus: "pending",
    status: "pending",
  };
  const legacyPaid = {
    _id: "res_legacy_3",
    monthlyRent: 5000,
    reservationFeeAmount: 1500,
    reservationFeePaymentStatus: "paid",
    initialPaymentStatus: "pending",
    status: "pending",
  };

  assert.equal(resolveReservationFinancials(legacySettled).isReservationFeePaid, true);
  assert.equal(resolveReservationFinancials(legacySettled).appliedReservationCredit, 1500);
  assert.equal(resolveReservationFinancials(legacyCompleted).isReservationFeePaid, true);
  assert.equal(resolveReservationFinancials(legacyCompleted).appliedReservationCredit, 1500);
  assert.equal(resolveReservationFinancials(legacyPaid).isReservationFeePaid, true);
  assert.equal(resolveReservationFinancials(legacyPaid).appliedReservationCredit, 1500);
});

test("resolveReservationFinancials: recognizes payment timestamps as proof of settlement", () => {
  const withTimestamp = {
    _id: "res_ts_1",
    monthlyRent: 7000,
    reservationFeeAmount: 2000,
    reservationFeePaidAt: new Date("2026-08-01"),
    initialPaymentStatus: "unpaid",
    status: "pending",
  };

  const financials = resolveReservationFinancials(withTimestamp);
  assert.equal(financials.isReservationFeePaid, true);
  assert.equal(financials.appliedReservationCredit, 2000);
  assert.equal(financials.remainingDue, 12000);
});

