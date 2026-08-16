import { useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpDown,
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
import { BRANCH_OPTIONS, BRANCH_DISPLAY_NAMES } from "../../../../../shared/utils/constants";
import {
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../../shared/utils/maintenanceConfig";
import {
  ARCHIVE_FILTER_OPTIONS,
  OPERATIONAL_STAGES,
  SLA_FILTER_OPTIONS,
  SPECIFIC_STATUS_OPTIONS,
  SUMMARY_STATUSES,
  getStageLabel,
  getStatusLabel,
  getStageStatusLabel,
} from "../maintenanceUtils";
import { MaintenanceExportDropdown } from "./MaintenanceReportModal";

export const QUEUE_FILTER_OPTIONS = [
  { key: "all", label: "All Requests" },
  { key: "open_queue", label: "Active Queue" },
  { key: "in_progress", label: "In Progress" },
  { key: "needs_attention", label: "Needs Attention", alertBadge: true },
  { key: "resolved", label: "Resolved (Awaiting)" },
  { key: "completed", label: "Completed" },
];

/**
 * MaintenanceFilters — 4-Core Primary Toolbar with an organized Advanced Filters drawer.
 */
export function MaintenanceFilters({
  searchQuery,
  stageFilter = "all",
  statusFilter = "all",
  stageStatusFilter,
  queueFilter,
  archiveView = "active",
  branchFilter = "all",
  userBranch,
  urgencyFilter = "all",
  slaFilter = "all",
  requestTypeFilter = "all",
  dateFrom = "",
  dateTo = "",
  sortMode = "newest",
  showAdvancedFilters = false,
  isOwner = false,
  filteredRequestsCount = 0,
  summaryRequestsCount = 0,
  stageCounts = {},
  statusCounts = {},
  stageStatusCounts = {},
  queueCounts = {},
  urgencyCounts = {},
  branchCounts = {},
  activeFilterChips = [],
  onStageFilterChange,
  onStatusFilterChange,
  onStageStatusFilterChange,
  onQueueFilterChange,
  onSearchQueryChange,
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
  isExporting = false,
  onResetFilters,
}) {
  const effectiveStage = stageFilter || queueFilter || (stageStatusFilter && !String(stageStatusFilter).startsWith("status:") ? String(stageStatusFilter).replace(/^stage:/, "") : "all");
  const effectiveStatus = statusFilter || (stageStatusFilter && String(stageStatusFilter).startsWith("status:") ? String(stageStatusFilter).replace(/^status:/, "") : "all");

  const effectiveStageCounts = Object.keys(stageCounts).length > 0 ? stageCounts : queueCounts;
  const effectiveStatusCounts = Object.keys(statusCounts).length > 0 ? statusCounts : stageStatusCounts;

  const handleStageChange = (val) => {
    if (onStageFilterChange) {
      onStageFilterChange(val);
    } else if (onQueueFilterChange) {
      onQueueFilterChange(val === "all" ? null : val);
    } else if (onStageStatusFilterChange) {
      onStageStatusFilterChange(val);
    }
  };

  const handleStatusChange = (val) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(val);
    } else if (onStageStatusFilterChange) {
      onStageStatusFilterChange(val);
    }
  };

  const advancedFiltersActiveCount =
    (slaFilter !== "all" ? 1 : 0) +
    (requestTypeFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (sortMode !== "newest" ? 1 : 0) +
    (archiveView !== "active" ? 1 : 0);

  const hasAnyActiveFilter =
    searchQuery.trim() !== "" ||
    effectiveStage !== "all" ||
    effectiveStatus !== "all" ||
    (isOwner && branchFilter !== "all") ||
    urgencyFilter !== "all" ||
    advancedFiltersActiveCount > 0;

  const handleClearAdvancedFilters = () => {
    onSlaFilterChange?.("all");
    onRequestTypeFilterChange?.("all");
    onDateFromChange?.("");
    onDateToChange?.("");
    onSortModeChange?.("newest");
    onArchiveViewChange?.("active");
  };

  const handleApplyDatePreset = (preset) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const formatYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = formatYmd(now);

    switch (preset) {
      case "today":
        onDateFromChange?.(todayStr);
        onDateToChange?.(todayStr);
        break;
      case "7d": {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        onDateFromChange?.(formatYmd(d));
        onDateToChange?.(todayStr);
        break;
      }
      case "30d": {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        onDateFromChange?.(formatYmd(d));
        onDateToChange?.(todayStr);
        break;
      }
      case "month": {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        onDateFromChange?.(formatYmd(firstDay));
        onDateToChange?.(todayStr);
        break;
      }
      case "clear":
        onDateFromChange?.("");
        onDateToChange?.("");
        break;
      default:
        break;
    }
  };

  const getActiveDatePreset = () => {
    if (!dateFrom && !dateTo) return null;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const formatYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = formatYmd(now);

    if (dateFrom === todayStr && dateTo === todayStr) return "today";

    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    if (dateFrom === formatYmd(d7) && dateTo === todayStr) return "7d";

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    if (dateFrom === formatYmd(d30) && dateTo === todayStr) return "30d";

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    if (dateFrom === formatYmd(firstDay) && dateTo === todayStr) return "month";

    return "custom";
  };

  const activeDatePreset = getActiveDatePreset();

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
      {/* Primary 4-Core Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search & 4-Core Quick Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* 1. Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm sm:max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search tenant, room, ID, or description..."
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

          {/* Core Dropdowns Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 2. Operational Stage Dropdown */}
            <select
              value={effectiveStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[140px]"
              aria-label="Filter by operational stage"
            >
              <option value="all">
                All Stages {effectiveStageCounts.all !== undefined ? `(${effectiveStageCounts.all})` : ""}
              </option>
              {OPERATIONAL_STAGES.map((stage) => {
                const count = effectiveStageCounts[stage.key] ?? effectiveStageCounts[stage.stageKey];
                return (
                  <option key={stage.key} value={stage.key}>
                    {stage.label} {count !== undefined ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>

            {/* 3. Specific Status Dropdown */}
            <select
              value={effectiveStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[140px]"
              aria-label="Filter by specific status"
            >
              <option value="all">
                All Statuses {effectiveStatusCounts.all !== undefined ? `(${effectiveStatusCounts.all})` : ""}
              </option>
              {SPECIFIC_STATUS_OPTIONS.map((status) => {
                const count = effectiveStatusCounts[status.key] ?? effectiveStatusCounts[status.rawStatus];
                return (
                  <option key={status.key} value={status.key}>
                    {status.label} {count !== undefined ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>

            {/* 3. Urgency Filter Dropdown */}
            <select
              value={urgencyFilter}
              onChange={(e) => onUrgencyFilterChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[130px]"
            >
              <option value="all">
                All Urgencies {urgencyCounts.all !== undefined ? `(${urgencyCounts.all})` : ""}
              </option>
              {MAINTENANCE_URGENCY_LEVELS.map((urgency) => {
                const count = urgencyCounts[urgency];
                return (
                  <option key={urgency} value={urgency}>
                    {getMaintenanceUrgencyMeta(urgency).label} {count !== undefined ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>

            {/* 4. Branch Filter (Owners Only - Auto-hidden for Branch Admins) */}
            {isOwner && (
              <select
                value={branchFilter}
                onChange={(e) => onBranchFilterChange(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition min-w-[130px]"
              >
                <option value="all">
                  All Branches {branchCounts.all !== undefined ? `(${branchCounts.all})` : ""}
                </option>
                {BRANCH_OPTIONS.map((branch) => {
                  const count = branchCounts[branch.value];
                  return (
                    <option key={branch.value} value={branch.value}>
                      {branch.label} {count !== undefined ? `(${count})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* Right Side: Advanced Toggle, Quick Reset, Export */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Advanced Filters Button with Active Count Pill */}
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
            <span>Filters</span>
            {advancedFiltersActiveCount > 0 && (
              <span className="flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {advancedFiltersActiveCount}
              </span>
            )}
            {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Quick 1-Click Reset All Button (Visible only when any filter is active) */}
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-100 transition"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset All</span>
            </button>
          )}

          {/* Export Dropdown */}
          <MaintenanceExportDropdown
            onExportCSV={onExportCsv || onExport}
            onExportPDF={onExportPdf}
            disabled={filteredRequestsCount === 0}
            loading={isExporting}
          />
        </div>
      </div>

      {/* Expandable Advanced Filters Drawer */}
      {showAdvancedFilters && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Drawer Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Secondary Filters & Sorting
              </h4>
              {advancedFiltersActiveCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                  {advancedFiltersActiveCount} active
                </span>
              )}
            </div>
            {advancedFiltersActiveCount > 0 && (
              <button
                type="button"
                onClick={handleClearAdvancedFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                title="Reset all secondary filter options"
              >
                <RotateCcw size={12} />
                <span>Clear Secondary Filters</span>
              </button>
            )}
          </div>

          {/* Secondary Selects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Request Type / Service Category */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Service Category
              </label>
              <div className="relative">
                <Wrench
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />
                <select
                  value={requestTypeFilter}
                  onChange={(e) => onRequestTypeFilterChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition"
                >
                  <option value="all">All Categories</option>
                  {MAINTENANCE_REQUEST_TYPES.map((requestType) => (
                    <option key={requestType} value={requestType}>
                      {getMaintenanceTypeMeta(requestType).label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Target Timeline */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Target Timeline
              </label>
              <div className="relative">
                <Activity
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />
                <select
                  value={slaFilter}
                  onChange={(e) => onSlaFilterChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition"
                >
                  {SLA_FILTER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Sort Order */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Sort Order
              </label>
              <div className="relative">
                <ArrowUpDown
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />
                <select
                  value={sortMode}
                  onChange={(e) => onSortModeChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition"
                >
                  <option value="newest">Newest First</option>
                  <option value="urgency">Urgency Priority</option>
                </select>
              </div>
            </div>

            {/* 4. Archive Scope */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Archive Scope
              </label>
              <div className="relative">
                <Archive
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />
                <select
                  value={archiveView}
                  onChange={(e) => onArchiveViewChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition"
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

          {/* Date Range Section with Quick Presets */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar size={13} className="text-primary" />
                <span>Logged Date Range</span>
              </label>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">
                  Presets:
                </span>
                {[
                  { key: "today", label: "Today" },
                  { key: "7d", label: "Last 7 Days" },
                  { key: "30d", label: "Last 30 Days" },
                  { key: "month", label: "This Month" },
                ].map((preset) => {
                  const isActive = activeDatePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleApplyDatePreset(preset.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                        isActive
                          ? "bg-primary text-white border-primary font-semibold shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset("clear")}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition ml-1"
                    title="Clear date filter"
                  >
                    Clear Dates
                  </button>
                )}
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 pointer-events-none">
                  From
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-14 pr-8 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  aria-label="Start date"
                />
                {dateFrom && (
                  <button
                    type="button"
                    onClick={() => onDateFromChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    title="Clear start date"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 pointer-events-none">
                  To
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-8 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  aria-label="End date"
                />
                {dateTo && (
                  <button
                    type="button"
                    onClick={() => onDateToChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    title="Clear end date"
                  >
                    <X size={13} />
                  </button>
                )}
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
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] font-semibold text-primary hover:underline px-1.5 py-0.5"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

