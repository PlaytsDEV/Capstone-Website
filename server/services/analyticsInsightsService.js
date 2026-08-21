const MAX_FINDINGS = 4;
const MAX_ANOMALIES = 3;
const MAX_ACTIONS = 3;
const MAX_RISK_ALERTS = 4;
const MAX_FORECAST_HIGHLIGHTS = 3;
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_API_VERSION = "v1beta";
const GEMINI_TIMEOUT_MS = 12000;
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 15000;
const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-r1";
const OPENROUTER_TIMEOUT_MS = 20000;
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

const safePercent = (value) => `${Number(value || 0)}%`;

const safeMoney = (value) =>
  `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const round = (value, digits = 1) =>
  Number(Number(value || 0).toFixed(digits));

const pickTopBy = (rows, key, limit = 3) =>
  [...(Array.isArray(rows) ? rows : [])]
    .sort((left, right) => Number(right?.[key] || 0) - Number(left?.[key] || 0))
    .slice(0, limit);

const tableRows = (table) => {
  if (Array.isArray(table)) return table;
  return Array.isArray(table?.rows) ? table.rows : [];
};

const buildSnapshotMeta = ({
  reportType,
  scope,
  filters,
  question,
  snapshot,
  provider,
  usedFallback,
  model = null,
  fallbackReason = null,
}) => ({
  reportType,
  source: "analytics-report-snapshot",
  provider,
  usedFallback,
  model,
  fallbackReason,
  branch: scope.branch,
  branchesIncluded: scope.branchesIncluded,
  filters,
  question: question || null,
  generatedAt: new Date().toISOString(),
  promptPreview: {
    reportType,
    scope: {
      role: scope.role,
      branch: scope.branch,
      branchesIncluded: scope.branchesIncluded,
    },
    metricsIncluded: Object.keys(snapshot.metrics || {}),
  },
});

const buildOccupancySnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const trend = reportData?.series?.occupancyTrend || [];
  const roomTypes = reportData?.tables?.roomTypes || [];
  const inventory = tableRows(reportData?.tables?.inventory);
  const firstRate = Number(trend[0]?.totalRate || kpis.occupancyRate || 0);
  const lastRate = Number(trend[trend.length - 1]?.totalRate || kpis.occupancyRate || 0);

  return {
    metrics: {
      occupancyRate: Number(kpis.occupancyRate || 0),
      totalCapacity: Number(kpis.totalCapacity || 0),
      occupiedBeds: Number(kpis.occupiedBeds || 0),
      availableBeds: Number(kpis.availableBeds || 0),
      unavailableBeds: Number(kpis.unavailableBeds || 0),
      trendDelta: lastRate - firstRate,
    },
    trend: trend.slice(-7).map((entry) => ({
      label: entry.label,
      totalRate: Number(entry.totalRate || 0),
    })),
    topRoomTypes: roomTypes.map((entry) => ({
      label: entry.roomTypeLabel,
      occupancyRate: Number(entry.occupancyRate || 0),
      occupiedBeds: Number(entry.occupiedBeds || 0),
      capacity: Number(entry.capacity || 0),
    })),
    constrainedRooms: pickTopBy(
      inventory.filter((row) => Number(row.availableBeds || 0) <= 1),
      "occupancyRate",
      5,
    ).map((row) => ({
      roomNumber: row.roomNumber,
      branch: row.branch,
      occupancyRate: Number(row.occupancyRate || 0),
      availableBeds: Number(row.availableBeds || 0),
      unavailableBeds: Number(row.unavailableBeds || 0),
    })),
  };
};

const buildBillingSnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const revenueByMonth = reportData?.series?.revenueByMonth || [];
  const overdueAging = reportData?.series?.overdueAging || [];
  const unpaidBalances = reportData?.tables?.unpaidBalances || [];
  const lastMonth = revenueByMonth[revenueByMonth.length - 1] || {};
  const prevMonth = revenueByMonth[revenueByMonth.length - 2] || {};

  return {
    metrics: {
      billedAmount: Number(kpis.billedAmount || 0),
      collectedRevenue: Number(kpis.collectedRevenue || 0),
      outstandingBalance: Number(kpis.outstandingBalance || 0),
      overdueAmount: Number(kpis.overdueAmount || 0),
      collectionRate: Number(kpis.collectionRate || 0),
      revenueDelta: Number(lastMonth.collectedRevenue || 0) - Number(prevMonth.collectedRevenue || 0),
    },
    revenueByMonth: revenueByMonth.slice(-6).map((entry) => ({
      label: entry.label,
      billedAmount: Number(entry.billedAmount || 0),
      collectedRevenue: Number(entry.collectedRevenue || 0),
      outstandingBalance: Number(entry.outstandingBalance || 0),
    })),
    overdueAging: overdueAging.map((entry) => ({
      label: entry.label,
      count: Number(entry.count || 0),
      amount: Number(entry.amount || 0),
    })),
    largestBalances: pickTopBy(unpaidBalances, "balance", 5).map((entry) => ({
      roomName: entry.roomName,
      branch: entry.branch,
      balance: Number(entry.balance || 0),
      daysOverdue: Number(entry.daysOverdue || 0),
      status: entry.status,
    })),
  };
};

const buildFinancialsSnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const revenueByMonth = reportData?.series?.revenueByMonth || [];
  const overdueAging = reportData?.series?.overdueAging || [];
  const branchComparison = reportData?.series?.branchComparison || [];
  const overdueRooms = tableRows(reportData?.tables?.overdueRooms);
  const unpaidBalances = reportData?.tables?.unpaidBalances || [];
  const lastMonth = revenueByMonth[revenueByMonth.length - 1] || {};
  const prevMonth = revenueByMonth[revenueByMonth.length - 2] || {};

  return {
    metrics: {
      billedAmount: Number(kpis.billedAmount || 0),
      collectedRevenue: Number(kpis.collectedRevenue || 0),
      outstandingBalance: Number(kpis.outstandingBalance || 0),
      overdueAmount: Number(kpis.overdueAmount || 0),
      collectionRate: Number(kpis.collectionRate || 0),
      netPosition: Number(kpis.netPosition || 0),
      revenueDelta: Number(lastMonth.collectedRevenue || 0) - Number(prevMonth.collectedRevenue || 0),
    },
    revenueByMonth: revenueByMonth.slice(-6).map((entry) => ({
      label: entry.label,
      billedAmount: Number(entry.billedAmount || 0),
      collectedRevenue: Number(entry.collectedRevenue || 0),
      outstandingBalance: Number(entry.outstandingBalance || 0),
    })),
    overdueAging: overdueAging.map((entry) => ({
      label: entry.label,
      count: Number(entry.count || 0),
      amount: Number(entry.amount || 0),
    })),
    branchComparison: branchComparison.map((entry) => ({
      label: entry.label,
      branch: entry.branch,
      billedAmount: Number(entry.billedAmount || 0),
      collectedRevenue: Number(entry.collectedRevenue || 0),
      overdueAmount: Number(entry.overdueAmount || 0),
      collectionRate: Number(entry.collectionRate || 0),
    })),
    overdueRooms: pickTopBy(overdueRooms, "outstandingBalance", 5).map((entry) => ({
      roomName: entry.roomName,
      branch: entry.branch,
      tenantCount: Number(entry.tenantCount || 0),
      overdueCount: Number(entry.overdueCount || 0),
      outstandingBalance: Number(entry.outstandingBalance || 0),
    })),
    largestBalances: pickTopBy(unpaidBalances, "balance", 5).map((entry) => ({
      roomName: entry.roomName,
      branch: entry.branch,
      balance: Number(entry.balance || 0),
      daysOverdue: Number(entry.daysOverdue || 0),
      status: entry.status,
    })),
  };
};

const buildOperationsSnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const reservationsByPeriod = reportData?.series?.reservationsByPeriod || [];
  const maintenanceByType = reportData?.series?.maintenanceByType || [];
  const maintenanceIssues = tableRows(reportData?.tables?.maintenanceIssues);
  const peakInquiryWindows = reportData?.tables?.peakInquiryWindows || [];

  return {
    metrics: {
      reservations: Number(kpis.reservations || 0),
      inquiries: Number(kpis.inquiries || 0),
      maintenanceRequests: Number(kpis.maintenanceRequests || 0),
      avgResolutionHours: Number(kpis.avgResolutionHours || 0),
      slaComplianceRate: Number(kpis.slaComplianceRate || 0),
    },
    reservationsByPeriod: reservationsByPeriod.slice(-6).map((entry) => ({
      label: entry.label,
      count: Number(entry.count || 0),
    })),
    maintenanceByType: maintenanceByType.slice(0, 5).map((entry) => ({
      label: entry.label,
      count: Number(entry.count || 0),
    })),
    delayedRequests: maintenanceIssues
      .filter((entry) => entry.slaState === "delayed" || entry.slaState === "priority")
      .slice(0, 5)
      .map((entry) => ({
        typeLabel: entry.typeLabel,
        urgency: entry.urgency,
        status: entry.status,
        branch: entry.branch,
      })),
    peakInquiryWindows: peakInquiryWindows.slice(0, 3).map((entry) => ({
      label: entry.label,
      count: Number(entry.count || 0),
    })),
  };
};

const buildAuditSnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const branchSummary = reportData?.series?.branchSummary || [];
  const recentSecurityEvents = tableRows(reportData?.tables?.recentSecurityEvents);
  const suspiciousIps = reportData?.tables?.suspiciousIps || [];

  return {
    metrics: {
      failedLogins: Number(kpis.failedLogins || 0),
      suspiciousIpCount: Number(kpis.suspiciousIpCount || 0),
      highSeverityActions: Number(kpis.highSeverityActions || 0),
      accessOverrides: Number(kpis.accessOverrides || 0),
      criticalEvents: Number(kpis.criticalEvents || 0),
    },
    branchSummary: branchSummary.slice(0, 5).map((entry) => ({
      label: entry.label,
      highSeverityCount: Number(entry.highSeverityCount || 0),
      accessOverrideCount: Number(entry.accessOverrideCount || 0),
      totalEvents: Number(entry.totalEvents || 0),
    })),
    suspiciousIps: suspiciousIps.slice(0, 5).map((entry) => ({
      ipAddress: entry.ip || entry.ipAddress,
      attempts: Number(entry.count || entry.attempts || 0),
      targetedEmailsCount: Array.isArray(entry.targetedEmails)
        ? entry.targetedEmails.length
        : 0,
    })),
    recentSecurityEvents: recentSecurityEvents.slice(0, 5).map((entry) => ({
      branch: entry.branch,
      action: entry.action,
      severity: entry.severity,
      type: entry.type,
    })),
  };
};

const buildForecastSnapshot = (forecast = {}) => ({
  sufficientHistory: Boolean(forecast?.sufficientHistory),
  historyMonthsAvailable: Number(forecast?.historyMonthsAvailable || 0),
  requiredHistoryMonths: Number(forecast?.requiredHistoryMonths || 4),
  headline: forecast?.insights?.headline || "",
  recommendations: clampList(
    forecast?.insights?.recommendations,
    MAX_FORECAST_HIGHLIGHTS,
    260,
  ),
  projected: (forecast?.projected || []).slice(0, 6).map((entry) => ({
    label: entry.label,
    projectedOccupancyRate: Number(entry.projectedOccupancyRate || 0),
    baselineRate: Number(entry.baselineRate || 0),
    seasonalMultiplier: Number(entry.seasonalMultiplier || 1),
  })),
});

const buildHubSnapshot = (reportData) => {
  const occupancy = buildOccupancySnapshot(reportData?.reports?.occupancy || {});
  const billing = buildBillingSnapshot(reportData?.reports?.billing || {});
  const operations = buildOperationsSnapshot(reportData?.reports?.operations || {});
  const forecast = buildForecastSnapshot(reportData?.forecast || {});
  const audit = reportData?.reports?.audit
    ? buildAuditSnapshot(reportData.reports.audit)
    : null;
  const rawBranchComp =
    reportData?.branchComparison ||
    reportData?.reports?.financials?.series?.branchComparison ||
    reportData?.reports?.billing?.series?.branchComparison ||
    [];
  const branchComparison = (Array.isArray(rawBranchComp) ? rawBranchComp : []).map((entry) => ({
    label: entry.label || entry.branch,
    branch: entry.branch || entry.label,
    occupancyRate: entry.occupancyRate !== undefined ? Number(entry.occupancyRate || 0) : null,
    billedAmount: entry.billedAmount !== undefined ? Number(entry.billedAmount || 0) : null,
    collectedRevenue: entry.collectedRevenue !== undefined ? Number(entry.collectedRevenue || 0) : null,
    overdueAmount: entry.overdueAmount !== undefined ? Number(entry.overdueAmount || 0) : null,
    collectionRate: entry.collectionRate !== undefined ? Number(entry.collectionRate || 0) : null,
  }));
  const metrics = {
    occupancyRate: occupancy.metrics.occupancyRate,
    availableBeds: occupancy.metrics.availableBeds,
    unavailableBeds: occupancy.metrics.unavailableBeds,
    collectionRate: billing.metrics.collectionRate,
    outstandingBalance: billing.metrics.outstandingBalance,
    overdueAmount: billing.metrics.overdueAmount,
    maintenanceRequests: operations.metrics.maintenanceRequests,
    slaComplianceRate: operations.metrics.slaComplianceRate,
    forecastSufficientHistory: forecast.sufficientHistory,
    ...(audit
      ? {
          failedLogins: audit.metrics.failedLogins,
          criticalSecurityEvents: audit.metrics.criticalEvents,
        }
      : {}),
  };

  return {
    metrics,
    occupancy: {
      trendDelta: occupancy.metrics.trendDelta,
      constrainedRooms: occupancy.constrainedRooms,
      topRoomTypes: occupancy.topRoomTypes,
    },
    paymentRisk: {
      revenueDelta: billing.metrics.revenueDelta,
      overdueAging: billing.overdueAging,
      largestBalances: billing.largestBalances,
    },
    maintenanceRisk: {
      maintenanceByType: operations.maintenanceByType,
      delayedRequests: operations.delayedRequests,
      peakInquiryWindows: operations.peakInquiryWindows,
    },
    forecast,
    branchComparison,
    security: audit
      ? {
          failedLogins: audit.metrics.failedLogins,
          criticalEvents: audit.metrics.criticalEvents,
          suspiciousIps: audit.suspiciousIps,
          branchSummary: audit.branchSummary,
        }
      : null,
  };
};

const buildDemographicsSnapshot = (reportData) => {
  const kpis = reportData?.kpis || {};
  const series = reportData?.series || {};

  return {
    metrics: {
      activeTenants: Number(kpis.activeTenants || kpis.totalAnalyzed || 0),
      totalAnalyzed: Number(kpis.totalAnalyzed || 0),
      studentsCount: Number(kpis.studentsCount || 0),
      studentPercentage: Number(kpis.studentPercentage || 0),
      professionalsCount: Number(kpis.professionalsCount || 0),
      professionalPercentage: Number(kpis.professionalPercentage || 0),
      dominantOccupation: kpis.dominantOccupation || "Students",
      dominantPercentage: Number(kpis.dominantPercentage || kpis.studentPercentage || 0),
      topProvince: kpis.topProvince || "N/A",
      topProvinceCount: Number(kpis.topProvinceCount || 0),
      peakMonth: kpis.peakMonth || "N/A",
      peakMonthCount: Number(kpis.peakMonthCount || 0),
      topRoomType: kpis.topRoomType || "N/A",
    },
    occupationMix: (series.occupationMix || []).slice(0, 5).map((entry) => ({
      label: entry.label,
      value: Number(entry.value || 0),
    })),
    topMonths: (series.reservationsByMonth || [])
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((m) => ({ label: m.label, count: m.count })),
    roomTypePreference: (series.roomTypePreference || []).slice(0, 4).map((entry) => ({
      label: entry.label,
      value: Number(entry.value || 0),
    })),
    referralSources: (series.referralSources || []).slice(0, 5).map((entry) => ({
      label: entry.label,
      value: Number(entry.value || 0),
    })),
    workScheduleMix: (series.workScheduleMix || []).slice(0, 4).map((entry) => ({
      label: entry.label,
      value: Number(entry.value || 0),
    })),
    ageDistribution: (series.ageDistribution || [])
      .filter((b) => b.count > 0)
      .slice(0, 5)
      .map((b) => ({ label: b.label, count: b.count })),
  };
};

const SNAPSHOT_BUILDERS = Object.freeze({
  hub: buildHubSnapshot,
  occupancy: buildOccupancySnapshot,
  billing: buildBillingSnapshot,
  financials: buildFinancialsSnapshot,
  operations: buildOperationsSnapshot,
  audit: buildAuditSnapshot,
  demographics: buildDemographicsSnapshot,
});

const deriveActionableItems = (reportType, snapshot, recommendedActions = []) => {
  const items = [];
  const metrics = snapshot.metrics || {};

  if (reportType === "occupancy") {
    const constrained = snapshot.constrainedRooms || [];
    const weakestType = [...(snapshot.topRoomTypes || [])]
      .sort((left, right) => Number(left.occupancyRate || 0) - Number(right.occupancyRate || 0))[0];

    if (constrained.length > 0) {
      items.push({
        label: "Filter Partial Units",
        actionType: "FILTER_STATUS",
        target: "inventory",
        filterValue: "partial",
      });
    }
    if (metrics.availableBeds > 0) {
      items.push({
        label: "Show Vacant Units",
        actionType: "FILTER_STATUS",
        target: "inventory",
        filterValue: "vacant",
      });
    }
    if (weakestType?.label) {
      items.push({
        label: `Filter ${weakestType.label}`,
        actionType: "FILTER_TYPE",
        target: "inventory",
        filterValue: weakestType.label.toLowerCase().includes("private")
          ? "private"
          : weakestType.label.toLowerCase().includes("double")
            ? "double-sharing"
            : "quadruple-sharing",
      });
    }
  } else if (reportType === "billing" || reportType === "financials") {
    const largestBalance = snapshot.largestBalances?.[0] || snapshot.overdueRooms?.[0];
    if (Number(metrics.overdueAmount || 0) > 0) {
      items.push({
        label: "Filter Overdue Accounts",
        actionType: "FILTER_STATUS",
        target: "unpaidBalances",
        filterValue: "overdue",
      });
    }
    if (largestBalance?.roomName) {
      items.push({
        label: `Locate ${largestBalance.roomName}`,
        actionType: "SEARCH",
        target: "unpaidBalances",
        filterValue: String(largestBalance.roomName),
      });
    }
  } else if (reportType === "operations") {
    const delayed = snapshot.delayedRequests || [];
    const topMaintenance = snapshot.maintenanceByType?.[0];
    if (delayed.length > 0) {
      items.push({
        label: "Filter Delayed Tickets",
        actionType: "FILTER_SLA",
        target: "maintenanceIssues",
        filterValue: "delayed",
      });
    }
    if (topMaintenance?.label) {
      items.push({
        label: `Filter ${topMaintenance.label}`,
        actionType: "SEARCH",
        target: "maintenanceIssues",
        filterValue: String(topMaintenance.label),
      });
    }
  } else if (reportType === "demographics") {
    const topOcc = snapshot.occupationMix?.[0];
    if (topOcc?.label) {
      items.push({
        label: `Filter ${topOcc.label}`,
        actionType: "SEARCH",
        target: "demographics",
        filterValue: String(topOcc.label),
      });
    }
  } else if (reportType === "hub") {
    if (Number(metrics.overdueAmount || 0) > 0) {
      items.push({
        label: "Open Overdue Billing",
        actionType: "NAVIGATE_TAB",
        target: "tabs",
        filterValue: "revenue",
      });
    }
    if (Number(metrics.maintenanceRequests || 0) > 0) {
      items.push({
        label: "Open Maintenance Ops",
        actionType: "NAVIGATE_TAB",
        target: "tabs",
        filterValue: "operations",
      });
    }
    if (Number(metrics.availableBeds || 0) > 0) {
      items.push({
        label: "Inspect Open Beds",
        actionType: "NAVIGATE_TAB",
        target: "tabs",
        filterValue: "occupancy",
      });
    }
  }

  return items.slice(0, 3);
};

const heuristicInsightBuilders = {
  hub: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const constrainedRooms = snapshot.occupancy?.constrainedRooms || [];
    const largestBalance = snapshot.paymentRisk?.largestBalances?.[0];
    const overdueBucket = pickTopBy(snapshot.paymentRisk?.overdueAging, "amount", 1)[0];
    const delayedRequests = snapshot.maintenanceRisk?.delayedRequests || [];
    const topMaintenance = snapshot.maintenanceRisk?.maintenanceByType?.[0];
    const forecast = snapshot.forecast || {};
    const security = snapshot.security;
    const branchLabel =
      scope.branch === "all"
        ? "all branches"
        : String(scope.branch || "the selected branch").replace(/-/g, " ");

    const hasCoreData =
      Number(metrics.occupancyRate || 0) > 0 ||
      Number(metrics.outstandingBalance || 0) > 0 ||
      Number(metrics.maintenanceRequests || 0) > 0;

    if (!hasCoreData) {
      return {
        headline: "More report data is needed before we can highlight clear patterns.",
        summary: [
          `We checked occupancy, billing, operations, and forecast data for ${branchLabel}.`,
          "Current records are still too light for confident recommendations.",
          question ? `You asked: ${question}` : null,
        ].filter(Boolean).join(" "),
        keyFindings: [
          "Occupancy, billing, and maintenance records are available but still building up.",
        ],
        anomalies: [],
        riskAlerts: [],
        forecastHighlights: forecast.headline ? [forecast.headline] : [],
        recommendedActions: [
          "Continue logging occupancy, billing, and maintenance records to unlock deeper AI insights.",
        ],
        confidence: "low",
      };
    }

    const branchComparison = snapshot.branchComparison || [];
    let branchComparisonFinding = null;
    if (scope.branch === "all" && branchComparison.length > 1) {
      const branchesWithCollections = branchComparison.filter((b) => b.collectionRate !== null);
      if (branchesWithCollections.length >= 2) {
        const sorted = [...branchesWithCollections].sort((a, b) => Number(b.collectionRate || 0) - Number(a.collectionRate || 0));
        const top = sorted[0];
        const bottom = sorted[sorted.length - 1];
        if (top && bottom && top.branch !== bottom.branch) {
          branchComparisonFinding = `Branch benchmark: ${top.label || top.branch} leads collections at ${safePercent(top.collectionRate)}, while ${bottom.label || bottom.branch} is at ${safePercent(bottom.collectionRate)}.`;
        }
      }
    }

    const keyFindings = [
      branchComparisonFinding,
      `Occupancy is at ${safePercent(metrics.occupancyRate)} with ${metrics.availableBeds} open bed(s) ready for move-in.`,
      `Collected payments stand at ${safePercent(metrics.collectionRate)} with ${safeMoney(metrics.outstandingBalance)} in unpaid bills.`,
      `${metrics.maintenanceRequests} repair request(s) were logged in this period.`,
      security && Number(security.criticalEvents || 0) > 0
        ? `${security.criticalEvents} important security event(s) need manager review.`
        : null,
    ].filter(Boolean).slice(0, MAX_FINDINGS);

    const riskAlerts = [
      Number(metrics.overdueAmount || 0) > 0
        ? `${safeMoney(metrics.overdueAmount)} is currently overdue across accounts.`
        : null,
      largestBalance
        ? `The largest visible unpaid balance is ${safeMoney(largestBalance.balance)} for ${largestBalance.roomName || "a room"}.`
        : null,
      overdueBucket
        ? `${overdueBucket.label} has the highest overdue total at ${safeMoney(overdueBucket.amount)}.`
        : null,
      delayedRequests.length > 0
        ? `${delayedRequests.length} delayed or high-priority repair(s) need quick attention.`
        : null,
      Number(metrics.unavailableBeds || 0) > 0
        ? `${metrics.unavailableBeds} bed(s) are temporarily closed for repairs or maintenance.`
        : null,
      security && Number(security.failedLogins || 0) >= 10
        ? `${security.failedLogins} failed login attempt(s) were flagged for review.`
        : null,
    ].filter(Boolean).slice(0, MAX_RISK_ALERTS);

    const forecastHighlights = [
      forecast.headline || null,
      ...(forecast.projected || []).slice(0, 2).map(
        (entry) =>
          `${entry.label}: projected occupancy ${safePercent(entry.projectedOccupancyRate)} against ${safePercent(entry.baselineRate)} baseline.`,
      ),
      ...((forecast.recommendations || []).slice(0, 1)),
    ].filter(Boolean).slice(0, MAX_FORECAST_HIGHLIGHTS);

    const recommendedActions = [
      Number(metrics.overdueAmount || 0) > 0
        ? "Send friendly payment reminders to accounts with the largest and oldest overdue bills."
        : null,
      constrainedRooms.length > 0
        ? "Review nearly full rooms and open up maintenance beds before accepting new bookings."
        : null,
      delayedRequests.length > 0
        ? "Prioritize delayed or urgent repairs to keep maintenance on schedule."
        : null,
      topMaintenance
        ? `Check repeat causes behind ${String(topMaintenance.label || "maintenance").toLowerCase()} requests to reduce future repairs.`
        : null,
      forecast.sufficientHistory === false
        ? "Build up more occupancy history for even more accurate future projections."
        : null,
      security && Number(security.criticalEvents || 0) > 0
        ? "Review important system events during your next administrative check."
        : null,
    ].filter(Boolean).slice(0, MAX_ACTIONS);

    const q = String(question || "").toLowerCase();
    let headline = `AI overview found ${riskAlerts.length} item(s) to check for ${branchLabel}.`;
    let summaryText = [
      `Overall operations are steady: occupancy is at ${safePercent(metrics.occupancyRate)}, collection rate is at ${safePercent(metrics.collectionRate)}, and ${metrics.maintenanceRequests} repair request(s) are logged.`,
      forecast.sufficientHistory
        ? "There is enough history to support upcoming monthly planning."
        : "More history will help make long-term forecasts even more reliable.",
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("risk") || q.includes("urgent") || q.includes("critical") || q.includes("warning")) {
      headline = `AI Safety Radar: ${riskAlerts.length} item(s) requiring management attention.`;
      summaryText = `In response to your query regarding risks: Key items to look at include ${riskAlerts.slice(0, 2).join(" and ")}. A quick follow-up will keep operations running smoothly.`;
    } else if (q.includes("forecast") || q.includes("projection") || q.includes("future")) {
      headline = forecast.headline || `Occupancy forecast is projected across ${forecast.projected?.length || 0} upcoming month(s).`;
      summaryText = `In response to your forecast query: Current occupancy is ${safePercent(metrics.occupancyRate)}, with upcoming projections shown in the forecast cards below.`;
    }

    return {
      headline,
      summary: summaryText,
      keyFindings,
      anomalies: riskAlerts.slice(0, MAX_ANOMALIES),
      riskAlerts,
      forecastHighlights,
      recommendedActions,
      confidence:
        forecast.sufficientHistory && keyFindings.length >= 3
          ? "medium"
          : "low",
    };
  },
  occupancy: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const constrained = snapshot.constrainedRooms || [];
    const bestType = pickTopBy(snapshot.topRoomTypes, "occupancyRate", 1)[0];
    const weakestType = [...(snapshot.topRoomTypes || [])]
      .sort((left, right) => Number(left.occupancyRate || 0) - Number(right.occupancyRate || 0))[0];

    if (Number(metrics.totalCapacity || 0) === 0) {
      return {
        headline: "Not enough room data yet to show occupancy trends.",
        summary: "This report does not have enough room records for a complete AI summary.",
        keyFindings: ["More room records are needed before occupancy patterns can be clearly shown."],
        anomalies: [],
        recommendedActions: ["Check that room inventory and tenant assignments are up to date."],
        confidence: "low",
      };
    }

    const q = String(question || "").toLowerCase();
    let headline = `Occupancy is at ${safePercent(metrics.occupancyRate)} with ${metrics.availableBeds} open bed(s).`;
    let summaryText = [
      `${metrics.availableBeds} bed(s) are open and ready for move-in.`,
      Number(metrics.trendDelta || 0) >= 0
        ? `Occupancy has stayed steady or risen by about ${safePercent(round(metrics.trendDelta, 0))}.`
        : `Occupancy dipped by about ${safePercent(Math.abs(round(metrics.trendDelta, 0)))}.`,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("utiliz") || q.includes("action") || q.includes("increase") || q.includes("recommend") || q.includes("boost") || q.includes("strategy")) {
      headline = `Focus on filling ${weakestType?.label || "open units"} and readying maintenance beds to boost occupancy from ${safePercent(metrics.occupancyRate)}.`;
      summaryText = `In response to your query regarding bed utilization: Overall occupancy is currently ${safePercent(metrics.occupancyRate)} with ${metrics.availableBeds} open bed(s). Promoting ${weakestType ? `${weakestType.label} units (${safePercent(weakestType.occupancyRate)} filled)` : "vacant units"}${metrics.unavailableBeds > 0 ? ` and unlocking ${metrics.unavailableBeds} bed(s) under maintenance` : ""} will quickly lift occupancy.`;
    } else if (q.includes("low") || q.includes("weak") || q.includes("least") || q.includes("empty") || q.includes("unfilled") || q.includes("vacancy")) {
      if (weakestType) {
        headline = `${weakestType.label} has the most open spots with ${safePercent(100 - (weakestType.occupancyRate || 0))} unfilled (${safePercent(weakestType.occupancyRate)} occupied).`;
        summaryText = `In response to your query regarding room vacancy: ${weakestType.label} rooms currently have the lowest occupancy at ${safePercent(weakestType.occupancyRate)} with ${Math.max(0, weakestType.capacity - weakestType.occupiedBeds)} bed(s) open. ${bestType?.label || "Other types"} has the highest at ${safePercent(bestType?.occupancyRate || 0)}.`;
      }
    } else if (q.includes("project") || q.includes("semester") || q.includes("forecast") || q.includes("future")) {
      headline = `Occupancy is tracking at ${safePercent(metrics.occupancyRate)} with ${metrics.availableBeds} beds ready for the next intake.`;
      summaryText = `In response to your projection query: Current occupancy is ${safePercent(metrics.occupancyRate)}. You can welcome up to ${metrics.availableBeds} new resident(s) across existing rooms.`;
    } else if (q.includes("constrained") || q.includes("offline") || q.includes("lock") || q.includes("blocked")) {
      headline = constrained.length > 0
        ? `${constrained.length} room(s) are nearly full or affected by ${metrics.unavailableBeds} bed(s) under maintenance.`
        : `No congested rooms detected; ${metrics.availableBeds} bed(s) are open across all rooms.`;
      summaryText = `In response to your inquiry: ${metrics.unavailableBeds} bed(s) are currently undergoing maintenance or locked. ${constrained[0] ? `Room ${constrained[0].roomNumber} has only ${constrained[0].availableBeds} bed(s) left.` : "Room capacity is well balanced."}`;
    } else if (q.includes("high") || q.includes("top") || q.includes("best") || q.includes("full")) {
      if (bestType) {
        headline = `${bestType.label} is the top performing room type at ${safePercent(bestType.occupancyRate)} occupancy.`;
        summaryText = `In response to your query: ${bestType.label} leads occupancy across the branch at ${safePercent(bestType.occupancyRate)} (${bestType.occupiedBeds}/${bestType.capacity} beds occupied).`;
      }
    } else if (q.includes("bed") || q.includes("capacity") || q.includes("available") || q.includes("open")) {
      headline = `${metrics.availableBeds} of ${metrics.totalCapacity} beds are ready for move-in.`;
      summaryText = `In response to your query: There are ${metrics.availableBeds} open bed(s) ready for move-in, ${metrics.occupiedBeds} occupied bed(s), and ${metrics.unavailableBeds} bed(s) under maintenance or lock.`;
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        bestType ? `${bestType.label} is the most popular room choice at ${safePercent(bestType.occupancyRate)} occupancy.` : null,
        weakestType ? `${weakestType.label} has the lowest occupancy rate at ${safePercent(weakestType.occupancyRate)}.` : null,
        constrained.length > 0 ? `${constrained.length} room(s) are nearly full or have beds under maintenance.` : "Room capacity is well balanced across all units.",
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        metrics.unavailableBeds > 0 ? `${metrics.unavailableBeds} bed(s) are temporarily closed for maintenance.` : null,
        constrained[0]
          ? `Room ${constrained[0].roomNumber} has only ${constrained[0].availableBeds} open bed(s) left.`
          : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        constrained.length > 0 ? "Prepare high-demand rooms quickly so they are ready for new tenants." : null,
        metrics.unavailableBeds > 0 ? "Complete repairs on maintenance beds to open up more room capacity." : null,
        weakestType ? `Review pricing and promotion for ${weakestType.label} to attract more tenants.` : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: snapshot.trend?.length >= 4 ? "medium" : "low",
    };
  },
  billing: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const largestBalance = snapshot.largestBalances?.[0];
    const oldestAging = pickTopBy(snapshot.overdueAging, "amount", 1)[0];

    if (Number(metrics.billedAmount || 0) === 0 && Number(metrics.collectedRevenue || 0) === 0) {
      return {
        headline: "Not enough billing data yet to show collection trends.",
        summary: "This report does not have enough billing records for a complete AI summary.",
        keyFindings: ["Bills or payment records are needed before collection patterns can be explained."],
        anomalies: [],
        recommendedActions: ["Check that bills and payments are being recorded for this period."],
        confidence: "low",
      };
    }

    const q = String(question || "").toLowerCase();
    let headline = `${safeMoney(metrics.collectedRevenue)} collected so far (${safePercent(metrics.collectionRate)} collection rate).`;
    let summaryText = [
      `${safeMoney(metrics.outstandingBalance)} in unpaid bills remains to be collected.`,
      Number(metrics.revenueDelta || 0) >= 0
        ? `Collections rose by ${safeMoney(metrics.revenueDelta)} compared to last month.`
        : `Collections dipped by ${safeMoney(Math.abs(metrics.revenueDelta))} compared to last month.`,
      `Current collection rate is ${safePercent(metrics.collectionRate)}.`,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("overdue") || q.includes("late") || q.includes("unpaid") || q.includes("aging")) {
      headline = `${safeMoney(metrics.overdueAmount)} is currently overdue in unpaid bills.`;
      summaryText = `In response to your query regarding overdue balances: Total overdue amount is ${safeMoney(metrics.overdueAmount)}. The biggest portion is in the ${oldestAging?.label || "overdue"} group (${safeMoney(oldestAging?.amount || 0)}).`;
    } else if (q.includes("highest") || q.includes("largest") || q.includes("most") || q.includes("room")) {
      if (largestBalance) {
        headline = `${largestBalance.roomName} has the highest unpaid balance at ${safeMoney(largestBalance.balance)}.`;
        summaryText = `In response to your query: Room ${largestBalance.roomName} has an unpaid balance of ${safeMoney(largestBalance.balance)} (${largestBalance.daysOverdue} days overdue).`;
      }
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        `${safeMoney(metrics.overdueAmount)} in bills is currently overdue.`,
        oldestAging ? `The largest overdue group is ${oldestAging.label} with ${safeMoney(oldestAging.amount)} unpaid.` : null,
        largestBalance ? `${largestBalance.roomName} has the largest visible unpaid balance at ${safeMoney(largestBalance.balance)}.` : null,
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        Number(metrics.collectionRate || 0) < 80 ? `Collection rate is low at ${safePercent(metrics.collectionRate)}.` : null,
        largestBalance && Number(largestBalance.daysOverdue || 0) > 60
          ? `One high unpaid balance is already ${largestBalance.daysOverdue} days late.`
          : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        "Follow up first on the highest unpaid balances and oldest overdue accounts.",
        Number(metrics.collectionRate || 0) < 80 ? "Send friendly payment reminders to encourage on-time payments." : null,
        Number(metrics.overdueAmount || 0) > 0 ? "Review overdue payments weekly so late balances do not build up." : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: snapshot.revenueByMonth?.length >= 3 ? "medium" : "low",
    };
  },
  financials: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const branchRisk = pickTopBy(snapshot.branchComparison, "overdueAmount", 1)[0];
    const bestCollectionBranch = pickTopBy(snapshot.branchComparison, "collectionRate", 1)[0];
    const largestRoom = snapshot.overdueRooms?.[0];
    const largestBalance = snapshot.largestBalances?.[0];
    const biggestAging = pickTopBy(snapshot.overdueAging, "amount", 1)[0];
    const branchLabel =
      scope.branch === "all"
        ? "all branches"
        : String(scope.branch || "the selected branch").replace(/-/g, " ");

    if (Number(metrics.billedAmount || 0) === 0 && Number(metrics.collectedRevenue || 0) === 0) {
      return {
        headline: "Not enough financial data yet for a summary.",
        summary: `The financial report for ${branchLabel} does not have enough billing or payment records for a complete AI summary.`,
        keyFindings: ["Bills and payment records are needed before financial trends can be clearly shown."],
        anomalies: [],
        recommendedActions: ["Check that billing and payment entries are up to date for this period."],
        confidence: "low",
      };
    }

    const q = String(question || "").toLowerCase();
    let headline = `${safeMoney(metrics.collectedRevenue)} collected with ${safeMoney(metrics.outstandingBalance)} in unpaid bills.`;
    let summaryText = [
      `The selected branches are at a ${safePercent(metrics.collectionRate)} collection rate with a net balance of ${safeMoney(metrics.netPosition)}.`,
      Number(metrics.revenueDelta || 0) >= 0
        ? `Collections grew by ${safeMoney(metrics.revenueDelta)} compared to last month.`
        : `Collections dipped by ${safeMoney(Math.abs(metrics.revenueDelta))} compared to last month.`,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("branch") || q.includes("compare") || q.includes("best") || q.includes("worst")) {
      if (branchRisk && bestCollectionBranch) {
        headline = `${bestCollectionBranch.label} leads collections (${safePercent(bestCollectionBranch.collectionRate)}), while ${branchRisk.label} has highest overdue total.`;
        summaryText = `In response to your branch comparison query: ${bestCollectionBranch.label} achieved the strongest collection rate at ${safePercent(bestCollectionBranch.collectionRate)}, while ${branchRisk.label} has ${safeMoney(branchRisk.overdueAmount)} in overdue bills.`;
      }
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        `${safeMoney(metrics.overdueAmount)} is overdue in the selected financial view.`,
        branchRisk ? `${branchRisk.label} has the highest overdue total at ${safeMoney(branchRisk.overdueAmount)}.` : null,
        bestCollectionBranch ? `${bestCollectionBranch.label} has the highest collection rate at ${safePercent(bestCollectionBranch.collectionRate)}.` : null,
        biggestAging ? `${biggestAging.label} has the largest overdue portion at ${safeMoney(biggestAging.amount)}.` : null,
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        Number(metrics.collectionRate || 0) < 80 ? `Collection rate is below target at ${safePercent(metrics.collectionRate)}.` : null,
        largestRoom ? `${largestRoom.roomName} has ${safeMoney(largestRoom.outstandingBalance)} in visible unpaid bills.` : null,
        largestBalance && Number(largestBalance.daysOverdue || 0) > 60
          ? `One unpaid balance is already ${largestBalance.daysOverdue} days overdue.`
          : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        "Follow up first on rooms and tenants with the oldest unpaid bills.",
        branchRisk ? `Review ${branchRisk.label} collection reminders to help close overdue balances.` : null,
        Number(metrics.collectionRate || 0) < 80 ? "Send polite reminder notifications to encourage faster payments." : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: snapshot.revenueByMonth?.length >= 3 ? "medium" : "low",
    };
  },
  operations: ({ snapshot, question }) => {
    const metrics = snapshot.metrics || {};
    const topMaintenance = snapshot.maintenanceByType?.[0];
    const topWindow = snapshot.peakInquiryWindows?.[0];
    const delayedCount = snapshot.delayedRequests?.length || 0;

    if (
      Number(metrics.reservations || 0) === 0 &&
      Number(metrics.inquiries || 0) === 0 &&
      Number(metrics.maintenanceRequests || 0) === 0
    ) {
      return {
        headline: "Not enough operations data yet to show activity trends.",
        summary: "This report does not have enough records for a complete AI summary.",
        keyFindings: ["Recent reservation, inquiry, or repair records are needed before trends can be clearly shown."],
        anomalies: [],
        recommendedActions: ["Check that reservations, inquiries, and repair tickets are being logged."],
        confidence: "low",
      };
    }

    const q = String(question || "").toLowerCase();
    let headline = `${metrics.maintenanceRequests} repair request(s) and ${metrics.reservations} reservation(s) logged in this period.`;
    let summaryText = [
      `Average repair time is ${round(metrics.avgResolutionHours)} hours.`,
      `On-time repair rate is ${safePercent(metrics.slaComplianceRate)}.`,
      topWindow ? `Most tenant inquiries arrive around ${topWindow.label}.` : null,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("sla") || q.includes("delay") || q.includes("late") || q.includes("slow")) {
      headline = delayedCount > 0
        ? `${delayedCount} repair request(s) need quick attention to stay on schedule.`
        : `Repairs are running on schedule with a ${safePercent(metrics.slaComplianceRate)} on-time completion rate.`;
      summaryText = `In response to your SLA query: On-time repair rate is ${safePercent(metrics.slaComplianceRate)} with an average fix time of ${round(metrics.avgResolutionHours)} hours across ${metrics.maintenanceRequests} total requests.`;
    } else if (q.includes("maintenance") || q.includes("repair") || q.includes("fix") || q.includes("issue")) {
      if (topMaintenance) {
        headline = `${topMaintenance.label} is the top repair request with ${topMaintenance.count} ticket(s).`;
        summaryText = `In response to your maintenance query: ${topMaintenance.label} makes up the largest share of repair requests. Average fix time is ${round(metrics.avgResolutionHours)} hours.`;
      }
    } else if (q.includes("inquiry") || q.includes("peak") || q.includes("time") || q.includes("lead")) {
      headline = topWindow ? `Most tenant inquiries arrive around ${topWindow.label}.` : `Total inquiry count is ${metrics.inquiries}.`;
      summaryText = `In response to your inquiry query: Total volume is ${metrics.inquiries} inquiries, with peak activity around ${topWindow?.label || "regular office hours"}.`;
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        topMaintenance ? `${topMaintenance.label} is the most common repair request.` : null,
        delayedCount > 0 ? `${delayedCount} repair ticket(s) need attention to stay on schedule.` : "Repairs are progressing smoothly with no major delays.",
        `Total inquiry volume stands at ${metrics.inquiries} for the reporting period.`,
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        Number(metrics.slaComplianceRate || 0) < 85 ? `The on-time repair rate is below target at ${safePercent(metrics.slaComplianceRate)}.` : null,
        delayedCount > 0 ? "Some repair tickets may need faster follow-up with technicians." : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        delayedCount > 0 ? "Assign delayed or urgent repair requests first to keep fixes on schedule." : null,
        topMaintenance ? `Check for root causes behind recurring ${topMaintenance.label.toLowerCase()} issues.` : null,
        topWindow ? `Ensure staff is ready to respond promptly around ${topWindow.label} when inquiry volume peaks.` : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: snapshot.reservationsByPeriod?.length >= 3 ? "medium" : "low",
    };
  },
  audit: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const hottestBranch = pickTopBy(snapshot.branchSummary, "highSeverityCount", 1)[0];
    const suspiciousIp = pickTopBy(snapshot.suspiciousIps, "attempts", 1)[0];

    if (
      Number(metrics.failedLogins || 0) === 0 &&
      Number(metrics.highSeverityActions || 0) === 0 &&
      Number(metrics.criticalEvents || 0) === 0
    ) {
      return {
        headline: "All systems look safe and secure — no security warnings in this period.",
        summary: "This report shows no failed logins, critical events, or unusual access actions right now.",
        keyFindings: ["No urgent security concerns were detected in the current summary."],
        anomalies: [],
        recommendedActions: ["Continue regular system monitoring and user permission reviews."],
        confidence: "medium",
      };
    }

    const q = String(question || "").toLowerCase();
    let headline = `${metrics.failedLogins} failed login attempt(s) and ${metrics.highSeverityActions} important system event(s) recorded.`;
    let summaryText = [
      `${metrics.accessOverrides} permission override or access change event(s) were logged.`,
      suspiciousIp ? `The most active suspicious IP had ${suspiciousIp.attempts} failed attempts.` : null,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("ip") || q.includes("failed") || q.includes("login") || q.includes("attack")) {
      headline = suspiciousIp
        ? `Suspicious IP ${suspiciousIp.ipAddress || "source"} recorded ${suspiciousIp.attempts} failed login attempts.`
        : `${metrics.failedLogins} failed login attempts recorded in total.`;
      summaryText = `In response to your security query: ${metrics.failedLogins} failed logins were detected and monitored.`;
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        hottestBranch ? `${hottestBranch.label} recorded the most system activity in this summary.` : null,
        suspiciousIp ? `One suspicious IP attempted logins on ${suspiciousIp.targetedEmailsCount} account(s).` : null,
        `${metrics.criticalEvents} important security event(s) were logged in this period.`,
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        Number(metrics.accessOverrides || 0) > 0 ? "There are permission or role changes that should be double-checked." : null,
        suspiciousIp && Number(suspiciousIp.attempts || 0) >= 5 ? "One IP address has an unusual number of failed login attempts." : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        suspiciousIp ? "Review repeated failed logins and confirm account security rules are working." : null,
        Number(metrics.accessOverrides || 0) > 0 ? "Double-check recent permission changes to verify they were authorized." : null,
        hottestBranch ? `Review ${hottestBranch.label} first as it had the most logged system events.` : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: "medium",
    };
  },
  demographics: ({ snapshot, scope, question }) => {
    const metrics = snapshot.metrics || {};
    const occupationMix = snapshot.occupationMix || [];
    const topMonths = snapshot.topMonths || [];
    const referralSources = snapshot.referralSources || [];
    const ageDistribution = snapshot.ageDistribution || [];
    const roomTypePref = snapshot.roomTypePreference || [];
    const branchLabel =
      scope.branch === "all"
        ? "all branches"
        : String(scope.branch || "the selected branch").replace(/-/g, " ");

    if (Number(metrics.totalAnalyzed || 0) === 0) {
      return {
        headline: "Not enough tenant demographic data yet for a summary.",
        summary: `The demographics report for ${branchLabel} does not have enough confirmed bookings to generate a summary.`,
        keyFindings: ["More confirmed tenant reservations are needed before demographic patterns can be shown."],
        anomalies: [],
        recommendedActions: ["Continue processing tenant applications to build demographic history."],
        confidence: "low",
      };
    }

    const topOccupation = occupationMix.length > 0
      ? occupationMix.sort((a, b) => b.value - a.value)[0]
      : null;
    const topReferral = referralSources.length > 0 ? referralSources[0] : null;
    const topAgeGroup = ageDistribution.length > 0
      ? ageDistribution.sort((a, b) => b.count - a.count)[0]
      : null;

    const q = String(question || "").toLowerCase();
    const dominantLabel = metrics.dominantOccupation || (metrics.studentPercentage >= metrics.professionalPercentage ? "Students" : "Working Professionals");
    const dominantPct = metrics.dominantPercentage || (dominantLabel === "Students" ? metrics.studentPercentage : metrics.professionalPercentage);

    let headline = `${metrics.totalAnalyzed} tenant(s) analyzed — ${dominantLabel} lead the community at ${safePercent(dominantPct)}.`;
    let summaryText = [
      topOccupation ? `Primary occupation segment is ${topOccupation.label} with ${topOccupation.value} tenant(s).` : null,
      metrics.topProvince && metrics.topProvince !== "N/A" ? `Leading tenant origin is ${metrics.topProvince} (${metrics.topProvinceCount} tenants).` : null,
      topMonths.length > 0 ? `Busiest booking month is ${topMonths[0].label} with ${topMonths[0].count} reservation(s).` : null,
      `The most popular room choice is ${metrics.topRoomType}.`,
      question ? `You asked: ${question}` : null,
    ].filter(Boolean).join(" ");

    if (q.includes("student") || q.includes("occupation") || q.includes("profession") || q.includes("job") || q.includes("work")) {
      headline = `${dominantLabel} represent ${safePercent(dominantPct)} of analyzed tenants (${metrics.studentsCount || 0} students, ${metrics.professionalsCount || 0} professionals).`;
      summaryText = `In response to your occupation query: Community mix comprises ${safePercent(metrics.studentPercentage)} students and ${safePercent(metrics.professionalPercentage)} working professionals, with ${topOccupation?.label || dominantLabel} being the largest group.`;
    } else if (q.includes("province") || q.includes("origin") || q.includes("where") || q.includes("city")) {
      headline = metrics.topProvince && metrics.topProvince !== "N/A"
        ? `${metrics.topProvince} is the leading origin with ${metrics.topProvinceCount} tenant(s).`
        : "Geographic origin distribution is currently building up.";
      summaryText = `In response to your geographic query: Most tenants originate from ${metrics.topProvince || "local branches"}, followed by surrounding regional provinces.`;
    } else if (q.includes("referral") || q.includes("channel") || q.includes("source") || q.includes("acquisition")) {
      headline = topReferral ? `${topReferral.label} is the top referral source (${topReferral.value} tenants).` : "Referral channel analysis active.";
      summaryText = `In response to your referral source query: Most tenants found Lilycrest through ${topReferral?.label || "direct inquiries"}.`;
    }

    return {
      headline,
      summary: summaryText,
      keyFindings: [
        topOccupation ? `${topOccupation.label} tenants make up the largest share of confirmed bookings.` : null,
        metrics.topProvince && metrics.topProvince !== "N/A" ? `${metrics.topProvince} represents the top geographic origin (${metrics.topProvinceCount} tenants).` : null,
        roomTypePref.length > 0 ? `${roomTypePref[0].label} is the most popular room choice.` : null,
        topReferral ? `${topReferral.label} is the top referral source with ${topReferral.value} tenant(s).` : null,
        topAgeGroup ? `The ${topAgeGroup.label} age bracket has the most residents.` : null,
        topMonths.length >= 2 ? `${topMonths[0].label} and ${topMonths[1].label} are the busiest booking months.` : null,
      ].filter(Boolean).slice(0, MAX_FINDINGS),
      anomalies: [
        Number(metrics.studentPercentage || 0) >= 90 ? "Nearly all tenants are students — consider targeted outreach for working professionals." : null,
        Number(metrics.professionalPercentage || 0) >= 90 ? "Working professionals dominate the current tenant base." : null,
        occupationMix.find((m) => m.label === "Unspecified" && m.value > metrics.totalAnalyzed * 0.3) ? "A number of tenants have an unspecified occupation — encourage applicants to share employment or school details." : null,
      ].filter(Boolean).slice(0, MAX_ANOMALIES),
      recommendedActions: [
        topMonths.length > 0 ? `Prepare room readiness before ${topMonths[0].label} to welcome the wave of new tenants smoothly.` : null,
        metrics.topProvince && metrics.topProvince !== "N/A" ? `Target marketing in ${metrics.topProvince} and adjacent commuting routes.` : null,
        topReferral ? `Keep investing in ${topReferral.label} as a referral channel — it brings in the most confirmed bookings.` : null,
        topAgeGroup ? `Tailor amenities and community updates for the ${topAgeGroup.label} age group, which is your largest community segment.` : null,
      ].filter(Boolean).slice(0, MAX_ACTIONS),
      confidence: Number(metrics.totalAnalyzed || 0) >= 10 ? "medium" : "low",
    };
  },
};

const createHeuristicProvider = () => ({
  name: "heuristic-fallback",
  async generate({ reportType, scope, question, snapshot }) {
    const build = heuristicInsightBuilders[reportType];
    if (!build) {
      throw new Error(`Unsupported analytics insight report type: ${reportType}`);
    }

    return build({ snapshot, scope, question });
  },
});

const analyticsInsightResponseSchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One concise sentence that states the most important report insight.",
    },
    summary: {
      type: "string",
      description: "A short paragraph explaining the trend using only the provided snapshot data.",
    },
    keyFindings: {
      type: "array",
      minItems: 1,
      maxItems: MAX_FINDINGS,
      items: { type: "string" },
    },
    anomalies: {
      type: "array",
      maxItems: MAX_ANOMALIES,
      items: { type: "string" },
    },
    riskAlerts: {
      type: "array",
      maxItems: MAX_RISK_ALERTS,
      items: { type: "string" },
    },
    forecastHighlights: {
      type: "array",
      maxItems: MAX_FORECAST_HIGHLIGHTS,
      items: { type: "string" },
    },
    recommendedActions: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ACTIONS,
      items: { type: "string" },
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
  },
  required: [
    "headline",
    "summary",
    "keyFindings",
    "anomalies",
    "recommendedActions",
    "confidence",
  ],
  propertyOrdering: [
    "headline",
    "summary",
    "keyFindings",
    "anomalies",
    "riskAlerts",
    "forecastHighlights",
    "recommendedActions",
    "confidence",
  ],
};

const getInsightResponseSchema = (reportType) =>
  reportType === "hub"
    ? {
        ...analyticsInsightResponseSchema,
        required: [
          "headline",
          "summary",
          "keyFindings",
          "riskAlerts",
          "forecastHighlights",
          "recommendedActions",
          "confidence",
        ],
      }
    : analyticsInsightResponseSchema;

const clampText = (value, maxLength = 420) =>
  String(value || "").trim().slice(0, maxLength);

const clampList = (items, limit, maxLength = 220) =>
  (Array.isArray(items) ? items : [])
    .map((item) => clampText(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);

const normalizeInsight = (insight) => {
  const anomalies = clampList(insight?.anomalies, MAX_ANOMALIES);
  const riskAlerts = clampList(
    insight?.riskAlerts || insight?.risk_alerts || anomalies,
    MAX_RISK_ALERTS,
  );

  const rawActions = Array.isArray(insight?.actionableItems) ? insight.actionableItems : [];
  const actionableItems = rawActions
    .map((act) => ({
      label: clampText(act.label || act.text || "View", 80),
      actionType: String(act.actionType || act.type || "FILTER").toUpperCase(),
      target: clampText(act.target || "", 50),
      filterValue: clampText(act.filterValue || act.value || "", 50),
    }))
    .filter((act) => act.label && act.actionType)
    .slice(0, 3);

  const normalized = {
    headline: clampText(insight?.headline, 180),
    summary: clampText(insight?.summary, 700),
    keyFindings: clampList(insight?.keyFindings, MAX_FINDINGS),
    anomalies,
    riskAlerts,
    forecastHighlights: clampList(
      insight?.forecastHighlights || insight?.forecast_highlights,
      MAX_FORECAST_HIGHLIGHTS,
    ),
    recommendedActions: clampList(insight?.recommendedActions, MAX_ACTIONS),
    actionableItems,
    confidence: VALID_CONFIDENCE.has(insight?.confidence)
      ? insight.confidence
      : "low",
  };

  if (!normalized.headline || !normalized.summary) {
    throw new Error("AI provider insight response is missing headline or summary.");
  }
  if (!normalized.keyFindings.length || !normalized.recommendedActions.length) {
    throw new Error("AI provider insight response is missing required lists.");
  }

  return normalized;
};

const buildGeminiPrompt = ({ reportType, scope, filters, question, snapshot }) =>
  [
    "You are a friendly, encouraging, and clear analytics assistant for Lilycrest Dormitory Management.",
    reportType === "hub"
      ? "Generate one consolidated AI Insights Hub response across occupancy, billing, operations, forecasts, and allowed monitoring data."
      : "Generate a practical, clear management insight for the selected report.",
    "Use only the JSON snapshot data. Do not invent facts, tenants, amounts, dates, or policy.",
    "Tone and Vocabulary Guidelines:",
    "- Use everyday, plain, and friendly English. Be warm, approachable, and easy to understand for any manager or staff member.",
    "- Avoid heavy corporate, academic, or statistical jargon.",
    "- Use simple words: say 'unpaid bills' instead of 'uncollected revenue exposure', 'open beds' instead of 'occupancy utilization variance', 'popular room choices' instead of 'cohort polarization', and 'repairs on schedule' instead of 'SLA compliance threshold'.",
    "- When referencing collectedRevenue or collection amounts, call them collected payments or collections, not revenue.",
    "- Write friendly, encouraging management insights with practical, realistic next steps.",
    "Keep recommendations operational and human-review focused. Do not say that records were changed.",
    "For owner/all-branch scope, include planning or branch-comparison implications when supported by the data.",
    reportType === "hub"
      ? "For the hub response, put immediate problems in riskAlerts and planning/projection notes in forecastHighlights."
      : null,
    "",
    `Report type: ${reportType}`,
    `Role: ${scope.role || "unknown"}`,
    `Branch scope: ${scope.branch || "all"}`,
    `Branches included: ${(scope.branchesIncluded || []).join(", ") || "none"}`,
    `Question: ${question || "No specific question."}`,
    "",
    "Filters:",
    JSON.stringify(filters || {}, null, 2),
    "",
    "Snapshot:",
    JSON.stringify(snapshot || {}, null, 2),
  ].filter((line) => line !== null).join("\n");

const parseGeminiText = (body) => {
  const text = body?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty insight response.");
  }

  return JSON.parse(text);
};

const parseJsonText = (rawText) => {
  const text = String(rawText || "").trim();
  if (!text) {
    throw new Error("AI provider returned an empty insight response.");
  }
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  }
};

const createGeminiProvider = () => {
  const apiKey = String(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "",
  ).trim();
  const model = String(process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL).trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY is not configured.");
  }

  return {
    name: "gemini",
    model,
    async generate({ reportType, scope, filters, question, snapshot }) {
      if (typeof fetch !== "function") {
        throw new Error("Global fetch is not available for Gemini requests.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      const endpoint = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: buildGeminiPrompt({
                      reportType,
                      scope,
                      filters,
                      question,
                      snapshot,
                    }),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 900,
              responseMimeType: "application/json",
              responseSchema: getInsightResponseSchema(reportType),
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `Gemini request failed with ${response.status}: ${errorText.slice(0, 180)}`,
          );
        }

        const body = await response.json();
        return normalizeInsight(parseGeminiText(body));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

const createGroqProvider = () => {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  const model = String(process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL).trim();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  return {
    name: "groq",
    model,
    async generate({ reportType, scope, filters, question, snapshot }) {
      if (typeof fetch !== "function") {
        throw new Error("Global fetch is not available for Groq requests.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
      const prompt = buildGeminiPrompt({
        reportType,
        scope,
        filters,
        question,
        snapshot,
      });

      const systemPrompt =
        "You are a friendly, encouraging, and clear analytics assistant for Lilycrest Dormitory Management. " +
        "Use plain, jargon-free English without corporate buzzwords (say 'unpaid bills' instead of 'uncollected revenue exposure', 'open beds' instead of 'occupancy utilization variance', and 'repairs on schedule' instead of 'SLA compliance threshold'). " +
        "Provide actionable, encouraging next steps. " +
        "You MUST return ONLY a strictly valid JSON object matching this schema: " +
        '{"headline": string, "summary": string, "keyFindings": string[], "anomalies": string[], ' +
        '"riskAlerts": string[], "forecastHighlights": string[], "recommendedActions": string[], ' +
        '"confidence": "low"|"medium"|"high"}. Do not output any markdown code fences, headers, or conversational filler.';

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `Groq request failed with ${response.status}: ${errorText.slice(0, 180)}`,
          );
        }

        const body = await response.json();
        const content = body?.choices?.[0]?.message?.content || "";
        return normalizeInsight(parseJsonText(content));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

const createOpenRouterProvider = () => {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  const model = String(process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL).trim();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  return {
    name: "openrouter",
    model,
    async generate({ reportType, scope, filters, question, snapshot }) {
      if (typeof fetch !== "function") {
        throw new Error("Global fetch is not available for OpenRouter requests.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
      const prompt = buildGeminiPrompt({
        reportType,
        scope,
        filters,
        question,
        snapshot,
      });

      const systemPrompt =
        "You are a friendly, encouraging, and clear analytics assistant for Lilycrest Dormitory Management. " +
        "Use plain, jargon-free English without corporate buzzwords (say 'unpaid bills' instead of 'uncollected revenue exposure', 'open beds' instead of 'occupancy utilization variance', and 'repairs on schedule' instead of 'SLA compliance threshold'). " +
        "Provide actionable, encouraging next steps. " +
        "You MUST return ONLY a strictly valid JSON object matching this schema: " +
        '{"headline": string, "summary": string, "keyFindings": string[], "anomalies": string[], ' +
        '"riskAlerts": string[], "forecastHighlights": string[], "recommendedActions": string[], ' +
        '"confidence": "low"|"medium"|"high"}. Do not output any markdown code fences, headers, or conversational filler.';

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://lilycrest.ph",
            "X-Title": "Lilycrest DMS Analytics",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `OpenRouter request failed with ${response.status}: ${errorText.slice(0, 180)}`,
          );
        }

        const body = await response.json();
        const content = body?.choices?.[0]?.message?.content || "";
        return normalizeInsight(parseJsonText(content));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

const resolveProviderChain = () => {
  const requestedProvider = String(
    process.env.AI_INSIGHTS_PROVIDER || process.env.AI_CHAT_PROVIDER || "gemini",
  ).trim().toLowerCase();

  const chain = [];
  const added = new Set();

  const tryAdd = (name, factory) => {
    if (!added.has(name)) {
      try {
        chain.push(factory());
        added.add(name);
      } catch (err) {
        chain.push({
          name,
          model: null,
          async generate() {
            throw err;
          },
        });
        added.add(name);
      }
    }
  };

  if (requestedProvider === "heuristic") {
    return [createHeuristicProvider()];
  }

  // 1. Add explicitly requested provider first (defaulting to gemini)
  if (requestedProvider === "groq") {
    tryAdd("groq", createGroqProvider);
  } else if (requestedProvider === "openrouter" || requestedProvider === "deepseek") {
    tryAdd("openrouter", createOpenRouterProvider);
  } else {
    tryAdd("gemini", createGeminiProvider);
  }

  // 2. Cascade down to other providers if their keys exist
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    tryAdd("gemini", createGeminiProvider);
  }
  if (process.env.GROQ_API_KEY) {
    tryAdd("groq", createGroqProvider);
  }
  if (process.env.OPENROUTER_API_KEY) {
    tryAdd("openrouter", createOpenRouterProvider);
  }

  // 3. Always fallback to heuristic engine
  chain.push(createHeuristicProvider());
  return chain;
};

export const generateAnalyticsInsight = async ({
  reportType,
  scope,
  filters,
  reportData,
  question = "",
}) => {
  const snapshotBuilder = SNAPSHOT_BUILDERS[reportType];
  if (!snapshotBuilder) {
    throw new Error(`Unsupported analytics snapshot type: ${reportType}`);
  }

  const snapshot = snapshotBuilder(reportData);
  const providers = resolveProviderChain();
  let successfulProvider = null;
  let insight = null;
  let usedFallback = false;
  let fallbackReason = null;
  const attemptedErrors = [];

  for (const provider of providers) {
    try {
      insight = await provider.generate({
        reportType,
        scope,
        filters,
        question,
        snapshot,
      });
      successfulProvider = provider;
      break;
    } catch (err) {
      attemptedErrors.push(`${provider.name}: ${err?.message || "Unknown error"}`);
    }
  }

  if (!successfulProvider || !insight) {
    const fallback = createHeuristicProvider();
    insight = await fallback.generate({
      reportType,
      scope,
      filters,
      question,
      snapshot,
    });
    successfulProvider = fallback;
    usedFallback = true;
    fallbackReason = attemptedErrors.join("; ");
  } else if (successfulProvider.name === "heuristic-fallback") {
    usedFallback = true;
    fallbackReason = attemptedErrors.length ? attemptedErrors.join("; ") : null;
  }

  return {
    snapshotMeta: buildSnapshotMeta({
      reportType,
      scope,
      filters,
      question,
      snapshot,
      provider: successfulProvider.name,
      usedFallback,
      model: successfulProvider.model || null,
      fallbackReason,
    }),
    insight: {
      headline: insight.headline,
      summary: insight.summary,
      keyFindings: insight.keyFindings || [],
      anomalies: insight.anomalies || [],
      riskAlerts: insight.riskAlerts || [],
      forecastHighlights: insight.forecastHighlights || [],
      recommendedActions: insight.recommendedActions || [],
      actionableItems: insight.actionableItems?.length
        ? insight.actionableItems
        : deriveActionableItems(reportType, snapshot, insight.recommendedActions),
      confidence: insight.confidence || "low",
      generatedAt: new Date().toISOString(),
      disclaimer:
        "This is an AI summary based on the report data shown here. Use it as a guide, not as the final basis for money, legal, or compliance decisions.",
    },
  };
};
