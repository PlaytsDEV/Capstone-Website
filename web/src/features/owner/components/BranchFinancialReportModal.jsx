import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  PhilippinePeso,
  Receipt,
  RotateCcw,
  TrendingUp,
  X,
} from "lucide-react";
import { useFinancialsAnalytics } from "../../../shared/hooks/queries/useAnalyticsReports";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import { BRANCH_DISPLAY_NAMES } from "../../../shared/utils/constants";
import {
  buildRangeLabel,
  formatBranch,
  formatPeso,
} from "../../admin/pages/reportCommon";
import {
  handleCsvExport,
  handlePdfExport,
  unwrapTableRows,
  useReportInsights,
} from "../../admin/pages/analyticsTabShared";

const DURATION_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "365d", label: "Last 1 Year" },
  { value: "all", label: "All Time" },
];

export default function BranchFinancialReportModal({
  branch = "gil-puyat",
  onClose,
}) {
  const [selectedRange, setSelectedRange] = useState("30d");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEscapeClose(true, onClose);

  const queryParams = useMemo(
    () => ({
      branch,
      range: selectedRange,
    }),
    [branch, selectedRange],
  );

  const { data, isLoading, isError, error, refetch } =
    useFinancialsAnalytics(queryParams);

  const { data: insightData } = useReportInsights({
    reportType: "financials",
    range: selectedRange,
    branch,
  });

  const overdueRooms = useMemo(() => {
    return unwrapTableRows(data?.tables?.overdueRooms);
  }, [data?.tables?.overdueRooms]);

  const kpis = data?.kpis || {};
  const branchComparison = data?.series?.branchComparison || [];
  const revenueByMonth = data?.series?.revenueByMonth || [];
  const branchName = BRANCH_DISPLAY_NAMES[branch] || formatBranch(branch);

  const metricCards = useMemo(
    () => [
      {
        icon: PhilippinePeso,
        label: "Collected Revenue",
        value: (kpis.collectedRevenueLabel || "PHP 0").replace("PHP ", "₱"),
        sub: "Settled payments this period",
        colorClass: "text-emerald-600 dark:text-emerald-400",
        dotClass: "bg-emerald-500",
      },
      {
        icon: Receipt,
        label: "Total Billed",
        value: (kpis.billedAmountLabel || "PHP 0").replace("PHP ", "₱"),
        sub: "Gross invoices issued",
        colorClass: "text-sky-600 dark:text-sky-400",
        dotClass: "bg-sky-500",
      },
      {
        icon: AlertCircle,
        label: "Outstanding Overdue",
        value: (kpis.outstandingBalanceLabel || "PHP 0").replace("PHP ", "₱"),
        sub: `${kpis.overdueRoomsCount || overdueRooms.length} room${
          (kpis.overdueRoomsCount || overdueRooms.length) === 1 ? "" : "s"
        } with balance`,
        colorClass:
          (kpis.outstandingBalance || 0) > 0
            ? "text-rose-600 dark:text-rose-400"
            : "text-slate-500 dark:text-slate-400",
        dotClass:
          (kpis.outstandingBalance || 0) > 0 ? "bg-rose-500" : "bg-slate-400",
      },
      {
        icon: TrendingUp,
        label: "Collection Rate",
        value: kpis.collectionRateLabel || `${kpis.collectionRate || 0}%`,
        sub: "Target benchmark: > 90%",
        colorClass: "text-sky-600 dark:text-sky-400",
        dotClass: "bg-sky-500",
      },
    ],
    [kpis, overdueRooms.length],
  );

  const handleExportCsv = useCallback(() => {
    handleCsvExport(
      overdueRooms,
      [
        { key: "roomName", label: "Room" },
        {
          key: "branch",
          label: "Branch",
          formatter: (val) => formatBranch(val),
        },
        { key: "tenantCount", label: "Tenants" },
        { key: "overdueCount", label: "Overdue Bills" },
        {
          key: "outstandingBalance",
          label: "Outstanding (₱)",
          formatter: (val) => formatPeso(val),
        },
      ],
      `lilycrest-financial-report-${branch}-${selectedRange}`,
    );
  }, [overdueRooms, branch, selectedRange]);

  const handleExportPdf = useCallback(async () => {
    try {
      setIsExportingPdf(true);
      await handlePdfExport({
        title: `${branchName} Financial Report`,
        subtitle: `${buildRangeLabel(selectedRange)} • ${branchName}`,
        filename: `lilycrest-financial-report-${branch}-${selectedRange}.pdf`,
        reportType: "Financials",
        kpis: metricCards.map((item, i) => ({
          label: item.label,
          value: item.value,
          sub: item.sub,
          highlight: i === 0,
        })),
        aiInsight: {
          headline:
            insightData?.insight?.headline || "AI Financial Summary",
          summary: insightData?.insight?.summary || "",
          confidence:
            insightData?.insight?.confidence === "high"
              ? 85
              : insightData?.insight?.confidence === "medium"
                ? 60
                : insightData?.insight?.confidence === "low"
                  ? 35
                  : 0,
          confidenceLabel: insightData?.insight?.confidence
            ? `${
                insightData.insight.confidence.charAt(0).toUpperCase() +
                insightData.insight.confidence.slice(1)
              }`
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
            title: "Overdue Rooms",
            type: "table",
            headers: ["Room", "Branch", "Outstanding", "Overdue Bills"],
            rows: overdueRooms.slice(0, 15).map((item) => ({
              Room: item.roomName,
              Branch: formatBranch(item.branch),
              Outstanding: formatPeso(item.outstandingBalance),
              "Overdue Bills": item.overdueCount ?? 0,
            })),
          },
        ],
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    selectedRange,
    branch,
    branchName,
    metricCards,
    insightData,
    branchComparison,
    revenueByMonth,
    overdueRooms,
  ]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sa-branch-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-fin-modal-title"
    >
      <div
        className="sa-branch-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="sa-branch-modal-header">
          <div className="sa-branch-modal-heading">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <PhilippinePeso
                  size={20}
                  className="text-emerald-600 dark:text-emerald-400"
                />
                <h2
                  id="branch-fin-modal-title"
                  className="sa-branch-modal-title"
                >
                  {branchName} Financial Report
                </h2>
              </div>
              <span className="sa-branch-modal-branch-badge">
                <span
                  className="sa-branch-modal-branch-dot"
                  style={{
                    backgroundColor:
                      branch === "gil-puyat" ? "#2563eb" : "#d97706",
                  }}
                />
                {branchName}
              </span>
            </div>
            <p className="sa-branch-modal-subtitle">
              Operational revenue, collections, and overdue accounts summary
            </p>
          </div>

          <div className="sa-branch-modal-header-controls">
            {/* Duration Selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="sa-modal-duration-select"
                className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
              >
                Duration:
              </label>
              <select
                id="sa-modal-duration-select"
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value)}
                className="sa-branch-modal-select"
                aria-label="Filter by duration"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="sa-branch-modal-close-btn"
              aria-label="Close modal"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="sa-branch-modal-body">
          {isLoading && !data ? (
            <div className="sa-branch-modal-skeleton-wrap space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            </div>
          ) : isError && !data ? (
            <div className="sa-branch-modal-error">
              <AlertCircle size={24} className="text-rose-600 dark:text-rose-400" />
              <div>
                <strong>Financial summary unavailable</strong>
                <p>
                  {error?.message ||
                    "Could not load financial metrics for this branch."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="sa-branch-modal-btn sa-branch-modal-btn--secondary"
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <>
              {/* ── 4 KPI Metric Cards ── */}
              <div className="sa-branch-modal-kpi-grid">
                {metricCards.map((kpi) => (
                  <div key={kpi.label} className="sa-branch-modal-kpi-card">
                    <div className="flex items-center justify-between">
                      <span className="sa-branch-modal-kpi-label">
                        {kpi.label}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${kpi.dotClass}`}
                      />
                    </div>
                    <div
                      className={`sa-branch-modal-kpi-value ${kpi.colorClass}`}
                    >
                      {kpi.value}
                    </div>
                    <span className="sa-branch-modal-kpi-sub">{kpi.sub}</span>
                  </div>
                ))}
              </div>

              {/* ── Overdue Rooms Table ── */}
              <div className="sa-branch-modal-section">
                <div className="sa-branch-modal-section-header">
                  <div className="flex items-center gap-2">
                    <span className="sa-branch-modal-section-title">
                      Overdue Exposure by Room
                    </span>
                    <span className="sa-branch-modal-count-pill">
                      {overdueRooms.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Sorted by outstanding amount
                  </span>
                </div>

                {overdueRooms.length === 0 ? (
                  <div className="sa-branch-modal-empty-rooms">
                    <CheckCircle2
                      size={18}
                      className="text-emerald-600 dark:text-emerald-400"
                    />
                    <span>
                      All rooms in <strong>{branchName}</strong> are fully
                      settled for this period.
                    </span>
                  </div>
                ) : (
                  <div className="sa-branch-modal-table-wrap">
                    <table className="sa-branch-modal-table">
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Branch</th>
                          <th className="text-center">Tenants</th>
                          <th className="text-center">Overdue Bills</th>
                          <th className="text-right">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overdueRooms.slice(0, 10).map((room, idx) => (
                          <tr key={room.roomId || `${room.roomName}-${idx}`}>
                            <td className="font-semibold text-foreground">
                              {room.roomName}
                            </td>
                            <td className="text-muted-foreground">
                              {formatBranch(room.branch)}
                            </td>
                            <td className="text-center text-muted-foreground tabular-nums">
                              {room.tenantCount ?? "-"}
                            </td>
                            <td className="text-center tabular-nums">
                              <span className="sa-branch-modal-overdue-count">
                                {room.overdueCount ?? 0}
                              </span>
                            </td>
                            <td className="text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                              {formatPeso(room.outstandingBalance || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {overdueRooms.length > 10 && (
                      <div className="sa-branch-modal-table-more">
                        Showing top 10 of {overdueRooms.length} overdue rooms.
                        Use full Analytics to review the entire list.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="sa-branch-modal-footer">
          <div className="sa-branch-modal-footer-left">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isLoading || overdueRooms.length === 0}
              className="sa-branch-modal-btn sa-branch-modal-btn--secondary"
              title="Export overdue accounts as CSV"
            >
              <FileSpreadsheet
                size={14}
                className="text-emerald-600 dark:text-emerald-400"
              />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isLoading || isExportingPdf}
              className="sa-branch-modal-btn sa-branch-modal-btn--secondary"
              title="Generate and download full PDF financial statement"
            >
              {isExportingPdf ? (
                <LoaderCircle size={14} className="animate-spin text-primary" />
              ) : (
                <FileText
                  size={14}
                  className="text-rose-600 dark:text-rose-400"
                />
              )}
              <span>{isExportingPdf ? "Generating PDF..." : "Export PDF"}</span>
            </button>
          </div>

          <div className="sa-branch-modal-footer-right">
            <button
              type="button"
              onClick={onClose}
              className="sa-branch-modal-btn sa-branch-modal-btn--ghost"
            >
              Close
            </button>

            <Link
              to={`/admin/analytics?tab=financials&branch=${branch}&range=${selectedRange}`}
              className="sa-branch-modal-btn sa-branch-modal-btn--primary"
              onClick={onClose}
            >
              <span>Open Full Analytics</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
