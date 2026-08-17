import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Download,
} from "lucide-react";
import {
  useVisitConflictHistory,
  useToggleResolveVisitConflict,
} from "../../../shared/hooks/queries/useReservations";
import { showNotification } from "../../../shared/utils/notification";

function ConflictHistorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-3 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function VisitConflictHistoryPanel({ branch }) {
  const [filterResolved, setFilterResolved] = useState("all"); // "all" | "false" | "true"
  const [expandedId, setExpandedId] = useState(null);

  const queryParams = {};
  if (filterResolved === "false") queryParams.resolved = "false";
  if (filterResolved === "true") queryParams.resolved = "true";

  const { data, isLoading, refetch, isRefetching } = useVisitConflictHistory(
    branch,
    queryParams,
  );
  const toggleResolveMutation = useToggleResolveVisitConflict();

  const records = data?.data?.records || data?.records || [];
  const total = data?.data?.total || data?.total || 0;

  const handleToggleResolve = async (conflictId, currentResolved) => {
    try {
      await toggleResolveMutation.mutateAsync({
        branch,
        conflictId,
        resolved: !currentResolved,
      });
      showNotification({
        type: "success",
        message: `Impact log marked as ${!currentResolved ? "Resolved" : "Unresolved"}.`,
      });
    } catch (err) {
      console.error("Failed to update resolution status:", err);
      showNotification({
        type: "error",
        message: "Failed to update resolution status. Please try again.",
      });
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ── Export CSV for Conflict Impact Logs ── */
  const handleExportCSV = () => {
    if (!records || records.length === 0) {
      showNotification({
        type: "warning",
        message: "No schedule impact logs available to export.",
      });
      return;
    }

    const headers = [
      "Trigger",
      "Status",
      "Recorded Date",
      "Saved By Email",
      "Affected Count",
      "Admin Note",
      "Affected Reservations",
    ];

    const csvRows = [
      headers.join(","),
      ...records.map((log) => {
        const affectedSummary = (log.affectedReservations || [])
          .map(
            (r) =>
              `${r.tenantName || "Applicant"} (${r.visitDate || ""} ${
                r.visitSlot || ""
              })`,
          )
          .join(" | ");

        const fields = [
          `"${(log.trigger || "Rule Update Impact").replace(/"/g, '""')}"`,
          `"${(log.resolved ? "Resolved" : "Unresolved").replace(/"/g, '""')}"`,
          `"${(log.createdAt ? new Date(log.createdAt).toISOString() : "").replace(/"/g, '""')}"`,
          `"${(log.acknowledgedBy?.email || "").replace(/"/g, '""')}"`,
          `"${log.affectedCount || 0}"`,
          `"${(log.adminNote || "").replace(/"/g, '""')}"`,
          `"${affectedSummary.replace(/"/g, '""')}"`,
        ];
        return fields.join(",");
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    const dateStamp = new Date().toISOString().split("T")[0];
    link.setAttribute(
      "download",
      `schedule_impact_logs_${branch || "all"}_${dateStamp}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification({
      type: "success",
      message: `Exported ${records.length} impact log ${
        records.length === 1 ? "record" : "records"
      } to CSV.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Outline Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Schedule Impact Audit Logs
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {total}
          </span>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2">
          {/* Outline Filter Buttons */}
          <div className="flex items-center gap-1">
            {[
              { key: "all", label: "All" },
              { key: "false", label: "Unresolved" },
              { key: "true", label: "Resolved" },
            ].map((tab) => {
              const isActive = filterResolved === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilterResolved(tab.key)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all border ${
                    isActive
                      ? "border-slate-900 dark:border-slate-100 bg-slate-900/5 dark:bg-slate-100/10 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={records.length === 0 || isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={
              records.length === 0
                ? "No impact logs available to export"
                : "Export impact logs to CSV"
            }
          >
            <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh conflict logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <ConflictHistorySkeleton />
      ) : records.length === 0 ? (
        /* Empty State */
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Schedule Conflicts Recorded
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {filterResolved !== "all"
              ? `No ${filterResolved === "true" ? "resolved" : "unresolved"} conflict logs found for this branch.`
              : "When availability rule updates affect active visit bookings, the impact logs will appear here for admin tracking."}
          </p>
        </div>
      ) : (
        /* Record Cards List */
        <div className="space-y-3">
          {records.map((log) => {
            const isExpanded = expandedId === log._id;
            const createdDate = log.createdAt
              ? new Date(log.createdAt).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A";
            const affectedResList = log.affectedReservations || [];

            return (
              <div
                key={log._id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 space-y-3"
              >
                {/* Header: Clickable Accordion */}
                <div
                  onClick={() => toggleExpand(log._id)}
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none group"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(log._id);
                    }
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                        {log.trigger || "Rule Update Impact"}
                      </span>
                      {/* Transparent Status Badge with Semantic Colored Dot */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-transparent ${
                          log.resolved
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            log.resolved ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <span>{log.resolved ? "Resolved" : "Unresolved"}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {createdDate}
                      </span>
                      {log.acknowledgedBy?.email && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Saved by {log.acknowledgedBy.email}
                        </span>
                      )}
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {log.affectedCount} {log.affectedCount === 1 ? "visit" : "visits"} affected
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleResolve(log._id, log.resolved);
                      }}
                      disabled={toggleResolveMutation.isLoading}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        log.resolved
                          ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          : "border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {log.resolved ? "Mark Unresolved" : "Mark Resolved"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(log._id);
                      }}
                      className="p-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 rounded transition-colors"
                      title={isExpanded ? "Collapse details" : "Expand details"}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Admin Note if Present (without side-colored border) */}
                {log.adminNote && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Admin Note:{" "}
                      </span>
                      <span>{log.adminNote}</span>
                    </div>
                  </div>
                )}

                {/* Collapsible Affected Reservations List */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Affected Reservations ({affectedResList.length})
                    </h5>

                    {affectedResList.length === 0 ? (
                      <p className="text-xs text-slate-500">No reservation details recorded.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                        {affectedResList.map((res, rIdx) => (
                          <div
                            key={res.reservationId || rIdx}
                            className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/60"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {res.tenantName}
                              </span>
                              {res.userEmail && (
                                <span className="text-slate-400 text-[11px]">
                                  ({res.userEmail})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {res.visitDate}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {res.visitSlot}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {res.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

