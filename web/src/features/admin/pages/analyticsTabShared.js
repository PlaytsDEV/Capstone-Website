import { useMemo, useState, useRef, useEffect } from "react";
import {
  Download,
  Search,
  RotateCcw,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Sparkles,
  CalendarDays,
  X,
} from "lucide-react";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { exportReportPdf } from "../../../shared/utils/reportPdf";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";
import { useAnalyticsInsights } from "../../../shared/hooks/queries/useAnalyticsReports";
import { analyticsApi } from "../../../shared/api/apiClient";
import { AnalyticsInsightPanel, ReportChartPanel, ReportMetricCard } from "../components/shared";
import { buildRangeLabel } from "./reportCommon";

export {
  getDynamicOccupancyPrompts,
  getDynamicBillingPrompts,
  getDynamicOperationsPrompts,
  getDynamicAcquisitionPrompts,
  getDynamicDemographicsPrompts,
  getDynamicFinancialsPrompts,
  getDynamicMonitoringPrompts,
  getDynamicOverviewPrompts,
} from "./analyticsTabUtils.js";

/**
 * Reusable table filter toolbar for Analytics tables.
 * Provides high-contrast, gradient-free search and select dropdown controls with clean 1px borders.
 */
export function AnalyticsTableToolbar({
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onResetFilters,
  hasActiveFilters = false,
  extraActions = null,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-muted/40 border border-border rounded-xl">
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        {filters.map((f, idx) => (
          <div key={idx} className="min-w-[140px]">
            <select
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width%3D'16' height%3D'16' viewBox%3D'0 0 24 24' fill%3D'none' stroke%3D'%231e293b' stroke-width%3D'2' stroke-linecap%3D'round' stroke-linejoin%3D'round'%3E%3Cpolyline points%3D'6 9 12 15 18 9'%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                backgroundSize: "12px 12px",
                paddingRight: "28px",
              }}
            >
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card border border-border rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {extraActions && <div className="flex items-center gap-2">{extraActions}</div>}
    </div>
  );
}

/**
 * Safely unwrap a table field from the analytics API.
 * The backend's `buildPaginatedTable` returns `{ rows, pagination }`,
 * but older API fixtures or flat tables may return a bare array.
 */
export function unwrapTableRows(tableField) {
  if (Array.isArray(tableField)) return tableField;
  if (Array.isArray(tableField?.rows)) return tableField.rows;
  return [];
}

export function unwrapTablePagination(tableField) {
  if (tableField?.pagination && typeof tableField.pagination === "object") {
    return tableField.pagination;
  }
  const rows = unwrapTableRows(tableField);
  return {
    total: rows.length,
    page: 1,
    limit: rows.length || 10,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };
}

export const RANGE_OPTIONS_SHORT = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "60d", label: "Last 60 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "365d", label: "Last 1 Year" },
];

export const RANGE_OPTIONS_LONG = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];

export function ExportButtons({
  onCsv,
  onPdf,
  loading = false,
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (fn) => {
    setIsOpen(false);
    if (fn) fn();
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {loading ? (
          <LoaderCircle size={13} className="animate-spin text-primary" />
        ) : (
          <Download size={13} />
        )}
        <span>{loading ? "Exporting..." : "Export"}</span>
        <ChevronDown
          size={13}
          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && !disabled && !loading && (
        <div
          className="absolute right-0 mt-1.5 w-44 rounded-xl bg-card border border-border shadow-lg p-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100"
          role="menu"
        >
          {onCsv && (
            <button
              type="button"
              onClick={() => handleAction(onCsv)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors text-left cursor-pointer"
              role="menuitem"
            >
              <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Export as CSV</span>
            </button>
          )}
          {onPdf && (
            <button
              type="button"
              onClick={() => handleAction(onPdf)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors text-left cursor-pointer"
              role="menuitem"
            >
              <FileText size={15} className="text-rose-600 dark:text-rose-400" />
              <span>Export as PDF</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ items, children, className = "" }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 ${className}`.trim()}>
      {Array.isArray(items)
        ? items.map((item) => (
            <ReportMetricCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              trend={item.trend}
              change={item.change}
              changeType={item.changeType}
              note={item.note}
              tone={item.tone}
              anomalyBadge={item.anomalyBadge}
              onClick={item.onClick}
            />
          ))
        : children}
    </div>
  );
}

export function buildBranchControl({ isOwner, branch, onChange }) {
  if (!isOwner) return null;
  return {
    value: branch,
    onChange,
    options: OWNER_BRANCH_FILTER_OPTIONS,
  };
}

export function handleCsvExport(data, columns, filename) {
  exportToCSV(data, columns, filename);
}

export async function handlePdfExport(config) {
  await exportReportPdf(config);
}

export function useReportInsights({ reportType, range, branch }) {
  const params = useMemo(
    () => ({
      reportType,
      range,
      ...(branch !== undefined ? { branch } : {}),
    }),
    [branch, range, reportType],
  );

  return useAnalyticsInsights(params);
}

export function AnalyticsInsightSection({
  reportLabel,
  summaryTitle,
  reportType,
  range,
  branch,
  data,
  isLoading,
  isError,
  suggestedPrompts = [],
  onExecuteAction = null,
  defaultCollapsed = true,
  className = "",
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [customData, setCustomData] = useState(null);

  useEffect(() => {
    setActiveQuestion("");
    setCustomData(null);
  }, [range, branch, reportType]);

  const handleAskQuestion = async (queryText) => {
    const q = String(queryText || "").trim();
    if (!q || isAsking) return;
    setIsAsking(true);
    setActiveQuestion(q);

    try {
      const response = await analyticsApi.getInsights({
        reportType: reportType || "hub",
        range,
        ...(branch !== undefined ? { branch } : {}),
        question: q,
      });
      const resolved = response?.data || response;
      if (resolved?.insight) {
        setCustomData(resolved);
      }
    } catch (err) {
      console.error("Failed to query Analytics AI:", err);
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearQuestion = () => {
    setActiveQuestion("");
    setCustomData(null);
  };

  const effectiveData = customData || data;
  const insight = effectiveData?.insight;

  if (!isLoading && !isError && !insight) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`p-3.5 rounded-xl bg-card border border-border flex items-center gap-3 text-xs text-muted-foreground ${className}`.trim()}>
        <LoaderCircle size={14} className="animate-spin text-primary" />
        <span>Reviewing data for the {reportLabel} report...</span>
      </div>
    );
  }

  if (isError || !insight) return null;

  return (
    <div className={`rounded-xl bg-card border border-border overflow-hidden transition-all shadow-xs ${className}`.trim()}>
      <div
        className={`px-4 py-3 bg-muted/40 flex items-center justify-between cursor-pointer transition-colors ${collapsed ? "" : "border-b border-border"}`}
        onClick={() => setCollapsed((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((prev) => !prev);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Sparkles size={13} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground tracking-tight">
              {summaryTitle || "Executive AI Summary"}
            </h3>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {insight.headline || `Key performance highlights for ${reportLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>{collapsed ? "Show Summary" : "Hide"}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="p-4">
          <AnalyticsInsightPanel
            title={summaryTitle}
            subtitle={`AI summary • ${insight.confidence || "standard"} confidence`}
            data={effectiveData}
            isLoading={false}
            isError={false}
            onAskQuestion={handleAskQuestion}
            onClearQuestion={handleClearQuestion}
            onExecuteAction={onExecuteAction}
            activeQuestion={activeQuestion}
            isAsking={isAsking}
            suggestedPrompts={suggestedPrompts}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Anomaly detection helper for Billing & Financials
 */
export function detectBillingAnomalies(kpis = {}) {
  const collectionRate = Number(kpis.collectionRate ?? 100);
  const overdueAmount = Number(kpis.overdueAmount ?? 0);
  const billedAmount = Number(kpis.billedAmount ?? 0);

  const badges = {};

  if (collectionRate < 70) {
    badges.collectionRate = { label: "Critical <70%", severity: "danger" };
  } else if (collectionRate < 85) {
    badges.collectionRate = { label: "Below Target <85%", severity: "warning" };
  }

  if (billedAmount > 0 && overdueAmount / billedAmount > 0.3) {
    badges.overdueAmount = { label: "Overdue Spike >30%", severity: "danger" };
  } else if (overdueAmount > 15000) {
    badges.overdueAmount = { label: "High Overdue Arrears", severity: "warning" };
  }

  return badges;
}

/**
 * Anomaly detection helper for Occupancy
 */
export function detectOccupancyAnomalies(kpis = {}) {
  const occupancyRate = Number(kpis.occupancyRate ?? 100);
  const unavailableBeds = Number(kpis.unavailableBeds ?? 0);

  const badges = {};

  if (occupancyRate < 60) {
    badges.occupancyRate = { label: "Low Capacity <60%", severity: "danger" };
  } else if (occupancyRate < 75) {
    badges.occupancyRate = { label: "Below Target <75%", severity: "warning" };
  } else if (occupancyRate >= 95) {
    badges.occupancyRate = { label: "Peak Occupancy", severity: "success" };
  }

  if (unavailableBeds > 2) {
    badges.availableBeds = { label: `${unavailableBeds} Offline Beds`, severity: "warning" };
  }

  return badges;
}

/**
 * Anomaly detection helper for Operations & Maintenance
 */
export function detectOperationsAnomalies(kpis = {}) {
  const slaComplianceRate = Number(kpis.slaComplianceRate ?? 100);
  const maintenanceRequests = Number(kpis.maintenanceRequests ?? 0);

  const badges = {};

  if (slaComplianceRate < 70) {
    badges.slaComplianceRate = { label: "Turnaround Critical <70%", severity: "danger" };
  } else if (slaComplianceRate < 85) {
    badges.slaComplianceRate = { label: "Turnaround Risk <85%", severity: "warning" };
  }

  if (maintenanceRequests > 20) {
    badges.maintenanceRequests = { label: "High Ticket Volume", severity: "warning" };
  }

  return badges;
}

export function buildInsightPdfSections(insightData, title = "AI Summary") {
  const insight = insightData?.insight;
  if (!insight) return [];

  const rows = [
    insight.headline ? `Headline: ${insight.headline}` : null,
    insight.summary ? `Summary: ${insight.summary}` : null,
    insight.confidence ? `Confidence: ${insight.confidence}` : null,
    ...(insight.keyFindings || []).map((item) => `What stands out: ${item}`),
    ...(insight.anomalies || []).map((item) => `Things to watch: ${item}`),
    ...(insight.recommendedActions || []).map((item) => `What to do next: ${item}`),
    insight.disclaimer ? `Disclaimer: ${insight.disclaimer}` : null,
  ].filter(Boolean);

  if (rows.length === 0) return [];

  return [
    {
      title,
      description: "AI-generated narrative based on the report data shown in this export.",
      rows,
    },
  ];
}

export function calculateRangeDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return null;
  // Inclusive day calculation (e.g. Jan 1 to Jan 2 = 2 days, Jan 1 to Dec 12 = 346 days)
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

export function CustomDateRangeModal({
  isOpen,
  onClose,
  onApply,
  initialDays = 30,
}) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (Number.isFinite(initialDays) && initialDays > 0 ? initialDays - 1 : 29));
    return d.toISOString().split("T")[0];
  }, [initialDays]);

  const [startDate, setStartDate] = useState(defaultStartStr);
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    if (isOpen) {
      setEndDate(todayStr);
      const d = new Date();
      d.setDate(d.getDate() - (Number.isFinite(initialDays) && initialDays > 0 ? initialDays - 1 : 29));
      setStartDate(d.toISOString().split("T")[0]);
    }
  }, [isOpen, initialDays, todayStr]);

  const diffDays = useMemo(() => calculateRangeDays(startDate, endDate), [startDate, endDate]);
  const isInvalidRange = !startDate || !endDate || !diffDays || diffDays <= 0;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleYtd = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleConfirm = () => {
    if (isInvalidRange) return;
    onApply(diffDays, { startDate, endDate });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Custom Date Range</h3>
              <p className="text-[11px] text-muted-foreground">Count days between chosen dates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button"
            onClick={() => handlePreset(30)}
            className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground rounded-md border border-border transition-colors cursor-pointer"
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => handlePreset(60)}
            className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground rounded-md border border-border transition-colors cursor-pointer"
          >
            Last 60 days
          </button>
          <button
            type="button"
            onClick={() => handlePreset(90)}
            className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground rounded-md border border-border transition-colors cursor-pointer"
          >
            Last 90 days
          </button>
          <button
            type="button"
            onClick={() => handlePreset(365)}
            className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground rounded-md border border-border transition-colors cursor-pointer"
          >
            Last 1 year
          </button>
          <button
            type="button"
            onClick={handleYtd}
            className="px-2.5 py-1 text-[11px] font-medium bg-muted/60 hover:bg-muted text-foreground rounded-md border border-border transition-colors cursor-pointer"
          >
            Year to Date
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-background text-foreground border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-background text-foreground border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-muted/40 border border-border">
          {diffDays ? (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Calculated duration:</span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                {diffDays} {diffDays === 1 ? "day" : "days"}
              </span>
            </div>
          ) : (
            <div className="text-xs font-medium text-destructive">
              End date must be on or after start date.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isInvalidRange}
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Apply Range ({diffDays || 0} {diffDays === 1 ? "day" : "days"})
          </button>
        </div>
      </div>
    </div>
  );
}

export function CardFilterSelect({
  value,
  onChange,
  options = RANGE_OPTIONS_SHORT,
  label = null,
  className = "",
  selectClassName = "",
  labelClassName = "",
  allowCustom = true,
  ariaLabel = "Filter by duration",
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentDays = useMemo(() => {
    const match = String(value || "").match(/^(\d+)d$/i);
    return match ? parseInt(match[1], 10) : 30;
  }, [value]);

  const computedOptions = useMemo(() => {
    const list = [...options];
    const hasCurrent = list.some((opt) => opt.value === value);
    if (!hasCurrent && value) {
      list.push({
        value,
        label: buildRangeLabel(value),
      });
    }
    if (allowCustom && !list.some((opt) => opt.value === "__custom__")) {
      list.push({
        value: "__custom__",
        label: "Custom range...",
      });
    }
    return list;
  }, [options, value, allowCustom]);

  const handleSelectChange = (e) => {
    const selected = e.target.value;
    if (selected === "__custom__") {
      setIsModalOpen(true);
    } else {
      onChange(selected);
    }
  };

  const handleCustomApply = (days) => {
    onChange(`${days}d`);
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`.trim()}>
        {label && (
          <span className={`text-[11px] font-medium text-muted-foreground whitespace-nowrap ${labelClassName}`.trim()}>
            {label}
          </span>
        )}
        <select
          value={value}
          onChange={handleSelectChange}
          onClick={(e) => e.stopPropagation()}
          aria-label={ariaLabel}
          className={`px-2 py-1 text-xs font-semibold bg-background text-foreground border border-border/80 rounded-md shadow-xs hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer ${selectClassName}`.trim()}
        >
          {computedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {allowCustom && (
        <CustomDateRangeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onApply={handleCustomApply}
          initialDays={currentDays}
        />
      )}
    </>
  );
}
