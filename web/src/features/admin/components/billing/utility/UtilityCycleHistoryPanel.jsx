import React from "react";
import {
  History,
  Send,
  Pencil,
  Trash2,
  Eye,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardX,
} from "lucide-react";
import {
  fmtCurrency,
  getCycleLabel,
  getMeterRangeLabel,
  getDisplayStatus,
  getDisplayStatusLabel,
  getDisplayStatusIcon,
  getHistoryStatusClasses,
  canEditPeriod,
  canDeletePeriod,
  DeltaChip,
} from "./utilityConstants";

export default function UtilityCycleHistoryPanel({
  periods = [],
  filteredPeriods = [],
  pagedPeriods = [],
  selectedPeriodId,
  onSelectPeriod,
  periodStatusFilter,
  onStatusFilterChange,
  periodStartDate,
  onStartDateChange,
  periodEndDate,
  onEndDateChange,
  periodSearch,
  onSearchChange,
  onClearFilters,
  periodsPage,
  totalPeriodPages,
  onPageChange,
  onSendPeriod,
  onEditPeriod,
  onDeletePeriod,
  onOpenHistoryModal,
  sendingByPeriodId = {},
  isSendingPeriod,
  isDeletingPeriod,
  utilityType,
  selectedRoom,
}) {
  const hasActiveFilters = Boolean(
    periodStatusFilter || periodStartDate || periodEndDate || periodSearch,
  );

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-card-foreground">
              <History size={13} className="shrink-0 text-slate-700 dark:text-slate-300" />
              Billing Cycle History
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage past and open billing cycles for this room. Select a cycle to monitor tenant payment breakdowns.
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-card-foreground">{filteredPeriods.length}</span> of{" "}
            <span className="font-semibold text-card-foreground">{periods.length}</span> cycle{periods.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
          {/* Status filter */}
          <select
            value={periodStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
            aria-label="Filter billing cycle status"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="ready_to_send">Ready to Send</option>
            <option value="sent">Sent / Finalized</option>
            <option value="paid">Paid</option>
          </select>

          {/* Start date */}
          <input
            type="date"
            value={periodStartDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
            title="Filter by cycle start date"
            aria-label="Filter by start date"
          />

          {/* End date */}
          <input
            type="date"
            value={periodEndDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
            title="Filter by cycle end date"
            aria-label="Filter by end date"
          />

          {/* Cycle search */}
          <div className="relative">
            <input
              type="text"
              value={periodSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by cycle label..."
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
              aria-label="Search cycles"
            />
            {periodSearch && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Cycle List Container */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-2.5">
        {filteredPeriods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground">
            <ClipboardX size={32} className="text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              {periods.length === 0 ? "No billing history found" : "No cycles match your filters"}
            </p>
            <p className="mt-0.5 text-xs">
              {periods.length === 0
                ? "Create a new billing period to start recording meter readings."
                : "Try resetting your filter parameters."}
            </p>
          </div>
        ) : (
          pagedPeriods.map((p) => {
            const status = getDisplayStatus(p);
            const isSelected = selectedPeriodId === p.id;
            const isSending = Boolean(sendingByPeriodId[p.id]);

            return (
              <div
                key={p.id}
                onClick={() => onSelectPeriod(p.id)}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 transition-all cursor-pointer ${
                  isSelected
                    ? "border-slate-900 bg-slate-100/90 shadow-xs dark:border-slate-100 dark:bg-slate-800"
                    : "border-border bg-card hover:bg-muted/30 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
                title="Click to monitor this billing cycle in the Tenant Payment panel below"
              >
                {/* Left info: Cycle name + Meter range + Delta */}
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${isSelected ? "text-slate-900 dark:text-white" : "text-card-foreground"}`}>
                      {getCycleLabel(p)}
                    </p>
                    {p.revised && (
                      <span className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        Revised
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{getMeterRangeLabel(p, utilityType)}</span>
                    {utilityType !== "water" && (
                      <DeltaChip
                        start={p.startReading}
                        end={p.endReading}
                        unit={utilityType === "electricity" ? "kWh" : "cu.m."}
                      />
                    )}
                  </div>
                </div>

                {/* Right info: Rate + Status badge + Action buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Rate: {fmtCurrency(p.ratePerUnit)}
                  </span>

                  {/* Transparent status badge with dot */}
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${getHistoryStatusClasses(status)}`}>
                    {getDisplayStatusIcon(status)}
                    {getDisplayStatusLabel(p)}
                  </span>

                  {/* Actions Group */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {status === "ready_to_send" && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-[#0A1628] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#13243D] active:scale-[0.98] transition-all disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                        onClick={() => onSendPeriod(p)}
                        disabled={isSending || isSendingPeriod}
                        title="Release this statement to tenants"
                      >
                        <Send size={11} />
                        {isSending ? "Sending..." : "Send"}
                      </button>
                    )}

                    {canEditPeriod(p) && (
                      <button
                        type="button"
                        className="rounded-md border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                        onClick={() => onEditPeriod(p)}
                        aria-label="Edit period details"
                        title="Edit period details"
                      >
                        <Pencil size={13} />
                      </button>
                    )}

                    {canDeletePeriod(p) && (
                      <button
                        type="button"
                        className="rounded-md border border-border p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.98] transition-all dark:text-rose-400 dark:hover:bg-rose-950/40"
                        onClick={() => onDeletePeriod(p.id)}
                        aria-label="Delete period"
                        title="Delete period"
                        disabled={isDeletingPeriod}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => onOpenHistoryModal(p.id)}
                      title="View detailed calculation snapshot"
                    >
                      <Eye size={12} className="inline mr-1" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination Controls */}
        {totalPeriodPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <span>
              Page {periodsPage} of {totalPeriodPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={periodsPage <= 1}
                onClick={() => onPageChange(periodsPage - 1)}
                className="h-7 w-7 flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous period page"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                disabled={periodsPage >= totalPeriodPages}
                onClick={() => onPageChange(periodsPage + 1)}
                className="h-7 w-7 flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next period page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
