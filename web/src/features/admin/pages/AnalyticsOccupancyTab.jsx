import { useEffect, useMemo, useState } from "react";
import {
  Bed,
  Building,
  DoorOpen,
  Users,
} from "lucide-react";
import {
  useOccupancyForecast,
  useOccupancyReport,
  useOccupancyRateHistory,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import { buildRangeLabel, formatBranch } from "./reportCommon";
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
  RANGE_OPTIONS_SHORT,
  unwrapTableRows,
  useReportInsights,
  detectOccupancyAnomalies,
  getDynamicOccupancyPrompts,
} from "./analyticsTabShared";
import "../styles/design-tokens.css";
import "../styles/admin-reports.css";

const INVENTORY_COLUMNS = [
  { key: "roomNumber", label: "Room", sortable: true },
  { key: "roomTypeLabel", label: "Type", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch), formatter: (v) => formatBranch(v) },
  { key: "capacity", label: "Capacity", sortable: true },
  { key: "occupiedBeds", label: "Occupied", sortable: true },
  { key: "availableBeds", label: "Available", sortable: true },
  { key: "unavailableBeds", label: "Unavailable", sortable: true },
  {
    key: "occupancyRate",
    label: "Rate",
    render: (row) => `${row.occupancyRate}%`,
    formatter: (v) => `${v}%`,
    sortable: true,
  },
  {
    key: "status",
    label: "Status",
    formatter: (v, row) => (row.occupancyRate >= 100 ? "Full" : row.occupiedBeds === 0 ? "Vacant" : "Partial"),
    render: (row) => {
      if (row.occupancyRate >= 100) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Full
          </span>
        );
      }
      if (row.occupiedBeds === 0) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Vacant
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          Partial
        </span>
      );
    },
  },
];

function ForecastCards({ forecast }) {
  const projectedMonths = forecast?.projected || [];
  const recommendations = forecast?.insights?.recommendations || [];

  if (!forecast?.sufficientHistory) {
    return (
      <p className="text-xs text-muted-foreground italic py-4">
        {forecast?.insights?.headline || "Insufficient history to forecast occupancy."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 py-1">
      {forecast.insights?.headline && (
        <p className="text-xs font-medium text-foreground">{forecast.insights.headline}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {projectedMonths.map((item) => (
          <div key={item.month} className="bg-muted/40 rounded-lg p-3 border border-border flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</span>
            <div className="text-[20px] font-bold text-foreground">{item.projectedOccupancyRate}%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Baseline <span className="font-medium text-foreground">{item.baselineRate}%</span> • Seasonal <span className="font-medium text-foreground">{item.seasonalMultiplier}x</span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-col gap-1.5">
        {recommendations.slice(0, 2).map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-blue-50/60 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/60">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsOccupancyTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);

  const [occupancyMetric, setOccupancyMetric] = useState("rate");
  const [trendRange, setTrendRange] = useState(null);
  const [forecastRange, setForecastRange] = useState(null);
  const [historyRange, setHistoryRange] = useState(null);

  const activeTrendRange = trendRange || range;
  const activeForecastRange = forecastRange || range;
  const activeHistoryRange = historyRange || range;

  const mainParams = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const trendParams = useMemo(
    () => ({
      range: activeTrendRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeTrendRange],
  );

  const forecastParams = useMemo(
    () => ({
      range: activeForecastRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeForecastRange],
  );

  const historyParams = useMemo(
    () => ({
      range: activeHistoryRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeHistoryRange],
  );

  const { data, isLoading, isError } = useOccupancyReport(mainParams);
  const { data: trendData } = useOccupancyReport(trendParams);
  const { data: forecast } = useOccupancyForecast(forecastParams);
  const { data: historyData } = useOccupancyRateHistory(historyParams);

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "occupancy",
    range,
    branch: isOwner ? branch : undefined,
  });

  const kpis = data?.kpis || {};
  const series = data?.series || {};
  const trend = (trendData?.series || series).occupancyTrend || [];
  const roomTypes = series.roomTypes || [];
  const forecastSeries = forecast?.series || [];
  const inventory = unwrapTableRows(data?.tables?.inventory);

  const historySeries = historyData?.series || [];
  const historyKpis = historyData?.kpis || {};
  const cohorts = historyData?.cohorts || {};

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.roomNumber && String(item.roomNumber).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.roomTypeLabel && String(item.roomTypeLabel).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType =
        typeFilter === "all" ||
        (item.type && String(item.type).toLowerCase() === typeFilter.toLowerCase()) ||
        (item.roomTypeLabel && String(item.roomTypeLabel).toLowerCase().includes(typeFilter.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "full" && item.occupancyRate >= 100) ||
        (statusFilter === "vacant" && item.occupiedBeds === 0) ||
        (statusFilter === "partial" && item.occupiedBeds > 0 && item.occupancyRate < 100);

      return matchSearch && matchType && matchStatus;
    });
  }, [inventory, searchQuery, typeFilter, statusFilter]);

  const occupancyPrompts = useMemo(
    () => getDynamicOccupancyPrompts(data, forecast),
    [data, forecast],
  );

  const occupancyDelta = kpis.comparison?.occupancyRate || {
    label: "+0 pp",
    changeType: "neutral",
    text: "vs prev period",
  };

  const anomalies = detectOccupancyAnomalies(kpis);

  const metricCards = [
    {
      icon: Bed,
      tone: "blue",
      label: "Occupancy Rate",
      value: kpis.occupancyRateLabel || "0%",
      trend: occupancyDelta.text || `${occupancyDelta.label || "+0 pp"} vs prev period`,
      changeType: occupancyDelta.changeType || "neutral",
      anomalyBadge: anomalies.occupancyRate,
    },
    {
      icon: Users,
      tone: "green",
      label: "Occupied Beds",
      value: kpis.occupiedBeds || 0,
      trend: "Active tenants",
    },
    {
      icon: DoorOpen,
      tone: "amber",
      label: "Available Beds",
      value: kpis.availableBeds || 0,
      trend: "Ready for move-in",
      anomalyBadge: anomalies.availableBeds,
    },
    {
      icon: Building,
      tone: "blue",
      label: "Total Beds",
      value: kpis.totalCapacity || 0,
      trend: "Total room inventory",
    },
  ];

  const exportPdf = () => {
    const insight = insightData?.insight;
    handlePdfExport({
      title: "Occupancy Analytics Report",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `lilycrest-occupancy-${branch || "all"}-${range}.pdf`,
      reportType: "Occupancy",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: item.trend,
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insight?.headline || "Occupancy summary",
        summary: insight?.summary || "",
        confidence:
          insight?.confidence === "high"
            ? 85
            : insight?.confidence === "medium"
            ? 60
            : insight?.confidence === "low"
            ? 35
            : 0,
        confidenceLabel: insight?.confidence
          ? `${insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}`
          : "",
        standout: insight?.keyFindings || [],
        watch: insight?.riskAlerts || insight?.anomalies || [],
        nextSteps: insight?.recommendedActions || [],
      },
      sections: [
        {
          title: "Room Inventory & Capacity",
          type: "table",
          headers: ["Room", "Type", "Branch", "Capacity", "Occupied", "Available", "Rate", "Status"],
          rows: filteredInventory.map((item) => ({
            Room: item.roomNumber || "-",
            Type: item.roomTypeLabel || "-",
            Branch: formatBranch(item.branch),
            Capacity: item.capacity || 0,
            Occupied: item.occupiedBeds || 0,
            Available: item.availableBeds || 0,
            Rate: `${item.occupancyRate || 0}%`,
            Status: item.occupancyRate >= 100 ? "Full" : item.occupiedBeds === 0 ? "Vacant" : "Partial",
          })),
        },
      ],
    });
  };

  const exportCsv = () => {
    handleCsvExport(
      filteredInventory,
      [
        { key: "roomNumber", label: "Room" },
        { key: "roomTypeLabel", label: "Type" },
        { key: "branch", label: "Branch", formatter: (v) => formatBranch(v) },
        { key: "capacity", label: "Capacity" },
        { key: "occupiedBeds", label: "Occupied Beds" },
        { key: "availableBeds", label: "Available Beds" },
        { key: "unavailableBeds", label: "Unavailable Beds" },
        { key: "occupancyRate", label: "Occupancy Rate (%)", formatter: (v) => `${v}%` },
        { key: "status", label: "Status", formatter: (v, row) => (row.occupancyRate >= 100 ? "Full" : row.occupiedBeds === 0 ? "Vacant" : "Partial") },
      ],
      `lilycrest-occupancy-${branch || "all"}-${range}`,
    );
  };

  useEffect(() => {
    if (registerExport) {
      registerExport({ exportCsv, exportPdf });
    }
  }, [registerExport, exportCsv, exportPdf]);

  const trendChartConfig = useMemo(() => {
    if (occupancyMetric === "beds") {
      return {
        data: trend.map((item) => ({
          label: item.label,
          occupied: item.occupiedBeds || 0,
          capacity: item.totalCapacity || 0,
        })),
        lines: [
          { key: "occupied", label: "Occupied Beds", color: "#2563eb", strokeWidth: 2.5 },
          { key: "capacity", label: "Total Capacity", color: "#64748b", strokeWidth: 1.75 },
        ],
        valueFormatter: (value) => `${value} bed${value === 1 ? "" : "s"}`,
        subtitle: `Occupied beds vs. capacity — ${buildRangeLabel(activeTrendRange).toLowerCase()}`,
      };
    }

    if (occupancyMetric === "byType") {
      return {
        data: trend.map((item) => ({
          label: item.label,
          private: item.byType?.["private"] ?? 0,
          double: item.byType?.["double-sharing"] ?? 0,
          quadruple: item.byType?.["quadruple-sharing"] ?? 0,
        })),
        lines: [
          { key: "private", label: "Private", color: "#2563eb", strokeWidth: 2 },
          { key: "double", label: "Double Sharing", color: "#16a34a", strokeWidth: 2 },
          { key: "quadruple", label: "Quad Sharing", color: "#f59e0b", strokeWidth: 2 },
        ],
        valueFormatter: (value) => `${value}%`,
        subtitle: `By room type — ${buildRangeLabel(activeTrendRange).toLowerCase()}`,
      };
    }

    return {
      data: trend.map((item) => ({
        label: item.label,
        occupancy: item.totalRate ?? 0,
      })),
      lines: [{ key: "occupancy", label: "Occupancy rate", color: "#2563eb", strokeWidth: 3 }],
      valueFormatter: (value) => `${value}%`,
      subtitle: `Daily occupancy rate — ${buildRangeLabel(activeTrendRange).toLowerCase()}`,
    };
  }, [activeTrendRange, occupancyMetric, trend]);

  if (isLoading && !data) {
    return <AdminAnalyticsDetailSkeleton tab="occupancy" isOwner={isOwner} />;
  }

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "FILTER_STATUS" && action.filterValue) {
      setStatusFilter(action.filterValue);
      setPage(1);
    } else if (action.actionType === "FILTER_TYPE" && action.filterValue) {
      setTypeFilter(action.filterValue);
        setPage(1);
    } else if (action.actionType === "SEARCH" && action.filterValue) {
      setSearchQuery(action.filterValue);
      setPage(1);
    }
  };

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      {isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
          Occupancy analytics could not be loaded. Please try again later.
        </div>
      ) : null}

      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="occupancy"
        summaryTitle="Occupancy Intelligence"
        reportType="occupancy"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={occupancyPrompts}
        onExecuteAction={handleExecuteAction}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Occupancy trend"
          subtitle={trendChartConfig.subtitle}
          actions={
            <div className="flex items-center gap-2">
              <div className="analytics-view-mode-toggle" role="group" aria-label="Occupancy view metric">
                <button
                  type="button"
                  className={`analytics-view-mode-btn ${occupancyMetric === "rate" ? "active" : ""}`}
                  onClick={() => setOccupancyMetric("rate")}
                >
                  Rate %
                </button>
                <button
                  type="button"
                  className={`analytics-view-mode-btn ${occupancyMetric === "beds" ? "active" : ""}`}
                  onClick={() => setOccupancyMetric("beds")}
                >
                  Beds
                </button>
                <button
                  type="button"
                  className={`analytics-view-mode-btn ${occupancyMetric === "byType" ? "active" : ""}`}
                  onClick={() => setOccupancyMetric("byType")}
                >
                  By Type
                </button>
              </div>
              <CardFilterSelect
                value={activeTrendRange}
                onChange={setTrendRange}
              />
            </div>
          }
        >
          <AnalyticsLineChart
            data={trendChartConfig.data}
            lines={trendChartConfig.lines}
            valueFormatter={trendChartConfig.valueFormatter}
            emptyTitle="No occupancy trend"
            emptyDescription="The branch does not have enough occupancy history for this range yet."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Room type mix"
          subtitle="Current occupancy by room type"
        >
          <AnalyticsDonutChart
            data={roomTypes.map((item) => ({
              label: item.roomTypeLabel,
              value: item.occupiedBeds,
            }))}
            centerLabel={{
              value: data?.kpis?.occupiedBeds || 0,
              label: "Occupied",
            }}
            emptyTitle="No room type data"
            emptyDescription="Room type distribution will appear once inventory is available."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Forecast panel"
          subtitle="Projected occupancy compared with recent baseline"
          actions={
            <CardFilterSelect
              value={activeForecastRange}
              onChange={setForecastRange}
            />
          }
        >
          <AnalyticsLineChart
            data={forecastSeries}
            lines={[
              { key: "projected", label: "Projected occupancy" },
              { key: "baseline", label: "Baseline rate", color: "#0f766e" },
            ]}
            valueFormatter={(value) => `${value}%`}
            emptyTitle="Forecast unavailable"
            emptyDescription="More occupancy history is needed before a forecast can be shown."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Forecast insights"
          subtitle="Deterministic 3-month occupancy projection"
        >
          <ForecastCards forecast={forecast} />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Historical Monthly Occupancy & Turnaround"
          subtitle="Bed-day utilization rate by month, stay length, and turnaround efficiency"
          actions={
            <CardFilterSelect
              value={activeHistoryRange}
              onChange={setHistoryRange}
            />
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5">
            <div className="bg-muted/40 border border-border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Avg Stay</span>
              <div className="text-[16px] font-semibold text-foreground mt-0.5">{historyKpis.averageStayMonths || 0} mos</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Mean tenure</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Turnaround</span>
              <div className="text-[16px] font-semibold text-foreground mt-0.5">{historyKpis.averageTurnaroundDays || 0} days</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Vacancy gap</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Peak Month</span>
              <div className="text-[16px] font-semibold text-foreground mt-0.5">{historyKpis.peakMonth?.month || "N/A"}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{historyKpis.peakMonth?.rate ?? 0}% utilization</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Off-Peak</span>
              <div className="text-[16px] font-semibold text-foreground mt-0.5">{historyKpis.offPeakMonth?.month || "N/A"}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{historyKpis.offPeakMonth?.rate ?? 0}% utilization</p>
            </div>
          </div>

          <AnalyticsBarChart
            data={historySeries}
            bars={[{ key: "occupancyRate", label: "Occupancy Rate (%)", color: "#2563eb" }]}
            valueFormatter={(val) => `${val}%`}
            emptyTitle="No historical bed data"
            emptyDescription="Historical monthly occupancy will populate as bed move-in records accumulate."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Tenant Cohort Mix"
          subtitle="Occupation & tenant status classification"
        >
          <AnalyticsDonutChart
            data={(cohorts.tenantTypes || []).map((item) => ({
              label: item.label,
              value: item.count,
            }))}
            centerLabel={{
              value: (cohorts.tenantTypes || []).reduce((sum, i) => sum + i.count, 0),
              label: "Tenants",
            }}
            emptyTitle="No tenant type data"
            emptyDescription="Tenant occupation data will appear once profiles are completed."
          />
        </ReportChartPanel>
      </div>

      <ReportChartPanel
        title="Room Inventory & Capacity"
        subtitle="Individual room unit status, bed allocation, and utilization rates"
        actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
      >
        <AnalyticsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          searchPlaceholder="Search room number or type..."
          filters={[
            {
              key: "typeFilter",
              label: "Type",
              value: typeFilter,
              onChange: (val) => {
                setTypeFilter(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All Room Types" },
                { value: "private", label: "Private" },
                { value: "double-sharing", label: "Double Sharing" },
                { value: "quadruple-sharing", label: "Quadruple Sharing" },
              ],
            },
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
                { value: "vacant", label: "Vacant (0% Occupied)" },
                { value: "partial", label: "Partial Occupancy" },
                { value: "full", label: "Full (100% Occupied)" },
              ],
            },
          ]}
          hasActiveFilters={Boolean(searchQuery || typeFilter !== "all" || statusFilter !== "all")}
          onResetFilters={() => {
            setSearchQuery("");
            setTypeFilter("all");
            setStatusFilter("all");
            setPage(1);
          }}
          extraActions={
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filteredInventory.length} of {inventory.length} rooms
            </span>
          }
        />

        <DataTable
          columns={INVENTORY_COLUMNS}
          data={filteredInventory}
          loading={isLoading}
          pagination={{
            page,
            pageSize,
            total: filteredInventory.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyState={{
            title: isError
              ? "Occupancy report unavailable"
              : "No occupancy rows",
            description: isError
              ? "The occupancy report could not be loaded."
              : "No room inventory matched the selected filter.",
          }}
        />
      </ReportChartPanel>
    </div>
  );
}
