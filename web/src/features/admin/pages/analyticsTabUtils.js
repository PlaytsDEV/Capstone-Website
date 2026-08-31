import { exportToCSV } from "../../../shared/utils/exportUtils.js";
import { exportReportPdf } from "../../../shared/utils/reportPdf.js";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants.js";
import { buildRangeLabel } from "./reportCommon.js";

/**
 * Safely unwrap a table field from the analytics API.
 * The backend's `buildPaginatedTable` returns `{ rows, pagination }`,
 * but older API fixtures or flat tables may return a bare array.
 */
export function unwrapTableRows(tableField) {
  if (Array.isArray(tableField)) return tableField;
  if (Array.isArray(tableField?.rows)) return tableField.rows;
  return [];
}

export function unwrapTablePagination(tableField) {
  if (tableField?.pagination && typeof tableField.pagination === "object") {
    return tableField.pagination;
  }
  const rows = unwrapTableRows(tableField);
  return {
    total: rows.length,
    page: 1,
    limit: rows.length || 10,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };
}

export const RANGE_OPTIONS_SHORT = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "365d", label: "Last 1 Year" },
];

export const RANGE_OPTIONS_LONG = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];

export function buildBranchControl({ isOwner, branch, onChange }) {
  if (!isOwner) return null;
  return {
    value: branch,
    onChange,
    options: OWNER_BRANCH_FILTER_OPTIONS,
  };
}

export function handleCsvExport(data, columns, filename) {
  exportToCSV(data, columns, filename);
}

export async function handlePdfExport(config) {
  await exportReportPdf(config);
}

/**
 * Anomaly detection helper for Billing & Financials
 */
export function detectBillingAnomalies(kpis = {}) {
  const collectionRate = Number(kpis.collectionRate ?? 100);
  const overdueAmount = Number(kpis.overdueAmount ?? 0);
  const billedAmount = Number(kpis.billedAmount ?? 0);

  const badges = {};

  if (collectionRate < 70) {
    badges.collectionRate = { label: "Critical <70%", severity: "danger" };
  } else if (collectionRate < 85) {
    badges.collectionRate = { label: "Below Target <85%", severity: "warning" };
  }

  if (billedAmount > 0 && overdueAmount / billedAmount > 0.3) {
    badges.overdueAmount = { label: "Overdue Spike >30%", severity: "danger" };
  } else if (overdueAmount > 15000) {
    badges.overdueAmount = { label: "High Overdue Arrears", severity: "warning" };
  }

  return badges;
}

/**
 * Anomaly detection helper for Occupancy
 */
export function detectOccupancyAnomalies(kpis = {}) {
  const occupancyRate = Number(kpis.occupancyRate ?? 100);
  const unavailableBeds = Number(kpis.unavailableBeds ?? 0);

  const badges = {};

  if (occupancyRate < 60) {
    badges.occupancyRate = { label: "Low Capacity <60%", severity: "danger" };
  } else if (occupancyRate < 75) {
    badges.occupancyRate = { label: "Below Target <75%", severity: "warning" };
  } else if (occupancyRate >= 95) {
    badges.occupancyRate = { label: "Peak Occupancy", severity: "success" };
  }

  if (unavailableBeds > 2) {
    badges.availableBeds = { label: `${unavailableBeds} Offline Beds`, severity: "warning" };
  }

  return badges;
}

/**
 * Anomaly detection helper for Operations & Maintenance
 */
export function detectOperationsAnomalies(kpis = {}) {
  const slaComplianceRate = Number(kpis.slaComplianceRate ?? 100);
  const maintenanceRequests = Number(kpis.maintenanceRequests ?? 0);

  const badges = {};

  if (slaComplianceRate < 70) {
    badges.slaComplianceRate = { label: "Turnaround Critical <70%", severity: "danger" };
  } else if (slaComplianceRate < 85) {
    badges.slaComplianceRate = { label: "Turnaround Risk <85%", severity: "warning" };
  }

  if (maintenanceRequests > 20) {
    badges.maintenanceRequests = { label: "High Ticket Volume", severity: "warning" };
  }

  return badges;
}

/**
 * Dynamic prompt generators based on live report data, anomalies, and KPIs
 */
export function getDynamicOccupancyPrompts(data, forecast) {
  const kpis = data?.kpis || {};
  const prompts = [];

  const unavailableBeds = Number(kpis.unavailableBeds || 0);
  const availableBeds = Number(kpis.availableBeds || 0);
  const occupancyRate = kpis.occupancyRate != null ? Number(kpis.occupancyRate) : null;
  const projectedFirst = forecast?.projected?.[0];

  if (unavailableBeds > 0) {
    prompts.push(`Why are ${unavailableBeds} beds currently offline or under repair?`);
  } else {
    prompts.push("Are any beds currently offline or under repair?");
  }

  if (availableBeds > 0) {
    prompts.push(`Which rooms currently have open beds (${availableBeds} available)?`);
  } else {
    prompts.push("Which rooms have open beds?");
  }

  if (projectedFirst?.label && projectedFirst?.projectedOccupancyRate != null) {
    prompts.push(`What is our projected occupancy for ${projectedFirst.label} (${projectedFirst.projectedOccupancyRate}%)?`);
  } else {
    prompts.push("What is our projected occupancy for next semester?");
  }

  if (occupancyRate != null && occupancyRate < 85) {
    prompts.push(`How can we improve room occupancy from ${kpis.occupancyRateLabel || `${occupancyRate}%`}?`);
  } else {
    prompts.push("How can we improve room occupancy?");
  }

  return prompts.slice(0, 4);
}

export function getDynamicBillingPrompts(data) {
  const kpis = data?.kpis || {};
  const overdueAccounts = unwrapTableRows(data?.tables?.overdueAccounts);
  const prompts = [];

  const overdueCount = overdueAccounts.length;
  const overdueAmount = Number(kpis.overdueAmount || kpis.outstandingBalance || 0);
  const collectionRate = kpis.collectionRate != null ? Number(kpis.collectionRate) : null;
  const collectedStr = kpis.collectedRevenueLabel?.replace("PHP ", "₱");

  if (overdueCount > 0 || overdueAmount > 0) {
    prompts.push(`Which tenants have overdue balances past 30 days (${overdueCount} accounts)?`);
  } else {
    prompts.push("Which tenants have balances past 30 days?");
  }

  if (overdueAmount > 0) {
    prompts.push("Are any payments overdue or at high risk of default?");
  } else {
    prompts.push("Are any payments overdue?");
  }

  if (collectedStr) {
    prompts.push(`How much revenue have we collected this month (${collectedStr})?`);
  } else {
    prompts.push("How much revenue have we collected this month?");
  }

  if (collectionRate != null && collectionRate < 90) {
    prompts.push(`How can we raise our collection rate from ${kpis.collectionRateLabel || `${collectionRate}%`} to 95%?`);
  } else {
    prompts.push("What collections are expected next month?");
  }

  return prompts.slice(0, 4);
}

export function getDynamicOperationsPrompts(data) {
  const kpis = data?.kpis || {};
  const series = data?.series || {};
  const maintenanceByType = series.maintenanceByType || [];
  const prompts = [];

  const maintRequests = Number(kpis.maintenanceRequests || 0);
  const slaCompliance = kpis.slaComplianceRate != null ? Number(kpis.slaComplianceRate) : null;
  const topType = maintenanceByType[0]?.label;

  if (maintRequests > 0) {
    prompts.push(`What repairs are taking the longest among ${maintRequests} active tickets?`);
  } else {
    prompts.push("What repairs are taking the longest?");
  }

  if (topType) {
    prompts.push(`Why do ${topType} issues happen most often?`);
  } else {
    prompts.push("Which maintenance issues happen most often?");
  }

  prompts.push("When do most prospective tenants inquire?");

  if (slaCompliance != null && slaCompliance < 90) {
    prompts.push(`How can we improve SLA compliance from ${kpis.slaComplianceRateLabel || `${slaCompliance}%`}?`);
  } else {
    prompts.push("How can we resolve maintenance tickets faster?");
  }

  return prompts.slice(0, 4);
}

export function getDynamicAcquisitionPrompts(reportData = []) {
  const channels = Array.isArray(reportData) ? reportData : [];
  const topChannel = channels[0];
  const bestConverting = [...channels]
    .filter((c) => Number(c.totalLeads || 0) >= 3)
    .sort((a, b) => Number(b.conversionRate || 0) - Number(a.conversionRate || 0))[0];
  const prompts = [];

  if (bestConverting?.channel && bestConverting.conversionRate != null) {
    prompts.push(`Why does ${bestConverting.channel} have our highest conversion rate (${bestConverting.conversionRate}%)?`);
  } else {
    prompts.push("Which marketing channels have the highest conversion rate?");
  }

  if (topChannel?.channel) {
    prompts.push(`How can we convert more leads from ${topChannel.channel} into move-ins?`);
  } else {
    prompts.push("How can we convert more leads into move-ins?");
  }

  prompts.push("Which channels bring in the most viewings?");
  prompts.push("Where should we focus our marketing efforts?");

  return prompts.slice(0, 4);
}

export function getDynamicDemographicsPrompts(data) {
  const kpis = data?.kpis || {};
  const prompts = [];

  const dominantOcc = kpis.dominantOccupation;
  const dominantPct = kpis.dominantPercentageLabel || kpis.studentPercentageLabel;
  const topProvince = kpis.topProvince;
  const topRoom = kpis.topRoomType;
  const peakMonth = kpis.peakMonth;

  if (dominantOcc && dominantPct) {
    prompts.push(`Who are our primary tenants (${dominantPct} ${dominantOcc.toLowerCase()} vs other occupations)?`);
  } else {
    prompts.push("Who are our primary tenants—students or working professionals?");
  }

  if (topProvince && topProvince !== "N/A") {
    prompts.push(`Why do most of our tenants come from ${topProvince}?`);
  } else {
    prompts.push("Where do most of our tenants come from?");
  }

  if (topRoom && topRoom !== "N/A") {
    prompts.push(`Why is ${topRoom} the top room preference among applicants?`);
  } else {
    prompts.push("Which room types do new tenants prefer?");
  }

  if (peakMonth && peakMonth !== "N/A") {
    prompts.push(`Why does reservation volume peak in ${peakMonth}?`);
  } else {
    prompts.push("How long do tenants usually stay?");
  }

  return prompts.slice(0, 4);
}

export function getDynamicFinancialsPrompts(data) {
  const kpis = data?.kpis || {};
  const overdueRooms = unwrapTableRows(data?.tables?.overdueRooms);
  const branchComparison = data?.series?.branchComparison || [];
  const prompts = [];

  const collectedStr = (kpis.collectedRevenueLabel || "").replace("PHP ", "₱");
  const overdueCount = overdueRooms.length;

  if (branchComparison.length > 1) {
    prompts.push("How do our branches compare in collections and collection rates?");
  } else {
    prompts.push("How do our branches compare in collections?");
  }

  if (overdueCount > 0) {
    prompts.push(`Which rooms have the highest unpaid balances (${overdueCount} overdue rooms)?`);
  } else {
    prompts.push("Which rooms have the highest unpaid balances?");
  }

  if (collectedStr) {
    prompts.push(`What is our total collected revenue vs target (${collectedStr})?`);
  } else {
    prompts.push("What is our total collected revenue vs target?");
  }

  prompts.push("How can we reduce outstanding dues?");

  return prompts.slice(0, 4);
}

export function getDynamicMonitoringPrompts(data) {
  const kpis = data?.kpis || {};
  const suspiciousIps = Array.isArray(data?.tables?.suspiciousIps) ? data?.tables?.suspiciousIps : [];
  const prompts = [];

  const failedLogins = Number(kpis.failedLogins || 0);
  const criticalEvents = Number(kpis.criticalEvents || 0);
  const accessOverrides = Number(kpis.accessOverrides || 0);

  if (failedLogins > 0) {
    prompts.push(`Are there any unusual failed login attempts (${failedLogins} recorded)?`);
  } else {
    prompts.push("Are there any unusual failed login attempts?");
  }

  if (accessOverrides > 0) {
    prompts.push(`Were any admin permissions or access overrides changed recently (${accessOverrides} overrides)?`);
  } else {
    prompts.push("Were any admin permissions or settings changed recently?");
  }

  if (suspiciousIps.length > 0) {
    prompts.push(`Which IP addresses showed repeated login failures (${suspiciousIps.length} flagged)?`);
  } else {
    prompts.push("Which IP addresses showed repeated login failures?");
  }

  if (criticalEvents > 0) {
    prompts.push(`What triggered the ${criticalEvents} critical security events?`);
  } else {
    prompts.push("Are there any high-priority security alerts?");
  }

  return prompts.slice(0, 4);
}

export function getDynamicOverviewPrompts(data, extra = {}) {
  const kpis = data?.kpis || {};
  const forecast = extra?.forecast || extra?.forecastData?.forecast || {};
  const prompts = [];

  const occRate = kpis.occupancyRateLabel;
  const activeTickets = Number(kpis.activeTickets || 0);
  const projectedFirst = forecast?.projected?.[0];

  if (occRate) {
    prompts.push(`How is our overall occupancy doing (${occRate})?`);
  } else {
    prompts.push("How is our overall occupancy doing?");
  }

  if (activeTickets > 0) {
    prompts.push(`Are any payments or repairs overdue (${activeTickets} active tickets)?`);
  } else {
    prompts.push("Are any payments or repairs overdue?");
  }

  if (projectedFirst?.label && projectedFirst?.projectedOccupancyRate != null) {
    prompts.push(`What is our expected occupancy for ${projectedFirst.label} (${projectedFirst.projectedOccupancyRate}%)?`);
  } else {
    prompts.push("What is our expected occupancy next quarter?");
  }

  prompts.push("How do branches compare in performance?");

  return prompts.slice(0, 4);
}

export function buildInsightPdfSections(insightData, title = "AI Summary") {
  const insight = insightData?.insight;
  if (!insight) return [];

  const rows = [
    insight.headline ? `Headline: ${insight.headline}` : null,
    insight.summary ? `Summary: ${insight.summary}` : null,
    insight.confidence ? `Confidence: ${insight.confidence}` : null,
    ...(insight.keyFindings || []).map((item) => `What stands out: ${item}`),
    ...(insight.anomalies || []).map((item) => `Things to watch: ${item}`),
    ...(insight.recommendedActions || []).map((item) => `What to do next: ${item}`),
    insight.disclaimer ? `Disclaimer: ${insight.disclaimer}` : null,
  ].filter(Boolean);

  if (rows.length === 0) return [];

  return [
    {
      title,
      description: "AI-generated narrative based on the report data shown in this export.",
      rows,
    },
  ];
}

export function calculateRangeDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return null;
  // Inclusive day calculation (e.g. Jan 1 to Jan 2 = 2 days, Jan 1 to Dec 12 = 346 days)
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
