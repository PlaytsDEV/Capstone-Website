import { useEffect, useMemo, useState } from "react";
import { AlertCircle, PhilippinePeso, Receipt, TrendingUp } from "lucide-react";
import { useFinancialsAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsComparisonChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import { buildRangeLabel, formatBranch, formatPeso, cleanCurrencyLabel } from "./reportCommon";
import {
  AnalyticsInsightSection,
  AnalyticsTableToolbar,
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  RANGE_OPTIONS_LONG,
  unwrapTableRows,
  useReportInsights,
  detectBillingAnomalies,
  getDynamicFinancialsPrompts,
} from "./analyticsTabShared";

const OVERDUE_ROOM_COLUMNS = [
  { key: "roomName", label: "Room", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch), sortable: true },
  { key: "tenantCount", label: "Tenants", sortable: true },
  { key: "overdueCount", label: "Overdue Bills", sortable: true },
  {
    key: "outstandingBalance",
    label: "Outstanding",
    render: (row) => formatPeso(row.outstandingBalance),
    sortable: true,
  },
];

export default function AnalyticsFinancialsTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [exposureFilter, setExposureFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);

  const params = useMemo(() => ({ branch, range }), [branch, range]);
  const { data, isLoading, isError } = useFinancialsAnalytics(params);

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "financials",
    range,
    branch,
  });
  const branchComparison = data?.series?.branchComparison || [];
  const revenueByMonth = data?.series?.revenueByMonth || [];
  const overdueAging = data?.series?.overdueAging || [];
  const overdueAccounts = data?.tables?.overdueRooms;
  const overdueRooms = unwrapTableRows(overdueAccounts);

  const filteredOverdueRooms = useMemo(() => {
    return overdueRooms.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.roomName && String(item.roomName).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.branch && String(item.branch).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchExposure =
        exposureFilter === "all" ||
        (exposureFilter === "multiple" && (item.overdueCount ?? 0) > 1) ||
        (exposureFilter === "single" && (item.overdueCount ?? 0) === 1);

      return matchSearch && matchExposure;
    });
  }, [overdueRooms, searchQuery, exposureFilter]);

  const financialsPrompts = useMemo(
    () => getDynamicFinancialsPrompts(data),
    [data],
  );

  const anomalies = detectBillingAnomalies(data?.kpis);

  const metricCards = [
    {
      icon: PhilippinePeso,
      label: "Collected",
      value: (data?.kpis?.collectedRevenueLabel || "PHP 0").replace("PHP ", "₱"),
      tone: "green",
      trend: "Total collected",
    },
    {
      icon: AlertCircle,
      label: "Outstanding",
      value: (data?.kpis?.outstandingBalanceLabel || "PHP 0").replace("PHP ", "₱"),
      tone: "rose",
      trend: "Pending dues",
      changeType: "down",
      anomalyBadge: anomalies.overdueAmount,
    },
    {
      icon: Receipt,
      label: "Overdue",
      value: (data?.kpis?.overdueAmountLabel || "PHP 0").replace("PHP ", "₱"),
      tone: "amber",
      trend: "Late payments",
      anomalyBadge: anomalies.overdueAmount,
    },
    {
      icon: TrendingUp,
      label: "Collection Rate",
      value: data?.kpis?.collectionRateLabel || "0%",
      tone: "blue",
      trend: "Target: > 90%",
      anomalyBadge: anomalies.collectionRate,
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      filteredOverdueRooms,
      [
        { key: "roomName", label: "Room" },
        { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
        { key: "tenantCount", label: "Tenants" },
        { key: "overdueCount", label: "Overdue Bills" },
        { key: "outstandingBalance", label: "Outstanding (₱)", formatter: (value) => formatPeso(value) },
      ],
      `lilycrest-financials-${branch || "all"}-${range}`,
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Financial Analytics Overview",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `lilycrest-financials-${branch || "all"}-${range}.pdf`,
      reportType: "Financials",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: "",
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insightData?.insight?.headline || "AI Financial Summary",
        summary: insightData?.insight?.summary || "",
        confidence: insightData?.insight?.confidence === "high" ? 85
          : insightData?.insight?.confidence === "medium" ? 60
          : insightData?.insight?.confidence === "low" ? 35
          : 0,
        confidenceLabel: insightData?.insight?.confidence
          ? `${insightData.insight.confidence.charAt(0).toUpperCase() + insightData.insight.confidence.slice(1)}`
          : "",
        standout: insightData?.insight?.keyFindings || [],
        watch: insightData?.insight?.riskAlerts || [],
        nextSteps: insightData?.insight?.recommendedActions || [],
      },
      sections: [
        {
          title: "Branch Comparison",
          type: "table",
          headers: ["Branch", "Collected", "Overdue", "Collection Rate"],
          rows: branchComparison.map((item) => ({
            Branch: item.label,
            Collected: formatPeso(item.collectedRevenue),
            Overdue: formatPeso(item.overdueAmount),
            "Collection Rate": `${item.collectionRate}%`,
          })),
        },
        {
          title: "Monthly Collections",
          type: "table",
          headers: ["Month", "Collected", "Billed"],
          rows: revenueByMonth.map((item) => ({
            Month: item.label,
            Collected: formatPeso(item.collectedRevenue),
            Billed: formatPeso(item.billedAmount),
          })),
        },
        {
          title: "Top Overdue Rooms",
          type: "table",
          headers: ["Room", "Branch", "Outstanding", "Overdue Bills"],
          rows: filteredOverdueRooms.slice(0, 12).map((item) => ({
            Room: item.roomName,
            Branch: formatBranch(item.branch),
            Outstanding: formatPeso(item.outstandingBalance),
            "Overdue Bills": item.overdueCount ?? 0,
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
    return <AdminAnalyticsDetailSkeleton tab="financials" />;
  }

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "FILTER_STATUS" && action.filterValue) {
      setExposureFilter(action.filterValue);
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
        reportLabel="financials"
        summaryTitle="Financial Summary"
        reportType="financials"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={financialsPrompts}
        onExecuteAction={handleExecuteAction}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChartPanel title="Branch comparison" subtitle="Collections, overdue exposure, and collection rate by branch">
          <AnalyticsComparisonChart
            data={branchComparison.map((item) => ({
              label: item.label,
              collected: item.collectedRevenue,
              overdue: item.overdueAmount,
            }))}
            bars={[
              { key: "collected", label: "Collected", color: "#2563eb" },
              { key: "overdue", label: "Overdue", color: "#dc2626" },
            ]}
            valueFormatter={(value) => formatPeso(value)}
            emptyTitle="No branch comparison data"
            emptyDescription="Branch financial comparison will appear once billing records are available."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Overdue aging" subtitle="Outstanding balances bucketed by days overdue">
          <AnalyticsBarChart
            data={overdueAging.map((item) => ({ label: item.label, amount: item.amount }))}
            bars={[{ key: "amount", label: "Outstanding", color: "#f97316" }]}
            valueFormatter={(value) => formatPeso(value)}
            emptyTitle="No overdue aging data"
            emptyDescription="There are no overdue balances for the selected scope."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChartPanel title="Monthly collections" subtitle="Collected payments over the selected period">
          <AnalyticsBarChart
            data={revenueByMonth.map((item) => ({
              label: item.label,
              collected: item.collectedRevenue,
              billed: item.billedAmount,
            }))}
            bars={[
              { key: "collected", label: "Collected", color: "#0f766e" },
              { key: "billed", label: "Billed", color: "#2563eb" },
            ]}
            valueFormatter={(value) => formatPeso(value)}
            emptyTitle="No monthly collections data"
            emptyDescription="Collection history will appear once billing records are present."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Net position" subtitle="Collected payments less currently overdue balances">
          {(() => {
            const netPosition = typeof data?.kpis?.netPosition === "number"
              ? data.kpis.netPosition
              : (data?.kpis?.collectedRevenue || 0) - (data?.kpis?.overdueAmount || 0);
            const isDeficit = netPosition < 0;
            const latestMonth = revenueByMonth.at(-1);

            return (
              <div className="flex flex-col gap-4 w-full h-full justify-between py-0.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-card dark:bg-card/40 border border-border rounded-xl p-4 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Net Position
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                          isDeficit ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isDeficit ? "bg-rose-500" : "bg-emerald-500"}`} />
                        {isDeficit ? "Deficit" : "Surplus"}
                      </span>
                    </div>

                    <div>
                      <div
                        className={`text-2xl font-bold tracking-tight tabular-nums ${
                          isDeficit ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatPeso(netPosition)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {isDeficit
                          ? "Overdue balances exceed collected revenue"
                          : "Positive operating collections balance"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-card dark:bg-card/40 border border-border rounded-xl p-4 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Latest Billing Month
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Current Cycle
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-bold tracking-tight text-foreground">
                        {latestMonth?.label || "-"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-normal">
                        Billed <span className="font-semibold text-foreground">{formatPeso(latestMonth?.billedAmount || 0)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 border border-border rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground font-medium block">Total Collected</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatPeso(data?.kpis?.collectedRevenue || 0)}
                    </span>
                  </div>

                  <div className="space-y-0.5 border-x border-border/60">
                    <span className="text-[11px] text-muted-foreground font-medium block">Overdue Exposure</span>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      -{formatPeso(data?.kpis?.overdueAmount || 0)}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground font-medium block">Collection Rate</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {data?.kpis?.collectionRate || 0}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </ReportChartPanel>
      </div>

      <ReportChartPanel title="Overdue exposure tables" subtitle="Rooms carrying the highest unpaid balance">
        <AnalyticsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          searchPlaceholder="Search room or branch..."
          filters={[
            {
              key: "exposureFilter",
              label: "Exposure Level",
              value: exposureFilter,
              onChange: (val) => {
                setExposureFilter(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All Overdue Rooms" },
                { value: "single", label: "Single Overdue Bill" },
                { value: "multiple", label: "Multiple Overdue Bills (Critical)" },
              ],
            },
          ]}
          hasActiveFilters={Boolean(searchQuery || exposureFilter !== "all")}
          onResetFilters={() => {
            setSearchQuery("");
            setExposureFilter("all");
            setPage(1);
          }}
            extraActions={
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                  Showing {filteredOverdueRooms.length} of {overdueRooms.length} rooms
                </span>
                <ExportButtons onCsv={exportCsv} onPdf={exportPdf} />
              </div>
            }
          />
          <DataTable
            columns={OVERDUE_ROOM_COLUMNS}
            data={filteredOverdueRooms}
            loading={isLoading}
            pagination={{
              page,
              pageSize,
              total: filteredOverdueRooms.length,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{
              title: isError ? "Financial overview unavailable" : "No overdue rooms",
              description: isError
                ? "The financial overview could not be loaded."
                : "No overdue room exposure was found for the selected filter.",
            }}
          />
        </ReportChartPanel>
      </div>
    );
  }
