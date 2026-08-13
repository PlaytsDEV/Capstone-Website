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
} from "lucide-react";
import {
  useVisitConflictHistory,
  useToggleResolveVisitConflict,
} from "../../../shared/hooks/queries/useReservations";

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
    } catch (err) {
      console.error("Failed to update resolution status:", err);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Schedule Impact Audit Logs
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => setFilterResolved("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterResolved === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterResolved("false")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterResolved === "false"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Unresolved
            </button>
            <button
              onClick={() => setFilterResolved("true")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterResolved === "true"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Resolved
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh conflict logs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
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
            const createdDate = log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A";
            const affectedResList = log.affectedReservations || [];

            return (
              <div
                key={log._id}
                className={`rounded-xl border transition-all ${
                  log.resolved
                    ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-90"
                    : "border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
                }`}
              >
                {/* Header Summary */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {log.trigger || "Rule Update Impact"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          log.resolved
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                            : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                        }`}
                      >
                        {log.resolved ? "Resolved" : "Unresolved"}
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
                      onClick={() => handleToggleResolve(log._id, log.resolved)}
                      disabled={toggleResolveMutation.isLoading}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        log.resolved
                          ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          : "border-emerald-300 dark:border-emerald-800 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {log.resolved ? "Mark Unresolved" : "Mark Resolved"}
                    </button>

                    <button
                      onClick={() => toggleExpand(log._id)}
                      className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                      title={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Admin Note if Present */}
                {log.adminNote && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Admin Note: </span>
                      <span>{log.adminNote}</span>
                    </div>
                  </div>
                )}

                {/* Collapsible Affected Reservations List */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-xl space-y-2">
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
                                <span className="text-slate-400 text-[11px]">({res.userEmail})</span>
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
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
