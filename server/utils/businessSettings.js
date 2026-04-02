import BusinessSettings from "../models/BusinessSettings.js";
import { BUSINESS } from "../config/constants.js";

const GLOBAL_KEY = "global";
export const DEFAULT_BRANCH_OVERRIDES = {
  "gil-puyat": {
    isApplianceFeeEnabled: false,
    applianceFeeAmountPerUnit: 0,
  },
  guadalupe: {
    isApplianceFeeEnabled: true,
    applianceFeeAmountPerUnit: 200,
  },
};

const parseFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function normalizeBranchOverrides(branchOverridesLike) {
  const normalized = { ...DEFAULT_BRANCH_OVERRIDES };
  const source = branchOverridesLike instanceof Map
    ? Object.fromEntries(branchOverridesLike.entries())
    : branchOverridesLike || {};

  for (const [branch, defaults] of Object.entries(DEFAULT_BRANCH_OVERRIDES)) {
    const override = source?.[branch];
    normalized[branch] = {
      isApplianceFeeEnabled:
        override?.isApplianceFeeEnabled ?? defaults.isApplianceFeeEnabled,
      applianceFeeAmountPerUnit:
        parseFiniteNumber(override?.applianceFeeAmountPerUnit) ??
        defaults.applianceFeeAmountPerUnit,
    };
  }

  return normalized;
}

export function serializeBranchOverrides(branchOverridesLike) {
  return normalizeBranchOverrides(branchOverridesLike);
}

export async function getBusinessSettings() {
  let settings = await BusinessSettings.findOne({ key: GLOBAL_KEY });
  if (!settings) {
    settings = await BusinessSettings.create({
      key: GLOBAL_KEY,
      reservationFeeAmount: BUSINESS.DEPOSIT_AMOUNT,
      penaltyRatePerDay: BUSINESS.PENALTY_RATE_PER_DAY,
      defaultElectricityRatePerKwh: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
      defaultWaterRatePerUnit: 0,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
    });
  } else {
    let changed = false;

    if (settings.penaltyRatePerDay === undefined || settings.penaltyRatePerDay === null) {
      settings.penaltyRatePerDay = BUSINESS.PENALTY_RATE_PER_DAY;
      changed = true;
    }
    if (
      settings.defaultElectricityRatePerKwh === undefined ||
      settings.defaultElectricityRatePerKwh === null
    ) {
      settings.defaultElectricityRatePerKwh = BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH;
      changed = true;
    }
    if (
      settings.defaultWaterRatePerUnit === undefined ||
      settings.defaultWaterRatePerUnit === null
    ) {
      settings.defaultWaterRatePerUnit = 0;
      changed = true;
    }
    const currentBranchOverrides = settings.branchOverrides instanceof Map
      ? Object.fromEntries(settings.branchOverrides.entries())
      : settings.branchOverrides || {};
    const normalizedBranchOverrides = normalizeBranchOverrides(currentBranchOverrides);
    if (
      JSON.stringify(currentBranchOverrides) !==
      JSON.stringify(normalizedBranchOverrides)
    ) {
      settings.branchOverrides = normalizedBranchOverrides;
      changed = true;
    }

    if (changed) {
      await settings.save();
    }
  }
  return settings;
}

export async function getReservationFeeAmount() {
  const settings = await getBusinessSettings();
  return settings.reservationFeeAmount ?? BUSINESS.DEPOSIT_AMOUNT;
}

export async function getPenaltyRatePerDay() {
  const settings = await getBusinessSettings();
  return settings.penaltyRatePerDay ?? BUSINESS.PENALTY_RATE_PER_DAY;
}

export function resolvePenaltyRatePerDay(storedRatePerDay, configuredRatePerDay) {
  const stored = parseFiniteNumber(storedRatePerDay);
  if (stored !== null && stored > 0) return stored;

  const configured = parseFiniteNumber(configuredRatePerDay);
  if (configured !== null && configured > 0) return configured;

  return BUSINESS.PENALTY_RATE_PER_DAY;
}

export async function getDefaultElectricityRatePerKwh() {
  const settings = await getBusinessSettings();
  return settings.defaultElectricityRatePerKwh ?? BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH;
}

export function resolveElectricityRatePerKwh(previousRatePerKwh, defaultRatePerKwh) {
  const previous = parseFiniteNumber(previousRatePerKwh);
  if (previous !== null && previous > 0) return previous;

  const configured = parseFiniteNumber(defaultRatePerKwh);
  if (configured !== null && configured > 0) return configured;

  return BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH;
}

export async function getDefaultWaterRatePerUnit() {
  const settings = await getBusinessSettings();
  return settings.defaultWaterRatePerUnit ?? 0;
}

export function getBranchSettings(branch, settingsLike = null) {
  const normalizedBranch = String(branch || "").toLowerCase();
  const normalizedOverrides = normalizeBranchOverrides(
    settingsLike?.branchOverrides ?? settingsLike,
  );
  return normalizedOverrides[normalizedBranch] || {
    isApplianceFeeEnabled: false,
    applianceFeeAmountPerUnit: 0,
  };
}

export async function getBranchSettingsForBranch(branch) {
  const settings = await getBusinessSettings();
  return getBranchSettings(branch, settings);
}

export function isApplianceFeeEnabled(branch, settingsLike = null) {
  return !!getBranchSettings(branch, settingsLike).isApplianceFeeEnabled;
}

export function resolveWaterRatePerUnit(requestedRatePerUnit, defaultRatePerUnit) {
  const requestedProvided =
    requestedRatePerUnit !== undefined &&
    requestedRatePerUnit !== null &&
    requestedRatePerUnit !== "";

  if (requestedProvided) {
    return requestedRatePerUnit;
  }

  const configured = parseFiniteNumber(defaultRatePerUnit);
  return configured !== null ? configured : 0;
}
