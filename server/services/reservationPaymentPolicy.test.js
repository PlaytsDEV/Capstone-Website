import { describe, expect, test } from "@jest/globals";
import {
  getReservationCheckoutBlockers,
  resolveReservationInitialCharges,
} from "./reservationPaymentPolicy.js";

describe("reservationPaymentPolicy", () => {
  test("applies the reservation fee once to approved initial move-in charges", () => {
    expect(resolveReservationInitialCharges({
      monthlyRent: 6300,
      reservationFeeAmount: 2000,
    })).toEqual({
      approvedMonthlyRate: 6300,
      advanceRent: 6300,
      securityDeposit: 6300,
      reservationFeeAmount: 2000,
      initialCharges: 12600,
      remainingInitialAmount: 10600,
      currency: "PHP",
    });
  });

  test("requires explicit application and payment approval", () => {
    const { blockers } = getReservationCheckoutBlockers({
      monthlyRent: 6300,
      reservationFeeAmount: 2000,
    });

    expect(blockers).toEqual(expect.arrayContaining([
      "APPLICATION_APPROVAL_MISSING",
      "PAYMENT_APPROVAL_MISSING",
    ]));
  });

  test("accepts an approved, priced reservation", () => {
    const { blockers, pricing } = getReservationCheckoutBlockers({
      monthlyRent: 6300,
      reservationFeeAmount: 2000,
      applicationReviewedAt: new Date(),
      applicationReviewedBy: "admin-1",
      approvedForPaymentAt: new Date(),
    });

    expect(blockers).toEqual([]);
    expect(pricing.remainingInitialAmount).toBe(10600);
  });
});
