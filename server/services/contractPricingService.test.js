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
});
