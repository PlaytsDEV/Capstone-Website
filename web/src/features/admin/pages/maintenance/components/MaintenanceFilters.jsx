import { ChevronDown, ChevronUp, Search } from "lucide-react";
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
  ARCHIVE_FILTER_OPTIONS,
  SLA_FILTER_OPTIONS,
  SUMMARY_STATUSES,
} from "../maintenanceUtils";
import { MaintenanceExportDropdown } from "./MaintenanceReportModal";

export function MaintenanceFilters({
  searchQuery,
  statusFilter,
  archiveView,
  branchFilter,
  urgencyFilter,
  slaFilter,
  requestTypeFilter,
  dateFrom,
  dateTo,
  sortMode,
  showAdvancedFilters,
  isOwner,
  filteredRequestsCount,
  summaryRequestsCount,
  activeFilterChips = [],
  onSearchQueryChange,
  onStatusFilterChange,
  onArchiveViewChange,
  onBranchFilterChange,
  onUrgencyFilterChange,
  onSlaFilterChange,
  onRequestTypeFilterChange,
  onDateFromChange,
  onDateToChange,
  onSortModeChange,
  onToggleAdvancedFilters,
  onExport,
  onResetFilters,
}) {
  return (
    <section className="mt-5 rounded-xl border border-border bg-card px-5 py-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Find requests quickly
      </h2>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="relative min-w-[280px] flex-[2_1_420px]">
          <span className="sr-only">Search</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tenant, ID, assignment, or description"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-muted-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
        </label>

        <label className="min-w-[180px] flex-1">
          <span className="sr-only">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All statuses</option>
            {SUMMARY_STATUSES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[160px] flex-1">
          <span className="sr-only">Archive View</span>
          <select
            value={archiveView}
            onChange={(event) => onArchiveViewChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            {ARCHIVE_FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {isOwner ? (
          <label className="min-w-[170px] flex-1">
            <span className="sr-only">Branch</span>
            <select
              value={branchFilter}
              onChange={(event) => onBranchFilterChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">All Branches</option>
              {BRANCH_OPTIONS.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="min-w-[180px] flex-1">
          <span className="sr-only">Urgency</span>
          <select
            value={urgencyFilter}
            onChange={(event) => onUrgencyFilterChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All urgency levels</option>
            {MAINTENANCE_URGENCY_LEVELS.map((urgency) => (
              <option key={urgency} value={urgency}>
                {getMaintenanceUrgencyMeta(urgency).label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[180px] flex-1">
          <span className="sr-only">SLA Health</span>
          <select
            value={slaFilter}
            onChange={(event) => onSlaFilterChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            {SLA_FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-card-foreground hover:bg-muted"
            onClick={onToggleAdvancedFilters}
            aria-expanded={showAdvancedFilters}
          >
            {showAdvancedFilters ? (
              <>
                <ChevronUp size={14} />
                Less Filters
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                More Filters
              </>
            )}
          </button>

          <MaintenanceExportDropdown
            options={[
              {
                key: "requests-csv",
                label: "Download List as CSV",
                onClick: onExport,
                disabled: filteredRequestsCount === 0,
              },
            ]}
            disabled={filteredRequestsCount === 0}
          />

          <button
            type="button"
            className="inline-flex h-10 min-w-[130px] items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground"
            onClick={onResetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {showAdvancedFilters ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
          <label className="xl:col-span-3">
            <span className="sr-only">Request Type</span>
            <select
              value={requestTypeFilter}
              onChange={(event) => onRequestTypeFilterChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">All request types</option>
              {MAINTENANCE_REQUEST_TYPES.map((requestType) => (
                <option key={requestType} value={requestType}>
                  {getMaintenanceTypeMeta(requestType).label}
                </option>
              ))}
            </select>
          </label>

          <label className="xl:col-span-2">
            <span className="sr-only">Date From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="sr-only">Date To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="sr-only">Sort By</span>
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="newest">Newest first</option>
              <option value="urgency">Urgency high first</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredRequestsCount} of {summaryRequestsCount} requests
      </div>

      {activeFilterChips.length ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
