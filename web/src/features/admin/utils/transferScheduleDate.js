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
 * The EARLIEST date a new Admin Room Transfer may be scheduled for. Same-day
 * transfers are ALLOWED (subject to a backend office-hours check), so this is
 * TODAY, as a local calendar `YYYY-MM-DD` string — the wizard's date picker
 * uses it as `min`. Philippine users are UTC+8, so local calendar === Manila
 * calendar; the backend (`isPastManilaDate` / `isWithinOfficeHours`) stays
 * authoritative and rejects a past date (TRANSFER_DATE_INVALID) or an
 * out-of-office-hours same-day time (OUTSIDE_OFFICE_HOURS).
 *
 * @param {Date} [now] - injectable for tests
 * @returns {string}
 */
export const minScheduleDateStr = (now = new Date()) => toDateInputValue(now);

/** "HH:mm" -> minutes from midnight, or null. */
export const timeStrToMinutes = (value) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(mins) && mins >= 0 && mins < 24 * 60 ? mins : null;
};

/** minutes from midnight -> "HH:mm". */
export const minutesToTimeStr = (minutes) => {
  const m = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Advisory (backend-authoritative) same-day office-hours check for the wizard.
 * Given a `YYYY-MM-DD` + `HH:mm` and the resolved office hours, returns
 * `{ ok, reason }`. Only same-day is gated — a future date is always ok here.
 *
 * @param {string} dateStr  `YYYY-MM-DD`
 * @param {string} timeStr  `HH:mm`
 * @param {{ startMinutes:number, endMinutes:number, days:number[] }} officeHours
 * @param {Date} [now]
 */
export const checkSameDayOfficeHours = (dateStr, timeStr, officeHours, now = new Date()) => {
  if (!dateStr) return { ok: false, reason: "Select an effective date." };
  if (dateStr > localTodayStr(now)) return { ok: true, reason: "" };
  if (dateStr < localTodayStr(now)) return { ok: false, reason: "The effective date is in the past." };
  // Same day — check the time against office hours.
  const mins = timeStrToMinutes(timeStr);
  if (mins == null) return { ok: false, reason: "Enter a valid transfer time (HH:mm)." };
  const oh = officeHours || { startMinutes: 8 * 60, endMinutes: 20 * 60, days: [1, 2, 3, 4, 5, 6] };
  const target = new Date(now);
  const isoDay = target.getDay() === 0 ? 7 : target.getDay();
  if (Array.isArray(oh.days) && oh.days.length && !oh.days.includes(isoDay)) {
    return { ok: false, reason: "The office is closed today. Choose a future date." };
  }
  if (mins < oh.startMinutes || mins >= oh.endMinutes) {
    return {
      ok: false,
      reason: `Same-day transfers must be within office hours (${minutesToTimeStr(oh.startMinutes)}–${minutesToTimeStr(oh.endMinutes)}).`,
    };
  }
  return { ok: true, reason: "" };
};

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
