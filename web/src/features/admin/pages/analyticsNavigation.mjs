export const ANALYTICS_SUMMARY_PATH = "/admin/analytics";
export const ANALYTICS_DETAILS_PATH = "/admin/analytics/details";

export const ANALYTICS_SUMMARY_RANGES = ["7d", "30d", "60d", "90d", "365d"];
export const BASE_ANALYTICS_TABS = ["occupancy", "billing", "operations", "demographics", "acquisition"];
export const OWNER_ANALYTICS_TABS = ["consolidated", "financials", "monitoring", "support"];
export const TAB_RANGE_OPTIONS = {
  occupancy: ["7d", "30d", "60d", "90d", "365d"],
  billing: ["3m", "6m", "12m"],
  operations: ["7d", "30d", "60d", "90d", "365d"],
  demographics: ["3m", "6m", "12m"],
  acquisition: ["7d", "30d", "60d", "90d", "365d"],
  consolidated: ["7d", "30d", "60d", "90d", "365d"],
  financials: ["3m", "6m", "12m"],
  monitoring: ["7d", "30d", "60d", "90d", "365d"],
  support: ["7d", "30d", "60d", "90d", "365d"],
};
export const TAB_ALIASES = Object.freeze({
  "marketing-roi": "acquisition",
  marketing: "acquisition",
  leads: "acquisition",
});
export const OWNER_BRANCH_OPTIONS = ["all", "gil-puyat", "guadalupe"];
export const SUMMARY_TO_MONTH_RANGE = {
  "7d": "1m",
  "30d": "3m",
  "60d": "6m",
  "90d": "12m",
  "365d": "12m",
  "1y": "12m",
};
export const MONTH_TO_SUMMARY_RANGE = {
  "1m": "7d",
  "3m": "30d",
  "6m": "60d",
  "12m": "90d",
};
export const LEGACY_ANALYTICS_REDIRECTS = Object.freeze({
  occupancy: `${ANALYTICS_DETAILS_PATH}?tab=occupancy`,
  billing: `${ANALYTICS_DETAILS_PATH}?tab=billing`,
  operations: `${ANALYTICS_DETAILS_PATH}?tab=operations`,
  financials: `${ANALYTICS_DETAILS_PATH}?tab=financials`,
  monitoring: `${ANALYTICS_DETAILS_PATH}?tab=monitoring`,
});

export function getAllowedAnalyticsTabs(isOwner) {
  return isOwner
    ? [...BASE_ANALYTICS_TABS, ...OWNER_ANALYTICS_TABS]
    : [...BASE_ANALYTICS_TABS];
}

export function getAllowedSummaryRanges() {
  return [...ANALYTICS_SUMMARY_RANGES];
}

export function isValidCustomDayRange(range) {
  return Boolean(range && /^(\d+)d$/i.test(String(range).trim()));
}

export function getAnalyticsDetailsRange(tab, requestedRange) {
  const allowedRanges = TAB_RANGE_OPTIONS[tab] || TAB_RANGE_OPTIONS.occupancy;
  if (allowedRanges.includes(requestedRange)) {
    return requestedRange;
  }
  const isMonthTab = tab === "billing" || tab === "financials" || tab === "demographics";
  if (isMonthTab) {
    if (SUMMARY_TO_MONTH_RANGE[requestedRange]) {
      return SUMMARY_TO_MONTH_RANGE[requestedRange];
    }
    if (isValidCustomDayRange(requestedRange)) {
      const days = parseInt(requestedRange.match(/^(\d+)d$/i)[1], 10);
      const months = Math.min(Math.max(Math.ceil(days / 30), 1), 24);
      return `${months}m`;
    }
    return allowedRanges.includes("3m") ? "3m" : allowedRanges[0];
  }
  if (isValidCustomDayRange(requestedRange)) {
    return requestedRange;
  }
  return allowedRanges.includes("30d") ? "30d" : allowedRanges[0];
}

export function getSummaryDetailRange(tab, summaryRange) {
  if (tab === "billing" || tab === "financials" || tab === "demographics") {
    if (SUMMARY_TO_MONTH_RANGE[summaryRange]) {
      return SUMMARY_TO_MONTH_RANGE[summaryRange];
    }
    if (isValidCustomDayRange(summaryRange)) {
      const days = parseInt(summaryRange.match(/^(\d+)d$/i)[1], 10);
      const months = Math.min(Math.max(Math.ceil(days / 30), 1), 24);
      return `${months}m`;
    }
    return SUMMARY_TO_MONTH_RANGE["30d"];
  }

  return getAnalyticsDetailsRange(tab, summaryRange);
}

export function normalizeAnalyticsSummaryState({
  requestedRange,
  requestedBranch,
  isOwner,
  userBranch = "gil-puyat",
}) {
  const isAllowed =
    ANALYTICS_SUMMARY_RANGES.includes(requestedRange) ||
    isValidCustomDayRange(requestedRange);
  const range = isAllowed ? requestedRange : "30d";

  const branch = isOwner
    ? OWNER_BRANCH_OPTIONS.includes(requestedBranch)
      ? requestedBranch
      : "all"
    : userBranch || "gil-puyat";

  return {
    range,
    branch,
    allowedRanges: getAllowedSummaryRanges(),
  };
}

export function normalizeAnalyticsState({
  requestedTab,
  requestedRange,
  requestedBranch,
  isOwner,
  userBranch = "gil-puyat",
}) {
  const normalizedRequestedTab = TAB_ALIASES[requestedTab] || requestedTab;
  const allowedTabs = getAllowedAnalyticsTabs(isOwner);
  const activeTab = allowedTabs.includes(normalizedRequestedTab) ? normalizedRequestedTab : allowedTabs[0];
  const allowedRanges = TAB_RANGE_OPTIONS[activeTab] || TAB_RANGE_OPTIONS.occupancy;
  const range = getAnalyticsDetailsRange(activeTab, requestedRange);

  const branch = isOwner
    ? OWNER_BRANCH_OPTIONS.includes(requestedBranch)
      ? requestedBranch
      : "all"
    : userBranch || "gil-puyat";

  return {
    activeTab,
    range,
    branch,
    allowedTabs,
    allowedRanges,
  };
}

export function buildAnalyticsDetailsHref({
  tab = BASE_ANALYTICS_TABS[0],
  range = "30d",
  branch,
  isOwner = false,
}) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("range", getSummaryDetailRange(tab, range));

  if (isOwner && branch) {
    params.set("branch", branch);
  }

  return `${ANALYTICS_DETAILS_PATH}?${params.toString()}`;
}

export function getDetailSummaryRange(range) {
  return MONTH_TO_SUMMARY_RANGE[range] || getAnalyticsDetailsRange("occupancy", range);
}

export function buildAnalyticsSummaryHref({
  range = "30d",
  branch,
  isOwner = false,
}) {
  const params = new URLSearchParams();
  params.set("range", getDetailSummaryRange(range));

  if (isOwner && branch) {
    params.set("branch", branch);
  }

  return `${ANALYTICS_SUMMARY_PATH}?${params.toString()}`;
}
