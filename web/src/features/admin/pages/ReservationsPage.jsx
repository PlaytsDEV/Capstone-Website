import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Download,
  RotateCcw,
  Trash2,
  User,
  Search,
  ArrowLeft,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { reservationApi } from "../../../shared/api/apiClient";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { showNotification } from "../../../shared/utils/notification";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import {
  normalizeBranchFilterValue,
  syncBranchSearchParam,
} from "../../../shared/utils/branchFilterQuery.mjs";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { useReservations } from "../../../shared/hooks/queries/useReservations";
import {
  RESERVATION_STATUS_LABELS,
  hasReservationStatus,
  readMoveInDate,
} from "../../../shared/utils/lifecycleNaming";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";
import ReservationDetailsModal from "../components/ReservationDetailsModal";
import VisitSchedulesTab from "../components/VisitSchedulesTab";
import VisitAvailabilityTab from "../components/VisitAvailabilityTab";
import InquiriesPage from "./InquiriesPage";
import {
  ActionBar,
  DataTable,
  PageShell,
  StatusBadge,
  SummaryBar,
} from "../components/shared";
import {
  IN_PROGRESS_STATUSES,
  checkOverdueReservation,
  getBranchLabel,
  hasPendingCancellationRequest,
  mapReservationAdminRow,
} from "../utils/reservationRows";
import "../styles/design-tokens.css";
import "../styles/admin-reservations.css";

const getAvatarColor = (initials = "") => {
  const colors = [
    "bg-[color:var(--chart-5)] text-white",
    "bg-[color:var(--chart-1)] text-white",
    "bg-[color:var(--secondary)] text-white",
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

function formatShortDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SUMMARY_FILTERS = [
  "all",
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "reserved",
  "cancellation_requested",
  "cancelled",
  "moveIn",
  "archived",
];
function ReservationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const isOwner = user?.role === "owner";
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("reservations");
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("search") || "",
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const requestedBranch = searchParams.get("branch");
  const [branchFilter, setBranchFilter] = useState(() =>
    normalizeBranchFilterValue({
      requestedBranch: isOwner ? requestedBranch : null,
      fallbackBranch: isOwner ? null : user?.branch,
      allValue: "all",
    }),
  );
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState({ key: "createdAt", dir: "desc" });
  const [seenIds, setSeenIds] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_seen_reservation_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsSeen = useCallback((id) => {
    if (!id) return;
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(
          "admin_seen_reservation_ids",
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    variant: "info",
    onConfirm: null,
  });
  const itemsPerPage = 10;

  const {
    data: rawReservations = [],
    isLoading: loading,
    error: queryError,
  } = useReservations({ view: "admin-list", archive: "all" });
  const error = queryError?.message || null;

  const reservations = useMemo(
    () =>
      rawReservations.map((raw) => {
        const row = mapReservationAdminRow(raw);
        return {
          ...row,
          isNew: row.isNew && !raw.isViewedByAdmin && !seenIds.has(row.id),
        };
      }),
    [rawReservations, seenIds],
  );

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => !reservation.isArchived),
    [reservations],
  );

  const counts = useMemo(
    () => ({
      total: activeReservations.length,
      pendingApplicationReview: activeReservations.filter((reservation) =>
        reservation.status === "pending_application_review",
      ).length,
      needsRevision: activeReservations.filter((reservation) =>
        reservation.status === "needs_revision",
      ).length,
      approvedForPayment: activeReservations.filter((reservation) =>
        reservation.status === "approved_for_payment",
      ).length,
      reserved: activeReservations.filter(
        (reservation) => reservation.status === "reserved",
      ).length,
      cancellationRequested: activeReservations.filter(hasPendingCancellationRequest)
        .length,
      cancelled: activeReservations.filter(
        (reservation) => reservation.status === "cancelled",
      ).length,
      movedIn: activeReservations.filter((reservation) =>
        hasReservationStatus(reservation.status, "moveIn"),
      ).length,
      archived: reservations.filter((reservation) => reservation.isArchived)
        .length,
    }),
    [activeReservations, reservations],
  );

  const filteredReservations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const matchArchive =
        statusFilter === "archived"
          ? reservation.isArchived
          : !reservation.isArchived;
      if (!matchArchive) return false;

      const matchSearch =
        !query ||
        reservation.customer.toLowerCase().includes(query) ||
        reservation.email.toLowerCase().includes(query) ||
        reservation.reservationCode.toLowerCase().includes(query) ||
        reservation.room.toLowerCase().includes(query);
      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "archived"
            ? true
          : statusFilter === "new"
            ? reservation.isNew
          : statusFilter === "overdue"
            ? checkOverdueReservation(reservation)
            : statusFilter === "in_progress"
              ? IN_PROGRESS_STATUSES.includes(reservation.status)
              : statusFilter === "cancellation_requested"
                ? hasPendingCancellationRequest(reservation)
                : hasReservationStatus(reservation.status, statusFilter);
      const matchBranch =
        branchFilter === "all" || reservation.branchCode === branchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [branchFilter, reservations, searchTerm, statusFilter]);

  const sortedReservations = useMemo(() => {
    const { key, dir } = sortState;
    if (statusFilter === "cancellation_requested") {
      return [...filteredReservations].sort(
        (left, right) =>
          new Date(right.cancellationRequestedAt || 0) -
          new Date(left.cancellationRequestedAt || 0),
      );
    }

    if (!key) return filteredReservations;

    return [...filteredReservations].sort((left, right) => {
      const leftValue = left[key];
      const rightValue = right[key];

      if (leftValue == null) return 1;
      if (rightValue == null) return -1;

      let comparison = 0;
      if (key === "createdAt") {
        comparison = new Date(leftValue) - new Date(rightValue);
      } else if (key === "moveInDate") {
        comparison =
          new Date(readMoveInDate(left)) - new Date(readMoveInDate(right));
      } else if (typeof leftValue === "string") {
        comparison = leftValue.localeCompare(rightValue);
      } else {
        comparison = leftValue - rightValue;
      }

      return dir === "asc" ? comparison : -comparison;
    });
  }, [filteredReservations, sortState, statusFilter]);

  const totalFiltered = sortedReservations.length;
  const isArchivedView = statusFilter === "archived";

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, itemsPerPage, totalFiltered]);

  useEffect(() => {
    const nextBranch = normalizeBranchFilterValue({
      requestedBranch: isOwner ? requestedBranch : null,
      fallbackBranch: isOwner ? null : user?.branch,
      allValue: "all",
    });

    setBranchFilter((current) =>
      current === nextBranch ? current : nextBranch,
    );
  }, [isOwner, requestedBranch, user?.branch]);

  useEffect(() => {
    if (!user?.role) return;

    const nextParams = syncBranchSearchParam(searchParams, branchFilter, {
      enabled: isOwner,
      allValue: "all",
    });

    if (nextParams.toString() === searchParams.toString()) return;
    setSearchParams(nextParams, { replace: true });
  }, [branchFilter, isOwner, searchParams, setSearchParams, user?.role]);

  const summaryItems = useMemo(
    () => [
      { label: "All", value: counts.total, icon: Calendar, color: "blue" },
      {
        label: "Pending Review",
        value: counts.pendingApplicationReview,
        icon: Clock,
        color: "orange",
      },
      {
        label: "Needs Revision",
        value: counts.needsRevision,
        icon: Clock,
        color: "orange",
      },
      {
        label: "Approved for Payment",
        value: counts.approvedForPayment,
        icon: CheckCircle,
        color: "neutral",
      },
      {
        label: "Reserved",
        value: counts.reserved,
        icon: CheckCircle,
        color: "blue",
      },
      {
        label: "Cancellation Requests",
        value: counts.cancellationRequested,
        icon: AlertTriangle,
        color: "orange",
      },
      {
        label: "Cancelled",
        value: counts.cancelled,
        icon: Trash2,
        color: "red",
      },
      { label: "Move In", value: counts.movedIn, icon: User, color: "green" },
      {
        label: "Archived",
        value: counts.archived,
        icon: Archive,
        color: "neutral",
      },
    ],
    [counts],
  );
  const activeSummaryIndex = SUMMARY_FILTERS.indexOf(statusFilter);

  const tabs = useMemo(
    () => [
      { key: "reservations", label: "Reservations" },
      { key: "visits", label: "Visit Schedules" },
      { key: "availability", label: "Availability Rules" },
      { key: "inquiries", label: "Inquiries" },
    ],
    [],
  );

  const filters = useMemo(
    () => [
      ...(isOwner
        ? [
            {
              key: "branch",
              options: OWNER_BRANCH_FILTER_OPTIONS,
              value: branchFilter,
              onChange: (value) => {
                setBranchFilter(value);
                setCurrentPage(1);
              },
            },
          ]
        : []),
      {
        key: "status",
        options: [
          { value: "all", label: "All Status" },
          { value: "new", label: "New Reservations" },
          { value: "pending_application_review", label: "Pending Review" },
          { value: "approved_for_payment", label: "Approved for Payment" },
          { value: "cancellation_requested", label: "Cancellation Requests" },
          { value: "moveIn", label: "Moved In" },
          { value: "cancelled", label: "Cancelled" },
          { value: "archived", label: "Archived" },
        ],
        value: statusFilter,
        onChange: (value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        },
      },
    ],
    [branchFilter, isOwner, statusFilter],
  );

  const prefetchReservationDetail = useCallback(
    async (reservationId) => {
      if (!reservationId) return null;
      return queryClient.fetchQuery({
        queryKey: queryKeys.reservations.detail(reservationId),
        queryFn: () => reservationApi.getById(reservationId),
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!selectedReservation?.id) return;

    const liveReservation = reservations.find(
      (reservation) => reservation.id === selectedReservation.id,
    );

    if (!liveReservation) return;

    setSelectedReservation((previous) => {
      if (!previous) return previous;
      if (
        previous.status === liveReservation.status &&
        previous.moveInDate === liveReservation.moveInDate &&
        previous.moveOutDate === liveReservation.moveOutDate &&
        previous.cancellationRequested === liveReservation.cancellationRequested &&
        previous.cancellationStatus === liveReservation.cancellationStatus &&
        previous.cancellationRequestedAt === liveReservation.cancellationRequestedAt &&
        previous.visitStatus === liveReservation.visitStatus &&
        previous.visitApproved === liveReservation.visitApproved &&
        previous.scheduleApproved === liveReservation.scheduleApproved &&
        previous.scheduleRejected === liveReservation.scheduleRejected
      ) {
        return previous;
      }

      return {
        ...previous,
        customer: liveReservation.customer,
        email: liveReservation.email,
        room: liveReservation.room,
        branch: liveReservation.branch,
        branchCode: liveReservation.branchCode,
        roomType: liveReservation.roomType,
        reservationCode: liveReservation.reservationCode,
        status: liveReservation.status,
        moveInDate: liveReservation.moveInDate,
        moveOutDate: liveReservation.moveOutDate,
        createdAt: liveReservation.createdAt,
        cancellationRequested: liveReservation.cancellationRequested,
        cancellationRequestedAt: liveReservation.cancellationRequestedAt,
        cancellationRequestedBy: liveReservation.cancellationRequestedBy,
        cancellationStatus: liveReservation.cancellationStatus,
        cancellationReason: liveReservation.cancellationReason,
        cancellationAdminNote: liveReservation.cancellationAdminNote,
        visitStatus: liveReservation.visitStatus,
        visitApproved: liveReservation.visitApproved,
        visitDate: liveReservation.visitDate,
        visitTime: liveReservation.visitTime,
        visitHistory: liveReservation.visitHistory,
        scheduleApproved: liveReservation.scheduleApproved,
        scheduleRejected: liveReservation.scheduleRejected,
        scheduleRejectionReason: liveReservation.scheduleRejectionReason,
      };
    });
  }, [reservations, selectedReservation]);

  const handleView = useCallback(
    async (reservationId) => {
      markAsSeen(reservationId);
      try {
        const reservation = await prefetchReservationDetail(reservationId);
        setSelectedReservation({
          ...reservation,
          id: reservation._id,
          customer:
            reservation.customer ||
            `${reservation.userId?.firstName || ""} ${reservation.userId?.lastName || ""}`.trim() ||
            "Unknown",
          email: reservation.email || reservation.userId?.email || "-",
          room:
            reservation.roomId?.name || reservation.roomId?.roomNumber || "-",
          branch: getBranchLabel(reservation.roomId?.branch),
          branchCode: reservation.roomId?.branch || "",
          roomType: reservation.roomId?.type || "",
          status: reservation.status || "pending",
          totalPrice: reservation.totalPrice,
          paymentStatus: reservation.paymentStatus,
          paymentMethod: reservation.paymentMethod,
          createdAt: reservation.createdAt,
          reservationCode: reservation.reservationCode || "-",
          firstName: reservation.firstName,
          lastName: reservation.lastName,
          middleName: reservation.middleName,
          nickname: reservation.nickname,
          phone: reservation.mobileNumber || reservation.phone,
          birthday: reservation.birthday,
          maritalStatus: reservation.maritalStatus,
          nationality: reservation.nationality,
          educationLevel: reservation.educationLevel,
          address: reservation.address,
          emergencyContact: reservation.emergencyContact,
          healthConcerns: reservation.healthConcerns,
          employment: reservation.employment,
          selfiePhotoUrl: reservation.selfiePhotoUrl,
          validIDFrontUrl: reservation.validIDFrontUrl,
          validIDBackUrl: reservation.validIDBackUrl,
          validIDType: reservation.validIDType,
          nbiClearanceUrl: reservation.nbiClearanceUrl,
          nbiReason: reservation.nbiReason,
          companyIDUrl: reservation.companyIDUrl,
          companyIDReason: reservation.companyIDReason,
          finalMoveInDate: reservation.finalMoveInDate,
          proofOfPaymentUrl: reservation.proofOfPaymentUrl,
          leaseDuration: reservation.leaseDuration,
          billingEmail: reservation.billingEmail,
          moveInDate: reservation.moveInDate,
          moveOutDate: reservation.moveOutDate,
          visitDate: reservation.visitDate,
          visitTime: reservation.visitTime,
          visitApproved: reservation.visitApproved,
          notes: reservation.notes,
          cancellationRequested: reservation.cancellationRequested,
          cancellationRequestedAt: reservation.cancellationRequestedAt,
          cancellationRequestedBy: reservation.cancellationRequestedBy,
          cancellationStatus: reservation.cancellationStatus,
          cancellationReason: reservation.cancellationReason,
          cancellationAdminNote: reservation.cancellationAdminNote,
        });
      } catch {
        const fallbackReservation = reservations.find(
          (reservation) => reservation.id === reservationId,
        );
        if (fallbackReservation) {
          setSelectedReservation(fallbackReservation);
        }
      }
    },
    [prefetchReservationDetail, reservations],
  );

  useEffect(() => {
    if (activeTab !== "reservations") return;
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) return;
    markAsSeen(reservationId);
    if (selectedReservation?.id === reservationId) return;

    handleView(reservationId);
  }, [activeTab, handleView, markAsSeen, searchParams, selectedReservation?.id]);

  const refetchReservations = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["reservations"] }),
    [queryClient],
  );

  const handleDelete = useCallback(
    (reservationId) => {
      setConfirmModal({
        open: true,
        title: "Archive Reservation",
        message:
          "This will hide the reservation from the active list and preserve billing history. You can restore it later from Archived Reservations. Permanent deletion is restricted when issued bills exist.",
        variant: "danger",
        confirmText: "Archive",
        onConfirm: async () => {
          setConfirmModal((previous) => ({ ...previous, open: false }));
          try {
            await reservationApi.archive(reservationId, {
              reason: "Archived from Reservations page",
            });
            showNotification("Reservation archived", "success");
            refetchReservations();
          } catch (error) {
            showNotification(
              error?.message || "Failed to archive reservation",
              "error",
            );
          }
        },
      });
    },
    [refetchReservations],
  );

  const handleRestore = useCallback(
    (reservationId) => {
      setConfirmModal({
        open: true,
        title: "Restore Reservation",
        message:
          "This will return the reservation to the reservations list using its previous status. Billing and history records will remain preserved.",
        variant: "info",
        confirmText: "Restore",
        onConfirm: async () => {
          setConfirmModal((previous) => ({ ...previous, open: false }));
          try {
            await reservationApi.restore(reservationId);
            showNotification("Reservation restored", "success");
            refetchReservations();
          } catch (error) {
            showNotification(
              error?.message || "Failed to restore reservation",
              "error",
            );
          }
        },
      });
    },
    [refetchReservations],
  );

  const handleExportReservations = useCallback(() => {
    exportToCSV(
      sortedReservations.map((reservation) => ({
        reservationCode: reservation.reservationCode,
        applicant: reservation.customer,
        email: reservation.email,
        branch: reservation.branch,
        room: reservation.room,
        status:
          RESERVATION_STATUS_LABELS[reservation.status] || reservation.status,
        moveInDate: formatShortDate(readMoveInDate(reservation)),
        createdAt: formatShortDate(reservation.createdAt),
      })),
      [
        { key: "reservationCode", label: "Reservation Code" },
        { key: "applicant", label: "Applicant" },
        { key: "email", label: "Email" },
        { key: "branch", label: "Branch" },
        { key: "room", label: "Room" },
        { key: "status", label: "Status" },
        { key: "moveInDate", label: "Move In" },
        { key: "createdAt", label: "Created" },
      ],
      "reservations",
    );
  }, [sortedReservations]);

  const columns = useMemo(
    () => [
      {
        key: "applicant",
        sortKey: "customer",
        label: "Applicant",
        sortable: true,
        render: (row) => {
          const rowInitials = initials(row.customer);
          return (
            <div className="res-applicant-cell">
              <div
                className={`res-avatar ${getAvatarColor(rowInitials)}`}
                aria-label={row.customer}
              >
                {rowInitials}
              </div>
              <div className="res-applicant-info">
                <div className="flex items-center gap-2">
                  <span className="res-applicant-name">{row.customer}</span>
                  {row.isNew && (
                    <span
                      className="res-badge-new"
                      title="New reservation (created within 48 hours)"
                    >
                      <span className="res-badge-new__dot" />
                      NEW
                    </span>
                  )}
                </div>
                <span className="res-applicant-email">{row.email}</span>
                <span className="res-applicant-code">{row.phone}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: "room",
        label: "Room",
        sortable: true,
        render: (row) => (
          <div className="res-room-cell">
            <span className="res-room-name">{row.room}</span>
            <span className="res-room-meta">
              {row.roomType || "Room"}, {row.branch}
            </span>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusBadge
            status={checkOverdueReservation(row) ? "overdue" : row.status}
          />
        ),
      },
      {
        key: "moveInDate",
        label: isArchivedView ? "Archived" : "Move-In",
        sortable: true,
        render: (row) => formatShortDate(row.moveInDate),
      },
      {
        key: "createdAt",
        label: isArchivedView ? "Archived By" : "Date",
        sortable: true,
        render: (row) => formatShortDate(row.createdAt),
      },
      {
        key: "actions",
        label: "",
        width: "70px",
        align: "right",
        render: (row) => (
          <div
            className="res-actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="res-icon-btn"
              title="View details"
              onClick={() => handleView(row.id)}
            >
              <Eye size={16} />
            </button>
            {can("manageReservations") && (
              <button
                className="res-icon-btn res-icon-btn--danger"
                title="Delete"
                onClick={() => handleDelete(row.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [can, handleDelete, handleView, isArchivedView],
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Review applications, confirm documents, and move accepted residents
            toward assignment.
          </p>
        </div>
      </div>

      <div className="border-b" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-[color:var(--primary)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[color:var(--primary)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "reservations" && (
        <>
          <div className="grid grid-flow-col auto-cols-[minmax(160px,1fr)] gap-3 overflow-x-auto pb-2">
            {summaryItems.map((item, idx) => {
              const isActive = activeSummaryIndex === idx;
              return (
                <div
                  key={item.label}
                  onClick={() => {
                    const nextFilter = idx < 0 ? "all" : SUMMARY_FILTERS[idx];

                    setStatusFilter(nextFilter);
                    setCurrentPage(1);
                  }}
                  style={{
                    borderColor: isActive ? "var(--primary)" : "var(--border-light)",
                    boxShadow: isActive
                      ? "0 6px 16px rgba(2,6,23,0.06)"
                      : "0 2px 8px rgba(2,6,23,0.03)",
                  }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon
                      strokeWidth={1.5}
                      className={`w-5 h-5 flex-shrink-0 mr-2 ${
                        item.color === "blue"
                          ? "text-[color:var(--info)]"
                          : item.color === "orange"
                          ? "text-[color:var(--warning)]"
                          : item.color === "neutral"
                          ? "text-[color:var(--status-neutral)]"
                          : item.color === "green"
                          ? "text-[color:var(--success)]"
                          : "text-[color:var(--danger)]"
                      }`}
                    />

                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {item.label}
                    </span>
                  </div>

                  <div
                    className={`text-2xl font-semibold ${
                      item.color === "blue"
                        ? "text-[color:var(--info)]"
                        : item.color === "orange"
                        ? "text-[color:var(--warning)]"
                        : item.color === "neutral"
                        ? "text-[color:var(--status-neutral)]"
                        : item.color === "green"
                        ? "text-[color:var(--success)]"
                        : "text-[color:var(--danger)]"
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              );
            })}
</div>

          <div
            style={{ backgroundColor: "var(--bg-card)", border: `1px solid var(--border-light)` }}
            className="border rounded-lg p-6 overflow-x-auto"
          >
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, email, code, or room..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                  className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                {isOwner && (
                  <select
                    value={branchFilter}
                    onChange={(e) => {
                      setBranchFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                    className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {OWNER_BRANCH_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                  className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {filters
                    .find((f) => f.key === "status")
                    ?.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleExportReservations}
                  className="px-4 py-2 border border-[var(--border-light)]
 rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {isArchivedView && (
              <div className="mb-4 rounded-md border border-[var(--border-light)] bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Archived reservations are hidden from the active operational
                list, but billing and history records are preserved. Restore
                returns the record to the reservations list using a safe
                previous status.
              </div>
            )}

            <div className="overflow-x-auto" style={{ backgroundColor: "var(--bg-card)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-light)", backgroundColor: "color-mix(in srgb, var(--bg-inset) 30%, transparent)" }}>
                    {columns.slice(0, 5).map((col) => (
                      <th
                        key={col.key}
                        className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
                        onClick={() => {
                          if (col.sortable) {
                            setSortState((prev) => ({
                              key: col.sortKey || col.key,
                              dir:
                                prev.key === (col.sortKey || col.key) &&
                                prev.dir === "asc"
                                  ? "desc"
                                  : "asc",
                            }));
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.sortable &&
                            sortState.key === (col.sortKey || col.key) &&
                            (sortState.dir === "asc" ? "↑" : "↓")}
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReservations
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border-light)] hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleView(row.id)}
                        onMouseEnter={() =>
                          prefetchReservationDetail(row.id).catch(() => {})
                        }
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${getAvatarColor(initials(row.customer))}`}
                            >
                              {initials(row.customer)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 font-medium text-foreground">
                                <span>{row.customer}</span>
                                {row.isNew && (
                                  <span
                                    className="res-badge-new"
                                    title="New reservation (created within 48 hours)"
                                  >
                                    <span className="res-badge-new__dot" />
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.email}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-foreground">
                            {row.room}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.roomType || "Room"}, {row.branch}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col items-start gap-1.5">
                            {isArchivedView ? (
                              <>
                                <StatusBadge status="archived" />
                                <span className="text-xs text-muted-foreground">
                                  Previous:{" "}
                                  {RESERVATION_STATUS_LABELS[
                                    row.archivedPreviousStatus
                                  ] ||
                                    row.archivedPreviousStatus ||
                                    "Cancelled"}
                                </span>
                              </>
                            ) : (
                              <>
                                <StatusBadge
                                  status={
                                    checkOverdueReservation(row)
                                      ? "overdue"
                                      : row.status
                                  }
                                />
                                {hasPendingCancellationRequest(row) && (
                                  <StatusBadge status="cancellation_requested" />
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-foreground">
                          {isArchivedView
                            ? formatShortDate(row.archivedAt)
                            : formatShortDate(row.moveInDate)}
                        </td>
                        <td className="py-4 px-4 text-sm text-foreground">
                          {isArchivedView
                            ? row.archivedByName || "-"
                            : formatShortDate(row.createdAt)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(row.id);
                              }}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            {can("manageReservations") && isArchivedView && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestore(row.id);
                                }}
                                className="p-1.5 hover:bg-[color:var(--success)]/10 text-[color:var(--success)] rounded-md transition-colors"
                                title="Restore reservation"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {can("manageReservations") && !isArchivedView && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(row.id);
                                }}
                                className="p-1.5 hover:bg-[color:var(--danger)]/10 text-[color:var(--danger)] rounded-md transition-colors"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {sortedReservations.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {isArchivedView
                          ? "No archived reservations found."
                          : "No reservations found. Try adjusting your filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {totalFiltered > itemsPerPage && (
                <div className="flex justify-end items-center gap-2 mt-4 pt-4 border-t border-[var(--border-light)]">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1 text-sm border border-[var(--border-light)]
 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-muted-foreground">
                    Page {currentPage} of{" "}
                    {Math.ceil(totalFiltered / itemsPerPage)}
                  </span>
                  <button
                    disabled={
                      currentPage === Math.ceil(totalFiltered / itemsPerPage)
                    }
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1 text-sm border border-[var(--border-light)]
 rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "visits" && (
        <div className="mt-2">
          <VisitSchedulesTab />
        </div>
      )}
      {activeTab === "availability" && (
        <div className="mt-2">
          <VisitAvailabilityTab />
        </div>
      )}
      {activeTab === "inquiries" && (
        <div className="mt-2">
          <InquiriesPage isEmbedded />
        </div>
      )}

      {selectedReservation && (
        <ReservationDetailsModal
          reservation={selectedReservation}
          focusCancellation={searchParams.get("focus") === "cancellation"}
          onClose={() => {
            setSelectedReservation(null);
            if (searchParams.has("reservationId") || searchParams.has("focus")) {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("reservationId");
              nextParams.delete("focus");
              setSearchParams(nextParams, { replace: true });
            }
          }}
          onUpdate={refetchReservations}
        />
      )}
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
      {error && <div className="sr-only">{error}</div>}
    </div>
  );
}

export default ReservationsPage;
