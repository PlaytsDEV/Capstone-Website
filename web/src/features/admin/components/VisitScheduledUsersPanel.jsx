import React, { useState } from "react";
import {
  Search,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Home,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Tag,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useVisitScheduledUsers } from "../../../shared/hooks/queries/useReservations";

function ScheduledUsersSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-3 w-56 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ── Friendly status badge styling with solid HSL colors (strictly no gradients) ── */
function VisitStatusBadge({ status, rejected }) {
  if (rejected) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
        Rejected
      </span>
    );
  }

  const s = String(status || "").toLowerCase();

  if (s === "completed" || s === "visit_completed") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
        Completed
      </span>
    );
  }

  if (s === "cancelled" || s === "visit_cancelled") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        Cancelled
      </span>
    );
  }

  if (s === "no_show") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
        No-Show
      </span>
    );
  }

  if (s === "schedule_approved" || s === "approved") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
        Approved
      </span>
    );
  }

  if (s === "rescheduled") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
        Rescheduled
      </span>
    );
  }

  return (
    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
      Scheduled
    </span>
  );
}

/* ── Viewing Mode chip ── */
function ViewingTypeBadge({ type }) {
  const t = String(type || "").toLowerCase();
  if (t === "remote_2d_viewing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
        <Eye size={11} />
        2D Remote Viewing
      </span>
    );
  }
  if (t === "urgent_move_in_review") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
        <AlertCircle size={11} />
        Urgent Move-in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      <Home size={11} />
      Physical Visit
    </span>
  );
}

/* ── Date formatting helpers ── */
function formatVisitDate(dateStr) {
  if (!dateStr) return "Not specified";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeSchedule(dateStr) {
  if (!dateStr) return "";
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return "";
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return "";
}

function formatTimestamp(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VisitScheduledUsersPanel({ branch }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const LIMIT = 15;

  const queryParams = {
    page,
    limit: LIMIT,
  };
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (searchQuery.trim()) queryParams.search = searchQuery.trim();

  const { data, isLoading, isError, refetch, isRefetching } = useVisitScheduledUsers(
    branch,
    queryParams,
    { keepPreviousData: true },
  );

  const records = data?.records || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || Math.max(1, Math.ceil(total / LIMIT));
  const summary = data?.summary || {};

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const toggleExpand = (id) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Controls ── */}
      <div className="space-y-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        {/* Search row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search applicant name, email, phone, visit code..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh scheduled visitors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          {[
            { key: "all", label: "All", count: summary.totalScheduled },
            { key: "upcoming", label: "Upcoming", count: summary.upcomingCount },
            { key: "completed", label: "Completed", count: summary.completedCount },
            { key: "cancelled", label: "Cancelled", count: summary.cancelledCount },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.key
                      ? "bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Body ── */}
      {isLoading ? (
        <ScheduledUsersSkeleton />
      ) : isError ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/50">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Failed to Load Scheduled Visitors
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            An error occurred while fetching visitor history. Please try refreshing.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
          >
            Retry
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <User className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-70" />
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Scheduled Visitors Found
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No visitor records matched "${searchQuery}". Try a different search term.`
              : statusFilter !== "all"
                ? `No ${statusFilter} visitor appointments found for this branch.`
                : "When applicants schedule in-person tours or remote viewings, their booking records will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((userRecord) => {
            const isExpanded = expandedCardId === userRecord._id;
            const relativeTime = formatRelativeSchedule(userRecord.visitDateRaw);
            const historyList = userRecord.visitHistory || [];

            return (
              <div
                key={userRecord._id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
              >
                {/* Header: User name, Visit Code & Status */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {userRecord.tenantName}
                      </span>
                      {userRecord.visitCode && (
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {userRecord.visitCode}
                        </span>
                      )}
                    </div>

                    {/* Contact links */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {userRecord.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{userRecord.email}</span>
                        </span>
                      )}
                      {userRecord.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{userRecord.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <VisitStatusBadge
                      status={userRecord.visitStatus}
                      rejected={userRecord.scheduleRejected}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(userRecord._id)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                      title={isExpanded ? "Collapse details" : "Expand details"}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Scheduled Visit Details Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div>
                      <span className="font-medium">
                        {formatVisitDate(userRecord.visitDate)}
                      </span>
                      {relativeTime && (
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          ({relativeTime})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Slot: <strong>{userRecord.visitSlot}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Room: <strong>{userRecord.roomNumber}</strong> ({userRecord.roomType})
                    </span>
                  </div>

                  <div className="flex items-center">
                    <ViewingTypeBadge type={userRecord.viewingPreference} />
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                    {/* Booking Audit Timestamps */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Booked At: </span>
                        <strong className="text-slate-700 dark:text-slate-300">
                          {formatTimestamp(userRecord.visitScheduledAt)}
                        </strong>
                      </div>

                      {userRecord.scheduleApprovedAt && (
                        <div>
                          <span className="text-slate-400">Approved At: </span>
                          <strong className="text-slate-700 dark:text-slate-300">
                            {formatTimestamp(userRecord.scheduleApprovedAt)}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Rejection Note */}
                    {userRecord.scheduleRejected && userRecord.scheduleRejectionReason && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>Rejection Reason: </strong>
                          <span>{userRecord.scheduleRejectionReason}</span>
                        </div>
                      </div>
                    )}

                    {/* Admin Outcome Notes */}
                    {userRecord.visitOutcomeNotes && (
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Visit Outcome Notes: </strong>
                          <span>{userRecord.visitOutcomeNotes}</span>
                          {userRecord.visitOutcomeUpdatedByName && (
                            <span className="block text-[10px] text-slate-400 mt-1">
                              Recorded by {userRecord.visitOutcomeUpdatedByName} on{" "}
                              {formatTimestamp(userRecord.visitOutcomeUpdatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Previous Attempts / Reschedule History */}
                    {historyList.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <h6 className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Reschedule & Attempt History ({historyList.length})
                        </h6>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                          {historyList.map((hist, hIdx) => (
                            <div
                              key={hIdx}
                              className="p-2 flex items-center justify-between text-[11px] bg-slate-50/50 dark:bg-slate-900/40"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>
                                  {formatVisitDate(hist.visitDate)} ({hist.visitTime || "N/A"})
                                </span>
                              </div>
                              <span className="font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {hist.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination Footer ── */}
      {!isLoading && !isError && total > LIMIT && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
