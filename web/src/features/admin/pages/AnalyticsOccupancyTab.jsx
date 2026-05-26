import { useMemo, useState } from "react";
import {
  useOccupancyForecast,
  useOccupancyReport,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import {
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
  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const { data, isLoading, isError } = useOccupancyReport(params);
  const { data: forecastData } = useOccupancyForecast({
    months: 3,
    ...(isOwner ? { branch } : {}),
  });
  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "occupancy",
    range,
    branch: isOwner ? branch : undefined,
  });

  const inventory = unwrapTableRows(data?.tables?.inventory);
  const roomTypes = Array.isArray(data?.tables?.roomTypes)
    ? data?.tables?.roomTypes
    : [];
  const trend = data?.series?.occupancyTrend || [];
  const forecast = forecastData?.forecast || {};
  const forecastSeries = (forecast.projected || []).map((item) => ({
    label: item.label,
    projected: item.projectedOccupancyRate,
    baseline: item.baselineRate,
  }));

  const metricCards = [
    {
      label: "Occupancy Rate",
      value: data?.kpis?.occupancyRateLabel || "0%",
      tone: "blue",
    },
    {
      label: "Total Capacity",
      value: data?.kpis?.totalCapacity || 0,
      tone: "green",
    },
    {
      label: "Occupied Beds",
      value: data?.kpis?.occupiedBeds || 0,
      tone: "amber",
    },
    {
      label: "Unavailable Beds",
      value: data?.kpis?.unavailableBeds || 0,
      tone: "rose",
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      inventory,
      [
        { key: "roomNumber", label: "Room" },
        { key: "roomTypeLabel", label: "Type" },
        {
          key: "branch",
          label: "Branch",
          formatter: (value) => formatBranch(value),
        },
        { key: "capacity", label: "Capacity" },
        { key: "occupiedBeds", label: "Occupied Beds" },
        { key: "availableBeds", label: "Available Beds" },
        { key: "unavailableBeds", label: "Unavailable Beds" },
        {
          key: "occupancyRate",
          label: "Occupancy Rate",
          formatter: (value) => `${value}%`,
        },
      ],
      `occupancy-report-${range}`,
    );
  };

 // Helper — derive status pill from occupancy rate
const deriveStatus = (rate) => {
  if (rate >= 95) return "Full";
  if (rate >= 80) return "Good";
  if (rate >= 65) return "Watch";
  return "Low";
};
const insight = insightData?.insight; // ← unwrap the nested object first

 const exportPdf = () => {
  handlePdfExport({
    title: "Occupancy Report",
    subtitle: `${buildRangeLabel(range)} · ${formatBranch(data?.scope?.branch || branch)}`,
    filename: `occupancy-report-${range}.pdf`,
    reportType: "Occupancy",

    kpis: metricCards.map((item, i) => ({
      label: item.label,
      value: item.value,
      sub: item.sub ?? item.change ?? "",
      highlight: i === 0,
    })),

    aiInsight: {
      headline: insight?.headline || "Occupancy summary",
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
        title: "Room type summary",
        type: "table",
        colWidths: [38, 22, 22, 22, 22, 28, 26],
        headers: ["Room type", "Capacity", "Occupied", "Available", "Unavailable", "Occupancy", "Status"],
        rows: roomTypes.map((item) => ({
          "Room type": item.roomTypeLabel,
          "Capacity": item.capacity,
          "Occupied": item.occupiedBeds,
          "Available": item.availableBeds ?? (item.capacity - item.occupiedBeds),
          "Unavailable": item.unavailableBeds ?? 0,
          "Occupancy": Number(item.occupancyRate),
          "Status": item.status ?? deriveStatus(Number(item.occupancyRate)),
        })),
      },
      {
        title: "Inventory snapshot",
        type: "inventory",
        colWidths: [28, 36, 24, 24, 24, 20],
        headers: ["Room", "Room type", "Capacity", "Occupied", "Available", "On hold"],
        rows: inventory.slice(0, 12).map((item) => ({
          "Room": item.roomNumber,
          "Room type": item.roomTypeLabel,
          "Capacity": item.capacity,
          "Occupied": item.occupiedBeds,
          "Available": item.availableBeds ?? (item.capacity - item.occupiedBeds),
          "On hold": item.onHold ?? 0,
        })),
      },
    ],
  });
};

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
        title="Inventory table"
        subtitle="Current room capacity, occupancy, and unavailable inventory"
      >
        <DataTable
          columns={INVENTORY_COLUMNS}
          data={inventory}
          loading={isLoading}
          pagination={{
            page,
            pageSize: 10,
            total: inventory.length,
            onPageChange: setPage,
          }}
          emptyState={{
            title: isError
              ? "Occupancy report unavailable"
              : "No occupancy rows",
            description: isError
              ? "The occupancy report could not be loaded."
              : "No room inventory matched this branch scope yet.",
          }}
        />
      </ReportChartPanel>
    </AnalyticsTabLayout>
  );
}
