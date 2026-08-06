import { describe, expect, test } from "@jest/globals";
import {
  resolveContractLeasePricing,
  resolveAuthoritativeLeasePricing,
  resolveRoomDiscountPricing,
  buildPricingDisplay,
} from "./contractPricingResolver.js";

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

describe("resolveRoomDiscountPricing", () => {
  test("reproduces the seeded GP Quadruple rates (price 6300 / monthlyPrice 5400)", () => {
    const details = resolveRoomDiscountPricing("quadruple-sharing", {
      quadrupleDiscountPercent: 10,
      isDiscountEnabled: true,
    }, {});
    expect(details).toMatchObject({
      regularShortRate: 7000,
      regularLongRate: 6000,
      shortTermRate: 6300,
      monthlyPrice: 5400,
      longTermDiscountPercent: 10,
    });
  });

  test("disabling discounts (globally or per-room) removes the discount", () => {
    expect(resolveRoomDiscountPricing("quadruple-sharing", { isDiscountEnabled: false }, {}))
      .toMatchObject({ monthlyPrice: 6000, shortTermRate: 7000, longTermDiscountPercent: 0 });
    expect(resolveRoomDiscountPricing("quadruple-sharing", { isDiscountEnabled: true }, { isDiscountEnabled: false }))
      .toMatchObject({ monthlyPrice: 6000, shortTermRate: 7000, longTermDiscountPercent: 0 });
  });
});

describe("resolveAuthoritativeLeasePricing", () => {
  const gpQuadrupleRoom = { branch: "gil-puyat", type: "quadruple-sharing", price: 6300, monthlyPrice: 5400 };
  const settings = { longTermLeaseMinMonths: 6, quadrupleDiscountPercent: 10, isDiscountEnabled: true };

  test("12-month lease resolves to the long-term discounted rate: 5400", () => {
    expect(resolveAuthoritativeLeasePricing({
      room: gpQuadrupleRoom, roomType: "quadruple-sharing", leaseDurationMonths: 12, settings,
    })).toMatchObject({ isLongTerm: true, regularMonthlyRate: 6000, finalMonthlyRate: 5400, discountPercentage: 10 });
  });

  test("5-month lease resolves to the short-term discounted rate: 6300", () => {
    expect(resolveAuthoritativeLeasePricing({
      room: gpQuadrupleRoom, roomType: "quadruple-sharing", leaseDurationMonths: 5, settings,
    })).toMatchObject({ isLongTerm: false, regularMonthlyRate: 7000, finalMonthlyRate: 6300, discountPercentage: 10 });
  });

  test("6-month boundary is long-term", () => {
    expect(resolveAuthoritativeLeasePricing({
      room: gpQuadrupleRoom, roomType: "quadruple-sharing", leaseDurationMonths: 6, settings,
    })).toMatchObject({ isLongTerm: true, finalMonthlyRate: 5400 });
  });

  test("rejects durations below 1 month", () => {
    expect(() => resolveAuthoritativeLeasePricing({
      room: gpQuadrupleRoom, roomType: "quadruple-sharing", leaseDurationMonths: 0, settings,
    })).toThrow(expect.objectContaining({ code: "LEASE_DURATION_INVALID" }));
  });

  test("rejects a missing lease duration", () => {
    expect(() => resolveAuthoritativeLeasePricing({
      room: gpQuadrupleRoom, roomType: "quadruple-sharing", leaseDurationMonths: undefined, settings,
    })).toThrow(expect.objectContaining({ code: "LEASE_DURATION_INVALID" }));
  });

  test("rejects an unsupported room type rather than defaulting", () => {
    expect(() => resolveAuthoritativeLeasePricing({
      room: { branch: "gil-puyat", type: "penthouse" }, roomType: "penthouse", leaseDurationMonths: 12, settings,
    })).toThrow(expect.objectContaining({ code: "ROOM_TYPE_UNSUPPORTED" }));
  });

  test("does not silently invent per-branch rates: guadalupe uses the same room-type table", () => {
    const guadalupeRoom = { branch: "guadalupe", type: "quadruple-sharing" };
    expect(resolveAuthoritativeLeasePricing({
      room: guadalupeRoom, roomType: "quadruple-sharing", leaseDurationMonths: 12, settings,
    })).toMatchObject({ finalMonthlyRate: 5400, branch: "guadalupe" });
  });
});

describe("buildPricingDisplay", () => {
  test("returns a snapshotted display for an approved structured reservation, ignoring room/settings", () => {
    const display = buildPricingDisplay({
      reservation: {
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: {
          approvedAt: new Date(),
          regularMonthlyRate: 6000,
          discountPercentage: 10,
          discountAmount: 600,
          finalMonthlyRate: 5400,
          leaseType: "long",
          leaseDurationMonths: 12,
          roomType: "quadruple-sharing",
        },
      },
      room: { type: "quadruple-sharing", price: 999999 },
      settings: {},
    });
    expect(display).toMatchObject({ status: "snapshotted", finalMonthlyRate: 5400 });
  });

  test("returns a preview for a not-yet-approved reservation with a valid lease duration", () => {
    const display = buildPricingDisplay({
      reservation: { leaseDuration: 12 },
      room: { type: "quadruple-sharing", branch: "gil-puyat" },
      settings: { longTermLeaseMinMonths: 6, quadrupleDiscountPercent: 10 },
    });
    expect(display).toMatchObject({ status: "preview", finalMonthlyRate: 5400 });
  });

  test("returns unavailable (not a guess) when lease duration is not yet chosen", () => {
    const display = buildPricingDisplay({
      reservation: {},
      room: { type: "quadruple-sharing" },
      settings: {},
    });
    expect(display.status).toBe("unavailable");
    expect(display.reason).toBe("LEASE_DURATION_INVALID");
  });
});
