import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ArrowUpRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { useReservations } from "../../../shared/hooks/queries/useReservations";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
  StatGridSkeleton,
  TableSkeleton,
} from "../../../shared/components/LoadingSkeletons";
import Pagination from "../../../shared/components/Pagination";
import VisitDetailsModal from "./VisitDetailsModal";
import { StatusBadge } from "./shared";
import { mapVisitScheduleRows } from "../utils/reservationRows";
import { ExportButtons } from "../pages/analyticsTabShared";
import {
  handleExportVisitSchedulesCSV,
  handleExportVisitSchedulesPDF,
} from "../utils/visitExportUtils";
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
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });
  const buttonRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = row.isHistorical ? 50 : 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    const menuWidth = 160;
    const left = Math.max(
      10,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10)
    );
    const top = openUp ? rect.top - 6 : rect.bottom + 6;

    setCoords({ top, left, openUp });
  }, [row.isHistorical]);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleScrollOrResize() {
      updatePosition();
    }

    function handleClickOutside(event) {
      if (buttonRef.current && buttonRef.current.contains(event.target)) {
        return;
      }
      const menuEl = document.getElementById(`visit-actions-menu-${row.id}`);
      if (menuEl && menuEl.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, updatePosition, row.id]);

  const canPerformVisitActions =
    !row.visitApproved &&
    row.visitStatus !== "no_show" &&
    row.visitStatus !== "visit_completed" &&
    !row.scheduleRejected;

  return (
    <div
      className="relative flex items-center justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        disabled={actionLoading === row.id}
        className="group px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-light)] bg-card text-foreground hover:border-slate-400 dark:hover:border-slate-600 hover:bg-muted active:scale-95 transition-all duration-150 flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
      >
        <span className="group-hover:text-foreground transition-colors duration-150">Actions</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150" />
      </button>

      {isOpen &&
        createPortal(
          <div
            id={`visit-actions-menu-${row.id}`}
            style={{
              position: "fixed",
              left: `${coords.left}px`,
              ...(coords.openUp
                ? { bottom: `${window.innerHeight - coords.top}px` }
                : { top: `${coords.top}px` }),
              zIndex: 9999,
            }}
            className="min-w-[160px] rounded-lg border border-[var(--border-light)] bg-card p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {row.isHistorical ? (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--danger)] hover:bg-[color:var(--danger-light)] transition-colors"
                onClick={() => {
                  setIsOpen(false);
                  handleDeleteHistoryEntry(row.reservationId, row.historyIndex);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
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
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function VisitSchedulesTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
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
  // Branch admins see only their branch — owners can filter across all branches
  const [branchFilter, setBranchFilter] = useState(isOwner ? "all" : (user?.branch || "all"));
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: rawReservations = [], isLoading: loading } = useReservations(
    { view: "admin-list" },
    { refetchInterval: 5000, refetchOnWindowFocus: true, refetchOnMount: true },
  );

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
      "Delete Visit Schedule?",
      "Remove this visit appointment from your active list? The time slot will be reopened for new visitors, and your record history is safely saved.",
      "danger",
      "Delete Schedule",
      async () => {
        // Real-time optimistic UI removal: mark item as archived immediately in React Query cache
        queryClient.setQueriesData(
          { queryKey: ["reservations"] },
          (oldData) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((res) =>
              res._id === id || res.id === id
                ? { ...res, isArchived: true, status: "archived" }
                : res,
            );
          },
        );
        await reservationApi.delete(id);
      },
      "Visit schedule deleted successfully.",
      "Failed to delete visit schedule. Please try again.",
    );
  };

  const handleDeleteHistoryEntry = (reservationId, historyIndex) => {
    confirmAction(
      "Delete History Entry?",
      "Remove this specific visit history record? This will delete this past visit entry from the visitor's log.",
      "danger",
      "Delete Entry",
      async () => {
        // Real-time optimistic update: immediately update history list in React Query cache
        queryClient.setQueriesData(
          { queryKey: ["reservations"] },
          (oldData) => {
            if (!Array.isArray(oldData)) return oldData;
            return oldData.map((res) => {
              if (res._id === reservationId || res.id === reservationId) {
                const nextHistory = Array.isArray(res.visitHistory)
                  ? res.visitHistory.filter((_, idx) => idx !== historyIndex)
                  : [];
                return { ...res, visitHistory: nextHistory };
              }
              return res;
            });
          },
        );
        await reservationApi.update(reservationId, {
          removeVisitHistoryIndex: historyIndex,
        });
      },
      "History entry deleted successfully.",
      "Failed to delete history entry. Please try again.",
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

  const counts = useMemo(
    () => ({
      total: schedules.length,
      awaitingVisit: awaitingVisit.length,
      completed: completed.length,
      noShows: noShows.length,
      rejected: rejected.length,
      cancelled: cancelled.length,
    }),
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

  const activeFilterLabel = summaryItems[activeFilter]?.label || "All Visits";

  const handleExportCSV = useCallback(() => {
    handleExportVisitSchedulesCSV({
      schedules: displayData,
      branchFilter,
    });
  }, [branchFilter, displayData]);

  const handleExportPDF = useCallback(async () => {
    try {
      await handleExportVisitSchedulesPDF({
        schedules: displayData,
        counts,
        branchFilter,
        activeFilterLabel,
        searchTerm,
      });
    } catch (err) {
      console.error("[VisitSchedulesExport] PDF generation failed:", err);
      showNotification("Failed to generate PDF report. Please try again.", "error");
    }
  }, [activeFilterLabel, branchFilter, counts, displayData, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stat-card row skeleton */}
        <StatGridSkeleton count={6} />

        {/* Table card skeleton */}
        <div
          className="border rounded-lg p-6"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-light)" }}
        >
          {/* Toolbar placeholder */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="sk-shimmer flex-1" style={{ height: 36, borderRadius: 8 }} />
            <div className="sk-shimmer" style={{ width: 140, height: 36, borderRadius: 8 }} />
            <div className="sk-shimmer" style={{ width: 140, height: 36, borderRadius: 8 }} />
          </div>
          <TableSkeleton rows={7} columns={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div
        className="border rounded-lg p-5 overflow-visible"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-light)",
        }}
      >
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, code, or room..."
              style={{
                backgroundColor: "var(--input-background)",
                borderColor: "var(--border-light)",
              }}
              className="w-full pl-10 pr-4 h-9 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:justify-start lg:justify-end">
            {isOwner && (
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                style={{
                  backgroundColor: "var(--input-background)",
                  borderColor: "var(--border-light)",
                }}
                className="h-9 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer hover:bg-muted transition-colors"
              >
                <option value="all">All Branches</option>
                <option value="Gil Puyat">Gil Puyat</option>
                <option value="Guadalupe">Guadalupe</option>
              </select>
            )}

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              style={{
                backgroundColor: "var(--input-background)",
                borderColor: "var(--border-light)",
              }}
              className="h-9 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer hover:bg-muted transition-colors"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="name-az">Name A-Z</option>
              <option value="name-za">Name Z-A</option>
            </select>

            <ExportButtons
              onCsv={handleExportCSV}
              onPdf={handleExportPDF}
              disabled={displayData.length === 0}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {displayData.length === 0 ? (
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
            <table className="w-full table-fixed">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: "var(--border-light)",
                    backgroundColor:
                      "color-mix(in srgb, var(--bg-inset) 30%, transparent)",
                  }}
                >
                  <th style={{ width: "26%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Visitor
                  </th>
                  <th style={{ width: "13%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Branch
                  </th>
                  <th style={{ width: "13%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Room
                  </th>
                  <th style={{ width: "15%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requested
                  </th>
                  <th style={{ width: "17%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Visit Appointment
                  </th>
                  <th style={{ width: "16%" }} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th style={{ width: "100px" }} className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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

        {displayData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(displayData.length / itemsPerPage))}
            totalItems={displayData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onLimitChange={(newLimit) => {
              setItemsPerPage(newLimit);
              setCurrentPage(1);
            }}
            pageSizeOptions={[5, 10, 20, 50]}
            itemLabel="visit schedules"
            variant="numbered"
            className="mt-4 pt-4 border-t border-border"
          />
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
