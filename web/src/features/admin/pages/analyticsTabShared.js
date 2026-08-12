import { useMemo, useState, useRef, useEffect } from "react";
import { Download, FileDown, Search, Filter, RotateCcw, ChevronDown, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { exportReportPdf } from "../../../shared/utils/reportPdf";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";
import { useAnalyticsInsights } from "../../../shared/hooks/queries/useAnalyticsReports";
import { AnalyticsInsightPanel, ReportChartPanel, ReportMetricCard } from "../components/shared";

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
 * but some table fields are plain arrays. This helper normalizes both
 * shapes to a plain array so `.slice()` / `.length` never crash.
 */
export function unwrapTableRows(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.rows)) return value.rows;
  return [];
}

export const RANGE_OPTIONS_SHORT = [
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
];

export const RANGE_OPTIONS_LONG = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];

export function ExportButtons({ onCsv, onPdf, disabled = false, loading = false, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

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
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all cursor-pointer"
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

export function MetricGrid({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {items.map((item) => (
        <ReportMetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          tone={item.tone}
          onClick={item.onClick}
        />
      ))}
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
  data,
  isLoading,
  isError,
}) {
  return (
    <ReportChartPanel
      title="AI summary"
      subtitle={`AI-generated insight for this ${reportLabel} report`}
    >
      <AnalyticsInsightPanel
        title={summaryTitle}
        subtitle="AI-generated report insight"
        data={data}
        isLoading={isLoading}
        isError={isError}
      />
    </ReportChartPanel>
  );
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

export function CardFilterSelect({
  value,
  onChange,
  options = RANGE_OPTIONS_SHORT,
  label = null,
  className = "",
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="px-2 py-1 text-xs font-semibold bg-background text-foreground border border-border/80 rounded-md shadow-xs hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
