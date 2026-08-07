import { useMemo, useState } from "react";
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
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  RANGE_OPTIONS_SHORT,
  unwrapTableRows,
  useReportInsights,
} from "./analyticsTabShared";


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
        return <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", background: "#dcfce7", color: "#166534", fontWeight: 500 }}>Full</span>;
      }
      if (row.occupiedBeds === 0) {
        return <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", background: "#fef3c7", color: "#92400e", fontWeight: 500 }}>Vacant</span>;
      }
      return <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", background: "#dbeafe", color: "#1e40af", fontWeight: 500 }}>Partial</span>;
    },
  },
];

function ForecastCards({ forecast }) {
  const projectedMonths = forecast?.projected || [];
  const recommendations = forecast?.insights?.recommendations || [];

  if (!forecast?.sufficientHistory) {
    return (
      <p className="admin-reports__hint">
        {forecast?.insights?.headline ||
          "Insufficient history to forecast occupancy."}
      </p>
    );
  }

  return (
    <div className="admin-reports__panel-stack">
      <p className="admin-reports__hint">{forecast.insights?.headline}</p>
      {projectedMonths.map((item) => (
        <div key={item.month} className="admin-reports__meta-card">
          <span className="admin-reports__meta-label">{item.label}</span>
          <div className="admin-reports__meta-value">
            {item.projectedOccupancyRate}%
          </div>
          <p className="admin-reports__hint">
            Baseline {item.baselineRate}% • Seasonal {item.seasonalMultiplier}x
          </p>
        </div>
      ))}
      {recommendations.slice(0, 2).map((item) => (
        <p key={item} className="admin-reports__hint">
          {item}
        </p>
      ))}
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

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const { data, isLoading, isError } = useOccupancyReport(params);
  const { data: forecast } = useOccupancyForecast(params);
  const { data: historyData } = useOccupancyRateHistory(params);

  const kpis = data?.kpis || {};
  const series = data?.series || {};
  const trend = series.occupancyTrend || [];
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

  const metricCards = [
    {
      label: "Occupancy Rate",
      value: kpis.occupancyRateLabel || "0%",
      note: "Beds occupied",
    },
    {
      label: "Occupied Beds",
      value: kpis.occupiedBeds || 0,
      note: "Active tenants",
    },
    {
      label: "Available Beds",
      value: kpis.availableBeds || 0,
      note: "Ready for move-in",
    },
    {
      label: "Total Beds",
      value: kpis.totalCapacity || 0,
      note: "Total inventory",
    },
  ];

  const exportPdf = () =>
    handlePdfExport({
      title: "Occupancy Analytics",
      subtitle: `${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`,
      metrics: metricCards,
      insights: buildInsightPdfSections(insightData?.insights),
      tables: [{ title: "Inventory", columns: INVENTORY_COLUMNS, rows: inventory }],
    });
  const exportCsv = () => handleCsvExport("occupancy_inventory.csv", inventory);

  return (
    <AnalyticsTabLayout
      header={
        <AnalyticsToolbar
          title="Occupancy Analytics"
          subtitle={`Scope: ${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`}
          range={{
            value: range,
            onChange: (value) => {
              setPage(1);
              onRangeChange(value);
            },
            options: RANGE_OPTIONS_SHORT,
          }}
          branch={buildBranchControl({
            isOwner,
            branch,
            onChange: (value) => {
              setPage(1);
              onBranchChange(value);
            },
          })}
          actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
        />
      }
    >
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="occupancy"
        summaryTitle="Occupancy Summary"
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
      />

      <div className="admin-reports__grid">
        <ReportChartPanel
          title="Occupancy trend"
          subtitle="Daily occupancy rate over the selected period"
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

      <div className="admin-reports__grid">
        <ReportChartPanel
          title="Forecast panel"
          subtitle="Projected occupancy compared with recent baseline"
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

      <ReportChartPanel
        title="Historical Monthly Occupancy Rate & Turnaround"
        subtitle="Bed-day utilization rate by month, average stay length, and turnaround efficiency"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div className="admin-reports__meta-card">
            <span className="admin-reports__meta-label">Avg Length of Stay</span>
            <div className="admin-reports__meta-value">{historyKpis.averageStayMonths || 0} mos</div>
            <p className="admin-reports__hint">Mean tenant tenure</p>
          </div>
          <div className="admin-reports__meta-card">
            <span className="admin-reports__meta-label">Turnaround Time</span>
            <div className="admin-reports__meta-value">{historyKpis.averageTurnaroundDays || 0} days</div>
            <p className="admin-reports__hint">Vacancy gap between tenants</p>
          </div>
          <div className="admin-reports__meta-card">
            <span className="admin-reports__meta-label">Peak Occupancy</span>
            <div className="admin-reports__meta-value">{historyKpis.peakMonth?.month || "N/A"}</div>
            <p className="admin-reports__hint">{historyKpis.peakMonth?.rate ?? 0}% bed utilization</p>
          </div>
          <div className="admin-reports__meta-card">
            <span className="admin-reports__meta-label">Off-Peak Season</span>
            <div className="admin-reports__meta-value">{historyKpis.offPeakMonth?.month || "N/A"}</div>
            <p className="admin-reports__hint">{historyKpis.offPeakMonth?.rate ?? 0}% bed utilization</p>
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

      <ReportChartPanel
        title="Inventory table"
        subtitle="Current room capacity, occupancy, and unavailable inventory"
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
            pageSize: 10,
            total: filteredInventory.length,
            onPageChange: setPage,
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
    </AnalyticsTabLayout>
  );
}

