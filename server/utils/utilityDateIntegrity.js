import { getManilaDayjs } from "./dateUtils.js";

function integrityError(message, statusCode = 400, code = "UTILITY_DATE_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function billingDay(value, label) {
  const parsed = getManilaDayjs(value);
  if (!value || !parsed.isValid()) {
    throw integrityError(`${label} must be a valid date.`);
  }
  return parsed.startOf("day");
}

function currentBillingDay(now = new Date()) {
  return getManilaDayjs(now).startOf("day");
}

export function assertUtilityStartDate(startDate) {
  const start = billingDay(startDate, "Period start date");
  return start.toDate();
}

export function assertUtilityReadingDate(date, { periodStart = null } = {}) {
  const reading = billingDay(date, "Meter reading date");
  if (periodStart && reading.isBefore(billingDay(periodStart, "Period start date"))) {
    throw integrityError(
      "Meter reading date cannot be before the period start date.",
      400,
      "UTILITY_READING_BEFORE_PERIOD",
    );
  }
  return reading.toDate();
}

export function assertUtilityClosingDate(startDate, endDate) {
  const start = billingDay(startDate, "Period start date");
  const end = billingDay(endDate, "Period end date");
  if (end.isBefore(start)) {
    throw integrityError(
      "Period end date cannot be before the period start date.",
      400,
      "UTILITY_PERIOD_REVERSED",
    );
  }
  return end.toDate();
}

export function assertUtilityPeriodSendable(period) {
  try {
    assertUtilityClosingDate(period?.startDate, period?.endDate);
    if (period?.closedAt) {
      const closed = billingDay(period.closedAt, "Period finalized date");
      const start = billingDay(period.startDate, "Period start date");
      if (closed.isBefore(start)) {
        throw integrityError(
          "The period was finalized before its recorded cycle started.",
          409,
          "UTILITY_FINALIZED_BEFORE_PERIOD_START",
        );
      }
    }
  } catch (error) {
    error.statusCode = 409;
    error.code = "UTILITY_PERIOD_REQUIRES_DATE_REVIEW";
    error.message = `This utility period has invalid dates and must be corrected before it can be sent. ${error.message}`;
    throw error;
  }
}

export default {
  assertUtilityStartDate,
  assertUtilityReadingDate,
  assertUtilityClosingDate,
  assertUtilityPeriodSendable,
};
