import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Timer,
  Users,
  Wrench,
} from "lucide-react";
import { useAuditAnalytics, useOperationsReport } from "../../../shared/hooks/queries/useAnalyticsReports";
import { useMaintenanceProviderReport } from "../../../shared/hooks/queries/useMaintenance";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  PeriodComparisonCard,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import { buildRangeLabel, formatBranch, formatDate, formatDateTime } from "./reportCommon";
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
  detectOperationsAnomalies,
  getDynamicOperationsPrompts,
} from "./analyticsTabShared";

const MAINTENANCE_COLUMNS = [
  { key: "requestId", label: "Request ID", sortable: true },
  { key: "typeLabel", label: "Type", sortable: true },
  {
    key: "urgency",
    label: "Urgency",
    sortable: true,
    render: (row) => {
      const val = String(row.urgency || "").toLowerCase();
      const isUrgent = val === "emergency" || val === "high";
      return (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            background: isUrgent ? "var(--danger-subtle, #fee2e2)" : "var(--info-subtle, #dbeafe)",
            color: isUrgent ? "var(--danger-dark, #b91c1c)" : "var(--info-dark, #1e40af)",
            fontWeight: 600,
            border: isUrgent ? "1px solid rgba(185, 28, 28, 0.2)" : "1px solid rgba(30, 64, 175, 0.2)",
            textTransform: "capitalize",
          }}
        >
          {row.urgency || "Normal"}
        </span>
      );
    },
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => {
      const val = String(row.status || "").toLowerCase();
      const isDone = val === "resolved" || val === "completed";
      const isInProgress = val === "in_progress" || val === "in progress";
      return (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            background: isDone
              ? "var(--success-subtle, #dcfce7)"
              : isInProgress
              ? "var(--info-subtle, #dbeafe)"
              : "var(--warning-subtle, #fef3c7)",
            color: isDone
              ? "var(--success-dark, #166534)"
              : isInProgress
              ? "var(--info-dark, #1e40af)"
              : "var(--warning-dark, #92400e)",
            fontWeight: 600,
            border: isDone
              ? "1px solid rgba(22, 101, 52, 0.2)"
              : isInProgress
              ? "1px solid rgba(30, 64, 175, 0.2)"
              : "1px solid rgba(146, 64, 14, 0.2)",
            textTransform: "capitalize",
          }}
        >
          {row.status || "Pending"}
        </span>
      );
    },
  },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch) },
  { key: "createdAt", label: "Created", render: (row) => formatDateTime(row.createdAt) },
  {
    key: "resolutionHours",
    label: "Resolution",
    render: (row) => (row.resolutionHours == null ? "-" : `${row.resolutionHours} hrs`),
  },
  {
    key: "slaState",
    label: "Turnaround Status",
    sortable: true,
    render: (row) => {
      const val = String(row.slaState || "").toLowerCase();
      const isMet = val.includes("met") || val.includes("on_track") || val.includes("on track") || val.includes("on-time");
      return (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            background: isMet ? "var(--success-subtle, #dcfce7)" : "var(--danger-subtle, #fee2e2)",
            color: isMet ? "var(--success-dark, #166534)" : "var(--danger-dark, #b91c1c)",
            fontWeight: 600,
            border: isMet ? "1px solid rgba(22, 101, 52, 0.2)" : "1px solid rgba(185, 28, 28, 0.2)",
          }}
        >
          {row.slaState || "Within Target"}
        </span>
      );
    },
  },
];

const PROVIDER_COLUMNS = [
  { key: "providerName", label: "Provider / Technician", sortable: true },
  { key: "category", label: "Specialty", sortable: true },
  { key: "totalAssigned", label: "Assigned Jobs", sortable: true },
  { key: "activeJobs", label: "Active", sortable: true },
  { key: "completedJobs", label: "Completed", sortable: true },
  { key: "overdueJobs", label: "Overdue", sortable: true },
  {
    key: "completionRate",
    label: "Completion Rate",
    sortable: true,
    render: (row) => (
      <span
        style={{
          padding: "3px 10px",
          borderRadius: "12px",
          fontSize: "11px",
          background: (row.completionRate || 0) >= 80 ? "var(--success-subtle, #dcfce7)" : "var(--warning-subtle, #fef3c7)",
          color: (row.completionRate || 0) >= 80 ? "var(--success-dark, #166534)" : "var(--warning-dark, #92400e)",
          fontWeight: 700,
        }}
      >
        {row.completionRate != null ? `${row.completionRate}%` : "—"}
      </span>
    ),
  },
];

export default function AnalyticsOperationsTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [slaFilter, setSlaFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);
  const [providerPage, setProviderPage] = useState(1);
  const [providerPageSize, setProviderPageSize] = useState(5);

  const [resRange, setResRange] = useState(null);
  const activeResRange = resRange || range;

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const resParams = useMemo(
    () => ({
      range: activeResRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeResRange],
  );

  const { data, isLoading, isError } = useOperationsReport(params);
  const { data: resData } = useOperationsReport(resParams);
  const { data: providerRawData, isLoading: isProvidersLoading } = useMaintenanceProviderReport(params);

  const providerData = providerRawData?.data || providerRawData || {};
  const providersList = Array.isArray(providerData?.providers) ? providerData.providers : [];

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "operations",
    range,
    branch: isOwner ? branch : undefined,
  });

  const maintenanceIssues = unwrapTableRows(data?.tables?.maintenanceIssues);
  const inquiryWindows = Array.isArray(data?.tables?.peakInquiryWindows) ? data?.tables?.peakInquiryWindows : [];
  const reservationsByPeriod = (resData || data)?.series?.reservationsByPeriod || [];
  const maintenanceByType = data?.series?.maintenanceByType || [];
  const maintenanceResolution = data?.series?.maintenanceResolution || [];
  const resolutionTrend = data?.series?.resolutionTrend || [];
  const [turnaroundMetric, setTurnaroundMetric] = useState("hours");

  const turnaroundChartConfig = useMemo(() => {
    if (turnaroundMetric === "rate") {
      return {
        data: resolutionTrend.map((item) => ({
          label: item.label,
          rate: item.onTimeRate ?? 100,
          target: 90,
        })),
        lines: [
          { key: "rate", label: "On-Time Rate", color: "#16a34a", strokeWidth: 2.5 },
          { key: "target", label: "Target (90%)", color: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 4" },
        ],
        valueFormatter: (value) => `${value}%`,
        subtitle: "Percentage of tickets resolved within turnaround time target",
      };
    }

    return {
      data: resolutionTrend.map((item) => ({
        label: item.label,
        avgHours: item.avgResolutionHours ?? 0,
        targetHours: item.targetHours || 48,
      })),
      lines: [
        { key: "avgHours", label: "Actual Turnaround", color: "#2563eb", strokeWidth: 2.5 },
        { key: "targetHours", label: "Benchmark (48 hrs)", color: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 4" },
      ],
      valueFormatter: (value) => `${value} hrs`,
      subtitle: "Mean resolution time in hours vs 48-hour target benchmark",
    };
  }, [resolutionTrend, turnaroundMetric]);

  const filteredMaintenance = useMemo(() => {
    return maintenanceIssues.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.requestId && String(item.requestId).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.typeLabel && String(item.typeLabel).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSla =
        slaFilter === "all" ||
        (item.slaState && String(item.slaState).toLowerCase().includes(slaFilter.toLowerCase()));

      const matchUrgency =
        urgencyFilter === "all" ||
        (item.urgency && String(item.urgency).toLowerCase() === urgencyFilter.toLowerCase());

      return matchSearch && matchSla && matchUrgency;
    });
  }, [maintenanceIssues, searchQuery, slaFilter, urgencyFilter]);

  const operationsPrompts = useMemo(
    () => getDynamicOperationsPrompts(data),
    [data],
  );

  const resCount = data?.kpis?.reservations || 0;
  const inqCount = data?.kpis?.inquiries || 0;
  const maintCount = data?.kpis?.maintenanceRequests || 0;
  const slaRate = data?.kpis?.slaComplianceRateLabel || "0%";

  const reservationsDelta = data?.kpis?.comparison?.reservations || {
    label: "+0",
    changeType: "neutral",
    text: "vs prev period",
  };
  const maintenanceDelta = data?.kpis?.comparison?.maintenanceRequests || {
    label: "+0",
    changeType: "neutral",
    text: "vs prev period",
  };
  const inquiriesDelta = data?.kpis?.comparison?.inquiries || {
    label: "+0",
    changeType: "neutral",
    text: "vs prev period",
  };
  const slaDelta = data?.kpis?.comparison?.slaComplianceRate || {
    label: "+0 pp",
    changeType: "neutral",
    text: "vs target",
  };

  const anomalies = detectOperationsAnomalies(data?.kpis);

  const metricCards = [
    {
      icon: CalendarDays,
      tone: "amber",
      label: "Reservations",
      value: resCount,
      trend: reservationsDelta.text || `${reservationsDelta.label || "+0"} vs prev period`,
      changeType: reservationsDelta.changeType || "neutral",
    },
    {
      icon: Wrench,
      tone: "amber",
      label: "Maintenance Requests",
      value: maintCount,
      trend: maintenanceDelta.text || `${maintenanceDelta.label || "+0"} vs prev period`,
      changeType: maintenanceDelta.changeType === "up" ? "down" : maintenanceDelta.changeType === "down" ? "up" : "neutral",
      anomalyBadge: anomalies.maintenanceRequests,
    },
    {
      icon: Users,
      tone: "teal",
      label: "Inquiries",
      value: inqCount,
      trend: inquiriesDelta.text || `${inquiriesDelta.label || "+0"} vs prev period`,
      changeType: inquiriesDelta.changeType || "neutral",
    },
    {
      icon: CheckCircle2,
      tone: "green",
      label: "On-Time Resolution Rate",
      value: slaRate,
      trend: slaDelta.text || `${slaDelta.label || "+0 pp"} on-time rate`,
      changeType: slaDelta.changeType || "neutral",
      anomalyBadge: anomalies.slaComplianceRate,
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      filteredMaintenance,
      [
        { key: "requestId", label: "Request ID" },
        { key: "typeLabel", label: "Type" },
        { key: "urgency", label: "Urgency" },
        { key: "status", label: "Status" },
        { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
        { key: "createdAt", label: "Created", formatter: (value) => formatDateTime(value) },
        { key: "resolvedAt", label: "Resolved", formatter: (value) => formatDateTime(value) },
        { key: "resolutionHours", label: "Resolution Hours" },
        { key: "slaState", label: "Turnaround Status" },
      ],
      `lilycrest-operations-${branch || "all"}-${range}`,
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Operations Analytics Report",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `lilycrest-operations-${branch || "all"}-${range}.pdf`,
      reportType: "Operations",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: item.trend,
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insightData?.insight?.headline || "Operations summary",
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
          title: "Maintenance Turnaround Timeline",
          type: "table",
          headers: ["Period", "Resolved Tickets", "Avg Turnaround Hours", "On-Time Rate"],
          rows: resolutionTrend.map((item) => ({
            Period: item.label,
            "Resolved Tickets": String(item.resolvedCount || 0),
            "Avg Turnaround Hours": `${item.avgResolutionHours || 0} hrs`,
            "On-Time Rate": `${item.onTimeRate ?? 100}%`,
          })),
        },
        {
          title: "Peak Inquiry Windows",
          type: "table",
          headers: ["Window", "Inquiries"],
          rows: inquiryWindows.map((item) => ({
            Window: item.label,
            Inquiries: item.count || 0,
          })),
        },
        {
          title: "Maintenance Snapshot",
          type: "table",
          headers: ["Request ID", "Type", "Urgency", "Status", "Turnaround Status"],
          rows: filteredMaintenance.slice(0, 12).map((item) => ({
            "Request ID": item.requestId || "-",
            Type: item.typeLabel || "-",
            Urgency: item.urgency || "-",
            Status: item.status || "-",
            "Turnaround Status": item.slaState || "-",
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
    return <AdminAnalyticsDetailSkeleton tab="operations" isOwner={isOwner} />;
  }

  const periodComparisonRows = [
    {
      label: "Reservations",
      sublabel: "vs previous period",
      value: resCount,
      change: reservationsDelta.label,
      changeType: reservationsDelta.changeType || "neutral",
    },
    {
      label: "Maintenance requests",
      sublabel: "vs previous period",
      value: maintCount,
      change: maintenanceDelta.label,
      changeType: maintenanceDelta.changeType === "up" ? "down" : maintenanceDelta.changeType === "down" ? "up" : "neutral",
    },
    {
      label: "Inquiries",
      sublabel: "vs previous period",
      value: inqCount,
      change: inquiriesDelta.label,
      changeType: inquiriesDelta.changeType || "neutral",
    },
    {
      label: "On-time resolution rate",
      sublabel: "vs previous period",
      value: slaRate,
      change: slaDelta.label,
      changeType: slaDelta.changeType || "neutral",
    },
  ];

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "FILTER_SLA" && action.filterValue) {
      setSlaFilter(action.filterValue);
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
        reportLabel="operations"
        summaryTitle="Operations & Turnaround Intelligence"
        reportType="operations"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={operationsPrompts}
        onExecuteAction={handleExecuteAction}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Turnaround Speed & Efficiency"
          subtitle={turnaroundChartConfig.subtitle}
          actions={
            <div className="analytics-view-mode-toggle" role="group" aria-label="Turnaround view metric">
              <button
                type="button"
                className={`analytics-view-mode-btn ${turnaroundMetric === "hours" ? "active" : ""}`}
                onClick={() => setTurnaroundMetric("hours")}
              >
                Avg Hours
              </button>
              <button
                type="button"
                className={`analytics-view-mode-btn ${turnaroundMetric === "rate" ? "active" : ""}`}
                onClick={() => setTurnaroundMetric("rate")}
              >
                On-Time %
              </button>
            </div>
          }
        >
          <AnalyticsLineChart
            data={turnaroundChartConfig.data}
            lines={turnaroundChartConfig.lines}
            valueFormatter={turnaroundChartConfig.valueFormatter}
            emptyTitle="No turnaround timeline data"
            emptyDescription="Maintenance turnaround trend will populate as tickets are resolved."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Maintenance category mix" subtitle="Most common maintenance request types">
          <AnalyticsDonutChart
            data={maintenanceByType.map((item) => ({ label: item.label, value: item.count }))}
            centerLabel={{ value: data?.kpis?.maintenanceRequests || 0, label: "Requests" }}
            emptyTitle="No maintenance categories"
            emptyDescription="Maintenance categories will appear once tickets exist for this scope."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Reservation activity"
          subtitle="Bookings per week"
          actions={
            <CardFilterSelect
              value={activeResRange}
              onChange={setResRange}
            />
          }
        >
          <AnalyticsBarChart
            data={reservationsByPeriod.map((item) => ({ label: item.label, count: item.count }))}
            bars={[{ key: "count", label: "Reservations", color: "#f59e0b" }]}
            emptyTitle="No reservation trend"
            emptyDescription="Reservation activity will appear once records exist in this range."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Inquiry timing" subtitle="Peak inquiry windows in two-hour blocks">
          <AnalyticsBarChart
            data={inquiryWindows.map((item) => ({ label: item.label, count: item.count }))}
            bars={[{ key: "count", label: "Inquiries", color: "#0f766e" }]}
            emptyTitle="No inquiry timing data"
            emptyDescription="Inquiry timing will appear once inquiry activity exists for this range."
          />
        </ReportChartPanel>
      </div>

      <PeriodComparisonCard
        title="Period comparison"
        subtitle="Current vs previous period"
        rows={periodComparisonRows}
      />

      <div>
        <ReportChartPanel title="Maintenance tickets table" subtitle="Most recent branch-scoped maintenance tickets">
          <AnalyticsTableToolbar
            searchQuery={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            searchPlaceholder="Search request ID or type..."
            filters={[
              {
                key: "slaFilter",
                label: "Turnaround Status",
                value: slaFilter,
                onChange: (val) => {
                  setSlaFilter(val);
                  setPage(1);
                },
                options: [
                  { value: "all", label: "All Turnaround Statuses" },
                  { value: "on-time", label: "On-Time" },
                  { value: "at-risk", label: "At Risk" },
                  { value: "breached", label: "Delayed" },
                ],
              },
              {
                key: "urgencyFilter",
                label: "Urgency",
                value: urgencyFilter,
                onChange: (val) => {
                  setUrgencyFilter(val);
                  setPage(1);
                },
                options: [
                  { value: "all", label: "All Urgency Levels" },
                  { value: "low", label: "Low" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                ],
              },
            ]}
            hasActiveFilters={Boolean(searchQuery || slaFilter !== "all" || urgencyFilter !== "all")}
            onResetFilters={() => {
              setSearchQuery("");
              setSlaFilter("all");
              setUrgencyFilter("all");
              setPage(1);
            }}
            extraActions={
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                  Showing {filteredMaintenance.length} of {maintenanceIssues.length} tickets
                </span>
                <ExportButtons onCsv={exportCsv} onPdf={exportPdf} />
              </div>
            }
          />

          <DataTable
            columns={MAINTENANCE_COLUMNS}
            data={filteredMaintenance}
            loading={isLoading}
            pagination={{
              page,
              pageSize,
              total: filteredMaintenance.length,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{
              title: isError ? "Maintenance report unavailable" : "No maintenance tickets",
              description: isError
                ? "The operations report could not be loaded."
                : "No maintenance tickets matched the selected filter criteria.",
            }}
          />
        </ReportChartPanel>
      </div>

      {providersList.length > 0 && (
        <ReportChartPanel title="Technician & Provider Performance" subtitle="Service provider task allocation and completion rates">
          <DataTable
            columns={PROVIDER_COLUMNS}
            data={providersList}
            loading={isProvidersLoading}
            pagination={{
              page: providerPage,
              pageSize: providerPageSize,
              total: providersList.length,
              onPageChange: setProviderPage,
              onPageSizeChange: setProviderPageSize,
            }}
            emptyState={{
              title: "No providers registered",
              description: "Technician assignments will appear once work orders are dispatched.",
            }}
          />
        </ReportChartPanel>
      )}
    </div>
  );
}
