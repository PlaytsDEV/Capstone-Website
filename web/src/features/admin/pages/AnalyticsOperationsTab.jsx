import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useOperationsReport } from "../../../shared/hooks/queries/useAnalyticsReports";
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

export default function AnalyticsOperationsTab({
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
 const { data, isLoading, isError } = useOperationsReport(params);
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
 title: "Recent Reservations",
 type: "table",
 headers: ["Guest", "Room", "Status", "Created"],
 rows: reservations.slice(0, 12).map((item) => ({
 Guest: item.guestName || "-",
 Room: item.roomName || "-",
 Status: item.status || "-",
 Created: formatDate(item.createdAt),
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
 title="Operations Analytics"
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

 <ReportChartPanel title="Maintenance and reservation tables" subtitle="Most recent branch-scoped maintenance tickets">
 <DataTable
 columns={MAINTENANCE_COLUMNS}
 data={maintenanceIssues}
 loading={isLoading}
 pagination={{
 page,
 pageSize: 10,
 total: maintenanceIssues.length,
 onPageChange: setPage,
 }}
 emptyState={{
 title: isError ? "Operations report unavailable" : "No maintenance issues",
 description: isError
 ? "The operations report could not be loaded."
 : "No maintenance issues were found for the selected scope.",
 }}
 />
 </ReportChartPanel>

 <ReportChartPanel
 title="Recent reservations"
 subtitle="Latest reservation activity in the selected reporting window"
 actions={
 <Link to="/admin/reservations" className="admin-reports__link">
 Open reservations
 <ExternalLink size={14} />
 </Link>
 }
 >
 <div className="admin-reports__panel-stack">
 {reservations.slice(0, 6).map((reservation) => (
 <div key={reservation.id} className="admin-reports__meta-card">
 <span className="admin-reports__meta-label">{reservation.guestName}</span>
 <div className="admin-reports__meta-value">{reservation.roomName}</div>
 <p className="admin-reports__hint">
 {reservation.status} • {formatDate(reservation.createdAt)} • {formatBranch(reservation.branch)}
 </p>
 </div>
 ))}
 {!reservations.length ? (
 <p className="admin-reports__hint">No recent reservations for the selected scope.</p>
 ) : null}
 </div>
 </ReportChartPanel>
 </AnalyticsTabLayout>
 );
}
