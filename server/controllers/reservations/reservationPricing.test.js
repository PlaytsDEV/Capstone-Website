import { describe, expect, jest, test } from "@jest/globals";

const mockBusinessSettings = {
  key: "global",
  isDiscountEnabled: true,
  reservationFeeAmount: 3000,
  longTermLeaseMinMonths: 6,
  save: jest.fn().mockResolvedValue(true),
  branchOverrides: {
    "gil-puyat": {
      isApplianceFeeEnabled: false,
      applianceFeeAmountPerUnit: 0,
    },
    guadalupe: {
      isApplianceFeeEnabled: true,
      applianceFeeAmountPerUnit: 200,
    },
  },
};

await jest.unstable_mockModule("../../models/BusinessSettings.js", () => ({
  default: {
    findOne: jest.fn(() => Promise.resolve(mockBusinessSettings)),
    create: jest.fn().mockResolvedValue(mockBusinessSettings),
  },
}));

await jest.unstable_mockModule("../../models/Appliance.js", () => ({
  default: {
    find: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([
        { code: "refrigerator", name: "Refrigerator", monthlyFee: 300, maxQuantity: 2 },
      ]),
    })),
  },
}));

const { buildReservationPricing } = await import("./_helpers.js");

describe("buildReservationPricing", () => {
  const mockRoom = {
    _id: "69d9e9b139100a9aa9ba3b84",
    name: "GP - Room 201",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    price: 7000,
    monthlyPrice: 6300,
  };

  test("calculates pricing without throwing ReferenceError when selectedAppliances is empty", async () => {
    const result = await buildReservationPricing({
      room: mockRoom,
      leaseDuration: "1",
      selectedAppliances: {},
    });

    expect(result).toBeDefined();
    expect(result.monthlyRent).toBeGreaterThan(0);
    expect(result.breakdown.appliancePolicy.selectedQuantity).toBe(0);
    expect(result.breakdown.appliancePolicy.appliedAmount).toBe(0);
  });

  test("calculates pricing with valid appliances and sets totalApplianceQuantity in appliancePolicy", async () => {
    const result = await buildReservationPricing({
      room: { ...mockRoom, branch: "guadalupe" },
      leaseDuration: "6",
      selectedAppliances: {
        refrigerator: 2,
      },
    });

    expect(result).toBeDefined();
    expect(result.breakdown.appliancePolicy.selectedQuantity).toBe(2);
    expect(result.breakdown.appliancePolicy.appliedAmount).toBe(600);
  });
});
