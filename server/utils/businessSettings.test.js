import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const findOne = jest.fn();
const create = jest.fn();

await jest.unstable_mockModule("../models/BusinessSettings.js", () => ({
  default: {
    findOne,
    create,
  },
}));

const {
  DEFAULT_BRANCH_OVERRIDES,
  getBusinessSettings,
  getReservationFeeAmount,
  getPenaltyRatePerDay,
  getDefaultElectricityRatePerKwh,
  getDefaultWaterRatePerUnit,
  resolvePenaltyRatePerDay,
  resolveElectricityRatePerKwh,
  resolveWaterRatePerUnit,
} = await import("./businessSettings.js");
const { BUSINESS } = await import("../config/constants.js");

describe("businessSettings", () => {
  beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
  });

  test("creates the global settings document with expected defaults", async () => {
    const createdDoc = {
      key: "global",
      reservationFeeAmount: BUSINESS.DEPOSIT_AMOUNT,
      penaltyRatePerDay: BUSINESS.PENALTY_RATE_PER_DAY,
      defaultElectricityRatePerKwh: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
      defaultWaterRatePerUnit: 0,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
    };

    findOne.mockResolvedValue(null);
    create.mockResolvedValue(createdDoc);

    const settings = await getBusinessSettings();

    expect(findOne).toHaveBeenCalledWith({ key: "global" });
    expect(create).toHaveBeenCalledWith({
      key: "global",
      reservationFeeAmount: BUSINESS.DEPOSIT_AMOUNT,
      penaltyRatePerDay: BUSINESS.PENALTY_RATE_PER_DAY,
      defaultElectricityRatePerKwh: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
      defaultWaterRatePerUnit: 0,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
    });
    expect(settings).toBe(createdDoc);
  });

  test("backfills newly added settings on older documents and persists them", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const existingSettings = {
      key: "global",
      reservationFeeAmount: BUSINESS.DEPOSIT_AMOUNT,
      penaltyRatePerDay: null,
      defaultElectricityRatePerKwh: undefined,
      defaultWaterRatePerUnit: null,
      branchOverrides: undefined,
      save,
    };

    findOne.mockResolvedValue(existingSettings);

    const settings = await getBusinessSettings();

    expect(settings.penaltyRatePerDay).toBe(BUSINESS.PENALTY_RATE_PER_DAY);
    expect(settings.defaultElectricityRatePerKwh).toBe(
      BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
    );
    expect(settings.defaultWaterRatePerUnit).toBe(0);
    expect(settings.branchOverrides).toEqual(DEFAULT_BRANCH_OVERRIDES);
    expect(save).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  test("getter helpers return the configured values", async () => {
    const configuredSettings = {
      key: "global",
      reservationFeeAmount: 2500,
      penaltyRatePerDay: 75,
      defaultElectricityRatePerKwh: 18.5,
      defaultWaterRatePerUnit: 32.25,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      save: jest.fn(),
    };

    findOne.mockResolvedValue(configuredSettings);

    await expect(getReservationFeeAmount()).resolves.toBe(2500);
    await expect(getPenaltyRatePerDay()).resolves.toBe(75);
    await expect(getDefaultElectricityRatePerKwh()).resolves.toBe(18.5);
    await expect(getDefaultWaterRatePerUnit()).resolves.toBe(32.25);
  });

  test("resolveElectricityRatePerKwh prefers the previous room rate before the configured default", () => {
    expect(resolveElectricityRatePerKwh(21.5, 18)).toBe(21.5);
    expect(resolveElectricityRatePerKwh(null, 18)).toBe(18);
    expect(resolveElectricityRatePerKwh(undefined, undefined)).toBe(
      BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
    );
  });

  test("resolveWaterRatePerUnit falls back to the configured default only when the request omits a rate", () => {
    expect(resolveWaterRatePerUnit(42, 30)).toBe(42);
    expect(resolveWaterRatePerUnit("18.75", 30)).toBe("18.75");
    expect(resolveWaterRatePerUnit(undefined, 30)).toBe(30);
    expect(resolveWaterRatePerUnit("", 30)).toBe(30);
    expect(resolveWaterRatePerUnit(null, undefined)).toBe(0);
  });

  test("resolvePenaltyRatePerDay prefers the stored bill rate before the configured default", () => {
    expect(resolvePenaltyRatePerDay(60, 50)).toBe(60);
    expect(resolvePenaltyRatePerDay(undefined, 50)).toBe(50);
    expect(resolvePenaltyRatePerDay(null, undefined)).toBe(BUSINESS.PENALTY_RATE_PER_DAY);
  });
});
