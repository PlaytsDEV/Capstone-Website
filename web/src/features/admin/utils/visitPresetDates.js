/**
 * Special Date & Holiday Presets for Lilycrest DMS Visit Availability
 * Contains Philippine 2026 National Holidays & Key Operational Closures
 */

export function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBlackoutDateDisplay(isoDate) {
  if (!isoDate) return "—";
  const parts = String(isoDate).split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(dateObj.getTime())) return isoDate;
  return dateObj.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getBlackoutDateStatus(dateStr, todayStr = getTodayISO()) {
  if (!dateStr) return "upcoming";
  if (dateStr === todayStr) return "today";
  if (dateStr < todayStr) return "past";
  return "upcoming";
}

/**
 * Filter and sort blackout dates based on search, status filter, and date sorting order
 */
export function filterAndSortBlackouts(
  blackouts = [],
  { search = "", statusFilter = "all", sortOrder = "asc" } = {},
  todayStr = getTodayISO()
) {
  let result = [...blackouts];

  // 1. Search Filter
  if (search.trim()) {
    const query = search.trim().toLowerCase();
    result = result.filter(
      (b) =>
        (b.date && b.date.toLowerCase().includes(query)) ||
        (b.reason && b.reason.toLowerCase().includes(query))
    );
  }

  // 2. Status Filter
  if (statusFilter !== "all") {
    result = result.filter((b) => {
      const status = getBlackoutDateStatus(b.date, todayStr);
      return status === statusFilter;
    });
  }

  // 3. Sort Order
  result.sort((a, b) => {
    const dA = a.date || "";
    const dB = b.date || "";
    if (sortOrder === "desc") {
      return dB.localeCompare(dA);
    }
    return dA.localeCompare(dB);
  });

  return result;
}

/**
 * Partitions blackouts into active (today + upcoming) vs expired (past)
 */
export function partitionExpiredBlackouts(blackouts = [], todayStr = getTodayISO()) {
  const active = [];
  const expired = [];

  for (const b of blackouts) {
    const status = getBlackoutDateStatus(b.date, todayStr);
    if (status === "past") {
      expired.push(b);
    } else {
      active.push(b);
    }
  }

  return { active, expired };
}

/**
 * Philippine 2026 National Holidays Preset List
 */
export const PH_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day", type: "regular" },
  { date: "2026-01-02", name: "Day after New Year's Day", type: "special" },
  { date: "2026-02-17", name: "Chinese New Year", type: "special" },
  { date: "2026-02-25", name: "EDSA People Power Revolution Anniversary", type: "special" },
  { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
  { date: "2026-04-03", name: "Good Friday", type: "regular" },
  { date: "2026-04-04", name: "Black Saturday", type: "special" },
  { date: "2026-04-09", name: "Araw ng Kagitingan", type: "regular" },
  { date: "2026-05-01", name: "Labor Day", type: "regular" },
  { date: "2026-06-12", name: "Independence Day", type: "regular" },
  { date: "2026-08-21", name: "Ninoy Aquino Day", type: "special" },
  { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
  { date: "2026-11-01", name: "All Saints' Day", type: "special" },
  { date: "2026-11-02", name: "All Souls' Day", type: "special" },
  { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2026-12-25", name: "Christmas Day", type: "regular" },
  { date: "2026-12-30", name: "Rizal Day", type: "regular" },
];

/**
 * Quick Preset Bundles for Modal Selection
 */
export const PRESET_BUNDLES = [
  {
    id: "all_2026",
    label: "All 2026 Holidays",
    description: "All 17 official Philippine national holidays for 2026",
    items: PH_HOLIDAYS_2026,
  },
  {
    id: "regular_2026",
    label: "Regular Holidays",
    description: "Mandatory regular holidays across all branches",
    items: PH_HOLIDAYS_2026.filter((h) => h.type === "regular"),
  },
  {
    id: "special_2026",
    label: "Special Non-Working Days",
    description: "Special nationwide non-working holidays",
    items: PH_HOLIDAYS_2026.filter((h) => h.type === "special"),
  },
  {
    id: "holy_week_2026",
    label: "Holy Week & Easter 2026",
    description: "April Maundy Thursday through Black Saturday",
    items: PH_HOLIDAYS_2026.filter((h) => h.date >= "2026-04-02" && h.date <= "2026-04-04"),
  },
];

/**
 * Merge Preset Items into Existing Blackout Dates without duplicates
 */
export function mergeBlackoutPresets(existingBlackouts = [], newPresetItems = []) {
  const existingMap = new Set(existingBlackouts.map((b) => b.date));
  let addedCount = 0;
  let skippedCount = 0;
  const mergedList = [...existingBlackouts];

  for (const item of newPresetItems) {
    if (existingMap.has(item.date)) {
      skippedCount++;
    } else {
      existingMap.add(item.date);
      mergedList.push({
        date: item.date,
        reason: item.reason || item.name || "Holiday Blackout",
      });
      addedCount++;
    }
  }

  return { mergedList, addedCount, skippedCount };
}
