import { useMemo, useState } from "react";
import { useBillingReport, useFinancialsAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsComparisonChart,
  AnalyticsDonutChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  ReportChartPanel,
} from "../components/shared";
import {
  buildRangeLabel,
  formatBranch,
  formatDate,
  formatPeso,
} from "./reportCommon";
import {
  AnalyticsInsightSection,
  buildInsightPdfSections,
  buildBranchControl,
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  RANGE_OPTIONS_LONG,
  unwrapTableRows,
  useReportInsights,
} from "./analyticsTabShared";

const OVERDUE_COLUMNS = [
  { key: "tenantName", label: "Tenant", sortable: true },
  { key: "roomName", label: "Room", sortable: true },
  { key: "branch", label: "Branch", render: (row) => formatBranch(row.branch) },
  { key: "status", label: "Status", sortable: true },
  {
    key: "dueDate",
    label: "Due Date",
    render: (row) => formatDate(row.dueDate),
  },
  { key: "daysOverdue", label: "Days Overdue", sortable: true },
  {
    key: "balance",
    label: "Balance",
    render: (row) => formatPeso(row.balance),
    sortable: true,
  },
];

export default function AnalyticsBillingTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const { data, isLoading, isError } = useBillingReport(params);
  const { data: financialsData } = useFinancialsAnalytics(params);
  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "billing",
    range,
    branch: isOwner ? branch : undefined,
  });

  const overdueAccounts = unwrapTableRows(data?.tables?.overdueAccounts);
  const unpaidBalances = Array.isArray(data?.tables?.unpaidBalances)
    ? data?.tables?.unpaidBalances
    : [];
  const revenueByMonth = data?.series?.revenueByMonth || [];
  const statusDistribution = data?.series?.statusDistribution || [];
  const overdueAging = data?.series?.overdueAging || [];
  const branchComparison = financialsData?.series?.branchComparison || [];
  const insight = insightData?.insight;

  const filteredOverdue = useMemo(() => {
    return overdueAccounts.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.tenantName && String(item.tenantName).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.roomName && String(item.roomName).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (item.status && String(item.status).toLowerCase() === statusFilter.toLowerCase());

      return matchSearch && matchStatus;
    });
  }, [overdueAccounts, searchQuery, statusFilter]);

  const metricCards = [
    {
      label: "Collected Revenue",
      value: data?.kpis?.collectedRevenueLabel || "PHP 0",
      tone: "green",
    },
    {
      label: "Billed Amount",
      value: data?.kpis?.billedAmountLabel || "PHP 0",
      tone: "blue",
    },
    {
      label: "Outstanding Overdue",
      value: data?.kpis?.outstandingBalanceLabel || "PHP 0",
      tone: "rose",
    },
    {
      label: "Collection Rate",
      value: data?.kpis?.collectionRateLabel || "0%",
      tone: "amber",
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      overdueAccounts,
      [
        { key: "tenantName", label: "Tenant" },
        { key: "roomName", label: "Room" },
        { key: "branch", label: "Branch", formatter: (value) => formatBranch(value) },
        { key: "status", label: "Status" },
        { key: "dueDate", label: "Due Date", formatter: (value) => formatDate(value) },
        { key: "daysOverdue", label: "Days Overdue" },
        { key: "balance", label: "Balance", formatter: (value) => formatPeso(value) },
      ],
      `billing-report-${range}`,
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Billing & Revenue Analytics",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `billing-report-${range}.pdf`,
      reportType: "Billing",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: "",
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insight?.headline || "Billing summary",
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
          title: "Revenue by Month",
          type: "table",
          headers: ["Month", "Collected", "Billed"],
          rows: revenueByMonth.map((item) => ({
            Month: item.label,
            Collected: formatPeso(item.collectedRevenue),
            Billed: formatPeso(item.billedAmount),
          })),
        },
        {
          title: "Overdue Aging",
          type: "table",
          headers: ["Aging Bracket", "Outstanding Amount"],
          rows: overdueAging.map((item) => ({
            "Aging Bracket": item.label,
            "Outstanding Amount": formatPeso(item.amount),
          })),
        },
        {
          title: "Top Overdue Accounts",
          type: "table",
          headers: ["Tenant", "Room", "Branch", "Balance", "Days Overdue"],
          rows: overdueAccounts.slice(0, 10).map((item) => ({
            Tenant: item.tenantName || "-",
            Room: item.roomName || "-",
            Branch: formatBranch(item.branch),
            Balance: formatPeso(item.balance),
            "Days Overdue": item.daysOverdue || 0,
          })),
        },
      ],
    });
  };

  return (
    <AnalyticsTabLayout
      header={
        <AnalyticsToolbar
          title="Billing & Revenue Analytics"
          subtitle={`Scope: ${formatBranch(data?.scope?.branch || branch)} • ${buildRangeLabel(range)}`}
          range={{ value: range, onChange: (value) => { setPage(1); onRangeChange(value); }, options: RANGE_OPTIONS_LONG }}
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
        reportLabel="billing"
        summaryTitle="Billing & Financial Summary"
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
      />

      {isOwner && branchComparison.length > 0 && (
        <ReportChartPanel title="Branch financial comparison" subtitle="Collections, overdue exposure, and collection rate by branch">
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
      )}

      <div className="admin-reports__grid">
        <ReportChartPanel title="Revenue by month" subtitle="Collected vs billed revenue across time">
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
            valueFormatter={(val) => formatPeso(val)}
            emptyTitle="No revenue data"
            emptyDescription="Monthly revenue trends will appear once billing history is recorded."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Payment status distribution" subtitle="Current status of all generated bills">
          <AnalyticsDonutChart
            data={statusDistribution.map((item) => ({
              label: item.label,
              value: item.count,
            }))}
            centerLabel={{
              value: statusDistribution.reduce((sum, i) => sum + i.count, 0),
              label: "Bills",
            }}
            emptyTitle="No bill status data"
            emptyDescription="Bill status distribution will populate as billing periods run."
          />
        </ReportChartPanel>
      </div>

      <div className="admin-reports__grid">
        <ReportChartPanel title="Overdue aging" subtitle="Unpaid balances bucketed by delay">
          <AnalyticsBarChart
            data={overdueAging.map((item) => ({
              label: item.label,
              amount: item.amount,
            }))}
            bars={[{ key: "amount", label: "Overdue Amount", color: "#f97316" }]}
            valueFormatter={(val) => formatPeso(val)}
            emptyTitle="No overdue aging data"
            emptyDescription="Overdue aging distribution will appear when overdue bills exist."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Net position summary" subtitle="Collected revenue versus overdue exposure">
          <div className="admin-reports__meta-grid">
            <div className="admin-reports__meta-card">
              <span className="admin-reports__meta-label">Total Billed</span>
              <div className="admin-reports__meta-value">
                {data?.kpis?.billedAmountLabel || "PHP 0"}
              </div>
            </div>
            <div className="admin-reports__meta-card">
              <span className="admin-reports__meta-label">Total Collected</span>
              <div className="admin-reports__meta-value">
                {data?.kpis?.collectedRevenueLabel || "PHP 0"}
              </div>
            </div>
          </div>
        </ReportChartPanel>
      </div>

      <ReportChartPanel title="Overdue accounts table" subtitle="Tenants with outstanding unpaid balances">
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search tenant or room..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "6px",
              width: "180px",
              outline: "none",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              fontSize: "12px",
              padding: "6px 10px",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "6px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground, #64748b)", marginLeft: "auto" }}>
            Showing {filteredOverdue.length} of {overdueAccounts.length} accounts
          </span>
        </div>

        <DataTable
          columns={OVERDUE_COLUMNS}
          data={filteredOverdue}
          loading={isLoading}
          pagination={{
            page,
            pageSize: 10,
            total: filteredOverdue.length,
            onPageChange: setPage,
          }}
          emptyState={{
            title: isError ? "Billing report unavailable" : "No overdue accounts",
            description: isError
              ? "The billing report could not be loaded."
              : "No overdue tenant accounts found matching your filter.",
          }}
        />
      </ReportChartPanel>
    </AnalyticsTabLayout>
  );
}
