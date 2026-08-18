/**
 * Constants and date computation helpers for the Reservation Application form.
 * Extracted from ReservationApplicationStep.jsx.
 */

export const MOVE_IN_TIME_SLOTS = [
 { value: "08:00", label: "8:00 AM" },
 { value: "09:00", label: "9:00 AM" },
 { value: "10:00", label: "10:00 AM" },
 { value: "11:00", label: "11:00 AM" },
 { value: "12:00", label: "12:00 PM" },
 { value: "13:00", label: "1:00 PM" },
 { value: "14:00", label: "2:00 PM" },
 { value: "15:00", label: "3:00 PM" },
 { value: "16:00", label: "4:00 PM" },
 { value: "17:00", label: "5:00 PM" },
 { value: "18:00", label: "6:00 PM" },
];

export const REFERRAL_OPTIONS = [
 { id: "facebook", value: "facebook", label: "Facebook Ad" },
 { id: "instagram", value: "instagram", label: "Instagram" },
 { id: "tiktok", value: "tiktok", label: "TikTok" },
 { id: "walkin", value: "walkin", label: "Walk-in" },
 { id: "friend", value: "friend", label: "Referred by a Friend" },
 { id: "other", value: "other", label: "Other" },
];

export const WORK_SCHEDULE_OPTIONS = [
 { id: "dayshift", value: "day", label: "Day Shift (around 9 am to 5 pm)" },
 {
 id: "nightshift",
 value: "night",
 label: "Night Shift (around 11 pm to 7 am)",
 },
 { id: "others", value: "others", label: "Others" },
];

export const LEASE_OPTIONS = [
  { value: "1", label: "1 month", shortLabel: "1 mo", months: 1 },
  { value: "2", label: "2 months", shortLabel: "2 mos", months: 2 },
  { value: "3", label: "3 months", shortLabel: "3 mos", months: 3 },
  { value: "4", label: "4 months", shortLabel: "4 mos", months: 4 },
  { value: "5", label: "5 months", shortLabel: "5 mos", months: 5 },
  { value: "6", label: "6 months", shortLabel: "6 mos", months: 6 },
  { value: "10", label: "10 months", shortLabel: "10 mos", months: 10 },
  { value: "12", label: "1 year", shortLabel: "1 yr", months: 12 },
];

/**
 * Returns available lease options sorted ascending, dynamically including
 * room-specific minimum long-term duration (e.g., 10 months) if not already present.
 */
export function getAvailableLeaseOptions(minMonths = 6) {
  const optionsMap = new Map();
  LEASE_OPTIONS.forEach((opt) => optionsMap.set(Number(opt.value), opt));

  if (minMonths && !optionsMap.has(Number(minMonths))) {
    const num = Number(minMonths);
    optionsMap.set(num, {
      value: String(num),
      label: num === 12 ? "1 year" : `${num} months`,
      shortLabel: num === 12 ? "1 yr" : `${num} mos`,
      months: num,
    });
  }

  return Array.from(optionsMap.values()).sort((a, b) => a.months - b.months);
}

export const formatDateInputValue = (date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Compute intended move-in date constraints relative to a reference date (defaults to today) */
export function getMoveInDateConstraints(referenceDate = new Date()) {
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const moveInMin = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 3,
  );
  const moveInMax = new Date(
    today.getFullYear(),
    today.getMonth() + 3,
    today.getDate(),
  );
  return {
    moveInMin: formatDateInputValue(moveInMin),
    moveInMax: formatDateInputValue(moveInMax),
    minMoveInDate: formatDateInputValue(moveInMin),
    maxMoveInDate: formatDateInputValue(moveInMax),
  };
}

/** Compute date constraints relative to today */
export function getDateConstraints() {
  const today = new Date();
  const birthdayMax = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );
  const birthdayMin = new Date(
    today.getFullYear() - 80,
    today.getMonth(),
    today.getDate(),
  );
  const { moveInMin, moveInMax } = getMoveInDateConstraints(today);
  return {
    birthdayMin: formatDateInputValue(birthdayMin),
    birthdayMax: formatDateInputValue(birthdayMax),
    moveInMin,
    moveInMax,
  };
}

