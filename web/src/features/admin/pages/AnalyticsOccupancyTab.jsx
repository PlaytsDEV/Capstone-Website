import { useMemo, useState } from "react";
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
} from "./analyticsTabShared";
import "../styles/design-tokens.css";
import "../styles/admin-reports.css";

const INVENTORY_COLUMNS = [
  { key: "roomNumber", label: "Room", sortable: true },
  { key: "roomTypeLabel", label: "Type", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch) },
  { key: "capacity", label: "Capacity", sortable: true },
  { key: "occupiedBeds", label: "Occupied", sortable: true },
  { key: "availableBeds", label: "Available", sortable: true },
  { key: "unavailableBeds", label: "Unavailable", sortable: true },
  {
    key: "occupancyRate",
    label: "Rate",
    render: (row) => `${row.occupancyRate}%`,
  },
  {
    key: "status",
    label: "Status",
    render: (row) => {
      if (row.occupancyRate >= 100) {
        return (
          <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", background: "var(--success-subtle, #dcfce7)", color: "var(--success-dark, #166534)", fontWeight: 600, border: "1px solid rgba(22, 101, 52, 0.2)" }}>
            Full
          </span>
        );
      }
      if (row.occupiedBeds === 0) {
        return (
          <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", background: "var(--warning-subtle, #fef3c7)", color: "var(--warning-dark, #92400e)", fontWeight: 600, border: "1px solid rgba(146, 64, 14, 0.2)" }}>
            Vacant
          </span>
        );
      }
      return (
        <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", background: "var(--info-subtle, #dbeafe)", color: "var(--info-dark, #1e40af)", fontWeight: 600, border: "1px solid rgba(30, 64, 175, 0.2)" }}>
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
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);

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

  const insightData = useMemo(
    () => ({ kpis, series, tables: data?.tables }),
    [kpis, series, data?.tables],
  );
  const { isInsightLoading, isInsightError } = useReportInsights(
    "occupancy",
    insightData,
  );

  const occupancyDelta = kpis.comparison?.occupancyRate || {
    label: "+0 pp",
    changeType: "neutral",
    text: "vs prev period",
  };

  const metricCards = [
    {
      icon: Bed,
      tone: "blue",
      label: "Occupancy Rate",
      value: kpis.occupancyRateLabel || "0%",
      trend: occupancyDelta.text || `${occupancyDelta.label || "+0 pp"} vs prev period`,
      changeType: occupancyDelta.changeType || "neutral",
    },
    {
      icon: Users,
      tone: "green",
      label: "Occupied Beds",
      value: kpis.occupiedBeds || 0,
      trend: "Active residents",
    },
    {
      icon: DoorOpen,
      tone: "amber",
      label: "Available Beds",
      value: kpis.availableBeds || 0,
      trend: "Ready for move-in",
    },
    {
      icon: Building,
      tone: "purple",
      label: "Total Beds",
      value: kpis.totalCapacity || 0,
      trend: "Total room inventory",
    },
  ];

  const exportPdf = () =>
    handlePdfExport({
      title: "Occupancy Analytics",
      subtitle: `${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`,
      metrics: metricCards,
      insights: buildInsightPdfSections(insightData?.insights),
      tables: [{ title: "Inventory", columns: INVENTORY_COLUMNS, rows: filteredInventory }],
    });
  const exportCsv = () => handleCsvExport("occupancy_inventory.csv", filteredInventory);

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="occupancy"
        summaryTitle="Occupancy Summary & Intelligence"
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Occupancy trend"
          subtitle="Daily occupancy rate over the selected period"
          actions={
            <CardFilterSelect
              value={activeTrendRange}
              onChange={setTrendRange}
            />
          }
        >
          <AnalyticsLineChart
            data={trend.map((item) => ({
              label: item.label,
              occupancy: item.totalRate,
            }))}
            lines={[{ key: "occupancy", label: "Occupancy rate" }]}
            valueFormatter={(value) => `${value}%`}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
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
