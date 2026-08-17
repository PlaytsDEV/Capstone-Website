import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  PhilippinePeso,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { useBillingReport, useFinancialsAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsComparisonChart,
  AnalyticsDonutChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  PeriodComparisonCard,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import {
  buildRangeLabel,
  formatBranch,
  formatDate,
  formatPeso,
} from "./reportCommon";
import {
  AnalyticsInsightSection,
  AnalyticsTableToolbar,
  buildInsightPdfSections,
  buildBranchControl,
  CardFilterSelect,
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  RANGE_OPTIONS_LONG,
  RANGE_OPTIONS_SHORT,
  unwrapTableRows,
  useReportInsights,
  detectBillingAnomalies,
  getDynamicBillingPrompts,
} from "./analyticsTabShared";

const OVERDUE_COLUMNS = [
  { key: "tenantName", label: "Tenant", sortable: true },
  { key: "roomName", label: "Room", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch) },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {row.status || "Overdue"}
      </span>
    ),
  },
  {
    key: "dueDate",
    label: "Due Date",
    render: (row) => formatDate(row.dueDate),
  },
  {
    key: "daysOverdue",
    label: "Days Overdue",
    sortable: true,
    render: (row) => {
      const isCritical = (row.daysOverdue || 0) > 30;
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            isCritical ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-rose-500" : "bg-amber-500"}`} />
          {row.daysOverdue} days
        </span>
      );
    },
  },
  {
    key: "balance",
    label: "Balance",
    render: (row) => (
      <span className="font-bold text-foreground tabular-nums">
        {formatPeso(row.balance)}
      </span>
    ),
    sortable: true,
  },
];

export default function AnalyticsBillingTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);

  const [revenueRange, setRevenueRange] = useState(null);
  const activeRevenueRange = revenueRange || range;

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const revenueParams = useMemo(
    () => ({
      range: activeRevenueRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeRevenueRange],
  );

  const { data, isLoading, isError } = useBillingReport(params);
  const { data: revenueData } = useBillingReport(revenueParams);
  const { data: financialsData } = useFinancialsAnalytics(params);

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "billing",
    range,
    branch: isOwner ? branch : undefined,
  });

  const overdueAccounts = unwrapTableRows(data?.tables?.overdueAccounts);
  const revenueByMonth = (revenueData || data)?.series?.revenueByMonth || [];
  const utilityBreakdown = (revenueData || data)?.series?.utilityBreakdown || [];
  const statusDistribution = data?.series?.statusDistribution || [];
  const overdueAging = data?.series?.overdueAging || [];
  const branchComparison = financialsData?.series?.branchComparison || [];
  const insight = insightData?.insight;

  const filteredOverdue = useMemo(() => {
    return overdueAccounts.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.tenantName && String(item.tenantName).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.roomName && String(item.roomName).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (item.status && String(item.status).toLowerCase() === statusFilter.toLowerCase());

      return matchSearch && matchStatus;
    });
  }, [overdueAccounts, searchQuery, statusFilter]);

  const billingPrompts = useMemo(
    () => getDynamicBillingPrompts(data),
    [data],
  );

  const kpis = data?.kpis || {};

  const collectedStr = kpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0";
  const billedStr = kpis.billedAmountLabel?.replace("PHP ", "₱") || "₱0";
  const overdueStr = kpis.outstandingBalanceLabel?.replace("PHP ", "₱") || "₱0";
  const rateStr = kpis.collectionRateLabel || "0%";

  const revenueDelta = kpis.comparison?.collectedRevenue || {
    label: "+0%",
    changeType: "neutral",
    text: "vs prev period",
  };
  const billedDelta = kpis.comparison?.billedAmount || {
    label: "+0%",
    changeType: "neutral",
    text: "vs prev period",
  };
  const rateDelta = kpis.comparison?.collectionRate || {
    label: "+0 pp",
    changeType: "neutral",
    text: "vs prev period",
  };
  const balanceDelta = kpis.comparison?.outstandingBalance || {
    label: "0%",
    changeType: "neutral",
    text: "vs prev period",
  };

  const anomalies = detectBillingAnomalies(kpis);

  const metricCards = [
    {
      icon: PhilippinePeso,
      tone: "green",
      label: "Revenue Collected",
      value: collectedStr,
      trend: revenueDelta.text || `${revenueDelta.label || "+0%"} vs prev period`,
      changeType: revenueDelta.changeType || "neutral",
    },
    {
      icon: Receipt,
      tone: "teal",
      label: "Total Billed",
      value: billedStr,
      trend: billedDelta.text || `${billedDelta.label || "+0%"} vs prev period`,
      changeType: billedDelta.changeType || "neutral",
    },
    {
      icon: AlertCircle,
      tone: "rose",
      label: "Outstanding Balance",
      value: overdueStr,
      trend: balanceDelta.text || `${balanceDelta.label || "0%"} vs prev period`,
      changeType: balanceDelta.changeType === "up" ? "down" : balanceDelta.changeType === "down" ? "up" : "neutral",
      anomalyBadge: anomalies.overdueAmount,
    },
    {
      icon: TrendingUp,
      tone: "amber",
      label: "Collection Rate",
      value: rateStr,
      trend: rateDelta.text || `${rateDelta.label || "+0 pp"} vs prev period`,
      changeType: rateDelta.changeType || "neutral",
      anomalyBadge: anomalies.collectionRate,
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      filteredOverdue,
      [
        { key: "tenantName", label: "Tenant" },
        { key: "roomName", label: "Room" },
        { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
        { key: "status", label: "Status" },
        { key: "dueDate", label: "Due Date", formatter: (value) => formatDate(value) },
        { key: "daysOverdue", label: "Days Overdue" },
        { key: "balance", label: "Balance (₱)", formatter: (value) => formatPeso(value) },
      ],
      `lilycrest-billing-${branch || "all"}-${range}`,
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Billing & Revenue Analytics Report",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `lilycrest-billing-${branch || "all"}-${range}.pdf`,
      reportType: "Billing",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: item.trend,
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insight?.headline || "Billing summary",
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
          title: "Revenue by Month",
          type: "table",
          headers: ["Month", "Collected", "Billed"],
          rows: revenueByMonth.map((item) => ({
            Month: item.label,
            Collected: formatPeso(item.collectedRevenue),
            Billed: formatPeso(item.billedAmount),
          })),
        },
        {
          title: "Utility & Submetering Breakdown",
          type: "table",
          headers: ["Month", "Base Rent", "Electricity Submeter", "Water & Other", "Total Billed"],
          rows: utilityBreakdown.map((item) => ({
            Month: item.label,
            "Base Rent": formatPeso(item.rentAmount),
            "Electricity Submeter": formatPeso(item.electricityAmount),
            "Water & Other": formatPeso(item.waterAmount + (item.otherAmount || 0)),
            "Total Billed": formatPeso(item.totalAmount),
          })),
        },
        {
          title: "Overdue Aging",
          type: "table",
          headers: ["Aging Bracket", "Outstanding Amount"],
          rows: overdueAging.map((item) => ({
            "Aging Bracket": item.label,
            "Outstanding Amount": formatPeso(item.amount),
          })),
        },
        {
          title: "Top Overdue Accounts",
          type: "table",
          headers: ["Tenant", "Room", "Branch", "Balance", "Days Overdue"],
          rows: filteredOverdue.slice(0, 10).map((item) => ({
            Tenant: item.tenantName || "-",
            Room: item.roomName || "-",
            Branch: formatBranch(item.branch),
            Balance: formatPeso(item.balance),
            "Days Overdue": item.daysOverdue || 0,
          })),
        },
      ],
    });
  };

  useEffect(() => {
    if (registerExport) {
      registerExport({ exportCsv, exportPdf });
    }
  }, [registerExport, exportCsv, exportPdf]);

  if (isLoading && !data) {
    return <AdminAnalyticsDetailSkeleton tab="billing" isOwner={isOwner} />;
  }

  const periodComparisonRows = [
    {
      label: "Revenue collected",
      sublabel: "vs previous period",
      value: collectedStr,
      change: revenueDelta.label,
      changeType: revenueDelta.changeType || "neutral",
    },
    {
      label: "Total billed",
      sublabel: "vs previous period",
      value: billedStr,
      change: billedDelta.label,
      changeType: billedDelta.changeType || "neutral",
    },
    {
      label: "Collection rate",
      sublabel: "vs previous period",
      value: rateStr,
      change: rateDelta.label,
      changeType: rateDelta.changeType || "neutral",
    },
    {
      label: "Outstanding balance",
      sublabel: "vs previous period",
      value: overdueStr,
      change: balanceDelta.label,
      changeType: balanceDelta.changeType === "up" ? "down" : balanceDelta.changeType === "down" ? "up" : "neutral",
    },
  ];

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "FILTER_STATUS" && action.filterValue) {
      setStatusFilter(action.filterValue);
      setPage(1);
    } else if (action.actionType === "SEARCH" && action.filterValue) {
      setSearchQuery(action.filterValue);
      setPage(1);
    }
  };

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="billing"
        summaryTitle="Billing & Financial Intelligence"
        reportType="billing"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={billingPrompts}
        onExecuteAction={handleExecuteAction}
      />

      {isOwner && branchComparison.length > 0 && (
        <div>
          <ReportChartPanel title="Branch financial comparison" subtitle="Collections, overdue exposure, and collection rate by branch">
            <AnalyticsComparisonChart
              data={branchComparison.map((item) => ({
                label: item.label,
                collected: item.collectedRevenue,
                overdue: item.overdueAmount,
              }))}
              bars={[
                { key: "collected", label: "Collected", color: "#16a34a" },
                { key: "overdue", label: "Overdue", color: "#dc2626" },
              ]}
              valueFormatter={(value) => formatPeso(value)}
              emptyTitle="No branch comparison data"
              emptyDescription="Branch financial comparison will appear once billing records are available."
            />
          </ReportChartPanel>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Revenue collections"
          subtitle="Billed vs collected — monthly"
          actions={
            <CardFilterSelect
              value={activeRevenueRange}
              onChange={setRevenueRange}
              options={RANGE_OPTIONS_LONG}
            />
          }
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
            valueFormatter={(val) => formatPeso(val)}
            emptyTitle="No revenue data"
            emptyDescription="Monthly revenue trends will appear once billing history is recorded."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Utility & Submetering Breakdown"
          subtitle="Monthly billed split: Base Rent vs Electric Submetering vs Water & Other"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md border border-border bg-muted/30">
              Rent: <strong className="text-foreground">{formatPeso(kpis.totalRentBilled || 0)}</strong>
            </span>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md border border-border bg-amber-50/50 dark:bg-amber-950/30">
              Electricity: <strong>{formatPeso(kpis.totalElectricityBilled || 0)}</strong>
            </span>
            <span className="text-[11px] font-medium text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-md border border-border bg-sky-50/50 dark:bg-sky-950/30">
              Water & Fees: <strong>{formatPeso(kpis.totalWaterBilled || 0)}</strong>
            </span>
          </div>
          <AnalyticsBarChart
            data={utilityBreakdown.map((item) => ({
              label: item.label,
              rent: item.rentAmount,
              electricity: item.electricityAmount,
              water: item.waterAmount + (item.otherAmount || 0),
            }))}
            bars={[
              { key: "rent", label: "Base Rent", color: "#0f766e" },
              { key: "electricity", label: "Electricity", color: "#f59e0b" },
              { key: "water", label: "Water & Fees", color: "#0284c7" },
            ]}
            valueFormatter={(val) => formatPeso(val)}
            emptyTitle="No utility breakdown data"
            emptyDescription="Submetered utility and rent splits will appear once billing records are generated."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Payment status distribution" subtitle="Current status of all generated bills">
          <AnalyticsDonutChart
            data={statusDistribution.map((item) => ({
              label: item.label,
              value: item.count,
            }))}
            centerLabel={{
              value: statusDistribution.reduce((sum, i) => sum + i.count, 0),
              label: "Bills",
            }}
            emptyTitle="No bill status data"
            emptyDescription="Bill status distribution will populate as billing periods run."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Overdue aging" subtitle="Unpaid balances bucketed by delay">
          <AnalyticsBarChart
            data={overdueAging.map((item) => ({
              label: item.label,
              amount: item.amount,
            }))}
            bars={[{ key: "amount", label: "Overdue Amount", color: "#f59e0b" }]}
            valueFormatter={(val) => formatPeso(val)}
            emptyTitle="No overdue aging data"
            emptyDescription="Overdue aging distribution will appear when overdue bills exist."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PeriodComparisonCard
          title="Period comparison"
          subtitle="Current vs previous period"
          rows={periodComparisonRows}
        />
      </div>

      <ReportChartPanel
        title="Overdue Accounts Ledger"
        subtitle="Active tenant accounts with outstanding balances and aging brackets"
        actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
      >
        <AnalyticsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          searchPlaceholder="Search tenant or room..."
          filters={[
            {
              key: "statusFilter",
              label: "Status",
              value: statusFilter,
              onChange: (val) => {
                setStatusFilter(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All Statuses" },
                { value: "overdue", label: "Overdue" },
                { value: "unpaid", label: "Unpaid" },
                { value: "partial", label: "Partial" },
              ],
            },
          ]}
          hasActiveFilters={Boolean(searchQuery || statusFilter !== "all")}
          onResetFilters={() => {
            setSearchQuery("");
            setStatusFilter("all");
            setPage(1);
          }}
          extraActions={
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filteredOverdue.length} of {overdueAccounts.length} accounts
            </span>
          }
        />

        <DataTable
          columns={OVERDUE_COLUMNS}
          data={filteredOverdue}
          loading={isLoading}
          pagination={{
            page,
            pageSize,
            total: filteredOverdue.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyState={{
            title: isError ? "Billing report unavailable" : "No overdue accounts",
            description: isError
              ? "The billing report could not be loaded."
              : "No overdue tenant accounts found matching your filter.",
          }}
        />
      </ReportChartPanel>
    </div>
  );
}
