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

export function assertUtilityStartDate(startDate, { now = new Date() } = {}) {
  const start = billingDay(startDate, "Period start date");
  if (start.isAfter(currentBillingDay(now))) {
    throw integrityError(
      "Period start date cannot be in the future.",
      400,
      "UTILITY_START_DATE_IN_FUTURE",
    );
  }
  return start.toDate();
}

export function assertUtilityReadingDate(date, { periodStart = null, now = new Date() } = {}) {
  const reading = billingDay(date, "Meter reading date");
  if (reading.isAfter(currentBillingDay(now))) {
    throw integrityError(
      "Meter reading date cannot be in the future.",
      400,
      "UTILITY_READING_DATE_IN_FUTURE",
    );
  }
  if (periodStart && reading.isBefore(billingDay(periodStart, "Period start date"))) {
    throw integrityError(
      "Meter reading date cannot be before the period start date.",
      400,
      "UTILITY_READING_BEFORE_PERIOD",
    );
  }
  return reading.toDate();
}

export function assertUtilityClosingDate(startDate, endDate, { now = new Date() } = {}) {
  const start = billingDay(startDate, "Period start date");
  const end = billingDay(endDate, "Period end date");
  if (start.isAfter(currentBillingDay(now))) {
    throw integrityError(
      "A future utility period cannot be finalized.",
      400,
      "UTILITY_START_DATE_IN_FUTURE",
    );
  }
  if (end.isBefore(start)) {
    throw integrityError(
      "Period end date cannot be before the period start date.",
      400,
      "UTILITY_PERIOD_REVERSED",
    );
  }
  if (end.isAfter(currentBillingDay(now))) {
    throw integrityError(
      "Period end date and final meter reading cannot be in the future.",
      400,
      "UTILITY_END_DATE_IN_FUTURE",
    );
  }
  return end.toDate();
}

export function assertUtilityPeriodSendable(period, { now = new Date() } = {}) {
  try {
    const end = assertUtilityClosingDate(period?.startDate, period?.endDate, { now });
    if (period?.closedAt) {
      const closed = billingDay(period.closedAt, "Period finalized date");
      const start = billingDay(period.startDate, "Period start date");
      if (closed.isBefore(start) || closed.isBefore(billingDay(end, "Period end date"))) {
        throw integrityError(
          "The period was finalized before its recorded cycle ended.",
          409,
          "UTILITY_FINALIZED_BEFORE_PERIOD_END",
        );
      }
    }
  } catch (error) {
    error.statusCode = 409;
    error.code = "UTILITY_PERIOD_REQUIRES_DATE_REVIEW";
    error.message = `This utility period has invalid or future dates and must be corrected before it can be sent. ${error.message}`;
    throw error;
  }
}

export default {
  assertUtilityStartDate,
  assertUtilityReadingDate,
  assertUtilityClosingDate,
  assertUtilityPeriodSendable,
};
