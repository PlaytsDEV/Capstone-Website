import BusinessSettings from "../models/BusinessSettings.js";
import { BUSINESS } from "../config/constants.js";
import { getManilaDayjs } from "./dateUtils.js";

const GLOBAL_KEY = "global";

// ── Office hours (Admin Room Transfer §15) ────────────────────────────────────
export const DEFAULT_OFFICE_HOURS = Object.freeze({
  officeHoursStartMinutes: 8 * 60, // 08:00
  officeHoursEndMinutes: 20 * 60, // 20:00
  officeDaysOfWeek: [1, 2, 3, 4, 5, 6], // Mon–Sat, ISO weekday numbers
});

export const DEFAULT_BRANCH_OVERRIDES = Object.freeze({
  "gil-puyat": {
    isApplianceFeeEnabled: false,
    applianceFeeAmountPerUnit: 0,
    changedBy: null,
    changedAt: null,
  },
  guadalupe: {
    isApplianceFeeEnabled: true,
    applianceFeeAmountPerUnit: 200,
    changedBy: null,
    changedAt: null,
  },
});

export const RESERVATION_APPLIANCES = Object.freeze([
  { id: "fan", name: "Electric Fan" },
  { id: "ricecooker", name: "Rice Cooker" },
  { id: "laptop", name: "Laptop" },
]);

export const DEFAULT_POLICY_SETTINGS = Object.freeze({
  noShowGraceDays: BUSINESS.NOSHOW_GRACE_DAYS,
  stalePendingHours: BUSINESS.STALE_PENDING_HOURS,
  staleVisitPendingHours: BUSINESS.STALE_VISIT_PENDING_HOURS,
  visitPendingWarnDays: BUSINESS.VISIT_PENDING_WARN_DAYS,
  staleVisitApprovedHours: BUSINESS.STALE_VISIT_APPROVED_HOURS,
  stalePaymentPendingHours: BUSINESS.STALE_PAYMENT_PENDING_HOURS,
  archiveCancelledAfterDays: BUSINESS.ARCHIVE_CANCELLED_AFTER_DAYS,
});

export const DEFAULT_BUSINESS_SETTINGS = Object.freeze({
  reservationFeeAmount: BUSINESS.DEPOSIT_AMOUNT,
  penaltyRatePerDay: BUSINESS.PENALTY_RATE_PER_DAY,
  latePaymentGraceDays: BUSINESS.DEFAULT_LATE_PAYMENT_GRACE_DAYS || 1,
  maxPenaltyCapPercent: BUSINESS.MAX_PENALTY_CAP_PERCENT,
  defaultElectricityRatePerKwh: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
  defaultWaterRatePerUnit: 0,
  checkoutLockDurationMinutes: 30,
  renewalNoticeRequiredDays: 30,
  rfidReplacementCharge: 1000,
  depositRefundProcessingDays: 30,
  longTermLeaseMinMonths: BUSINESS.LONG_TERM_LEASE_MIN_MONTHS || 6,
  defaultLongTermDiscountPercent: BUSINESS.DEFAULT_LONG_TERM_DISCOUNT_PERCENT || 10,
  isDiscountEnabled: true,
  quadrupleDiscountPercent: 10,
  doubleDiscountPercent: 20,
  privateDiscountPercent: 10,
  officeHoursStartMinutes: DEFAULT_OFFICE_HOURS.officeHoursStartMinutes,
  officeHoursEndMinutes: DEFAULT_OFFICE_HOURS.officeHoursEndMinutes,
  ...DEFAULT_POLICY_SETTINGS,
});

const BRANCH_OVERRIDE_KEYS = Object.keys(DEFAULT_BRANCH_OVERRIDES);
const POLICY_SETTING_KEYS = Object.keys(DEFAULT_POLICY_SETTINGS);
const BUSINESS_SETTING_KEYS = Object.keys(DEFAULT_BUSINESS_SETTINGS);

const parseFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeChangedBy = (value) => {
  if (!value || typeof value !== "object") return null;

  const userId =
    value.userId != null && value.userId !== ""
      ? String(value.userId)
      : null;
  const email = value.email ? String(value.email) : "";
  const role = value.role ? String(value.role) : "";

  if (!userId && !email && !role) {
    return null;
  }

  return {
    userId,
    email,
    role,
  };
};

const toSourceObject = (value) => {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }

  if (value && typeof value.toObject === "function") {
    return value.toObject();
  }

  return value || {};
};

const normalizeOfficeDaysOrNull = (value) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const days = [
    ...new Set(
      value
        .map((d) => Math.round(Number(d)))
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
    ),
  ].sort((a, b) => a - b);
  return days.length ? days : null;
};

const normalizeBranchOverride = (value, defaults) => {
  const source = toSourceObject(value);

  return {
    isApplianceFeeEnabled:
      source?.isApplianceFeeEnabled ?? defaults.isApplianceFeeEnabled,
    applianceFeeAmountPerUnit:
      parseFiniteNumber(source?.applianceFeeAmountPerUnit) ??
      defaults.applianceFeeAmountPerUnit,
    changedBy: normalizeChangedBy(source?.changedBy),
    changedAt: normalizeDate(source?.changedAt),
  };
};

function normalizeBranchOverrides(branchOverridesLike) {
  const source = toSourceObject(branchOverridesLike);
  const normalized = {};

  for (const branch of BRANCH_OVERRIDE_KEYS) {
    normalized[branch] = normalizeBranchOverride(
      source?.[branch],
      DEFAULT_BRANCH_OVERRIDES[branch],
    );
  }

  return normalized;
}

export function serializeBranchOverrides(branchOverridesLike) {
  return normalizeBranchOverrides(branchOverridesLike);
}

export function mergeBranchOverrides(currentOverridesLike, patchOverridesLike = {}) {
  const current = normalizeBranchOverrides(currentOverridesLike);
  const patch = toSourceObject(patchOverridesLike);
  const merged = { ...current };

  for (const branch of BRANCH_OVERRIDE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, branch)) continue;

    merged[branch] = normalizeBranchOverride(
      {
        ...current[branch],
        ...toSourceObject(patch[branch]),
      },
      DEFAULT_BRANCH_OVERRIDES[branch],
    );
  }

  return merged;
}

export function serializeBusinessSettings(settingsLike = {}) {
  const source = toSourceObject(settingsLike);
  const serialized = {
    branchOverrides: normalizeBranchOverrides(source.branchOverrides),
    changedBy: normalizeChangedBy(source.changedBy),
    changedAt: normalizeDate(source.changedAt),
    updatedAt: normalizeDate(source.updatedAt),
  };

  for (const key of BUSINESS_SETTING_KEYS) {
    if (key === "isDiscountEnabled") {
      serialized.isDiscountEnabled =
        typeof source.isDiscountEnabled === "boolean"
          ? source.isDiscountEnabled
          : DEFAULT_BUSINESS_SETTINGS.isDiscountEnabled;
    } else {
      serialized[key] =
        parseFiniteNumber(source[key]) ?? DEFAULT_BUSINESS_SETTINGS[key];
    }
  }

  // officeDaysOfWeek is an array, not a scalar — handled outside the numeric loop.
  serialized.officeDaysOfWeek =
    normalizeOfficeDaysOrNull(source.officeDaysOfWeek) ??
    [...DEFAULT_OFFICE_HOURS.officeDaysOfWeek];

  return serialized;
}

export async function getBusinessSettings() {
  let settings = await BusinessSettings.findOne({ key: GLOBAL_KEY });

  if (!settings) {
    settings = await BusinessSettings.create({
      key: GLOBAL_KEY,
      ...DEFAULT_BUSINESS_SETTINGS,
      branchOverrides: DEFAULT_BRANCH_OVERRIDES,
      changedBy: null,
      changedAt: null,
    });
    return settings;
  }

  let changed = false;

  for (const key of BUSINESS_SETTING_KEYS) {
    if (settings[key] === undefined || settings[key] === null) {
      settings[key] = DEFAULT_BUSINESS_SETTINGS[key];
      changed = true;
    }
  }

  if (
    !Array.isArray(settings.officeDaysOfWeek) ||
    settings.officeDaysOfWeek.length === 0
  ) {
    settings.officeDaysOfWeek = [...DEFAULT_OFFICE_HOURS.officeDaysOfWeek];
    changed = true;
  }

  if (settings.changedBy === undefined) {
    settings.changedBy = null;
    changed = true;
  }

  if (settings.changedAt === undefined) {
    settings.changedAt = null;
    changed = true;
  }

  const currentBranchOverrides = toSourceObject(settings.branchOverrides);
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

export async function getLatePaymentGraceDays() {
  const settings = await getBusinessSettings();
  return settings.latePaymentGraceDays ?? (BUSINESS.DEFAULT_LATE_PAYMENT_GRACE_DAYS || 1);
}

export function resolveLatePaymentGraceDays(storedGraceDays, configuredGraceDays) {
  const stored = parseFiniteNumber(storedGraceDays);
  if (stored !== null && stored >= 0) return stored;

  const configured = parseFiniteNumber(configuredGraceDays);
  if (configured !== null && configured >= 0) return configured;

  return BUSINESS.DEFAULT_LATE_PAYMENT_GRACE_DAYS || 1;
}

export async function getMaxPenaltyCapPercent() {
  const settings = await getBusinessSettings();
  return settings.maxPenaltyCapPercent ?? BUSINESS.MAX_PENALTY_CAP_PERCENT;
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
  return (
    normalizedOverrides[normalizedBranch] || {
      isApplianceFeeEnabled: false,
      applianceFeeAmountPerUnit: 0,
      changedBy: null,
      changedAt: null,
    }
  );
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

// ── Office hours resolution + enforcement (Admin Room Transfer §15) ───────────

const clampMinuteOfDay = (value, fallback) => {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.min(Math.max(Math.round(parsed), 0), 24 * 60);
};

const normalizeOfficeDays = (value, fallback) => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const days = [
    ...new Set(
      value
        .map((d) => Math.round(Number(d)))
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
    ),
  ].sort((a, b) => a - b);
  return days.length ? days : fallback;
};

/**
 * The effective office-hours window (global setting, with the hard defaults as
 * fallback for any missing field). `branch` is accepted for a future per-branch
 * override but is currently unused — a single global window satisfies §15.
 *
 * @returns {{ startMinutes:number, endMinutes:number, days:number[] }}
 *   `days` = ISO weekday numbers (1 = Monday … 7 = Sunday).
 */
export function resolveOfficeHours(branch, settingsLike = null) {
  const source = toSourceObject(settingsLike) || {};

  const startMinutes = clampMinuteOfDay(
    source.officeHoursStartMinutes,
    DEFAULT_OFFICE_HOURS.officeHoursStartMinutes,
  );
  const endMinutes = clampMinuteOfDay(
    source.officeHoursEndMinutes,
    DEFAULT_OFFICE_HOURS.officeHoursEndMinutes,
  );
  const days = normalizeOfficeDays(
    source.officeDaysOfWeek,
    DEFAULT_OFFICE_HOURS.officeDaysOfWeek,
  );

  // Guard against an inverted window (end <= start) — fall back to the hard
  // default so a bad config can never make the window empty.
  const safeStart = endMinutes > startMinutes ? startMinutes : DEFAULT_OFFICE_HOURS.officeHoursStartMinutes;
  const safeEnd = endMinutes > startMinutes ? endMinutes : DEFAULT_OFFICE_HOURS.officeHoursEndMinutes;

  return { startMinutes: safeStart, endMinutes: safeEnd, days };
}

export async function resolveOfficeHoursForBranch(branch) {
  const settings = await getBusinessSettings();
  return resolveOfficeHours(branch, settings);
}

/**
 * Is `dateTime` (a Date / ISO string / dayjs) inside the branch's office hours,
 * evaluated in Asia/Manila? Both the weekday and the minute-of-day must fall
 * inside the configured window. The end minute is EXCLUSIVE (an 08:00–20:00
 * window admits 19:59, not 20:00).
 *
 * Pass a pre-resolved `officeHours` (from resolveOfficeHours) to avoid a DB
 * read; otherwise pass `settingsLike`.
 */
export function isWithinOfficeHours(dateTime, branch, { officeHours = null, settingsLike = null } = {}) {
  const m = getManilaDayjs(dateTime);
  if (!m || !m.isValid()) return false;
  const window = officeHours || resolveOfficeHours(branch, settingsLike);
  const isoDay = m.day() === 0 ? 7 : m.day(); // dayjs day(): 0=Sun..6=Sat → ISO 1=Mon..7=Sun
  if (!window.days.includes(isoDay)) return false;
  const minuteOfDay = m.hour() * 60 + m.minute();
  return minuteOfDay >= window.startMinutes && minuteOfDay < window.endMinutes;
}

export async function assertWithinOfficeHours(dateTime, branch) {
  const window = await resolveOfficeHoursForBranch(branch);
  if (isWithinOfficeHours(dateTime, branch, { officeHours: window })) return window;
  const fmt = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  throw Object.assign(
    new Error(
      `Same-day room transfers can only be scheduled during office hours ` +
        `(${fmt(window.startMinutes)}–${fmt(window.endMinutes)}, Asia/Manila). ` +
        `Choose a time within office hours, or a future date.`,
    ),
    { statusCode: 400, code: "OUTSIDE_OFFICE_HOURS" },
  );
}

export function serializeLifecyclePolicySettings(settingsLike = {}) {
  const serialized = serializeBusinessSettings(settingsLike);

  return POLICY_SETTING_KEYS.reduce((acc, key) => {
    acc[key] = serialized[key];
    return acc;
  }, {});
}

export async function getLifecyclePolicySettings() {
  const settings = await getBusinessSettings();
  return serializeLifecyclePolicySettings(settings);
}
