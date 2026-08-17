import test from "node:test";
import assert from "node:assert/strict";
import {
  getDynamicOccupancyPrompts,
  getDynamicBillingPrompts,
  getDynamicOperationsPrompts,
  getDynamicDemographicsPrompts,
  getDynamicFinancialsPrompts,
  getDynamicMonitoringPrompts,
  getDynamicOverviewPrompts,
} from "./analyticsTabUtils.js";

test("getDynamicOccupancyPrompts returns contextual prompts when data is available", () => {
  const data = {
    kpis: {
      unavailableBeds: 3,
      availableBeds: 8,
      occupancyRate: 72,
      occupancyRateLabel: "72%",
    },
  };
  const forecast = {
    projected: [
      { label: "September 2026", projectedOccupancyRate: 85 },
    ],
  };

  const prompts = getDynamicOccupancyPrompts(data, forecast);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("3 beds currently offline"));
  assert.ok(prompts[1].includes("8 available"));
  assert.ok(prompts[2].includes("September 2026 (85%)"));
  assert.ok(prompts[3].includes("improve room occupancy from 72%"));
});

test("getDynamicOccupancyPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicOccupancyPrompts(null, null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "Are any beds currently offline or under repair?");
  assert.equal(prompts[1], "Which rooms have open beds?");
  assert.equal(prompts[2], "What is our projected occupancy for next semester?");
  assert.equal(prompts[3], "How can we improve room occupancy?");
});

test("getDynamicBillingPrompts returns contextual prompts based on revenue and arrears", () => {
  const data = {
    kpis: {
      collectedRevenueLabel: "₱145,000",
      overdueAmount: 25000,
      outstandingBalance: 25000,
      collectionRate: 78,
      collectionRateLabel: "78%",
    },
    tables: {
      overdueAccounts: {
        rows: [{ tenantName: "Juan Dela Cruz" }, { tenantName: "Maria Santos" }],
      },
    },
  };

  const prompts = getDynamicBillingPrompts(data);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("2 accounts"));
  assert.ok(prompts[1].includes("overdue or at high risk"));
  assert.ok(prompts[2].includes("₱145,000"));
  assert.ok(prompts[3].includes("raise our collection rate from 78%"));
});

test("getDynamicBillingPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicBillingPrompts(null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "Which tenants have balances past 30 days?");
  assert.equal(prompts[1], "Are any payments overdue?");
  assert.equal(prompts[2], "How much revenue have we collected this month?");
  assert.equal(prompts[3], "What collections are expected next month?");
});

test("getDynamicOperationsPrompts returns contextual prompts based on tickets and SLA", () => {
  const data = {
    kpis: {
      maintenanceRequests: 14,
      slaComplianceRate: 68,
      slaComplianceRateLabel: "68%",
    },
    series: {
      maintenanceByType: [{ label: "Plumbing", count: 8 }],
    },
  };

  const prompts = getDynamicOperationsPrompts(data);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("14 active tickets"));
  assert.ok(prompts[1].includes("Plumbing"));
  assert.ok(prompts[2].includes("prospective tenants inquire"));
  assert.ok(prompts[3].includes("improve SLA compliance from 68%"));
});

test("getDynamicOperationsPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicOperationsPrompts(null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "What repairs are taking the longest?");
  assert.equal(prompts[1], "Which maintenance issues happen most often?");
  assert.equal(prompts[2], "When do most prospective tenants inquire?");
  assert.equal(prompts[3], "How can we resolve maintenance tickets faster?");
});

test("getDynamicDemographicsPrompts returns contextual prompts based on student ratio and room type", () => {
  const data = {
    kpis: {
      studentPercentageLabel: "82%",
      topRoomType: "Double Sharing",
      peakMonth: "August",
    },
  };

  const prompts = getDynamicDemographicsPrompts(data);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("82% students vs workers"));
  assert.ok(prompts[1].includes("Where do most of our tenants come from?"));
  assert.ok(prompts[2].includes("Double Sharing"));
  assert.ok(prompts[3].includes("peak in August"));
});

test("getDynamicDemographicsPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicDemographicsPrompts(null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "Who are our primary residents—students or workers?");
  assert.equal(prompts[1], "Where do most of our tenants come from?");
  assert.equal(prompts[2], "Which room types do new tenants prefer?");
  assert.equal(prompts[3], "How long do tenants usually stay?");
});

test("getDynamicFinancialsPrompts returns contextual prompts based on rooms and branch comparisons", () => {
  const data = {
    kpis: {
      collectedRevenueLabel: "₱320,000",
    },
    tables: {
      overdueRooms: [
        { roomName: "GP-101" },
        { roomName: "GP-102" },
      ],
    },
    series: {
      branchComparison: [
        { label: "Guadalupe", collectedRevenue: 200000 },
        { label: "Boni", collectedRevenue: 120000 },
      ],
    },
  };

  const prompts = getDynamicFinancialsPrompts(data);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("How do our branches compare"));
  assert.ok(prompts[1].includes("2 overdue rooms"));
  assert.ok(prompts[2].includes("₱320,000"));
  assert.ok(prompts[3].includes("reduce outstanding dues"));
});

test("getDynamicFinancialsPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicFinancialsPrompts(null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "How do our branches compare in collections?");
  assert.equal(prompts[1], "Which rooms have the highest unpaid balances?");
  assert.equal(prompts[2], "What is our total collected revenue vs target?");
  assert.equal(prompts[3], "How can we reduce outstanding dues?");
});

test("getDynamicMonitoringPrompts returns contextual prompts based on security anomalies", () => {
  const data = {
    kpis: {
      failedLogins: 9,
      criticalEvents: 2,
      accessOverrides: 3,
    },
    tables: {
      suspiciousIps: [
        { ipAddress: "192.168.1.50" },
      ],
    },
  };

  const prompts = getDynamicMonitoringPrompts(data);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("9 recorded"));
  assert.ok(prompts[1].includes("3 overrides"));
  assert.ok(prompts[2].includes("1 flagged"));
  assert.ok(prompts[3].includes("2 critical security events"));
});

test("getDynamicMonitoringPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicMonitoringPrompts(null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "Are there any unusual failed login attempts?");
  assert.equal(prompts[1], "Were any admin permissions or settings changed recently?");
  assert.equal(prompts[2], "Which IP addresses showed repeated login failures?");
  assert.equal(prompts[3], "Are there any high-priority security alerts?");
});

test("getDynamicOverviewPrompts returns contextual prompts based on hub dashboard data", () => {
  const data = {
    kpis: {
      occupancyRateLabel: "88%",
      activeTickets: 5,
    },
  };
  const extra = {
    forecast: {
      projected: [
        { label: "Q4 2026", projectedOccupancyRate: 92 },
      ],
    },
  };

  const prompts = getDynamicOverviewPrompts(data, extra);
  assert.equal(prompts.length, 4);
  assert.ok(prompts[0].includes("88%"));
  assert.ok(prompts[1].includes("5 active tickets"));
  assert.ok(prompts[2].includes("Q4 2026 (92%)"));
  assert.ok(prompts[3].includes("branches compare in performance"));
});

test("getDynamicOverviewPrompts returns fallback defaults when data is missing", () => {
  const prompts = getDynamicOverviewPrompts(null, null);
  assert.equal(prompts.length, 4);
  assert.equal(prompts[0], "How is our overall occupancy doing?");
  assert.equal(prompts[1], "Are any payments or repairs overdue?");
  assert.equal(prompts[2], "What is our expected occupancy next quarter?");
  assert.equal(prompts[3], "How do branches compare in performance?");
});

test("AnalyticsInsightPanel conforms to search query bar and ergonomics specification", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const panelPath = path.resolve(here, "../components/shared/AnalyticsInsightPanel.jsx");
  const panelCode = fs.readFileSync(panelPath, "utf8");

  // Real-time return to normal when erasing input or clicking X
  assert.match(panelCode, /if\s*\(!val\.trim\(\)\s*&&\s*activeQuestion\s*&&\s*typeof\s*onClearQuestion\s*===\s*"function"\)/);
  assert.match(panelCode, /handleClearInput/);

  // Suggested chip click populates inputQuestion and focuses inputRef without auto-search (no onAskQuestion call in handlePromptClick)
  assert.match(panelCode, /const handlePromptClick = \(prompt\) => \{\s*setInputQuestion\(prompt\);\s*inputRef\.current\?\.focus\(\);\s*\};/);

  // Ask AI button ergonomics: always Search icon + Ask AI text, disabled when isAsking or empty
  assert.match(panelCode, /<Search size=\{13\} \/>\s*<span>Ask AI<\/span>/);
  assert.doesNotMatch(panelCode, /<span>Thinking\.\.\.<\/span>/);

  // Synchronization with activeQuestion
  assert.match(panelCode, /if\s*\(!activeQuestion\)\s*\{\s*setInputQuestion\(""\);\s*\}\s*else\s*\{\s*setInputQuestion\(activeQuestion\);\s*\}/);
});

test("All analytics tabs pass dynamic prompts and preserve required financial summary contracts", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));

  const occCode = fs.readFileSync(path.resolve(here, "AnalyticsOccupancyTab.jsx"), "utf8");
  assert.match(occCode, /getDynamicOccupancyPrompts/);
  assert.match(occCode, /suggestedPrompts=\{occupancyPrompts\}/);

  const billCode = fs.readFileSync(path.resolve(here, "AnalyticsBillingTab.jsx"), "utf8");
  assert.match(billCode, /getDynamicBillingPrompts/);
  assert.match(billCode, /suggestedPrompts=\{billingPrompts\}/);

  const opsCode = fs.readFileSync(path.resolve(here, "AnalyticsOperationsTab.jsx"), "utf8");
  assert.match(opsCode, /getDynamicOperationsPrompts/);
  assert.match(opsCode, /suggestedPrompts=\{operationsPrompts\}/);

  const demoCode = fs.readFileSync(path.resolve(here, "AnalyticsDemographicsTab.jsx"), "utf8");
  assert.match(demoCode, /getDynamicDemographicsPrompts/);
  assert.match(demoCode, /suggestedPrompts=\{demographicsPrompts\}/);

  const finCode = fs.readFileSync(path.resolve(here, "AnalyticsFinancialsTab.jsx"), "utf8");
  assert.match(finCode, /getDynamicFinancialsPrompts/);
  assert.match(finCode, /suggestedPrompts=\{financialsPrompts\}/);
  assert.match(finCode, /summaryTitle="Financial Summary"/);
  assert.match(finCode, /"AI Financial Summary"/);

  const monCode = fs.readFileSync(path.resolve(here, "AnalyticsMonitoringTab.jsx"), "utf8");
  assert.match(monCode, /getDynamicMonitoringPrompts/);
  assert.match(monCode, /suggestedPrompts=\{monitoringPrompts\}/);

  const overCode = fs.readFileSync(path.resolve(here, "AnalyticsOverviewTab.jsx"), "utf8");
  assert.match(overCode, /getDynamicOverviewPrompts/);
  assert.match(overCode, /suggestedPrompts=\{overviewPrompts\}/);
});

