// Canonical calendar-date helpers for the Transfer Tenant wizard's
// "is this a future (scheduled) transfer?" decision.
//
// Business logic here compares CANONICAL `YYYY-MM-DD` strings only — never
// locale-formatted display strings like "09/05/2026", which sort
// lexicographically wrong and vary by locale. A native <input type="date">
// already yields `YYYY-MM-DD`; `toDateInputValue` produces the same shape
// from a Date using LOCAL calendar fields (Philippines users are UTC+8, so
// local === Manila), never `toISOString()` (which shifts to UTC and can roll
// back a day just after local midnight).
//
// Extracted from TenantWorkspaceModals so the exact comparison the wizard
// runs is unit-testable without mounting React.

/**
 * A Date -> local calendar `YYYY-MM-DD` (matches a native date input).
 * Returns "" for a nullish or unparseable value.
 * @param {Date|string|number|null|undefined} value
 * @returns {string}
 */
export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Today as a local calendar `YYYY-MM-DD` string.
 * @param {Date} [now] - injectable for tests
 * @returns {string}
 */
export const localTodayStr = (now = new Date()) => toDateInputValue(now);

/**
 * True when `effectiveTransferDate` (a `YYYY-MM-DD` string, or anything
 * `toDateInputValue` can normalize) is strictly AFTER today — i.e. this
 * Confirm SCHEDULES the transfer for a future date rather than executing it
 * now. An empty / missing date is treated as "immediate" (false).
 *
 * Comparison is a plain string `>` on canonical `YYYY-MM-DD`, which is
 * lexicographically correct for ISO dates. Never pass a locale-formatted
 * string here.
 *
 * @param {string} effectiveTransferDate - `YYYY-MM-DD`
 * @param {Date} [now] - injectable for tests
 * @returns {boolean}
 */
export const isScheduledTransferDate = (effectiveTransferDate, now = new Date()) => {
  if (!effectiveTransferDate) return false;
  const canonical =
    /^\d{4}-\d{2}-\d{2}$/.test(effectiveTransferDate)
      ? effectiveTransferDate
      : toDateInputValue(effectiveTransferDate);
  if (!canonical) return false;
  return canonical > localTodayStr(now);
};
