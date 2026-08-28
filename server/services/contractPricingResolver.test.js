import { describe, test, expect } from "@jest/globals";
import {
  resolveAuthoritativeLeasePricing,
  resolveRoomDiscountPricing,
} from "./contractPricingResolver.js";

describe("contractPricingResolver — Lease Duration Classification & Dual-Tier Pricing", () => {
  describe("resolveRoomDiscountPricing", () => {
    test("resolves correct dual-tier base rates and discounts for quadruple sharing", () => {
      const pricing = resolveRoomDiscountPricing("quadruple-sharing", {
        isDiscountEnabled: true,
        quadrupleDiscountPercent: 10,
      });

      expect(pricing.longTermLeaseMinMonths).toBe(6);
      expect(pricing.regularShortRate).toBe(7000);
      expect(pricing.shortTermRate).toBe(6300);
      expect(pricing.regularLongRate).toBe(6000);
      expect(pricing.monthlyPrice).toBe(5400);
      expect(pricing.longTermDiscountPercent).toBe(10);
    });

    test("resolves correct dual-tier base rates and discounts for double sharing", () => {
      const pricing = resolveRoomDiscountPricing("double-sharing", {
        isDiscountEnabled: true,
        doubleDiscountPercent: 20,
      });

      expect(pricing.longTermLeaseMinMonths).toBe(6);
      expect(pricing.regularShortRate).toBe(10000);
      expect(pricing.shortTermRate).toBe(8000);
      expect(pricing.regularLongRate).toBe(9000);
      expect(pricing.monthlyPrice).toBe(7200);
      expect(pricing.longTermDiscountPercent).toBe(20);
    });

    test("resolves correct dual-tier base rates and discounts for private room", () => {
      const pricing = resolveRoomDiscountPricing("private", {
        isDiscountEnabled: true,
        privateDiscountPercent: 10,
      });

      expect(pricing.longTermLeaseMinMonths).toBe(6);
      expect(pricing.regularShortRate).toBe(16000);
      expect(pricing.shortTermRate).toBe(14400);
      expect(pricing.regularLongRate).toBe(15000);
      expect(pricing.monthlyPrice).toBe(13500);
      expect(pricing.longTermDiscountPercent).toBe(10);
    });
  });

  describe("resolveAuthoritativeLeasePricing — 1-5 months Short-Term vs 6-12 months Long-Term", () => {
    test("1 to 5 months are strictly Short-Term with short-term base rate (7000 -> 6300 for quad)", () => {
      for (let months = 1; months <= 5; months++) {
        const pricing = resolveAuthoritativeLeasePricing({
          roomType: "quadruple-sharing",
          leaseDurationMonths: months,
          settings: { isDiscountEnabled: true, quadrupleDiscountPercent: 10 },
        });

        expect(pricing.isLongTerm).toBe(false);
        expect(pricing.leaseType).toBe("short_term");
        expect(pricing.regularMonthlyRate).toBe(7000);
        expect(pricing.finalMonthlyRate).toBe(6300);
        expect(pricing.discountAmount).toBe(700);
        expect(pricing.discountPercentage).toBe(10);
      }
    });

    test("6 to 12 months are strictly Long-Term with long-term base rate (6000 -> 5400 for quad)", () => {
      for (const months of [6, 10, 12]) {
        const pricing = resolveAuthoritativeLeasePricing({
          roomType: "quadruple-sharing",
          leaseDurationMonths: months,
          settings: { isDiscountEnabled: true, quadrupleDiscountPercent: 10 },
        });

        expect(pricing.isLongTerm).toBe(true);
        expect(pricing.leaseType).toBe("long_term");
        expect(pricing.regularMonthlyRate).toBe(6000);
        expect(pricing.finalMonthlyRate).toBe(5400);
        expect(pricing.discountAmount).toBe(600);
        expect(pricing.discountPercentage).toBe(10);
      }
    });

    test("6 months stay must never resolve to short-term rate (7000/6300)", () => {
      const pricing = resolveAuthoritativeLeasePricing({
        roomType: "quadruple-sharing",
        leaseDurationMonths: 6,
        settings: { isDiscountEnabled: true, quadrupleDiscountPercent: 10 },
      });

      expect(pricing.isLongTerm).toBe(true);
      expect(pricing.regularMonthlyRate).toBe(6000);
      expect(pricing.finalMonthlyRate).toBe(5400);
    });
  });
});
