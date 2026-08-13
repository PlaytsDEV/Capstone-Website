import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Layers,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import { BRANCH_OPTIONS } from "../../../../../shared/utils/constants";
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
  onExportCsv,
  onExportPdf,
  onResetFilters,
}) {
  const advancedFiltersActiveCount =
    (slaFilter !== "all" ? 1 : 0) +
    (requestTypeFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (sortMode !== "newest" ? 1 : 0) +
    (archiveView !== "active" ? 1 : 0);

  const hasAnyActiveFilter =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    (isOwner && branchFilter !== "all") ||
    urgencyFilter !== "all" ||
    advancedFiltersActiveCount > 0;

  const exportOptions = [
    {
      key: "requests-pdf",
      label: "Download List as PDF",
      onClick: onExportPdf,
      disabled: filteredRequestsCount === 0 || !onExportPdf,
    },
    {
      key: "requests-csv",
      label: "Download List as CSV",
      onClick: onExportCsv || onExport,
      disabled: filteredRequestsCount === 0,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
      {/* Primary Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search & Quick Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm sm:max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search tenant, ID, or description..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 pl-9 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[125px]"
            >
              <option value="all">All Statuses</option>
              {SUMMARY_STATUSES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>

            {/* Branch Filter (for Owners / Super Admins) */}
            {isOwner && (
              <select
                value={branchFilter}
                onChange={(e) => onBranchFilterChange(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[130px]"
              >
                <option value="all">All Branches</option>
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch.value} value={branch.value}>
                    {branch.label}
                  </option>
                ))}
              </select>
            )}

            {/* Urgency Filter */}
            <select
              value={urgencyFilter}
              onChange={(e) => onUrgencyFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[135px]"
            >
              <option value="all">All Urgency Levels</option>
              {MAINTENANCE_URGENCY_LEVELS.map((urgency) => (
                <option key={urgency} value={urgency}>
                  {getMaintenanceUrgencyMeta(urgency).label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* More Filters Toggle */}
          <button
            type="button"
            onClick={onToggleAdvancedFilters}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
              showAdvancedFilters || advancedFiltersActiveCount > 0
                ? "border-primary/40 dark:border-primary/60 bg-primary/10 text-primary dark:bg-primary/20"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
            }`}
            aria-expanded={showAdvancedFilters}
          >
            <SlidersHorizontal size={13} />
            <span>More Filters</span>
            {advancedFiltersActiveCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {advancedFiltersActiveCount}
              </span>
            )}
            {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Export Dropdown */}
          <MaintenanceExportDropdown
            options={exportOptions}
            disabled={filteredRequestsCount === 0}
          />

          {/* Reset Filters Button */}
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-100 transition"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Advanced Filters Drawer (Structured 3-Column Layout) */}
      {showAdvancedFilters && (
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Column 1: Classification & Health */}
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Wrench size={13} className="text-primary" />
                <span>Classification & SLA</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    SLA Health
                  </label>
                  <select
                    value={slaFilter}
                    onChange={(e) => onSlaFilterChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {SLA_FILTER_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Request Type
                  </label>
                  <select
                    value={requestTypeFilter}
                    onChange={(e) => onRequestTypeFilterChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    {MAINTENANCE_REQUEST_TYPES.map((requestType) => (
                      <option key={requestType} value={requestType}>
                        {getMaintenanceTypeMeta(requestType).label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Column 2: Date Range */}
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Calendar size={13} className="text-primary" />
                <span>Date Range</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Column 3: Sorting & Scope */}
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Layers size={13} className="text-primary" />
                <span>Order & Scope</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Sort Order
                  </label>
                  <select
                    value={sortMode}
                    onChange={(e) => onSortModeChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="urgency">Urgency Priority</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Archive Scope
                  </label>
                  <select
                    value={archiveView}
                    onChange={(e) => onArchiveViewChange(e.target.value)}
                    className="h-8.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {ARCHIVE_FILTER_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Chips (if any) */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80"
            >
              <span>{chip.label}</span>
              {chip.onRemove && (
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  title={`Remove ${chip.label}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
