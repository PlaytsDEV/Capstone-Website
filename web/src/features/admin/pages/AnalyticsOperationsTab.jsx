import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useAuditAnalytics, useOperationsReport } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  ReportChartPanel,
} from "../components/shared";
import { buildRangeLabel, formatBranch, formatDate, formatDateTime } from "./reportCommon";
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

const MAINTENANCE_COLUMNS = [
  { key: "requestId", label: "Request ID", sortable: true },
  { key: "typeLabel", label: "Type", sortable: true },
  { key: "urgency", label: "Urgency", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch) },
  { key: "createdAt", label: "Created", render: (row) => formatDateTime(row.createdAt) },
  {
    key: "resolutionHours",
    label: "Resolution",
    render: (row) => (row.resolutionHours == null ? "-" : `${row.resolutionHours} hrs`),
  },
  { key: "slaState", label: "SLA", sortable: true },
];

const EVENT_COLUMNS = [
  { key: "action", label: "Event", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch), sortable: true },
  { key: "severity", label: "Severity", sortable: true },
  { key: "user", label: "User", sortable: true },
  { key: "timestamp", label: "Time", render: (row) => formatDateTime(row.timestamp), sortable: true },
];

export default function AnalyticsOperationsTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [slaFilter, setSlaFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const { data, isLoading, isError } = useOperationsReport(params);
  const { data: auditData } = useAuditAnalytics(params);

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
  const reservations = Array.isArray(data?.tables?.reservations) ? data?.tables?.reservations : [];
  const inquiryWindows = Array.isArray(data?.tables?.peakInquiryWindows) ? data?.tables?.peakInquiryWindows : [];
  const reservationsByPeriod = data?.series?.reservationsByPeriod || [];
  const maintenanceByType = data?.series?.maintenanceByType || [];
  const maintenanceResolution = data?.series?.maintenanceResolution || [];

  const recentSecurityEvents = unwrapTableRows(auditData?.tables?.recentSecurityEvents);

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

  const metricCards = [
    { label: "Reservations", value: data?.kpis?.reservations || 0, tone: "blue" },
    { label: "Inquiries", value: data?.kpis?.inquiries || 0, tone: "green" },
    { label: "Maintenance", value: data?.kpis?.maintenanceRequests || 0, tone: "amber" },
    { label: "On-Time Fix Rate", value: data?.kpis?.slaComplianceRateLabel || "0%", tone: "rose" },
  ];

  const exportCsv = () => {
    handleCsvExport(
      maintenanceIssues,
      [
        { key: "requestId", label: "Request ID" },
        { key: "typeLabel", label: "Type" },
        { key: "urgency", label: "Urgency" },
        { key: "status", label: "Status" },
        { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
        { key: "createdAt", label: "Created", formatter: (value) => formatDateTime(value) },
        { key: "resolvedAt", label: "Resolved", formatter: (value) => formatDateTime(value) },
        { key: "resolutionHours", label: "Resolution Hours" },
        { key: "slaState", label: "SLA State" },
      ],
      `operations-report-${range}`,
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Operations Report",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `operations-report-${range}.pdf`,
      reportType: "Operations",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: "",
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
          headers: ["Request ID", "Type", "Urgency", "Status", "SLA"],
          rows: maintenanceIssues.slice(0, 12).map((item) => ({
            "Request ID": item.requestId || "-",
            Type: item.typeLabel || "-",
            Urgency: item.urgency || "-",
            Status: item.status || "-",
            SLA: item.slaState || "-",
          })),
        },
      ],
    });
  };

  return (
    <AnalyticsTabLayout
      header={
        <AnalyticsToolbar
          title="Operations & Health Analytics"
          subtitle={`Scope: ${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`}
          range={{ value: range, onChange: (value) => { setPage(1); onRangeChange(value); }, options: RANGE_OPTIONS_SHORT }}
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
        reportLabel="operations"
        summaryTitle="Operations Summary"
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
      />

      <div className="admin-reports__grid">
        <ReportChartPanel title="Reservation trend" subtitle="Reservation volume over the selected period">
          <AnalyticsBarChart
            data={reservationsByPeriod.map((item) => ({ label: item.label, count: item.count }))}
            bars={[{ key: "count", label: "Reservations" }]}
            emptyTitle="No reservation trend"
            emptyDescription="Reservation activity will appear once records exist in this range."
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

      <div className="admin-reports__grid">
        <ReportChartPanel title="Inquiry timing" subtitle="Peak inquiry windows in two-hour blocks">
          <AnalyticsBarChart
            data={inquiryWindows.map((item) => ({ label: item.label, count: item.count }))}
            bars={[{ key: "count", label: "Inquiries", color: "#0f766e" }]}
            emptyTitle="No inquiry timing data"
            emptyDescription="Inquiry timing will appear once inquiry activity exists for this range."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Resolution and SLA" subtitle="Average maintenance resolution time by category">
          <AnalyticsBarChart
            data={maintenanceResolution.map((item) => ({ label: item.label, hours: item.avgHours }))}
            bars={[{ key: "hours", label: "Average hours", color: "#f97316" }]}
            valueFormatter={(value) => `${value} hrs`}
            emptyTitle="No resolution data"
            emptyDescription="Resolution performance needs completed maintenance tickets to render."
          />
        </ReportChartPanel>
      </div>

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
              label: "SLA State",
              value: slaFilter,
              onChange: (val) => {
                setSlaFilter(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All SLA States" },
                { value: "on-time", label: "On-Time" },
                { value: "at-risk", label: "At Risk" },
                { value: "breached", label: "Breached" },
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
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filteredMaintenance.length} of {maintenanceIssues.length} tickets
            </span>
          }
        />

        <DataTable
          columns={MAINTENANCE_COLUMNS}
          data={filteredMaintenance}
          loading={isLoading}
          pagination={{
            page,
            pageSize: 10,
            total: filteredMaintenance.length,
            onPageChange: setPage,
          }}
          emptyState={{
            title: isError ? "Operations report unavailable" : "No maintenance issues",
            description: isError
              ? "The operations report could not be loaded."
              : "No maintenance issues matched the selected filter.",
          }}
        />
      </ReportChartPanel>

      {isOwner && recentSecurityEvents.length > 0 && (
        <ReportChartPanel
          title="System infrastructure & security events"
          subtitle="Owner security audit trail and access monitoring"
          actions={
            <Link to="/admin/audit-logs" className="admin-reports__link">
              Open full audit log
              <ExternalLink size={14} />
            </Link>
          }
        >
          <DataTable
            columns={EVENT_COLUMNS}
            data={recentSecurityEvents.slice(0, 10)}
            pagination={{
              page: 1,
              pageSize: 10,
              total: Math.min(10, recentSecurityEvents.length),
              onPageChange: () => {},
            }}
            emptyState={{
              title: "No audit events",
              description: "System audit logs will appear as administrative actions occur.",
            }}
          />
        </ReportChartPanel>
      )}
    </AnalyticsTabLayout>
  );
}
