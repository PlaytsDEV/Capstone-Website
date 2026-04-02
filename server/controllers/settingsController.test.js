import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const getBusinessSettings = jest.fn();
const DEFAULT_BRANCH_OVERRIDES = {
  "gil-puyat": {
    isApplianceFeeEnabled: false,
    applianceFeeAmountPerUnit: 0,
  },
  guadalupe: {
    isApplianceFeeEnabled: true,
    applianceFeeAmountPerUnit: 200,
  },
};

await jest.unstable_mockModule("../utils/businessSettings.js", () => ({
  DEFAULT_BRANCH_OVERRIDES,
  getBusinessSettings,
  getBranchSettings: jest.fn((branch, settings) => settings.branchOverrides?.[branch] || DEFAULT_BRANCH_OVERRIDES[branch]),
  serializeBranchOverrides: jest.fn((value) => value || DEFAULT_BRANCH_OVERRIDES),
}));

const {
  getBusinessRules,
  updateBusinessRules,
} = await import("./settingsController.js");

const createResponse = () => {
  const res = {
    req: { id: "req-1" },
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe("settingsController", () => {
  beforeEach(() => {
    getBusinessSettings.mockReset();
  });

  test("getBusinessRules returns all persisted business settings", async () => {
    const req = {};
    const res = createResponse();
    const next = jest.fn();
    const updatedAt = new Date("2026-03-31T10:15:00.000Z");

    getBusinessSettings.mockResolvedValue({
      reservationFeeAmount: 2000,
      penaltyRatePerDay: 50,
      defaultElectricityRatePerKwh: 16,
      defaultWaterRatePerUnit: 28,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      updatedAt,
    });

    await getBusinessRules(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      reservationFeeAmount: 2000,
      penaltyRatePerDay: 50,
      defaultElectricityRatePerKwh: 16,
      defaultWaterRatePerUnit: 28,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      updatedAt,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("updateBusinessRules persists all numeric settings", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const settings = {
      reservationFeeAmount: 2000,
      penaltyRatePerDay: 50,
      defaultElectricityRatePerKwh: 16,
      defaultWaterRatePerUnit: 0,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      updatedAt: new Date("2026-03-31T10:15:00.000Z"),
      save,
    };
    const req = {
      body: {
        reservationFeeAmount: "2500",
        penaltyRatePerDay: "75",
        defaultElectricityRatePerKwh: "18.5",
        defaultWaterRatePerUnit: "30.25",
        branchOverrides: {
          guadalupe: {
            isApplianceFeeEnabled: false,
            applianceFeeAmountPerUnit: 150,
          },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    getBusinessSettings.mockResolvedValue(settings);

    await updateBusinessRules(req, res, next);

    expect(settings.reservationFeeAmount).toBe(2500);
    expect(settings.penaltyRatePerDay).toBe(75);
    expect(settings.defaultElectricityRatePerKwh).toBe(18.5);
    expect(settings.defaultWaterRatePerUnit).toBe(30.25);
    expect(settings.branchOverrides).toEqual({
      ...DEFAULT_BRANCH_OVERRIDES,
      guadalupe: {
        isApplianceFeeEnabled: false,
        applianceFeeAmountPerUnit: 150,
      },
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      reservationFeeAmount: 2500,
      penaltyRatePerDay: 75,
      defaultElectricityRatePerKwh: 18.5,
      defaultWaterRatePerUnit: 30.25,
      branchOverrides: {
        ...DEFAULT_BRANCH_OVERRIDES,
        guadalupe: {
          isApplianceFeeEnabled: false,
          applianceFeeAmountPerUnit: 150,
        },
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("updateBusinessRules rejects invalid numeric input", async () => {
    const save = jest.fn();
    const settings = {
      reservationFeeAmount: 2000,
      penaltyRatePerDay: 50,
      defaultElectricityRatePerKwh: 16,
      defaultWaterRatePerUnit: 0,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      save,
    };
    const req = {
      body: {
        defaultWaterRatePerUnit: "-1",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    getBusinessSettings.mockResolvedValue(settings);

    await updateBusinessRules(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Default water rate must be a non-negative number",
    });
    expect(save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
