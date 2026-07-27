import { describe, expect, test } from "@jest/globals";
import {
  buildReservationPaymentPricingSnapshot,
  getReservationCheckoutBlockers,
  resolveReservationInitialCharges,
  validateReservationPaymentQuote,
} from "./reservationPaymentPolicy.js";

const snapshot = (reservationFeeAmount = 2000) => ({
  ...buildReservationPaymentPricingSnapshot({
    monthlyRent: 6300,
    reservationFeeAmount,
    moveInCashOut: {
      monthlyAdvance: 6300,
      securityDeposit: 6300,
      netAmountDue: 12600 - reservationFeeAmount,
    },
  }),
  approvedAt: new Date(),
});
describe("reservationPaymentPolicy", () => {
  test("uses the stored authoritative move-in snapshot", () => {
    expect(resolveReservationInitialCharges({
      paymentPricingSnapshot: snapshot(),
    })).toEqual(expect.objectContaining({
      monthlyRent: 6300,
      advanceRent: 6300,
      securityDeposit: 6300,
      reservationFeeCredit: 2000,
      amountDue: 10600,
      currency: "PHP",
      pricingVersion: 1,
    }));
  });

  test("requires explicit application, payment, deadline, and method approval", () => {
    const { blockers } = getReservationCheckoutBlockers({
      paymentPricingSnapshot: snapshot(),
    });
    expect(blockers).toEqual(expect.arrayContaining([
      "applicationApproval",
      "paymentApproval",
      "paymentDeadline",
      "paymentMethod",
    ]));
  });

  test("accepts an approved authoritative quote including explicit zero fee", () => {
    const paymentPricingSnapshot = snapshot(0);
    const reservation = {
      paymentPricingSnapshot,
      applicationReviewedAt: new Date(),
      applicationReviewedBy: "admin-1",
      approvedForPaymentAt: new Date(),
      paymentExpiresAt: new Date(Date.now() + 60_000),
      approvedPaymentMethods: ["paymongo"],
    };
    const { blockers, quote } = getReservationCheckoutBlockers(reservation);
    expect(blockers).toEqual([]);
    expect(quote.amountDue).toBe(12600);
    expect(validateReservationPaymentQuote(reservation).valid).toBe(true);
  });

  test("does not silently convert a missing Reservation fee to zero", () => {
    const paymentPricingSnapshot = snapshot();
    paymentPricingSnapshot.reservationFeeCredit = null;
    expect(validateReservationPaymentQuote({ paymentPricingSnapshot }).missingFields)
      .toContain("approvedReservationFee");
  });
});
