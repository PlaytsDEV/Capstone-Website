import { useMemo, useState } from "react";
import { useFinancialsAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
 AnalyticsBarChart,
 AnalyticsComparisonChart,
 AnalyticsTabLayout,
 AnalyticsToolbar,
 DataTable,
 ReportChartPanel,
} from "../components/shared";
import { buildRangeLabel, formatBranch, formatPeso } from "./reportCommon";
import {
 AnalyticsInsightSection,
 AnalyticsTableToolbar,
 buildInsightPdfSections,
 ExportButtons,
 handleCsvExport,
 handlePdfExport,
 MetricGrid,
 RANGE_OPTIONS_LONG,
 unwrapTableRows,
 useReportInsights,
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

export default function AnalyticsFinancialsTab({ branch, range, onBranchChange, onRangeChange }) {
 const [page, setPage] = useState(1);
 const [searchQuery, setSearchQuery] = useState("");
 const [exposureFilter, setExposureFilter] = useState("all");

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
 const overdueRoomsPagination = overdueAccounts?.pagination || { total: 0 };

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

 const metricCards = [
 { label: "Collected", value: data?.kpis?.collectedRevenueLabel || "PHP 0", tone: "green" },
 { label: "Outstanding", value: data?.kpis?.outstandingBalanceLabel || "PHP 0", tone: "rose" },
 { label: "Overdue", value: data?.kpis?.overdueAmountLabel || "PHP 0", tone: "amber" },
 { label: "Collection Rate", value: data?.kpis?.collectionRateLabel || "0%", tone: "blue" },
 ];

 const exportCsv = () => {
 handleCsvExport(
 overdueRooms,
 [
 { key: "roomName", label: "Room" },
 { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
 { key: "tenantCount", label: "Tenants" },
 { key: "overdueCount", label: "Overdue Bills" },
 { key: "outstandingBalance", label: "Outstanding", formatter: (value) => formatPeso(value) },
 ],
 `financials-overdue-rooms-${range}`,
 );
 };

 const exportPdf = () => {
 handlePdfExport({
 title: "Financial Overview",
 subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
 filename: `financial-overview-${range}.pdf`,
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
 rows: overdueRooms.slice(0, 12).map((item) => ({
 Room: item.roomName,
 Branch: formatBranch(item.branch),
 Outstanding: formatPeso(item.outstandingBalance),
 "Overdue Bills": item.overdueCount ?? 0,
 })),
 },
 ],
 });
 };

 return (
 <AnalyticsTabLayout
 header={
 <AnalyticsToolbar
 title="Financial Analytics"
 subtitle={`Scope: ${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`}
 range={{ value: range, onChange: (value) => { setPage(1); onRangeChange(value); }, options: RANGE_OPTIONS_LONG }}
 branch={{
 value: branch,
 onChange: (value) => {
 setPage(1);
 onBranchChange(value);
 },
 options: [
 { value: "all", label: "All Branches" },
 { value: "gil-puyat", label: "Gil Puyat" },
 { value: "guadalupe", label: "Guadalupe" },
 ],
 }}
 actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
 />
 }
 >
 <MetricGrid items={metricCards} />

 <AnalyticsInsightSection
 reportLabel="financials"
 summaryTitle="Financial Summary"
 data={insightData}
 isLoading={isInsightLoading}
 isError={isInsightError}
 />

 <div className="admin-reports__grid">
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

 <div className="admin-reports__grid">
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
 <div className="admin-reports__meta-grid">
 <div className="admin-reports__meta-card">
 <span className="admin-reports__meta-label">Net position</span>
 <div className="admin-reports__meta-value">{data?.kpis?.netPositionLabel || "PHP 0"}</div>
 </div>
 <div className="admin-reports__meta-card">
 <span className="admin-reports__meta-label">Latest billing month</span>
 <div className="admin-reports__meta-value">{revenueByMonth.at(-1)?.label || "-"}</div>
 <p className="admin-reports__hint">
 Billed {formatPeso(revenueByMonth.at(-1)?.billedAmount || 0)}
 </p>
 </div>
 </div>
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
   <span className="text-xs font-medium text-muted-foreground">
     Showing {filteredOverdueRooms.length} of {overdueRooms.length} rooms
   </span>
 }
 />
 <DataTable
 columns={OVERDUE_ROOM_COLUMNS}
 data={filteredOverdueRooms}
 loading={isLoading}
 pagination={{
 page,
 pageSize: 10,
 total: filteredOverdueRooms.length,
 onPageChange: setPage,
 }}
 emptyState={{
 title: isError ? "Financial overview unavailable" : "No overdue rooms",
 description: isError
 ? "The financial overview could not be loaded."
 : "No overdue room exposure was found for the selected filter.",
 }}
 />
 </ReportChartPanel>
 </AnalyticsTabLayout>
 );
}
