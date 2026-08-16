import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Globe, KeyRound, ShieldAlert } from "lucide-react";
import { useAuditAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
 AnalyticsBarChart,
 AnalyticsComparisonChart,
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
 ExportButtons,
 handleCsvExport,
 handlePdfExport,
 MetricGrid,
 RANGE_OPTIONS_SHORT,
 unwrapTableRows,
 useReportInsights,
} from "./analyticsTabShared";

const EVENT_COLUMNS = [
 { key: "action", label: "Event", sortable: true },
 { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch), sortable: true },
 { key: "severity", label: "Severity", sortable: true },
 { key: "user", label: "User", sortable: true },
 { key: "timestamp", label: "Time", render: (row) => formatDateTime(row.timestamp), sortable: true },
];

const SUSPICIOUS_IP_COLUMNS = [
 { key: "ipAddress", label: "IP Address", sortable: true },
 { key: "attempts", label: "Failed Logins", sortable: true },
 { key: "lastSeenAt", label: "Last Seen", render: (row) => formatDateTime(row.lastSeenAt), sortable: true },
];

export default function AnalyticsMonitoringTab({ branch, range, onBranchChange, onRangeChange }) {
 const [eventPage, setEventPage] = useState(1);
 const [ipPage, setIpPage] = useState(1);
 const [searchQuery, setSearchQuery] = useState("");
 const [severityFilter, setSeverityFilter] = useState("all");
 const [eventPageSize, setEventPageSize] = useState(5);
 const [ipPageSize, setIpPageSize] = useState(5);

 const params = useMemo(() => ({ branch, range }), [branch, range]);
 const { data, isLoading, isError } = useAuditAnalytics(params);
 const {
 data: insightData,
 isLoading: isInsightLoading,
 isError: isInsightError,
 } = useReportInsights({
 reportType: "audit",
 range,
 branch,
 });

 const kpis = data?.kpis || {};
 const branchSummary = Array.isArray(data?.series?.branchSummary) ? data?.series?.branchSummary : [];
 const severityDistribution = Array.isArray(data?.series?.severityDistribution) ? data?.series?.severityDistribution : [];
 const recentSecurityEvents = unwrapTableRows(data?.tables?.recentSecurityEvents);
 const suspiciousIps = Array.isArray(data?.tables?.suspiciousIps) ? data?.tables?.suspiciousIps : [];

 const filteredSecurityEvents = useMemo(() => {
  return recentSecurityEvents.filter((item) => {
   const matchSearch =
    !searchQuery ||
    (item.action && String(item.action).toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.user && String(item.user).toLowerCase().includes(searchQuery.toLowerCase()));

   const matchSeverity =
    severityFilter === "all" ||
    (item.severity && String(item.severity).toLowerCase() === severityFilter.toLowerCase());

   return matchSearch && matchSeverity;
  });
 }, [recentSecurityEvents, searchQuery, severityFilter]);

  const metricCards = [
    { icon: ShieldAlert, label: "Failed Logins", value: kpis.failedLogins || 0, tone: "rose", trend: "Authentication failures" },
    { icon: AlertTriangle, label: "Critical Events", value: kpis.criticalEvents || 0, tone: "amber", trend: "High priority alerts" },
    { icon: KeyRound, label: "Access Overrides", value: kpis.accessOverrides || 0, tone: "blue", trend: "Permission changes" },
    { icon: Globe, label: "Unique IPs", value: kpis.uniqueFailedLoginIps || 0, tone: "green", trend: "Origin addresses" },
  ];

 const exportCsv = () => {
 handleCsvExport(
 recentSecurityEvents,
 [
 { key: "action", label: "Event" },
 { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
 { key: "severity", label: "Severity" },
 { key: "user", label: "User" },
 { key: "timestamp", label: "Timestamp", formatter: (value) => formatDateTime(value) },
 ],
 `system-monitoring-${range}`,
 );
 };

 const exportPdf = () => {
 handlePdfExport({
 title: "System Monitoring",
 subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
 filename: `system-monitoring-${range}.pdf`,
 reportType: "Monitoring",
 kpis: metricCards.map((item, i) => ({
 label: item.label,
 value: item.value,
 sub: "",
 highlight: i === 0,
 })),
 aiInsight: {
 headline: insightData?.insight?.headline || "Security summary",
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
 title: "Branch Security Summary",
 type: "table",
 headers: ["Branch", "Events", "Critical", "Overrides"],
 rows: branchSummary.map((item) => ({
 Branch: item.label,
 Events: item.totalEvents || 0,
 Critical: item.criticalCount || 0,
 Overrides: item.accessOverrideCount || 0,
 })),
 },
 {
 title: "Recent Security Events",
 type: "table",
 headers: ["Event", "Branch", "Severity", "Date"],
 rows: recentSecurityEvents.slice(0, 12).map((item) => ({
 Event: item.action || "-",
 Branch: formatBranch(item.branch),
 Severity: item.severity || "-",
 Date: formatDate(item.timestamp),
 })),
 },
 {
 title: "Suspicious IP Activity",
 type: "table",
 headers: ["IP Address", "Failed Logins", "Last Seen"],
 rows: suspiciousIps.slice(0, 12).map((item) => ({
 "IP Address": item.ipAddress || "-",
 "Failed Logins": item.attempts || 0,
 "Last Seen": formatDateTime(item.lastSeenAt),
 })),
 },
 ],
 });
 };

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="security"
        summaryTitle="Security & System Audit Intelligence"
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
      />

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
 <ReportChartPanel title="Severity distribution" subtitle="Security and audit events by severity">
 <AnalyticsDonutChart
 data={severityDistribution.map((item) => ({
 label: item.label,
 value: item.count,
 }))}
 centerLabel={{ value: kpis.criticalEvents || 0, label: "Critical" }}
 emptyTitle="No severity data"
 emptyDescription="Severity distribution will appear once audit events exist for this scope."
 />
 </ReportChartPanel>

 <ReportChartPanel title="Branch-level security summary" subtitle="High-severity actions and overrides by branch">
 <AnalyticsComparisonChart
 data={branchSummary.map((item) => ({
 label: item.label,
 highSeverity: item.highSeverityCount,
 overrides: item.accessOverrideCount,
 }))}
 bars={[
 { key: "highSeverity", label: "High severity", color: "#dc2626" },
 { key: "overrides", label: "Overrides", color: "#2563eb" },
 ]}
 emptyTitle="No branch security summary"
 emptyDescription="Branch monitoring data will appear once audit activity is available."
 />
 </ReportChartPanel>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
  <ReportChartPanel title="Recent security events" subtitle="Latest owner-level security and audit activity">
   <AnalyticsTableToolbar
     searchQuery={searchQuery}
     onSearchChange={(val) => {
       setSearchQuery(val);
       setEventPage(1);
     }}
     searchPlaceholder="Search event or user..."
     filters={[
       {
         key: "severityFilter",
         label: "Severity",
         value: severityFilter,
         onChange: (val) => {
           setSeverityFilter(val);
           setEventPage(1);
         },
         options: [
           { value: "all", label: "All Severities" },
           { value: "critical", label: "Critical" },
           { value: "warning", label: "Warning" },
           { value: "info", label: "Info" },
         ],
       },
     ]}
     hasActiveFilters={Boolean(searchQuery || severityFilter !== "all")}
     onResetFilters={() => {
       setSearchQuery("");
       setSeverityFilter("all");
       setEventPage(1);
     }}
     extraActions={
       <div className="flex items-center gap-2">
         <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
           Showing {filteredSecurityEvents.length} of {recentSecurityEvents.length} events
         </span>
         <ExportButtons onCsv={exportCsv} onPdf={exportPdf} />
       </div>
     }
   />

  <DataTable
  columns={EVENT_COLUMNS}
  data={filteredSecurityEvents}
  loading={isLoading}
  pagination={{
  page: eventPage,
  pageSize: eventPageSize,
  total: filteredSecurityEvents.length,
  onPageChange: setEventPage,
  onPageSizeChange: setEventPageSize,
  }}
  emptyState={{
  title: isError ? "System monitoring unavailable" : "No recent security events",
  description: isError
  ? "The audit summary could not be loaded."
  : "No recent security activity matched the selected filter.",
  }}
  />
  </ReportChartPanel>

  <ReportChartPanel
  title="Suspicious IPs"
  subtitle="Failed login sources with repeated attempts"
  actions={
  <Link to="/admin/audit-logs" className="admin-reports__link">
  Open full audit log
  <ExternalLink size={14} />
  </Link>
  }
  >
  <DataTable
  columns={SUSPICIOUS_IP_COLUMNS}
  data={suspiciousIps}
  loading={isLoading}
  pagination={{
  page: ipPage,
  pageSize: ipPageSize,
  total: suspiciousIps.length,
  onPageChange: setIpPage,
  onPageSizeChange: setIpPageSize,
  }}
  emptyState={{
  title: isError ? "Suspicious IP summary unavailable" : "No suspicious IPs",
  description: isError
  ? "The suspicious IP summary could not be loaded."
  : "No repeated failed-login IPs were found for this scope.",
  }}
  />
 </ReportChartPanel>
 </div>
    </div>
 );
}
