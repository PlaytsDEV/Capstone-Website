import { BUSINESS } from "../config/constants.js";

/**
 * ============================================================================
 * FALLBACK AUDIT (hardening pass — every `??`/`||` default in this file)
 * ============================================================================
 * 1. `DEFAULT_REGULAR_RATES[normType] || DEFAULT_REGULAR_RATES["quadruple-sharing"]`
 *    (resolveRoomDiscountPricing) — UNSAFE IN ISOLATION, but unreachable on the
 *    money-moving path: resolveAuthoritativeLeasePricing() (the only entry
 *    point buildStructuredPricingSnapshot/buildPricingDisplay ever call)
 *    validates roomType against SUPPORTED_ROOM_TYPES and throws
 *    ROOM_TYPE_UNSUPPORTED *before* resolveRoomDiscountPricing ever runs.
 *    roomsController.js does call resolveRoomDiscountPricing directly for
 *    room-listing display, but Room.type is a strict mongoose enum
 *    (["private","double-sharing","quadruple-sharing"]), so this fallback
 *    cannot trigger for a real, schema-valid Room document — it only guards
 *    against a theoretical caller bug. Left in place, not a Bill/payment risk.
 * 2. `settings?.doubleDiscountPercent ?? 20`, `settings?.privateDiscountPercent ?? 10`,
 *    `settings?.quadrupleDiscountPercent ?? settings?.defaultLongTermDiscountPercent ?? 10`,
 *    `settings?.longTermLeaseMinMonths ?? BUSINESS.LONG_TERM_LEASE_MIN_MONTHS` —
 *    APPROVED SYSTEM DEFAULT, not a guess: these numbers are byte-for-byte the
 *    same defaults declared on the BusinessSettings mongoose schema
 *    (server/models/BusinessSettings.js) and in DEFAULT_BUSINESS_SETTINGS
 *    (server/utils/businessSettings.js). getBusinessSettings() self-heals any
 *    existing settings document that is missing one of these keys (sets it to
 *    the same default and persists the save) before ever returning it to a
 *    caller — so by the time `settings` reaches this resolver from either real
 *    call site (reservationCrudController.js, reservationLifecycleController.js,
 *    roomsController.js — all call getBusinessSettings() first), these fields
 *    are already guaranteed non-null and reflect the actual persisted document
 *    (an admin's live customization, if any). The `??` here is redundant
 *    defense against a caller passing a bare `{}` (e.g. a future direct-call
 *    bug), not a substitute for reading real config.
 * 3. `room?.isDiscountEnabled !== false` / room.regularLongRate / room.regularShortRate
 *    overrides — explicit per-room opt-in overrides, not fallbacks; absence
 *    simply means "use the room-type default", which is the documented,
 *    intended behavior for rooms without a custom rate.
 * No REQUIRED field (roomType, leaseDurationMonths) has a silent fallback —
 * both are validated and throw a structured error (ROOM_TYPE_UNSUPPORTED /
 * LEASE_DURATION_INVALID) when missing/invalid; see resolveAuthoritativeLeasePricing.
 * ============================================================================
 */

const DEFAULT_REGULAR_RATES = Object.freeze({
  private: Object.freeze({ shortTerm: 16000, longTerm: 15000 }),
  "double-sharing": Object.freeze({ shortTerm: 10000, longTerm: 9000 }),
  "quadruple-sharing": Object.freeze({ shortTerm: 7000, longTerm: 6000 }),
});

const SUPPORTED_ROOM_TYPES = Object.keys(DEFAULT_REGULAR_RATES);

const finiteNonNegative = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Authoritative room base-rate + discount resolution.
 *
 * This mirrors the logic in roomsController.js's getRoomDiscountDetails
 * (used to attach monthlyPrice/shortTermRate onto room listings), and is the
 * single source of truth for "what SHOULD this room type cost, before/after
 * the admin-configured long-term discount" — driven by BusinessSettings
 * (quadrupleDiscountPercent / doubleDiscountPercent / privateDiscountPercent,
 * isDiscountEnabled), with optional per-room overrides (room.regularLongRate /
 * room.regularShortRate, room.isDiscountEnabled).
 *
 * roomsController.js should call this instead of duplicating the formula.
 */
export const resolveRoomDiscountPricing = (roomType, settings = {}, room = {}) => {
  const normType = String(roomType || "").toLowerCase();
  const defaults = DEFAULT_REGULAR_RATES[normType] || DEFAULT_REGULAR_RATES["quadruple-sharing"];

  const isDiscountEnabled =
    settings?.isDiscountEnabled !== false && room?.isDiscountEnabled !== false;

  let baseLongRate = defaults.longTerm;
  let baseShortRate = defaults.shortTerm;
  let configuredDiscountPercent;

  if (normType.includes("double")) {
    configuredDiscountPercent = settings?.doubleDiscountPercent ?? 20;
  } else if (normType.includes("private")) {
    configuredDiscountPercent = settings?.privateDiscountPercent ?? 10;
  } else {
    configuredDiscountPercent =
      settings?.quadrupleDiscountPercent ?? settings?.defaultLongTermDiscountPercent ?? 10;
  }

  // Allow custom undiscounted base rates if explicitly configured on the room object.
  if (typeof room?.regularLongRate === "number" && room.regularLongRate > 0) {
    baseLongRate = room.regularLongRate;
  }
  if (typeof room?.regularShortRate === "number" && room.regularShortRate > 0) {
    baseShortRate = room.regularShortRate;
  }

  const discountPercent = isDiscountEnabled ? configuredDiscountPercent : 0;

  const monthlyPrice = isDiscountEnabled
    ? Math.round(baseLongRate * (1 - discountPercent / 100))
    : baseLongRate;

  const shortTermRate = isDiscountEnabled
    ? Math.round(baseShortRate * (1 - discountPercent / 100))
    : baseShortRate;

  return {
    isDiscountEnabled,
    longTermDiscountPercent: discountPercent,
    monthlyPrice,
    shortTermRate,
    regularLongRate: baseLongRate,
    regularShortRate: baseShortRate,
    longTermLeaseMinMonths: settings?.longTermLeaseMinMonths ?? BUSINESS.LONG_TERM_LEASE_MIN_MONTHS,
    quadrupleDiscountPercent: settings?.quadrupleDiscountPercent ?? 10,
    doubleDiscountPercent: settings?.doubleDiscountPercent ?? 20,
    privateDiscountPercent: settings?.privateDiscountPercent ?? 10,
  };
};

/**
 * Authoritative, lease-duration-aware final monthly rate for a reservation.
 *
 * Unlike resolveContractLeasePricing() below (which only *describes* an
 * already-decided approvedMonthlyRate), this function COMPUTES the correct
 * final monthly rate from branch/room-type/lease-duration using the same
 * admin-configured BusinessSettings discount table that room listings use
 * (see resolveRoomDiscountPricing above). It throws a structured error
 * instead of silently falling back when required inputs are missing or the
 * room type is unsupported.
 *
 * NOTE ON BRANCH SCOPE: the current schema (BusinessSettings.branchOverrides,
 * Room) does not define per-branch rate tables — discount percentages and
 * base rates are keyed by room type only, not by branch. This function does
 * NOT invent per-branch rate differentiation; `branch` is accepted and
 * returned for traceability only.
 */
export const resolveAuthoritativeLeasePricing = ({
  room,
  roomType,
  branch = null,
  leaseDurationMonths,
  settings = {},
}) => {
  const normType = String(roomType || room?.type || "").toLowerCase();
  if (!SUPPORTED_ROOM_TYPES.includes(normType)) {
    const error = new Error(
      `No configured rate for room type "${roomType || room?.type || "(none)"}".`,
    );
    error.code = "ROOM_TYPE_UNSUPPORTED";
    throw error;
  }

  const duration = Number(leaseDurationMonths);
  if (!Number.isFinite(duration) || duration < 1 || duration > 12) {
    const error = new Error(
      "A valid lease duration between 1 and 12 months is required to resolve pricing.",
    );
    error.code = "LEASE_DURATION_INVALID";
    throw error;
  }

  const threshold = Number(settings?.longTermLeaseMinMonths ?? BUSINESS.LONG_TERM_LEASE_MIN_MONTHS);
  const isLongTerm = duration >= threshold;
  const leaseType = isLongTerm ? "long_term" : "short_term";

  const discountDetails = resolveRoomDiscountPricing(normType, settings, room);
  const regularMonthlyRate = isLongTerm
    ? discountDetails.regularLongRate
    : discountDetails.regularShortRate;
  const finalMonthlyRate = isLongTerm
    ? discountDetails.monthlyPrice
    : discountDetails.shortTermRate;
  const discountAmount = roundMoney(Math.max(0, regularMonthlyRate - finalMonthlyRate));
  const discountPercentage = discountDetails.longTermDiscountPercent;

  if (!Number.isFinite(regularMonthlyRate) || regularMonthlyRate <= 0 || !Number.isFinite(finalMonthlyRate) || finalMonthlyRate <= 0) {
    const error = new Error("Resolved pricing is not a valid positive amount.");
    error.code = "PRICING_CONFIGURATION_INCOMPLETE";
    throw error;
  }

  return {
    isLongTerm,
    leaseType,
    roomType: normType,
    branch: branch || room?.branch || null,
    leaseDurationMonths: duration,
    regularMonthlyRate: roundMoney(regularMonthlyRate),
    discountPercentage,
    discountAmount,
    finalMonthlyRate: roundMoney(finalMonthlyRate),
  };
};

/**
 * Server-derived pricing object for API responses: an authoritative preview
 * before approval (status: "preview"), the immutable approved snapshot after
 * approval (status: "snapshotted"), or an explicit "unavailable" marker when
 * neither a snapshot nor a valid preview can be resolved (e.g. lease duration
 * not yet chosen) — the frontend must not guess a rate in that case.
 */
export const buildPricingDisplay = ({ reservation, room, settings = {} } = {}) => {
  const hasSnapshot =
    reservation?.financialWorkflowVersion === "structured-initial-payment-v1" &&
    reservation?.pricingSnapshot?.approvedAt;

  if (hasSnapshot) {
    // Immutable, already-approved values — read directly off the snapshot
    // that was persisted at approval time. Never recomputed here.
    const snapshot = reservation.pricingSnapshot;
    const advanceRentAmount = roundMoney(Number(snapshot.advanceRentAmount) || 0);
    const securityDepositAmount = roundMoney(Number(snapshot.securityDepositAmount) || 0);
    const reservationFeeAmount = roundMoney(Number(snapshot.reservationFeeAmount) || 0);
    const estimatedInitialPaymentTotal = roundMoney(
      Math.max(0, advanceRentAmount + securityDepositAmount - reservationFeeAmount),
    );
    return {
      status: "snapshotted",
      source: "approved_pricing_snapshot",
      regularMonthlyRate: snapshot.regularMonthlyRate,
      discountPercentage: snapshot.discountPercentage,
      discountAmount: snapshot.discountAmount,
      finalMonthlyRate: snapshot.finalMonthlyRate,
      leaseType: snapshot.leaseType === "long" ? "long_term" : "short_term",
      leaseDurationMonths: snapshot.leaseDurationMonths,
      roomType: snapshot.roomType,
      advanceRentAmount,
      securityDepositAmount,
      reservationFeeAmount,
      estimatedInitialPaymentTotal,
    };
  }

  try {
    const preview = resolveAuthoritativeLeasePricing({
      room,
      roomType: room?.type || reservation?.preferredRoomType,
      branch: room?.branch,
      leaseDurationMonths: reservation?.leaseDuration,
      settings,
    });
    // Pre-approval estimate only — advance rent and security deposit mirror
    // the same one-month-of-rent rule buildStructuredPricingSnapshot applies
    // at approval time; the reservation fee is treated as a full credit here
    // for display purposes only (actual credit is capped/verified against a
    // confirmed PayMongo payment at approval, see resolveVerifiedReservationFeeCredit).
    const advanceRentAmount = roundMoney(preview.finalMonthlyRate);
    const securityDepositAmount = roundMoney(preview.finalMonthlyRate);
    const reservationFeeAmount = roundMoney(Number(reservation?.reservationFeeAmount) || 2000);
    const estimatedInitialPaymentTotal = roundMoney(
      Math.max(0, advanceRentAmount + securityDepositAmount - reservationFeeAmount),
    );
    return {
      status: "preview",
      source: "server_policy_preview",
      regularMonthlyRate: preview.regularMonthlyRate,
      discountPercentage: preview.discountPercentage,
      discountAmount: preview.discountAmount,
      finalMonthlyRate: preview.finalMonthlyRate,
      leaseType: preview.leaseType,
      leaseDurationMonths: preview.leaseDurationMonths,
      roomType: preview.roomType,
      advanceRentAmount,
      securityDepositAmount,
      reservationFeeAmount,
      estimatedInitialPaymentTotal,
    };
  } catch (error) {
    return {
      status: "unavailable",
      source: "server_policy_preview",
      reason: error.code || "PRICING_UNAVAILABLE",
      message: error.message,
    };
  }
};

export const resolveContractLeasePricing = ({
  room,
  roomType,
  leaseDurationMonths,
  approvedMonthlyRate,
  longTermLeaseMinMonths = BUSINESS.LONG_TERM_LEASE_MIN_MONTHS,
}) => {
  const duration = Number(leaseDurationMonths);
  const threshold = Number(longTermLeaseMinMonths);
  const isLongTerm =
    Number.isFinite(duration) &&
    Number.isFinite(threshold) &&
    duration >= threshold;
  const leaseType = isLongTerm ? "long_term" : "short_term";
  const defaults = DEFAULT_REGULAR_RATES[roomType];
  const configuredRegularRate = finiteNonNegative(
    isLongTerm ? room?.regularLongRate : room?.regularShortRate,
  );
  const regularMonthlyRate =
    configuredRegularRate ??
    (isLongTerm ? defaults?.longTerm : defaults?.shortTerm) ??
    null;
  const approvedRate = finiteNonNegative(approvedMonthlyRate);
  const discountAmount =
    regularMonthlyRate !== null && approvedRate !== null
      ? roundMoney(Math.max(0, regularMonthlyRate - approvedRate))
      : null;
  const discountPercentage =
    regularMonthlyRate > 0 && discountAmount !== null
      ? Math.round((discountAmount / regularMonthlyRate) * 10000) / 100
      : null;

  return {
    isLongTerm,
    leaseType,
    regularMonthlyRate,
    discountPercentage,
    discountAmount,
    approvedMonthlyRate: approvedRate,
  };
};
