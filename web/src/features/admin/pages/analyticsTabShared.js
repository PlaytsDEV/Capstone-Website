import { useMemo } from "react";
import { Download, FileDown, Search, Filter, RotateCcw } from "lucide-react";
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
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
            />
          </div>
        )}

        {filters.map((filter) => (
          <div key={filter.key} className="flex items-center gap-2">
            {filter.label && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {filter.label}:
              </span>
            )}
            <div className="relative">
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium cursor-pointer"
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Filter
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none opacity-60"
              />
            </div>
          </div>
        ))}

        {hasActiveFilters && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background hover:bg-muted border border-border rounded-lg transition-colors"
            title="Reset filters"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {extraActions && (
        <div className="flex items-center gap-2">{extraActions}</div>
      )}
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

export function ExportButtons({ onCsv, onPdf }) {
 return (
 <div className="flex items-center gap-3">
 <button 
 className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground bg-card border border-border rounded-xl hover:bg-muted hover:text-foreground transition-colors shadow-sm" 
 onClick={onCsv}
 >
 <FileDown size={16} className="text-muted-foreground" />
 Export CSV
 </button>
 <button 
 className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-background rounded-xl hover:bg-card transition-colors shadow-sm" 
 onClick={onPdf}
 >
 <Download size={16} />
 Export PDF
 </button>
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

