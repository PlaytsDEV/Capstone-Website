import { BedDouble, Receipt, Wrench } from "lucide-react";

export const REPORT_TABS = [
  { key: "occupancy", label: "Occupancy", icon: BedDouble, iconClassName: "text-blue-500 dark:text-blue-400" },
  { key: "billing", label: "Billing", icon: Receipt, iconClassName: "text-emerald-600 dark:text-emerald-400" },
  { key: "operations", label: "Operations", icon: Wrench, iconClassName: "text-amber-500 dark:text-amber-400" },
];

export const REPORT_ROUTES = {
 occupancy: "/admin/analytics/details?tab=occupancy",
 billing: "/admin/analytics/details?tab=billing",
 operations: "/admin/analytics/details?tab=operations",
};

export const formatPeso = (value) => {
  const num = Number(value || 0);
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return isNegative ? `-₱${absFormatted}` : `₱${absFormatted}`;
};

export const cleanCurrencyLabel = (str) => {
  if (str === null || str === undefined || str === "") return "₱0";
  if (typeof str === "string") {
    if (str.includes("PHP -")) {
      return str.replace("PHP -", "-₱");
    }
    if (str.includes("-PHP ")) {
      return str.replace("-PHP ", "-₱");
    }
    return str.replace("PHP ", "₱");
  }
  return formatPeso(str);
};

export const formatDate = (value) => {
 if (!value) return "-";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "-";
 return date.toLocaleDateString("en-PH", {
 year: "numeric",
 month: "short",
 day: "numeric",
 });
};

export const formatDateTime = (value) => {
 if (!value) return "-";
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "-";
 return date.toLocaleString("en-PH", {
 year: "numeric",
 month: "short",
 day: "numeric",
 hour: "numeric",
 minute: "2-digit",
 });
};

export const formatBranch = (value) =>
 String(value || "")
 .split("-")
 .filter(Boolean)
 .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
 .join(" ") || "-";

export const buildRangeLabel = (range) => {
  const labels = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "60d": "Last 60 days",
    "90d": "Last 90 days",
    "180d": "Last 180 days",
    "365d": "Last 1 year",
    "1y": "Last 1 year",
    "3m": "Last 3 months",
    "6m": "Last 6 months",
    "12m": "Last 12 months",
    "24m": "Last 24 months",
  };
  if (labels[range]) return labels[range];
  const match = String(range || "").match(/^(\d+)d$/i);
  if (match) {
    const days = parseInt(match[1], 10);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return range || "-";
};
