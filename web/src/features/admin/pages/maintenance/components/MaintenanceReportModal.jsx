import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  MessageSquare,
  XCircle,
} from "lucide-react";
import {
  BRANCH_OPTIONS,
} from "../../../../../shared/utils/constants";
import {
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../../shared/utils/maintenanceConfig";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
  ReportChartPanel,
  ReportMetricCard,
} from "../../../components/shared";
import {
  ANALYTICS_SLA_OPTIONS,
  ASSIGNMENT_FILTER_OPTIONS,
  fmtDateTime,
  getRequestReportMeta,
  getStructuredReportSections,
  REPORT_NA,
  REPORT_TYPE_LABELS,
  SUMMARY_STATUSES,
} from "../maintenanceUtils";

export function MaintenanceExportDropdown({
  options,
  onExportCSV,
  onExportPDF,
  disabled = false,
  loading = false,
  align = "right",
  placement = "bottom",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Support either explicit onExportCSV / onExportPDF handlers or options array
  const resolvedOptions = Array.isArray(options)
    ? options.filter(Boolean)
    : [
        onExportCSV && {
          key: "export-csv",
          label: "Export as CSV",
          icon: <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
          onClick: onExportCSV,
          disabled: disabled || loading,
        },
        onExportPDF && {
          key: "export-pdf",
          label: "Export as PDF",
          icon: <FileText size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />,
          onClick: onExportPDF,
          disabled: disabled || loading,
        },
      ].filter(Boolean);

  const handleAction = (actionFn) => {
    setOpen(false);
    if (actionFn) actionFn();
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || loading || resolvedOptions.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {loading ? (
          <LoaderCircle size={13} className="animate-spin text-slate-800 dark:text-slate-200 shrink-0" />
        ) : (
          <Download size={13} className="shrink-0 text-slate-800 dark:text-slate-200" />
        )}
        <span>{loading ? "Exporting..." : "Export"}</span>
        <ChevronDown
          size={13}
          className={`text-slate-800 dark:text-slate-200 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && !loading && resolvedOptions.length > 0 ? (
        <div
          role="menu"
          className={`absolute z-[1300] min-w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100 ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {resolvedOptions.map((option) => {
            const isCsv =
              option.key?.toLowerCase().includes("csv") ||
              option.label?.toLowerCase().includes("csv");
            const isPdf =
              option.key?.toLowerCase().includes("pdf") ||
              option.label?.toLowerCase().includes("pdf");

            const optionIcon =
              option.icon ||
              (isCsv ? (
                <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isPdf ? (
                <FileText size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <FileDown size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
              ));

            return (
              <button
                key={option.key || option.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                onClick={() => handleAction(option.onClick)}
                disabled={option.disabled}
              >
                {optionIcon}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ReportExportDropdown({
  reportType,
  disabled = false,
  onExport,
}) {
  const label = REPORT_TYPE_LABELS[reportType] || "Maintenance Report";
  const options = [
    { key: "pdf", label: `Download ${label} PDF`, onClick: () => onExport("pdf") },
    { key: "csv", label: `Download ${label} CSV`, onClick: () => onExport("csv") },
  ];

  return <MaintenanceExportDropdown options={options} disabled={disabled} placement="top" />;
}

export function ReportInfoGrid({ items = [] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        let displayValue = item.value;
        if (typeof displayValue === "object" && displayValue !== null) {
          displayValue =
            formatCleanRoomName(displayValue) ||
            displayValue.name ||
            displayValue.roomNumber ||
            displayValue.label ||
            displayValue.title ||
            REPORT_NA;
        }
        return (
          <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {item.label}
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
              {displayValue || REPORT_NA}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReportViewerSection({ section }) {
  const rows = Array.isArray(section?.rows) && section.rows.length ? section.rows : [REPORT_NA];
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{section.title}</h3>
        {/admin only|internal|confidential/i.test(`${section.title} ${section.description || ""}`) ? (
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
            Admin Only
          </span>
        ) : null}
      </div>
      {section.description ? (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{section.description}</p>
      ) : null}
      <div className="mt-3 space-y-2">
        {rows.map((row, index) => {
          let rowContent = row;
          if (typeof rowContent === "object" && rowContent !== null) {
            rowContent =
              rowContent.name ||
              rowContent.message ||
              rowContent.title ||
              JSON.stringify(rowContent);
          }
          return (
            <div
              key={`${section.title}-${index}`}
              className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm leading-6 text-slate-700 dark:text-slate-200"
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ReportPreviewModal({
  open,
  report,
  request,
  isCopying = false,
  isSending = false,
  onCopy,
  onExport,
  onSendToTenant,
  onClose,
}) {
  if (!open || !report) return null;
  const label = REPORT_TYPE_LABELS[report.reportType] || "Maintenance Report";
  const isTenant = report.reportType === "tenant";
  const meta = getRequestReportMeta(request);
  const sections = getStructuredReportSections(report, request);
  const reportTypeTone = isTenant
    ? "border-sky-200 bg-sky-50 text-sky-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-report-preview-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <div className="border-b border-slate-200 bg-[#0f2742] p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                Lilycrest Residences
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="maintenance-report-preview-title" className="text-xl font-bold">
                  {report.title || label}
                </h2>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reportTypeTone}`}>
                  {label}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-200">
                Generated {report.generatedAt ? fmtDateTime(report.generatedAt) : fmtDateTime(new Date())}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
              onClick={onClose}
              aria-label="Close report preview"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {report.message ? (
            <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {report.message}
            </div>
          ) : null}
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Request Information</h3>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                Request {meta.requestId}
              </span>
            </div>
            <ReportInfoGrid
              items={[
                { label: "Tenant", value: meta.tenantName },
                ...(isTenant ? [] : [{ label: "User ID", value: meta.userId }]),
                { label: "Branch", value: meta.branch },
                { label: "Room/Unit", value: meta.room },
                { label: "Request Type", value: meta.requestType },
                { label: "Urgency", value: meta.urgency },
                { label: "Status", value: meta.status },
                { label: "Created", value: meta.createdAt },
                { label: "Updated", value: meta.updatedAt },
              ]}
            />
          </div>
          <div className="space-y-4">
            {sections.map((section, index) => (
              <ReportViewerSection key={`${section.title}-${index}`} section={section} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
          <ReportExportDropdown
            reportType={report.reportType}
            onExport={onExport}
            disabled={!report.summary}
          />
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
            onClick={onCopy}
            disabled={isCopying}
          >
            <ClipboardList size={14} />
            {isCopying ? "Copying..." : "Copy Summary"}
          </button>
          {isTenant ? (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSendToTenant}
              disabled={isSending}
            >
              <MessageSquare size={14} />
              {isSending ? "Sending..." : "Send to Tenant"}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export function MaintenanceReportFilters({
  filters,
  isOwner,
  userBranch,
  providerOptions = [],
  onChange,
  title = "Filters",
}) {
  const branchValue = isOwner ? filters.branch : userBranch;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Refine the reporting view without changing the operational request queue.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(filters.overdueOnly)}
            onChange={(event) => onChange("overdueOnly", event.target.checked)}
          />
          Overdue only
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Branch</span>
          <select
            value={branchValue || ""}
            onChange={(event) => onChange("branch", event.target.value)}
            disabled={!isOwner}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground disabled:bg-muted"
          >
            {isOwner ? <option value="all">All Branches</option> : null}
            {BRANCH_OPTIONS.map((branch) => (
              <option key={branch.value} value={branch.value}>{branch.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date From</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date To</span>
          <input type="date" value={filters.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</span>
          <select value={filters.status} onChange={(event) => onChange("status", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All statuses</option>
            {SUMMARY_STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Request Type</span>
          <select value={filters.requestType} onChange={(event) => onChange("requestType", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All request types</option>
            {MAINTENANCE_REQUEST_TYPES.map((type) => <option key={type} value={type}>{getMaintenanceTypeMeta(type).label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Urgency</span>
          <select value={filters.urgency} onChange={(event) => onChange("urgency", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All urgency levels</option>
            {MAINTENANCE_URGENCY_LEVELS.map((urgency) => <option key={urgency} value={urgency}>{getMaintenanceUrgencyMeta(urgency).label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Service Provider</span>
          <select value={filters.provider} onChange={(event) => onChange("provider", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            <option value="all">All providers</option>
            {providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assignment</span>
          <select value={filters.assignmentStatus} onChange={(event) => onChange("assignmentStatus", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            {ASSIGNMENT_FILTER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Target Timeline</span>
          <select value={filters.slaHealth} onChange={(event) => onChange("slaHealth", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
            {ANALYTICS_SLA_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

export function MaintenanceMetricsGrid({ summary = {}, isOwner = false }) {
  const metrics = [
    ["Total Requests", summary.totalRequests ?? 0, "blue"],
    ["Pending Requests", summary.pendingRequests ?? 0, "amber"],
    ["In Progress", summary.inProgressRequests ?? 0, "blue"],
    ["Completed", summary.completedRequests ?? 0, "green"],
    ["Overdue", summary.overdueRequests ?? 0, "rose"],
    ["Cancelled/Rejected", summary.cancelledRejectedRequests ?? 0, "rose"],
    ["Avg Response", summary.averageResponseTimeLabel || "Not enough data", "blue"],
    ["Avg Resolution", summary.averageResolutionTimeLabel || "Not enough data", "green"],
    ["Most Common Issue", summary.mostCommonIssueType || "Not enough data", "blue"],
    ["Assigned", summary.assignedRequests ?? 0, "blue"],
    ["Unassigned", summary.unassignedRequests ?? 0, "amber"],
    ...(isOwner ? [["Top Branch", summary.branchWithMostRequests || "Not enough data", "green"]] : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, tone]) => (
        <ReportMetricCard key={label} label={label} value={value} tone={tone} />
      ))}
    </div>
  );
}

export function MaintenanceAnalyticsCharts({ data, isOwner }) {
  const charts = data?.charts || {};
  const emptyTitle = "No maintenance data";
  const emptyDescription = "No maintenance data found for the selected filters.";
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportChartPanel title="Requests by Status">
        <AnalyticsDonutChart data={charts.requestsByStatus || []} centerLabel={{ value: data?.summary?.totalRequests || 0, label: "Requests" }} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Requests by Issue Type">
        <AnalyticsBarChart data={charts.requestsByIssueType || []} bars={[{ key: "value", label: "Requests", color: "#0ea5e9" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Requests by Urgency">
        <AnalyticsDonutChart data={charts.requestsByUrgency || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Monthly Maintenance Trend">
        <AnalyticsLineChart data={charts.monthlyTrend || []} lines={[{ key: "total", label: "Total" }, { key: "completed", label: "Completed" }, { key: "overdue", label: "Overdue" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      <ReportChartPanel title="Overdue Requests Overview">
        <AnalyticsDonutChart data={charts.overdueOverview || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
      </ReportChartPanel>
      {isOwner ? (
        <>
          <ReportChartPanel title="Requests per Branch">
            <AnalyticsBarChart data={charts.requestsPerBranch || []} bars={[{ key: "value", label: "Requests", color: "#0284c7" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
          <ReportChartPanel title="Average Resolution Time per Branch">
            <AnalyticsBarChart data={charts.averageResolutionTimePerBranch || []} bars={[{ key: "value", label: "Hours", color: "#10b981" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
          <ReportChartPanel title="Overdue Requests by Branch">
            <AnalyticsBarChart data={charts.overdueRequestsByBranch || []} bars={[{ key: "value", label: "Overdue", color: "#ef4444" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
          </ReportChartPanel>
        </>
      ) : null}
    </div>
  );
}
