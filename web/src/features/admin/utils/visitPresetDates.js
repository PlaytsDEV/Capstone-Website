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
