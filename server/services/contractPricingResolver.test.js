import { describe, expect, test } from "@jest/globals";
import { resolveContractLeasePricing } from "./contractPricingResolver.js";

const quadrupleRoom = {
  type: "quadruple-sharing",
  price: 6300,
  monthlyPrice: 5400,
};

describe("resolveContractLeasePricing", () => {
  test("uses the short-term regular rate below the lease threshold", () => {
    expect(resolveContractLeasePricing({
      room: quadrupleRoom,
      roomType: "quadruple-sharing",
      leaseDurationMonths: 5,
      approvedMonthlyRate: 6300,
      longTermLeaseMinMonths: 6,
    })).toEqual({
      isLongTerm: false,
      leaseType: "short_term",
      regularMonthlyRate: 7000,
      discountPercentage: 10,
      discountAmount: 700,
      approvedMonthlyRate: 6300,
    });
  });

  test.each([6, 12])(
    "uses the long-term regular rate for a %d-month lease",
    (leaseDurationMonths) => {
      expect(resolveContractLeasePricing({
        room: quadrupleRoom,
        roomType: "quadruple-sharing",
        leaseDurationMonths,
        approvedMonthlyRate: 5400,
        longTermLeaseMinMonths: 6,
      })).toEqual({
        isLongTerm: true,
        leaseType: "long_term",
        regularMonthlyRate: 6000,
        discountPercentage: 10,
        discountAmount: 600,
        approvedMonthlyRate: 5400,
      });
    },
  );

  test("honors a configured lease threshold and custom regular rates", () => {
    expect(resolveContractLeasePricing({
      room: { regularLongRate: 6500, regularShortRate: 7500 },
      roomType: "quadruple-sharing",
      leaseDurationMonths: 9,
      approvedMonthlyRate: 5850,
      longTermLeaseMinMonths: 9,
    })).toEqual(expect.objectContaining({
      isLongTerm: true,
      leaseType: "long_term",
      regularMonthlyRate: 6500,
      discountPercentage: 10,
      discountAmount: 650,
    }));
  });

  test("records no discount when discounts are disabled in the locked rate", () => {
    expect(resolveContractLeasePricing({
      room: quadrupleRoom,
      roomType: "quadruple-sharing",
      leaseDurationMonths: 12,
      approvedMonthlyRate: 6000,
      longTermLeaseMinMonths: 6,
    })).toEqual(expect.objectContaining({
      regularMonthlyRate: 6000,
      discountPercentage: 0,
      discountAmount: 0,
      approvedMonthlyRate: 6000,
    }));
  });
});
