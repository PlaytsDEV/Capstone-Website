import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

// Ensure Node process TZ default aligns with Philippine Time
if (!process.env.TZ) {
  process.env.TZ = APP_TIMEZONE;
}

// Set default timezone for dayjs
dayjs.tz.setDefault(APP_TIMEZONE);

/**
 * Get a dayjs instance in Asia/Manila (PHT) timezone context.
 */
export function getManilaDayjs(dateLike) {
  if (dateLike === undefined || dateLike === null) {
    return dayjs().tz(APP_TIMEZONE);
  }
  return dayjs(dateLike).tz(APP_TIMEZONE);
}

/**
 * Normalize a date to midnight (00:00:00.000) in Asia/Manila timezone.
 */
export function toManilaStartOfDay(dateLike) {
  if (!dateLike) return null;
  const d = getManilaDayjs(dateLike);
  return d.isValid() ? d.startOf("day") : null;
}

/**
 * Get current date at midnight (00:00:00.000) in Asia/Manila timezone.
 */
export function getManilaToday() {
  return dayjs().tz(APP_TIMEZONE).startOf("day");
}

/**
 * Compute exact difference in calendar days between two dates in Asia/Manila.
 * Returns (dateA - dateB) in Manila calendar days.
 */
export function diffManilaDays(dateA, dateB) {
  const dayA = toManilaStartOfDay(dateA);
  const dayB = toManilaStartOfDay(dateB);
  if (!dayA || !dayB) return NaN;
  return dayA.diff(dayB, "day");
}

/**
 * Format a date in Asia/Manila timezone.
 */
export function formatManilaDate(dateLike, formatStr = "YYYY-MM-DD") {
  if (!dateLike) return "";
  const d = getManilaDayjs(dateLike);
  return d.isValid() ? d.format(formatStr) : "";
}

export { dayjs };
