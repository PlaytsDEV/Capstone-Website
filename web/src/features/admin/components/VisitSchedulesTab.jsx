import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Search,
  Trash2,
  X as XIcon,
  AlertCircle,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { useReservations } from "../../../shared/hooks/queries/useReservations";
import {
  StatGridSkeleton,
  TableSkeleton,
} from "../../../shared/components/LoadingSkeletons";
import VisitDetailsModal from "./VisitDetailsModal";
import { StatusBadge } from "./shared";
import { mapVisitScheduleRows } from "../utils/reservationRows";
import "../styles/design-tokens.css";
import "../styles/admin-reservations.css";

const getAvatarColor = (initials = "") => {
  const colors = [
    "bg-[color:var(--chart-5)] text-white",
    "bg-[color:var(--chart-1)] text-white",
    "bg-[color:var(--chart-4)] text-white",
    "bg-[color:var(--danger)] text-white",
    "bg-[color:var(--chart-2)] text-white",
    "bg-[color:var(--warning)] text-white",
  ];
  const charCode = initials.length > 0 ? initials.charCodeAt(0) : 0;
  const index = charCode % colors.length;
  return colors[index];
};

function initials(name = "") {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0]?.[0] || "?").toUpperCase();
}

function VisitActionMenu({
  row,
  actionLoading,
  handleVerify,
  handleMarkNoShow,
  setSelectedSchedule,
  handleDelete,
  handleDeleteHistoryEntry,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const canPerformVisitActions =
    !row.visitApproved &&
    row.visitStatus !== "no_show" &&
    row.visitStatus !== "visit_completed" &&
    !row.scheduleRejected;

  return (
    <div
      ref={menuRef}
      className="relative flex items-center justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={actionLoading === row.id}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-light)] bg-card text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
      >
        <span>Actions</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-lg border border-[var(--border-light)] bg-card p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100 text-left">
          {row.isHistorical ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--danger)] hover:bg-[color:var(--danger-light)] transition-colors"
              onClick={() => {
                setIsOpen(false);
                handleDeleteHistoryEntry(row.reservationId, row.historyIndex);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete History Entry
            </button>
          ) : (
            <>
              {canPerformVisitActions && (
                <>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--success-dark)] hover:bg-[color:var(--success-light)] transition-colors"
                    disabled={actionLoading === row.id}
                    onClick={() => {
                      setIsOpen(false);
                      handleVerify(row.id);
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-[color:var(--success)]" />
                    Mark Visited
                  </button>

                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--warning-dark,#92400E)] hover:bg-[color:var(--warning-light,#FEF3C7)] transition-colors"
                    disabled={actionLoading === row.id}
                    onClick={() => {
                      setIsOpen(false);
                      handleMarkNoShow(row.id);
                    }}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-[color:var(--warning)]" />
                    No-Show
                  </button>

                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--danger-dark)] hover:bg-[color:var(--danger-light)] transition-colors"
                    disabled={actionLoading === row.id}
                    onClick={() => {
                      setIsOpen(false);
                      setSelectedSchedule(row);
                    }}
                  >
                    <XIcon className="w-3.5 h-3.5 text-[color:var(--danger)]" />
                    Reject
                  </button>

                  <div className="my-1 border-t border-[var(--border-light)]" />
                </>
              )}

              <button
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--danger)] hover:bg-[color:var(--danger-light)] transition-colors"
                onClick={() => {
                  setIsOpen(false);
                  handleDelete(row.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Archive Schedule
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VisitSchedulesTab() {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    variant: "info",
    onConfirm: null,
  });
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: rawReservations = [], isLoading: loading } = useReservations({
    view: "admin-list",
  });

  const schedules = useMemo(
    () => mapVisitScheduleRows(rawReservations),
    [rawReservations],
  );

  // All active visits awaiting the applicant to show up (schedules auto-approved)
  const awaitingVisit = useMemo(
    () =>
      schedules.filter(
        (s) =>
          !s.isHistorical &&
          !s.visitApproved &&
          !s.scheduleRejected &&
          s.visitStatus !== "no_show" &&
          s.visitStatus !== "visit_completed" &&
          s.visitStatus !== "visit_cancelled",
      ),
    [schedules],
  );
  // Visit completed (marked as visited)
  const completed = useMemo(
    () =>
      schedules.filter(
        (s) =>
          (!s.isHistorical && s.visitApproved) ||
          (s.isHistorical &&
            (s.historyStatus === "approved" || s.historyStatus === "completed")),
      ),
    [schedules],
  );
  // No-shows (explicitly recorded by admin)
  const noShows = useMemo(
    () =>
      schedules.filter(
        (s) =>
          (!s.isHistorical && s.visitStatus === "no_show") ||
          (s.isHistorical && s.historyStatus === "no_show"),
      ),
    [schedules],
  );
  const rejected = useMemo(
    () =>
      schedules.filter(
        (s) =>
          s.scheduleRejected ||
          (s.isHistorical && s.historyStatus === "rejected"),
      ),
    [schedules],
  );
  const cancelled = useMemo(
    () =>
      schedules.filter(
        (s) =>
          (s.isHistorical &&
            (s.historyStatus === "cancelled" ||
              s.historyStatus === "visit_cancelled")) ||
          (!s.isHistorical && s.status === "cancelled"),
      ),
    [schedules],
  );

  const refetchAll = () =>
    queryClient.invalidateQueries({ queryKey: ["reservations"] });

  const confirmAction = (
    title,
    message,
    variant,
    confirmText,
    action,
    successMsg = null,
    errorMsg = null,
  ) => {
    setConfirmModal({
      open: true,
      title,
      message,
      variant,
      confirmText,
      onConfirm: async () => {
        setConfirmModal((previous) => ({ ...previous, open: false }));
        try {
          await action();
          refetchAll();
          if (successMsg) showNotification(successMsg, "success", 3000);
        } catch {
          showNotification(errorMsg || `Failed: ${title}`, "error", 3000);
        }
      },
    });
  };

  const handleVerify = (id) => {
    confirmAction(
      "Mark Visit as Completed",
      "Confirm the applicant attended the scheduled physical visit? This will unlock their tenant application.",
      "info",
      "Mark as Visited",
      async () => {
        setActionLoading(id);
        try {
          await reservationApi.manageVisit(id, { action: "mark_visited" });
        } finally {
          setActionLoading(null);
        }
      },
      "Visit marked as completed. Tenant can now submit their application.",
      "Failed to mark visit as completed. Please try again.",
    );
  };



  const handleMarkNoShow = (id) => {
    confirmAction(
      "Mark as No-Show",
      "Mark this applicant as a no-show? This records that they did not attend the scheduled visit.",
      "danger",
      "Mark No-Show",
      async () => {
        setActionLoading(id);
        try {
          await reservationApi.manageVisit(id, { action: "mark_no_show" });
        } finally {
          setActionLoading(null);
        }
      },
      "Applicant marked as no-show.",
      "Failed to mark as no-show. Please try again.",
    );
  };

  const handleDelete = (id) => {
    confirmAction(
      "Archive Visit Schedule",
      "This action archives the reservation record for this visit schedule and preserves billing history.",
      "danger",
      "Archive",
      async () => {
        await reservationApi.delete(id);
      },
      "Visit schedule archived",
      "Failed to archive visit schedule. Please try again.",
    );
  };

  const handleDeleteHistoryEntry = (reservationId, historyIndex) => {
    confirmAction(
      "Delete History Entry",
      "Remove this visit history entry?",
      "danger",
      "Delete",
      async () => {
        await reservationApi.update(reservationId, {
          removeVisitHistoryIndex: historyIndex,
        });
      },
      "History entry removed",
      "Failed to remove history entry. Please try again.",
    );
  };

  const summaryItems = useMemo(
    () => [
      { label: "All", value: schedules.length, icon: Calendar, color: "blue" },
      {
        label: "Awaiting Visit",
        value: awaitingVisit.length,
        icon: Clock,
        color: "orange",
      },
      {
        label: "Visit Completed",
        value: completed.length,
        icon: CheckCircle,
        color: "green",
      },
      {
        label: "No-Show",
        value: noShows.length,
        icon: AlertCircle,
        color: "red",
      },
      {
        label: "Rejected",
        value: rejected.length,
        icon: XIcon,
        color: "red",
      },
      { label: "Cancelled", value: cancelled.length, icon: Ban, color: "red" },
    ],
    [
      awaitingVisit.length,
      cancelled.length,
      completed.length,
      noShows.length,
      rejected.length,
      schedules.length,
    ],
  );

  const displayData = useMemo(() => {
    let base;
    if (activeFilter === 0) base = schedules;
    else if (activeFilter === 1) base = awaitingVisit;
    else if (activeFilter === 2) base = completed;
    else if (activeFilter === 3) base = noShows;
    else if (activeFilter === 4) base = rejected;
    else if (activeFilter === 5) base = cancelled;
    else base = schedules;

    const query = searchTerm.trim().toLowerCase();
    let result = base.filter((schedule) => {
      const matchSearch =
        !query ||
        schedule.customer.toLowerCase().includes(query) ||
        schedule.email.toLowerCase().includes(query) ||
        schedule.reservationCode.toLowerCase().includes(query) ||
        schedule.room.toLowerCase().includes(query);
      const matchBranch =
        branchFilter === "all" ||
        schedule.branch.toLowerCase() === branchFilter.toLowerCase();
      return matchSearch && matchBranch;
    });

    if (sortBy === "oldest") {
      result = [...result].sort(
        (left, right) =>
          new Date(left.scheduledDate || 0) -
          new Date(right.scheduledDate || 0),
      );
    } else if (sortBy === "name-az") {
      result = [...result].sort((left, right) =>
        left.customer.localeCompare(right.customer),
      );
    } else if (sortBy === "name-za") {
      result = [...result].sort((left, right) =>
        right.customer.localeCompare(left.customer),
      );
    }

    return result;
  }, [
    activeFilter,
    awaitingVisit,
    branchFilter,
    cancelled,
    completed,
    noShows,
    rejected,
    schedules,
    searchTerm,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayData.length / itemsPerPage));
  const paginatedData = useMemo(
    () =>
      displayData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [currentPage, displayData],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, branchFilter, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      {loading ? (
        <StatGridSkeleton
          count={6}
          className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto pb-1"
        />
      ) : (
      <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto pb-1">
        {summaryItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeFilter === index;

          const colorClass =
            item.color === "blue"
              ? "text-[color:var(--info)]"
              : item.color === "orange"
              ? "text-[color:var(--warning)]"
              : item.color === "green"
              ? "text-[color:var(--success)]"
              : "text-[color:var(--danger)]";

          return (
            <div
              key={item.label}
              onClick={() => setActiveFilter(index)}
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: isActive
                  ? "color-mix(in srgb, var(--primary) 55%, var(--border-light))"
                  : "var(--border-light)",
                boxShadow: isActive ? "0 6px 16px rgba(2,6,23,0.06)" : "0 2px 8px rgba(2,6,23,0.03)",
              }}
              className="border rounded-xl p-4 cursor-pointer min-h-[108px]"
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon className={`${colorClass} w-5 h-5 flex-shrink-0 mr-2`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
              <div className={`text-[28px] font-medium leading-none ${colorClass}`}>
                {item.value}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div
        className="border rounded-lg p-6"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-light)",
        }}
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, code, or room..."
              style={{
                backgroundColor: "var(--input-background)",
                borderColor: "var(--border-light)",
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              style={{
                backgroundColor: "var(--input-background)",
                borderColor: "var(--border-light)",
              }}
              className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Branches</option>
              <option value="Gil Puyat">Gil Puyat</option>
              <option value="Guadalupe">Guadalupe</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={{
                backgroundColor: "var(--input-background)",
                borderColor: "var(--border-light)",
              }}
              className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="name-az">Name A-Z</option>
              <option value="name-za">Name Z-A</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={7} columns={7} style={{ border: 0 }} />
          ) : displayData.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">
                No visit schedules
              </p>
              <p className="mt-1 text-base text-muted-foreground">
                Visit schedules will appear here.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: "var(--border-light)",
                    backgroundColor:
                      "color-mix(in srgb, var(--bg-inset) 30%, transparent)",
                  }}
                >
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Visitor
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Room
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Visit Appointment
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row) => {
                  const isDim = row.isHistorical ? "opacity-55" : "";
                  const actionedDate = row.actionedAt
                    ? new Date(row.actionedAt)
                    : null;

                  let statusNode;
                  if (row.isHistorical) {
                    const historyMap = {
                      schedule_approved: { status: "active", label: "Sched. Approved" },
                      approved: { status: "verified", label: "Completed" },
                      completed: { status: "verified", label: "Completed" },
                      rejected: { status: "overdue", label: "Rejected" },
                      no_show: { status: "overdue", label: "No-Show" },
                      cancelled: { status: "overdue", label: "Cancelled" },
                      visit_cancelled: { status: "overdue", label: "Cancelled" },
                      pending: { status: "pending", label: "Scheduled" },
                    };
                    const config =
                      historyMap[row.historyStatus] || historyMap.pending;
                    statusNode = (
                      <div className="opacity-60">
                        <StatusBadge
                          status={config.status}
                          label={config.label}
                        />
                        {actionedDate && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {actionedDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            <div>
                              {actionedDate.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    let activeStatus, activeLabel;
                    if (row.scheduleRejected) {
                      activeStatus = "rejected";
                      activeLabel = "Rejected";
                    } else if (row.visitApproved || row.visitStatus === "visit_completed") {
                      activeStatus = "verified";
                      activeLabel = "Visit Completed";
                    } else if (row.visitStatus === "no_show") {
                      activeStatus = "overdue";
                      activeLabel = "No-Show";
                    } else {
                      // Schedules are auto-approved — show "Awaiting Visit"
                      activeStatus = "active";
                      activeLabel = "Awaiting Visit";
                    }
                    statusNode = (
                      <div>
                        <StatusBadge status={activeStatus} label={activeLabel} />
                        {actionedDate && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {actionedDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            <div>
                              {actionedDate.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--border-light)] hover:bg-muted transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className={`flex items-center gap-3 ${isDim}`}>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${getAvatarColor(initials(row.customer))}`}
                          >
                            {initials(row.customer)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {row.customer}
                              {row.historyStatus === "cancelled" ? (
                                <span className="ml-2 rounded-full bg-error-light px-2 py-0.5 text-[10px] font-semibold text-error-dark">
                                  Cancelled
                                </span>
                              ) : row.attemptNumber != null ? (
                                <span
                                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    row.isHistorical
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-info-light text-info-dark"
                                  }`}
                                >
                                  Attempt {row.attemptNumber}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-foreground">
                        <span className={isDim}>{row.branch}</span>
                      </td>
                      <td className="py-4 px-4 text-sm text-foreground">
                        <span className={isDim}>{row.room}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`leading-5 ${isDim}`}>
                          <div className="text-sm text-foreground">
                            {row.scheduledDate
                              ? new Date(row.scheduledDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.scheduledDate
                              ? new Date(row.scheduledDate).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "-"}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`leading-5 ${isDim}`}>
                          <div className="text-sm text-foreground">
                            {row.visitDate
                              ? new Date(row.visitDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.visitTime || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">{statusNode}</td>
                      <td className="py-4 px-4 text-right">
                        <VisitActionMenu
                          row={row}
                          actionLoading={actionLoading}
                          handleVerify={handleVerify}
                          handleMarkNoShow={handleMarkNoShow}
                          setSelectedSchedule={setSelectedSchedule}
                          handleDelete={handleDelete}
                          handleDeleteHistoryEntry={handleDeleteHistoryEntry}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-end items-center gap-2 mt-4 pt-4 border-t border-[var(--border-light)]">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 text-sm border border-[var(--border-light)] rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 text-sm border border-[var(--border-light)] rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() =>
          setConfirmModal((previous) => ({ ...previous, open: false }))
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText || "Confirm"}
      />
      <VisitDetailsModal
        schedule={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
        onUpdate={refetchAll}
      />
    </div>
  );
}

export default VisitSchedulesTab;
