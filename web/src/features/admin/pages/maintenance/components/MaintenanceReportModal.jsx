import { useState } from "react";
import { ChevronDown, ClipboardList, FileDown, MessageSquare, XCircle } from "lucide-react";
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
  options = [],
  disabled = false,
  align = "right",
  placement = "bottom",
}) {
  const [open, setOpen] = useState(false);
  const visibleOptions = options.filter(Boolean);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || visibleOptions.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FileDown size={14} />
        Export
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-[1300] min-w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } ${
            align === "left" ? "left-0" : "left-0 sm:left-auto sm:right-0"
          }`}
        >
          {visibleOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-left text-sm text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                option.onClick?.();
              }}
              disabled={option.disabled}
            >
              {option.label}
            </button>
          ))}
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
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 break-words text-sm font-semibold text-slate-900">
            {item.value || REPORT_NA}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportViewerSection({ section }) {
  const rows = Array.isArray(section?.rows) && section.rows.length ? section.rows : [REPORT_NA];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
        {/admin only|internal|confidential/i.test(`${section.title} ${section.description || ""}`) ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
            Admin Only
          </span>
        ) : null}
      </div>
      {section.description ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{section.description}</p>
      ) : null}
      <div className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <div key={`${section.title}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
            {row}
          </div>
        ))}
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
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">SLA Health</span>
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
    ["In Progress", summary.inProgressRequests ?? 0, "violet"],
    ["Completed", summary.completedRequests ?? 0, "green"],
    ["Overdue", summary.overdueRequests ?? 0, "rose"],
    ["Cancelled/Rejected", summary.cancelledRejectedRequests ?? 0, "rose"],
    ["Avg Response", summary.averageResponseTimeLabel || "Not enough data", "blue"],
    ["Avg Resolution", summary.averageResolutionTimeLabel || "Not enough data", "green"],
    ["Most Common Issue", summary.mostCommonIssueType || "Not enough data", "violet"],
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
            <AnalyticsBarChart data={charts.requestsPerBranch || []} bars={[{ key: "value", label: "Requests", color: "#6366f1" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
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
