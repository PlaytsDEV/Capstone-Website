import dayjs from "dayjs";

const contractDateError = (message, code, details = undefined) =>
  Object.assign(new Error(message), { code, statusCode: 422, details });

const validDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Canonical legal-Contract term calculation.
 *
 * Contract validation defines an N-month term as the same calendar instant
 * N months after leaseStartDate. Stay/workspace displays sometimes use an
 * inclusive final day (minus one day); that convention must not leak into
 * legal Contract dates because validateLeaseDuration requires whole months.
 */
export const deriveContractLeaseDates = ({
  leaseStartDate,
  leaseDurationMonths,
}) => {
  const start = validDate(leaseStartDate);
  const duration = Number(leaseDurationMonths);
  if (!start) {
    throw contractDateError(
      "A valid lease start date is required.",
      "CONTRACT_LEASE_START_DATE_INVALID",
      { leaseStartDate: leaseStartDate ?? null },
    );
  }
  if (!Number.isInteger(duration) || duration < 1) {
    throw contractDateError(
      "A positive whole-number lease duration is required.",
      "CONTRACT_LEASE_DURATION_INVALID",
      { leaseDurationMonths: leaseDurationMonths ?? null },
    );
  }
  const end = dayjs(start).add(duration, "month");
  if (!end.isValid()) {
    throw contractDateError(
      "The Contract lease end date could not be derived.",
      "CONTRACT_LEASE_END_DATE_INVALID",
    );
  }
  return {
    leaseStartDate: start,
    leaseEndDate: end.toDate(),
    leaseDurationMonths: duration,
  };
};

export const deriveAdvanceCoverageDates = (leaseStartDate) => {
  const start = validDate(leaseStartDate);
  if (!start) {
    throw contractDateError(
      "A valid lease start date is required for advance-rent coverage.",
      "CONTRACT_ADVANCE_COVERAGE_START_INVALID",
    );
  }
  return {
    advanceCoverageStart: start,
    advanceCoverageEnd: dayjs(start).add(1, "month").subtract(1, "day").toDate(),
  };
};
