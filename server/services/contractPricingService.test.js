import { describe, expect, test } from "@jest/globals";
import { buildInitialPaymentSummary } from "./contractPricingService.js";

const valid = (overrides = {}) => buildInitialPaymentSummary({
  advanceRentAmount: 6300,
  securityDepositAmount: 6300,
  reservationFeeAmount: 2000,
  approvedReservationFeeCreditAmount: 2000,
  reservationPaymentStatus: "partial",
  ...overrides,
});

describe("Contract initial payment summary", () => {
  test("calculates charges, applied credit, and remaining due", () => {
    expect(valid()).toMatchObject({
      valid: true,
      totalInitialCharges: 12600,
      verifiedReservationFeePaid: 2000,
      reservationFeeCreditApplied: 2000,
      remainingInitialAmountDue: 10600,
    });
  });
  test("credit cannot exceed verified payment", () => {
    const result = valid({ reservationFeeAmount: 1000 });
    expect(result.reservationFeeCreditApplied).toBe(1000);
    expect(result.errors).toContainEqual({ code: "RESERVATION_FEE_CREDIT_EXCEEDS_PAYMENT" });
  });
  test("credit cannot exceed initial charges and due cannot become negative", () => {
    const result = valid({
      advanceRentAmount: 500,
      securityDepositAmount: 500,
      reservationFeeAmount: 2000,
      approvedReservationFeeCreditAmount: 2000,
    });
    expect(result.reservationFeeCreditApplied).toBe(1000);
    expect(result.remainingInitialAmountDue).toBe(0);
    expect(result.errors).toContainEqual({ code: "RESERVATION_FEE_CREDIT_EXCEEDS_INITIAL_CHARGES" });
  });
  test("unverified reservation payment blocks an approved credit", () => {
    expect(valid({ reservationPaymentStatus: "pending" }).errors)
      .toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  });

  test("legacy paid status remains valid", () => {
    expect(valid({ reservationPaymentStatus: "paid" }).valid).toBe(true);
  });

  test("legacy pending status remains invalid when a credit requires verification", () => {
    expect(valid({ reservationPaymentStatus: "pending" }).valid).toBe(false);
  });
});

describe("Contract initial payment summary — structured workflow", () => {
  const structured = (overrides = {}) => buildInitialPaymentSummary({
    advanceRentAmount: 6300,
    securityDepositAmount: 6300,
    reservationFeeAmount: 2000,
    approvedReservationFeeCreditAmount: 2000,
    // Legacy field intentionally left at its unrelated default to prove it no
    // longer controls structured verification.
    reservationPaymentStatus: "pending",
    financialWorkflowVersion: "structured-initial-payment-v1",
    reservationFeePaymentStatus: "verified",
    ...overrides,
  });

  test("a verified structured reservation fee is accepted despite legacy paymentStatus being unset", () => {
    const result = structured();
    expect(result.valid).toBe(true);
    expect(result.errors).not.toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
    // The authoritative arithmetic must be unaffected by the verification-source fix.
    expect(result).toMatchObject({
      totalInitialCharges: 12600,
      verifiedReservationFeePaid: 2000,
      reservationFeeCreditApplied: 2000,
      remainingInitialAmountDue: 10600,
    });
  });

  test("a pending structured reservation fee remains unverified", () => {
    const result = structured({ reservationFeePaymentStatus: "pending" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  });

  test("a failed structured reservation fee remains unverified", () => {
    const result = structured({ reservationFeePaymentStatus: "failed" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  });

  test("a reconciliation-required structured reservation fee remains unverified", () => {
    const result = structured({ reservationFeePaymentStatus: "reconciliation_required" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  });

  test("zero reservation-fee credit does not require verification", () => {
    const result = structured({
      approvedReservationFeeCreditAmount: 0,
      reservationFeePaymentStatus: "pending",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).not.toContainEqual({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  });
});
