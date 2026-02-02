/**
 * =============================================================================
 * DATE FORMATTING UTILITIES
 * =============================================================================
 *
 * Utility functions for formatting dates throughout the application.
 * Provides consistent date display across all components.
 *
 * Usage:
 *   import { formatDate, formatDateTime, getRelativeTime } from '../utils/formatDate';
 *
 *   formatDate(new Date());           // "2026-02-02"
 *   formatDate(date, 'MM/DD/YYYY');   // "02/02/2026"
 *   formatDateTime(date);             // "2/2/2026, 10:30:00 AM"
 *   getRelativeTime(date);            // "5 minutes ago"
 * =============================================================================
 */

/**
 * Format a date to a string in various formats
 *
 * @param {Date|string|number} date - Date to format (Date object, ISO string, or timestamp)
 * @param {string} format - Output format (default: 'YYYY-MM-DD')
 * @returns {string} Formatted date string or empty string if invalid
 *
 * @example
 * formatDate(new Date());                    // "2026-02-02"
 * formatDate('2026-02-02', 'MM/DD/YYYY');    // "02/02/2026"
 * formatDate(1738473600000, 'DD/MM/YYYY');   // "02/02/2026"
 */
export const formatDate = (date, format = "YYYY-MM-DD") => {
  if (!date) return "";

  const d = new Date(date);

  // Check for invalid date
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  switch (format) {
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MMM DD, YYYY":
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    default:
      return `${year}-${month}-${day}`;
  }
};

/**
 * Format a date with time using locale string
 *
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date-time string or empty string if invalid
 *
 * @example
 * formatDateTime(new Date()); // "2/2/2026, 10:30:00 AM"
 */
export const formatDateTime = (date) => {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString();
};

/**
 * Get relative time string (e.g., "5 minutes ago")
 *
 * @param {Date|string|number} date - Date to compare against now
 * @returns {string} Relative time string or empty string if invalid
 *
 * @example
 * getRelativeTime(Date.now() - 300000);  // "5 minutes ago"
 * getRelativeTime(Date.now() - 7200000); // "2 hours ago"
 * getRelativeTime(Date.now() - 172800000); // "2 days ago"
 */
export const getRelativeTime = (date) => {
  if (!date) return "";

  const now = new Date();
  const past = new Date(date);

  if (isNaN(past.getTime())) return "";

  const diffInMs = now - past;
  const diffInMins = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) {
    return "Just now";
  } else if (diffInMins < 60) {
    return `${diffInMins} minute${diffInMins === 1 ? "" : "s"} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  } else {
    // For older dates, show the actual date
    return formatDate(date, "MMM DD, YYYY");
  }
};
