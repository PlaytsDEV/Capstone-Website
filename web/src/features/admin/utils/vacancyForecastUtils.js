/**
 * vacancyForecastUtils.js
 * Shared vacancy forecast helper functions for Room Management.
 * Used by RoomAvailabilityPage and OccupancyTrackingPage.
 */

/**
 * Returns the number of days until a given vacancy date.
 * Negative values indicate overdue (past due).
 * @param {string|Date|null} value
 * @returns {number|null}
 */
export function getDaysUntilVacancy(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Formats a vacancy date for display.
 * @param {string|Date|null} value
 * @returns {string}
 */
export function formatForecastDate(value) {
  if (!value) return "No forecast";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Returns display metadata (label, badge CSS, accent color, card CSS class)
 * based on how many days until vacancy.
 * @param {number|null} daysUntil
 * @returns {{ label: string, className: string, badgeClass: string, accent: string }}
 */
export function getForecastTone(daysUntil) {
  if (daysUntil == null) {
    return {
      label: "No date",
      className: "forecast-card--neutral",
      badgeClass:
        "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
      accent: "var(--text-muted)",
    };
  }
  if (daysUntil < 0) {
    return {
      label: "Overdue",
      className: "forecast-card--overdue",
      badgeClass:
        "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800",
      accent: "var(--status-error)",
    };
  }
  if (daysUntil <= 7) {
    return {
      label: "This week",
      className: "forecast-card--soon",
      badgeClass:
        "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      accent: "var(--accent-orange)",
    };
  }
  if (daysUntil <= 30) {
    return {
      label: "This month",
      className: "forecast-card--upcoming",
      badgeClass:
        "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      accent: "var(--status-success)",
    };
  }
  return {
    label: "Later",
    className: "forecast-card--neutral",
    badgeClass:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    accent: "var(--accent-blue)",
  };
}

/**
 * Builds a summary object from a raw vacancy forecast array.
 * @param {Array} vacancyForecast
 * @returns {{ total: number, withDate: number, expiringSoon: number, overdue: number }}
 */
export function buildForecastSummary(vacancyForecast) {
  const total = vacancyForecast.length;
  let withDate = 0;
  let expiringSoon = 0;
  let overdue = 0;

  vacancyForecast.forEach((item) => {
    if (item.nextExpectedVacancy) {
      withDate++;
      const days = getDaysUntilVacancy(item.nextExpectedVacancy);
      if (days != null && days < 0) overdue++;
      else if (days != null && days <= 7) expiringSoon++;
    }
  });

  return { total, withDate, expiringSoon, overdue };
}

/**
 * Returns the soonest vacancy bed object from a forecast item's bed list.
 * @param {{ beds?: Array }} forecastItem
 * @returns {object|null}
 */
export function getSoonestVacancyBed(forecastItem) {
  if (!forecastItem?.beds?.length) return null;
  const datedBeds = forecastItem.beds.filter((bed) => bed.expectedVacancy);
  if (datedBeds.length === 0) return null;
  return datedBeds.sort(
    (a, b) => new Date(a.expectedVacancy) - new Date(b.expectedVacancy)
  )[0];
}
