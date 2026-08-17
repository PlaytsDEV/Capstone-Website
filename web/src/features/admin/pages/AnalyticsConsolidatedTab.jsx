import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bed,
  ExternalLink,
  PhilippinePeso,
  Wrench,
} from "lucide-react";
import { useDashboardData } from "../../../shared/hooks/queries/useDashboard";
import {
  useAnalyticsInsightsHub,
  useBillingReport,
  useFinancialsAnalytics,
  useOccupancyReport,
  useOperationsReport,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsComparisonChart,
  AnalyticsInsightsHub,
  AnalyticsLineChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import { buildRangeLabel, formatBranch, formatPeso } from "./reportCommon";
import {
  buildAnalyticsDetailsHref,
  getSummaryDetailRange,
} from "./analyticsNavigation.mjs";
import {
  AnalyticsInsightSection,
  ExportButtons,
  MetricGrid,
  RANGE_OPTIONS_SHORT,
  buildBranchControl,
  handleCsvExport,
  handlePdfExport,
  detectOccupancyAnomalies,
  detectBillingAnomalies,
  detectOperationsAnomalies,
} from "./analyticsTabShared";

const CONSOLIDATED_PROMPTS = [
  "How are our branches performing overall?",
  "Which branch has the highest occupancy?",
  "Which branch has the highest overdue balance?",
  "Where are the biggest operational bottlenecks?",
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mergeBranchRows(dashboardRows = [], financialRows = []) {
  const rows = new Map();

  dashboardRows.forEach((item) => {
    rows.set(item.branch, {
      branch: item.branch,
      label: item.label || formatBranch(item.branch),
      occupancyRate: toNumber(item.occupancyRate),
      totalCapacity: toNumber(item.totalCapacity),
      availableBeds: toNumber(item.availableBeds),
      activeTickets: toNumber(item.activeTickets),
      inquiries: toNumber(item.inquiries),
      collectedRevenue: toNumber(item.revenueCollected),
      overdueAmount: toNumber(item.overdueAmount),
      collectionRate: toNumber(item.collectionRate),
    });
  });

  financialRows.forEach((item) => {
    const existing = rows.get(item.branch) || {
      branch: item.branch,
      label: item.label || formatBranch(item.branch),
    };

    rows.set(item.branch, {
      ...existing,
      collectedRevenue: toNumber(item.collectedRevenue ?? existing.collectedRevenue),
      overdueAmount: toNumber(item.overdueAmount ?? existing.overdueAmount),
      collectionRate: toNumber(item.collectionRate ?? existing.collectionRate),
      outstandingBalance: toNumber(item.outstandingBalance ?? existing.outstandingBalance),
    });
  });

  return [...rows.values()];
}

function DrilldownLink({ tab, range, branch, label }) {
  return (
    <Link
      to={buildAnalyticsDetailsHref({ tab, range, branch, isOwner: true })}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      <span>{label}</span>
      <ExternalLink size={12} />
    </Link>
  );
}

export default function AnalyticsConsolidatedTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
}) {
  const navigate = useNavigate();
  const effectiveBranch = isOwner ? branch : undefined;
  const monthRange = getSummaryDetailRange("billing", range);

  const dayParams = useMemo(
    () => ({
      range,
      ...(effectiveBranch ? { branch: effectiveBranch } : {}),
    }),
    [effectiveBranch, range],
  );
  const monthParams = useMemo(
    () => ({
      range: monthRange,
      ...(effectiveBranch ? { branch: effectiveBranch } : {}),
    }),
    [effectiveBranch, monthRange],
  );

  const dashboardQuery = useDashboardData(dayParams);
  const occupancyQuery = useOccupancyReport(dayParams);
  const billingQuery = useBillingReport(monthParams);
  const operationsQuery = useOperationsReport(dayParams);
  const financialsQuery = useFinancialsAnalytics(monthParams);
  const insightsQuery = useAnalyticsInsightsHub({
    range,
    billingRange: monthRange,
    ...(effectiveBranch ? { branch: effectiveBranch } : {}),
  });

  const dashboardData = dashboardQuery.data;
  const occupancyData = occupancyQuery.data;
  const billingData = billingQuery.data;
  const operationsData = operationsQuery.data;
  const financialsData = financialsQuery.data;

  const isInitialLoading =
    (dashboardQuery.isLoading && !dashboardData) ||
    (occupancyQuery.isLoading && !occupancyData) ||
    (billingQuery.isLoading && !billingData) ||
    (operationsQuery.isLoading && !operationsData);

  if (isInitialLoading) {
    return <AdminAnalyticsDetailSkeleton tab="consolidated" isOwner={isOwner} />;
  }

  const branchRows = mergeBranchRows(
    dashboardData?.branchComparison,
    financialsData?.series?.branchComparison,
  );
  const occupancyTrend = occupancyData?.series?.occupancyTrend || [];
  const revenueByMonth = billingData?.series?.revenueByMonth || [];
  const reservationsByPeriod = operationsData?.series?.reservationsByPeriod || [];
  const maintenanceByType = operationsData?.series?.maintenanceByType || [];
  const scopeBranch =
    dashboardData?.scope?.branch ||
    occupancyData?.scope?.branch ||
    billingData?.scope?.branch ||
    branch;
  const isError = [
    dashboardQuery.isError,
    occupancyQuery.isError,
    billingQuery.isError,
    operationsQuery.isError,
    financialsQuery.isError,
  ].some(Boolean);

  const occAnomalies = detectOccupancyAnomalies(occupancyData?.kpis || dashboardData?.kpis || {});
  const billAnomalies = detectBillingAnomalies(billingData?.kpis || financialsData?.kpis || {});
  const opsAnomalies = detectOperationsAnomalies(operationsData?.kpis || dashboardData?.kpis || {});

  const metricCards = [
    {
      icon: Bed,
      tone: "blue",
      label: "Consolidated Occupancy",
      value: occupancyData?.kpis?.occupancyRateLabel || dashboardData?.kpis?.occupancyRateLabel || "0%",
      trend: "Cross-branch average",
      anomalyBadge: occAnomalies.occupancyRate,
    },
    {
      icon: PhilippinePeso,
      tone: "green",
      label: "Consolidated Revenue",
      value: (billingData?.kpis?.collectedRevenueLabel || dashboardData?.kpis?.revenueLabel || "PHP 0").replace("PHP ", "₱"),
      trend: "Total collections",
      anomalyBadge: billAnomalies.collectionRate,
    },
    {
      icon: AlertCircle,
      tone: "rose",
      label: "Overdue Exposure",
      value: (financialsData?.kpis?.outstandingBalanceLabel || billingData?.kpis?.outstandingBalanceLabel || "PHP 0").replace("PHP ", "₱"),
      trend: "Pending balance",
      changeType: "down",
      anomalyBadge: billAnomalies.overdueAmount,
    },
    {
      icon: Wrench,
      tone: "purple",
      label: "Active Work Orders",
      value: dashboardData?.kpis?.activeTickets ?? operationsData?.kpis?.maintenanceRequests ?? 0,
      trend: "All branches",
      anomalyBadge: opsAnomalies.maintenanceRequests,
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      branchRows,
      [
        { key: "label", label: "Branch" },
        { key: "occupancyRate", label: "Occupancy Rate", formatter: (value) => `${value}%` },
        { key: "totalCapacity", label: "Total Capacity" },
        { key: "availableBeds", label: "Available Beds" },
        { key: "collectedRevenue", label: "Collected", formatter: (value) => formatPeso(value) },
        { key: "overdueAmount", label: "Overdue Amount", formatter: (value) => formatPeso(value) },
        { key: "collectionRate", label: "Collection Rate", formatter: (value) => `${value}%` },
        { key: "activeTickets", label: "Open Maintenance" },
        { key: "inquiries", label: "Inquiries" },
      ],
      `consolidated-report-${range}`,
    );
  };

  const exportPdf = () => {
    const insight = insightsQuery.data?.insight || insightsQuery.data || {};
    handlePdfExport({
      title: "Consolidated Owner Report",
      subtitle: `${buildRangeLabel(range)} operations / ${buildRangeLabel(monthRange)} billing - ${formatBranch(scopeBranch)}`,
      filename: `consolidated-report-${range}.pdf`,
      reportType: "Consolidated",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: "",
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insight?.headline || "Consolidated summary",
        summary: insight?.summary || "",
        confidence: insight?.confidence === "high" ? 85
          : insight?.confidence === "medium" ? 60
          : insight?.confidence === "low" ? 35
          : 0,
        confidenceLabel: insight?.confidence
          ? `${insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}`
          : "",
        standout: insight?.keyFindings || [],
        watch: insight?.riskAlerts || [],
        nextSteps: insight?.recommendedActions || [],
      },
      sections: [
        {
          title: "Branch Comparison",
          type: "table",
          headers: ["Branch", "Occupancy", "Collected", "Overdue", "Open Maintenance"],
          rows: branchRows.map((item) => ({
            Branch: item.label,
            Occupancy: `${item.occupancyRate || 0}%`,
            Collected: formatPeso(item.collectedRevenue || 0),
            Overdue: formatPeso(item.overdueAmount || 0),
            "Open Maintenance": item.activeTickets || 0,
          })),
        },
        {
          title: "Operations Snapshot",
          type: "table",
          headers: ["Metric", "Value"],
          rows: [
            { Metric: "Reservations", Value: operationsData?.kpis?.reservations || 0 },
            { Metric: "Inquiries", Value: operationsData?.kpis?.inquiries || 0 },
            { Metric: "Maintenance requests", Value: operationsData?.kpis?.maintenanceRequests || 0 },
            { Metric: "On-time fix rate", Value: operationsData?.kpis?.slaComplianceRateLabel || "0%" },
          ],
        },
        {
          title: "Collection Trend",
          type: "table",
          headers: ["Month", "Collected", "Billed"],
          rows: revenueByMonth.map((item) => ({
            Month: item.label,
            Collected: formatPeso(item.collectedRevenue || 0),
            Billed: formatPeso(item.billedAmount || 0),
          })),
        },
      ],
    });
  };

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "NAVIGATE_TAB" && action.filterValue) {
      navigate(buildAnalyticsDetailsHref({ tab: action.filterValue, range, branch, isOwner }));
    }
  };

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      {isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
          Some consolidated report sections could not be loaded. Available sections still show live data.
        </div>
      ) : null}

      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="consolidated"
        summaryTitle="Consolidated Portfolio Intelligence"
        reportType="hub"
        range={range}
        branch={branch}
        data={insightsQuery.data}
        isLoading={insightsQuery.isLoading}
        isError={insightsQuery.isError}
        suggestedPrompts={CONSOLIDATED_PROMPTS}
        onExecuteAction={handleExecuteAction}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <ReportChartPanel
          title="Branch performance"
          subtitle="Occupancy, collections, and maintenance pressure by branch"
          actions={<DrilldownLink tab="financials" range={range} branch={branch} label="Open financials" />}
        >
          <AnalyticsComparisonChart
            data={branchRows.map((item) => ({
              label: item.label,
              occupancy: item.occupancyRate || 0,
              collection: item.collectionRate || 0,
              maintenance: item.activeTickets || 0,
            }))}
            bars={[
              { key: "occupancy", label: "Occupancy %", color: "#2563eb" },
              { key: "collection", label: "Collection %", color: "#16a34a" },
              { key: "maintenance", label: "Open maintenance", color: "#f59e0b" },
            ]}
            emptyTitle="No branch comparison data"
            emptyDescription="Branch comparisons will appear once branch-scoped activity exists."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Collection trend"
          subtitle="Collected and billed amounts across the selected owner scope"
          actions={<DrilldownLink tab="billing" range={range} branch={branch} label="Open billing" />}
        >
          <AnalyticsBarChart
            data={revenueByMonth.map((item) => ({
              label: item.label,
              collected: item.collectedRevenue,
              billed: item.billedAmount,
            }))}
            bars={[
              { key: "collected", label: "Collected", color: "#16a34a" },
              { key: "billed", label: "Billed", color: "#0f766e" },
            ]}
            valueFormatter={(value) => formatPeso(value)}
            emptyTitle="No collection trend"
            emptyDescription="Collection history will appear once billing records exist for this scope."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <ReportChartPanel
          title="Occupancy trend"
          subtitle="Daily occupancy rate for the selected branch scope"
          actions={<DrilldownLink tab="occupancy" range={range} branch={branch} label="Open occupancy" />}
        >
          <AnalyticsLineChart
            data={occupancyTrend.map((item) => ({ label: item.label, occupancy: item.totalRate }))}
            lines={[{ key: "occupancy", label: "Occupancy rate", color: "#2563eb" }]}
            valueFormatter={(value) => `${value}%`}
            emptyTitle="No occupancy trend"
            emptyDescription="Occupancy trend data will appear after room history is available."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Operations trend"
          subtitle="Reservation activity and maintenance categories"
          actions={<DrilldownLink tab="operations" range={range} branch={branch} label="Open operations" />}
        >
          <div className="flex flex-col gap-3">
            <AnalyticsBarChart
              data={reservationsByPeriod.map((item) => ({ label: item.label, reservations: item.count }))}
              bars={[{ key: "reservations", label: "Reservations", color: "#f59e0b" }]}
              height={140}
              emptyTitle="No reservation trend"
              emptyDescription="Reservation activity will appear once records exist in this range."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {maintenanceByType.slice(0, 3).map((item) => (
                <div key={item.label} className="bg-muted/40 border border-border rounded-lg p-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">{item.label}</span>
                  <div className="text-[16px] font-semibold text-foreground mt-0.5">{item.count}</div>
                  <p className="text-[10px] text-muted-foreground">tickets</p>
                </div>
              ))}
              {!maintenanceByType.length ? (
                <p className="text-xs text-muted-foreground italic col-span-3">No maintenance categories for this scope.</p>
              ) : null}
            </div>
          </div>
        </ReportChartPanel>
      </div>

      <ReportChartPanel
        title="Executive Branch Snapshot"
        subtitle="A compact owner summary matrix for cross-branch portfolio review"
        actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {branchRows.map((item) => (
            <div key={item.branch} className="bg-muted/30 border border-border rounded-lg p-3.5 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-xs font-bold text-foreground">{item.label}</span>
                <div className="text-[18px] font-semibold text-foreground mt-1">
                  {item.occupancyRate || 0}% <span className="text-xs font-normal text-muted-foreground">occupancy</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/60">
                <div className="flex justify-between">
                  <span>Collected:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPeso(item.collectedRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overdue:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{formatPeso(item.overdueAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Available Beds:</span>
                  <span className="font-medium text-foreground">{item.availableBeds || 0}</span>
                </div>
              </div>
            </div>
          ))}
          {!branchRows.length ? (
            <p className="text-xs text-muted-foreground italic col-span-3">No branch rows are available for this scope yet.</p>
          ) : null}
        </div>
      </ReportChartPanel>
    </div>
  );
}
