import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsSummaryHref,
  buildAnalyticsDetailsHref,
  getAllowedAnalyticsTabs,
  LEGACY_ANALYTICS_REDIRECTS,
  normalizeAnalyticsSummaryState,
  normalizeAnalyticsState,
} from "./analyticsNavigation.mjs";

test("branch admins only get branch-safe tabs", () => {
  assert.deepEqual(getAllowedAnalyticsTabs(false), [
    "occupancy",
    "billing",
    "operations",
    "demographics",
    "acquisition",
  ]);
});

test("owners get owner-only tabs", () => {
  assert.deepEqual(getAllowedAnalyticsTabs(true), [
    "occupancy",
    "billing",
    "operations",
    "demographics",
    "acquisition",
    "consolidated",
    "financials",
    "monitoring",
    "support",
  ]);
});

test("marketing-roi alias resolves to acquisition tab", () => {
  const state = normalizeAnalyticsState({
    requestedTab: "marketing-roi",
    requestedRange: "30d",
    requestedBranch: "all",
    isOwner: false,
    userBranch: "gil-puyat",
  });

  assert.equal(state.activeTab, "acquisition");
  assert.equal(state.range, "30d");
});

test("detailed analytics defaults to occupancy when no tab is provided", () => {
  const state = normalizeAnalyticsState({
    requestedTab: null,
    requestedRange: null,
    requestedBranch: null,
    isOwner: false,
    userBranch: "gil-puyat",
  });

  assert.equal(state.activeTab, "occupancy");
  assert.equal(state.range, "30d");
  assert.equal(state.branch, "gil-puyat");
});

test("invalid branch-admin tab falls back to occupancy", () => {
  const state = normalizeAnalyticsState({
    requestedTab: "financials",
    requestedRange: "3m",
    requestedBranch: "all",
    isOwner: false,
    userBranch: "guadalupe",
  });

  assert.equal(state.activeTab, "occupancy");
  assert.equal(state.range, "30d");
  assert.equal(state.branch, "guadalupe");
});

test("owner invalid branch falls back to all", () => {
  const state = normalizeAnalyticsState({
    requestedTab: "monitoring",
    requestedRange: "60d",
    requestedBranch: "invalid-branch",
    isOwner: true,
  });

  assert.equal(state.activeTab, "monitoring");
  assert.equal(state.range, "60d");
  assert.equal(state.branch, "all");
});

test("billing range is normalized to allowed month ranges", () => {
  const state = normalizeAnalyticsState({
    requestedTab: "billing",
    requestedRange: "30d",
    requestedBranch: "all",
    isOwner: true,
  });

  assert.equal(state.activeTab, "billing");
  assert.equal(state.range, "3m");
});

test("summary state keeps short day ranges and owner branch filters", () => {
  const state = normalizeAnalyticsSummaryState({
    requestedRange: "60d",
    requestedBranch: "guadalupe",
    isOwner: true,
  });

  assert.equal(state.range, "60d");
  assert.equal(state.branch, "guadalupe");
});

test("summary detail links map short summary ranges to valid detailed billing ranges", () => {
  const href = buildAnalyticsDetailsHref({
    tab: "billing",
    range: "90d",
    branch: "all",
    isOwner: true,
  });

  assert.equal(href, "/admin/analytics/details?tab=billing&range=12m&branch=all");
});

test("detail summary links map month ranges back to summary-safe day ranges", () => {
  const href = buildAnalyticsSummaryHref({
    range: "12m",
    branch: "all",
    isOwner: true,
  });

  assert.equal(href, "/admin/analytics?range=90d&branch=all");
});

test("legacy redirects point to the detailed analytics workspace", () => {
  assert.deepEqual(LEGACY_ANALYTICS_REDIRECTS, {
    occupancy: "/admin/analytics/details?tab=occupancy",
    billing: "/admin/analytics/details?tab=billing",
    operations: "/admin/analytics/details?tab=operations",
    financials: "/admin/analytics/details?tab=financials",
    monitoring: "/admin/analytics/details?tab=monitoring",
  });
});

test("supports 365d and custom day range like 346d in summary and detailed states", () => {
  const summary365 = normalizeAnalyticsSummaryState({
    requestedRange: "365d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(summary365.range, "365d");

  const summaryCustom = normalizeAnalyticsSummaryState({
    requestedRange: "346d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(summaryCustom.range, "346d");

  const detailCustom = normalizeAnalyticsState({
    requestedTab: "occupancy",
    requestedRange: "346d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(detailCustom.range, "346d");

  const billingCustom = normalizeAnalyticsState({
    requestedTab: "billing",
    requestedRange: "346d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(billingCustom.range, "12m");
});

test("supports 7d short day range across summary and detail mappings", () => {
  const summary7 = normalizeAnalyticsSummaryState({
    requestedRange: "7d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(summary7.range, "7d");

  const detail7 = normalizeAnalyticsState({
    requestedTab: "occupancy",
    requestedRange: "7d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(detail7.range, "7d");

  const billing7 = normalizeAnalyticsState({
    requestedTab: "billing",
    requestedRange: "7d",
    requestedBranch: "all",
    isOwner: true,
  });
  assert.equal(billing7.range, "1m");

  const hrefBilling7 = buildAnalyticsDetailsHref({
    tab: "billing",
    range: "7d",
    branch: "all",
    isOwner: true,
  });
  assert.equal(hrefBilling7, "/admin/analytics/details?tab=billing&range=1m&branch=all");

  const hrefSummary1m = buildAnalyticsSummaryHref({
    range: "1m",
    branch: "all",
    isOwner: true,
  });
  assert.equal(hrefSummary1m, "/admin/analytics?range=7d&branch=all");
});
