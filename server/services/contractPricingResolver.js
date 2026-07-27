import { BUSINESS } from "../config/constants.js";

const DEFAULT_REGULAR_RATES = Object.freeze({
  private: Object.freeze({ shortTerm: 16000, longTerm: 15000 }),
  "double-sharing": Object.freeze({ shortTerm: 10000, longTerm: 9000 }),
  "quadruple-sharing": Object.freeze({ shortTerm: 7000, longTerm: 6000 }),
});

const finiteNonNegative = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

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
