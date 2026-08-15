import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Download,
  History,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  Search,
  ArrowLeft,
  X,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { reservationApi } from "../../../shared/api/apiClient";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { ExportButtons } from "./analyticsTabShared";
import {
  handleExportReservationsCSV,
  handleExportReservationsPDF,
} from "../utils/reservationExportUtils";
import {
  normalizeBranchFilterValue,
  syncBranchSearchParam,
} from "../../../shared/utils/branchFilterQuery.mjs";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { showNotification } from "../../../shared/utils/notification";
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
import Pagination from "../../../shared/components/Pagination";
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
  isNewReservation,
  mapReservationAdminRow,
  applyMoveInFilter,
  applyAppDateFilter,
  getReservationDocumentWarnings,
} from "../utils/reservationRows";
import ReservationFilterDrawer from "../components/ReservationFilterDrawer";
import ActiveFilterTags from "../components/ActiveFilterTags";
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

  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [isStatusViewExpanded, setIsStatusViewExpanded] = useState(true);
  const [advancedFilters, setAdvancedFilters] = useState({
    moveIn: "any",
    applicationDate: "any",
    roomType: "any",
    moveInStart: "",
    moveInEnd: "",
    appDateStart: "",
    appDateEnd: "",
  });

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
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const {
    data: rawReservations = [],
    isLoading: loading,
    error: queryError,
  } = useReservations(
    { view: "admin-list", archive: isOwner ? "all" : "active" },
    { refetchInterval: 5000, refetchOnWindowFocus: true, refetchOnMount: true },
  );
  const error = queryError?.message || null;

  const reservations = useMemo(
    () => rawReservations.map((raw) => mapReservationAdminRow(raw)),
    [rawReservations],
  );

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => !reservation.isArchived),
    [reservations],
  );

  const counts = useMemo(() => {
    let overdue = 0;
    let isNew = 0;

    activeReservations.forEach((r) => {
      if (checkOverdueReservation(r)) overdue++;
      if (r.isNew) isNew++;
    });

    return {
      total: activeReservations.length,
      isNew,
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
      overdue,
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
    };
  }, [activeReservations, reservations]);

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
          : statusFilter === "pending_review"
            ? reservation.status === "pending_application_review" ||
              reservation.status === "needs_revision"
          : statusFilter === "reserved"
            ? reservation.status === "reserved" ||
              reservation.status === "approved_for_payment"
          : statusFilter === "overdue"
            ? checkOverdueReservation(reservation)
          : statusFilter === "in_progress"
            ? IN_PROGRESS_STATUSES.includes(reservation.status)
          : statusFilter === "cancellation_requested"
            ? hasPendingCancellationRequest(reservation)
            : hasReservationStatus(reservation.status, statusFilter);
      const matchBranch =
        branchFilter === "all" || reservation.branchCode === branchFilter;

      const matchMoveIn = applyMoveInFilter(reservation, advancedFilters);
      const matchAppDate = applyAppDateFilter(reservation, advancedFilters);
      const matchRoomType =
        advancedFilters.roomType === "any" ||
        reservation.roomType === advancedFilters.roomType;

      return (
        matchSearch &&
        matchStatus &&
        matchBranch &&
        matchMoveIn &&
        matchAppDate &&
        matchRoomType
      );
    });
  }, [
    advancedFilters,
    branchFilter,
    reservations,
    searchTerm,
    statusFilter,
  ]);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.moveIn !== "any") count++;
    if (advancedFilters.applicationDate !== "any") count++;
    if (advancedFilters.roomType !== "any") count++;
    return count;
  }, [advancedFilters]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchTerm.trim() ||
        (isOwner && branchFilter !== "all") ||
        statusFilter !== "all" ||
        activeAdvancedFilterCount > 0,
      ),
    [activeAdvancedFilterCount, branchFilter, isOwner, searchTerm, statusFilter],
  );

  const handleResetAllFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
    setBranchFilter("all");
    setAdvancedFilters({
      moveIn: "any",
      applicationDate: "any",
      roomType: "any",
      moveInStart: "",
      moveInEnd: "",
      appDateStart: "",
      appDateEnd: "",
    });
    setCurrentPage(1);
  }, []);


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

  useEffect(() => {
    if (!isOwner && statusFilter === "archived") {
      setStatusFilter("all");
    }
  }, [isOwner, statusFilter]);

  const summaryItems = useMemo(
    () => [
      {
        key: "all",
        label: "All Active",
        value: counts.total,
        icon: Calendar,
        color: "blue",
        subtext: "Total active bookings",
      },
      {
        key: "pending_review",
        label: "Pending Review",
        value: counts.pendingApplicationReview + counts.needsRevision,
        icon: Clock,
        color: "orange",
        subtext: "Needs review / action",
      },
      {
        key: "reserved",
        label: "Reserved",
        value: counts.approvedForPayment + counts.reserved,
        icon: CheckCircle,
        color: "teal",
        subtext: "Confirmed / Approved",
      },
      {
        key: "moveIn",
        label: "Moved In",
        value: counts.movedIn,
        icon: User,
        color: "green",
        subtext: "Checked-in residents",
      },
    ],
    [counts],
  );

  const statusViewTabs = useMemo(
    () => [
      {
        id: "all",
        label: "All Active",
        count: counts.total,
        icon: null,
        title: "View all active reservations",
        activeClass: "res-view-tab--active res-view-tab--primary",
      },
      {
        id: "new",
        label: "New Applications",
        count: counts.isNew,
        icon: Sparkles,
        iconColor:
          counts.isNew > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground",
        title: "Newly submitted applicant reservations",
        activeClass: "res-view-tab--active res-view-tab--primary",
      },
      {
        id: "reserved",
        label: "Reserved",
        count: counts.reserved + counts.approvedForPayment,
        icon: CheckCircle,
        iconColor: "text-muted-foreground",
        title: "Filter confirmed and reserved reservations",
        activeClass: "res-view-tab--active res-view-tab--primary",
      },
      {
        id: "overdue",
        label: "Overdue Move-In",
        count: counts.overdue,
        icon: AlertTriangle,
        iconColor:
          counts.overdue > 0
            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground",
        title: "Reservations past scheduled move-in date",
        activeClass: "res-view-tab--active res-view-tab--danger",
        inactiveClass:
          counts.overdue > 0 ? "text-red-700 dark:text-red-400 font-medium" : "",
      },
      {
        id: "cancellation_requested",
        label: "Cancellation Requests",
        count: counts.cancellationRequested,
        icon: AlertTriangle,
        iconColor:
          counts.cancellationRequested > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
        title: "Review pending cancellation requests",
        activeClass: "res-view-tab--active res-view-tab--warning",
        inactiveClass:
          counts.cancellationRequested > 0
            ? "text-amber-700 dark:text-amber-400 font-medium"
            : "",
      },
      {
        id: "cancelled",
        label: "Cancelled",
        count: counts.cancelled,
        icon: Trash2,
        iconColor: "text-muted-foreground",
        title: "View cancelled reservations",
        activeClass: "res-view-tab--active res-view-tab--danger",
      },
      isOwner && {
        id: "archived",
        label: "Archived",
        count: counts.archived,
        icon: Archive,
        iconColor: "text-muted-foreground",
        title: "View archived records",
        activeClass: "res-view-tab--active res-view-tab--muted",
      },
    ].filter(Boolean),
    [counts, isOwner],
  );

  const tabs = useMemo(
    () => [
      { key: "reservations", label: "Reservations" },
      { key: "visits", label: "Visit Schedules" },
      { key: "availability", label: "Availability Rules" },
      { key: "inquiries", label: "Inquiries" },
    ],
    [],
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
      const targetRes = reservations.find((r) => r.id === reservationId);
      if (
        targetRes &&
        (hasReservationStatus(targetRes.status, "reserved", "approved_for_payment") ||
          hasReservationStatus(targetRes.status, "moveIn"))
      ) {
        showNotification(
          "Confirmed reserved bookings cannot be deleted directly. Please process a cancellation or move-in/move-out workflow first.",
          "error",
          5000,
        );
        return;
      }

      setConfirmModal({
        open: true,
        title: "Delete Reservation?",
        message:
          "Remove this reservation from your active list? Billing and record history are safely preserved in the background, and you can restore it anytime from the Archived tab.",
        variant: "danger",
        confirmText: "Delete Reservation",
        onConfirm: async () => {
          setConfirmModal((previous) => ({ ...previous, open: false }));

          // Real-time optimistic UI removal: mark item as archived immediately in React Query cache
          queryClient.setQueriesData(
            { queryKey: ["reservations"] },
            (oldData) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.map((res) =>
                String(res._id || res.id) === String(reservationId)
                  ? { ...res, isArchived: true, status: "archived", archivedAt: new Date().toISOString() }
                  : res,
              );
            },
          );

          showNotification("Reservation deleted successfully.", "success", 4000);

          try {
            await reservationApi.archive(reservationId, {
              reason: "Deleted from Reservations page",
            });
            refetchReservations();
          } catch (error) {
            refetchReservations();
            showNotification(
              error?.message || "Failed to delete reservation. Please try again.",
              "error",
            );
          }
        },
      });
    },
    [queryClient, refetchReservations, reservations],
  );

  const handleHardDelete = useCallback(
    (reservationId) => {
      setConfirmModal({
        open: true,
        title: "Permanently Delete Reservation?",
        message:
          "This will permanently purge this archived reservation record and its audit history from the database. This action is irreversible and restricted to System Owners.",
        variant: "danger",
        confirmText: "Permanently Delete",
        onConfirm: async () => {
          setConfirmModal((previous) => ({ ...previous, open: false }));

          // Optimistic UI removal: completely remove from cache
          queryClient.setQueriesData(
            { queryKey: ["reservations"] },
            (oldData) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.filter(
                (res) => String(res._id || res.id) !== String(reservationId),
              );
            },
          );

          showNotification("Reservation permanently deleted.", "success", 4000);

          try {
            await reservationApi.delete(reservationId, { hardDelete: true });
            refetchReservations();
          } catch (error) {
            refetchReservations();
            showNotification(
              error?.message || "Failed to permanently delete reservation. Please try again.",
              "error",
            );
          }
        },
      });
    },
    [queryClient, refetchReservations],
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

          // Optimistic UI restoration in cache
          queryClient.setQueriesData(
            { queryKey: ["reservations"] },
            (oldData) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.map((res) =>
                String(res._id || res.id) === String(reservationId)
                  ? {
                      ...res,
                      isArchived: false,
                      status: res.archivedPreviousStatus || "cancelled",
                      archivedAt: null,
                    }
                  : res,
              );
            },
          );

          showNotification("Reservation restored successfully.", "success", 4000);

          try {
            await reservationApi.restore(reservationId);
            refetchReservations();
          } catch (error) {
            refetchReservations();
            showNotification(
              error?.message || "Failed to restore reservation",
              "error",
            );
          }
        },
      });
    },
    [queryClient, refetchReservations],
  );

  const handleExportCSV = useCallback(() => {
    handleExportReservationsCSV({
      reservations: sortedReservations,
      branchFilter,
    });
  }, [branchFilter, sortedReservations]);

  const handleExportPDF = useCallback(async () => {
    try {
      await handleExportReservationsPDF({
        reservations: sortedReservations,
        counts,
        branchFilter,
        statusFilter,
        searchTerm,
      });
    } catch (error) {
      console.error("[ReservationsExport] PDF generation failed:", error);
      showNotification("Failed to generate PDF report. Please try again.", "error");
    }
  }, [branchFilter, counts, sortedReservations, statusFilter, searchTerm]);

  const columns = useMemo(
    () => [
      {
        key: "applicant",
        sortKey: "customer",
        label: "Applicant",
        sortable: true,
        width: "30%",
        render: (row) => {
          const rowInitials = initials(row.customer);
          const docWarnings = getReservationDocumentWarnings(row);
          return (
            <div className="res-applicant-cell">
              <ProfileAvatar
                className="res-avatar"
                user={row.userId}
                src={row.photoUrl || row.profileImage || row.userId?.profileImage}
                initials={rowInitials}
                alt={`${row.customer} profile photo`}
                size={36}
              />
              <div className="res-applicant-info">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="res-applicant-name">{row.customer}</span>
                  {row.isNew && (
                    <span
                      className="res-badge-new"
                      title={
                        hasPendingCancellationRequest(row)
                          ? "Cancellation requested (Requires admin action)"
                          : row.paymentStatus === "proof_uploaded"
                            ? "Payment proof uploaded (Requires admin verification)"
                            : "Requires admin review / approval"
                      }
                    >
                      <span className="res-badge-new__dot" />
                      NEW
                    </span>
                  )}
                  {docWarnings.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 text-xs font-semibold cursor-help"
                      title={`Document Precheck Warning:\n• ${docWarnings.join("\n• ")}`}
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span>Doc Warning</span>
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
        width: "22%",
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
        width: "18%",
        render: (row) => (
          <StatusBadge
            status={checkOverdueReservation(row) ? "overdue" : row.status}
          />
        ),
      },
      {
        key: "moveInDate",
        label: isArchivedView
          ? "Archived Date"
          : statusFilter === "cancelled"
            ? "Cancelled Date"
            : "Move-In",
        sortable: true,
        width: "14%",
        render: (row) =>
          isArchivedView
            ? formatShortDate(row.archivedAt || row.createdAt)
            : row.status === "cancelled" && row.cancelledAt
              ? formatShortDate(row.cancelledAt)
              : formatShortDate(row.moveInDate),
      },
      {
        key: "createdAt",
        label: isArchivedView
          ? "Archived By"
          : statusFilter === "cancelled"
            ? "Cancelled By"
            : "Date",
        sortable: false,
        width: "14%",
        render: (row) =>
          isArchivedView
            ? row.archivedByName || "Admin"
            : row.status === "cancelled"
              ? row.cancelledByName || "Admin"
              : formatShortDate(row.createdAt),
      },
      {
        key: "actions",
        label: "",
        width: "80px",
        align: "right",
        render: (row) => {
          const isReservedOrActive =
            hasReservationStatus(row.status, "reserved", "approved_for_payment") ||
            hasReservationStatus(row.status, "moveIn");

          return (
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
              {isArchivedView ? (
                <>
                  {can("manageReservations") && (
                    <button
                      className="res-icon-btn text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      title="Restore reservation"
                      onClick={() => handleRestore(row.id)}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className="res-icon-btn res-icon-btn--danger"
                      title="Permanently Delete (Owner Only)"
                      onClick={() => handleHardDelete(row.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              ) : (
                can("manageReservations") && (
                  isReservedOrActive ? (
                    <span
                      className="inline-flex cursor-not-allowed opacity-35"
                      title="Confirmed reserved bookings cannot be deleted directly. Process a cancellation or move-in first."
                    >
                      <button
                        type="button"
                        className="res-icon-btn"
                        disabled
                        tabIndex={-1}
                        aria-disabled="true"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ) : (
                    <button
                      className="res-icon-btn res-icon-btn--danger"
                      title="Delete / Archive"
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )
                )
              )}
            </div>
          );
        },
      },
    ],
    [can, handleDelete, handleHardDelete, handleRestore, handleView, isArchivedView, isOwner],
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Review applications, confirm documents, and move accepted tenants
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {summaryItems.map((item) => (
              <div
                key={item.key}
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-light)",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                }}
                className="border rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </span>
                  <div
                    className={`p-2 rounded-lg ${
                      item.color === "blue"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                        : item.color === "orange"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                        : item.color === "teal"
                        ? "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    }`}
                  >
                    <item.icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {item.value}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {item.subtext}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Unified Table & Filter Workspace Card */}
          <div
            style={{ backgroundColor: "var(--bg-card)", border: `1px solid var(--border-light)` }}
            className="border rounded-xl p-4 sm:p-5 overflow-visible"
          >
            {/* Row 1: Global Search, Branch, Sort, Advanced Filters, Reset, Export */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between mb-3.5">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email, code, or room..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                  className="w-full pl-10 pr-9 h-9 border rounded-lg text-xs focus:outline-none focus:border-[var(--primary)] focus:ring-0 transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:justify-start lg:justify-end">
                {/* Sort Selector with Explicit Icon Prefix */}
                <div className="relative inline-flex items-center">
                  <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={`${sortState.key}-${sortState.dir}`}
                    onChange={(e) => {
                      const [key, dir] = e.target.value.split("-");
                      setSortState({ key, dir });
                      setCurrentPage(1);
                    }}
                    style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                    className="h-9 pl-8 pr-7 border rounded-lg text-xs font-medium focus:outline-none focus:border-[var(--primary)] focus:ring-0 cursor-pointer hover:bg-muted transition-colors"
                    title="Sort reservations order"
                  >
                    <option value="createdAt-desc">Recent Transaction</option>
                    <option value="createdAt-asc">Oldest Transaction</option>
                    <option value="customer-asc">Applicant (A - Z)</option>
                    <option value="customer-desc">Applicant (Z - A)</option>
                  </select>
                </div>

                {/* Branch Selector with Explicit Icon Prefix */}
                {isOwner && (
                  <div className="relative inline-flex items-center">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <select
                      value={branchFilter}
                      onChange={(e) => {
                        setBranchFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                      className="h-9 pl-8 pr-7 border rounded-lg text-xs font-medium focus:outline-none focus:border-[var(--primary)] focus:ring-0 cursor-pointer hover:bg-muted transition-colors"
                      title="Filter by dormitory branch"
                    >
                      {OWNER_BRANCH_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Advanced Filter Drawer Trigger */}
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen(true)}
                  className={`h-9 px-3.5 border rounded-lg transition-colors flex items-center gap-2 text-xs font-medium cursor-pointer ${
                    activeAdvancedFilterCount > 0
                      ? "border-[color:var(--primary)] bg-primary/10 text-primary font-semibold"
                      : "border-[var(--border-light)] hover:bg-muted"
                  }`}
                  title="Open advanced date, room type, and payment filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>More Filters</span>
                  {activeAdvancedFilterCount > 0 && (
                    <span className="res-chip__count bg-[color:var(--primary)] text-white text-[10px]">
                      {activeAdvancedFilterCount}
                    </span>
                  )}
                </button>

                {/* Export Report Dropdown */}
                <ExportButtons
                  onCsv={handleExportCSV}
                  onPdf={handleExportPDF}
                  disabled={sortedReservations.length === 0}
                />
              </div>
            </div>

            {/* Row 2: Unified Status & Workflow Pipeline Strip */}
            <div className="flex items-center gap-2.5 flex-wrap pt-3 border-t border-[var(--border-light)] mb-4">
              <button
                type="button"
                onClick={() => setIsStatusViewExpanded((prev) => !prev)}
                className="res-status-view-trigger"
                aria-expanded={isStatusViewExpanded}
                title={
                  isStatusViewExpanded
                    ? "Collapse status filters sideways"
                    : "Expand all status filters sideways"
                }
              >
                <Layers size={13} className="text-muted-foreground" aria-hidden="true" />
                <span>Status View:</span>
                <ChevronDown
                  size={13}
                  className={`res-status-view-chevron ${!isStatusViewExpanded ? "is-collapsed" : ""}`}
                  aria-hidden="true"
                />
              </button>

              <div
                className={`res-view-segmented-control ${!isStatusViewExpanded ? "is-collapsed" : ""}`}
                role="tablist"
                aria-label="Reservation Status Views"
              >
                {statusViewTabs.map((tab) => {
                  const isSelected = statusFilter === tab.id;
                  const Icon = tab.icon;
                  return (
                    <div
                      key={tab.id}
                      className={`res-view-item ${isSelected ? "is-selected-item" : ""}`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => {
                          if (!isStatusViewExpanded && isSelected) {
                            setIsStatusViewExpanded(true);
                            return;
                          }
                          setStatusFilter(
                            tab.id === "all"
                              ? "all"
                              : statusFilter === tab.id
                                ? "all"
                                : tab.id,
                          );
                          setCurrentPage(1);
                        }}
                        className={`res-view-tab ${
                          isSelected ? tab.activeClass : tab.inactiveClass || ""
                        }`}
                        title={
                          !isStatusViewExpanded && isSelected
                            ? `${tab.title} (Click to expand other filters)`
                            : tab.title
                        }
                      >
                        {Icon && (
                          <Icon
                            size={13}
                            className={isSelected ? "text-white" : tab.iconColor}
                            aria-hidden="true"
                          />
                        )}
                        <span>{tab.label}</span>
                        <span className="res-view-tab__count">{tab.count}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <ActiveFilterTags
              searchTerm={searchTerm}
              onClearSearch={() => setSearchTerm("")}
              statusFilter={statusFilter}
              onClearStatus={() => setStatusFilter("all")}
              branchFilter={branchFilter}
              onClearBranch={() => setBranchFilter("all")}
              advancedFilters={advancedFilters}
              onClearAdvancedField={(field) =>
                setAdvancedFilters((prev) => ({ ...prev, [field]: "any" }))
              }
              onClearAll={handleResetAllFilters}
            />

            <ReservationFilterDrawer
              isOpen={moreFiltersOpen}
              onClose={() => setMoreFiltersOpen(false)}
              filters={advancedFilters}
              onChange={(next) => {
                setAdvancedFilters(next);
                setCurrentPage(1);
              }}
              onReset={() => {
                setAdvancedFilters({
                  moveIn: "any",
                  applicationDate: "any",
                  roomType: "any",
                  moveInStart: "",
                  moveInEnd: "",
                  appDateStart: "",
                  appDateEnd: "",
                });
                setCurrentPage(1);
              }}
              reservations={reservations}
            />


            {isArchivedView && (
              <div className="mb-4 rounded-md border border-[var(--border-light)] bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Archived reservations are hidden from the active operational
                list, but billing and history records are preserved. Restore
                returns the record to the reservations list using a safe
                previous status.
              </div>
            )}

            <div className="overflow-x-auto min-h-[380px]" style={{ backgroundColor: "var(--bg-card)" }}>
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-light)", backgroundColor: "color-mix(in srgb, var(--bg-inset) 30%, transparent)" }}>
                    {columns.slice(0, 5).map((col) => (
                      <th
                        key={col.key}
                        style={{ width: col.width }}
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
                    <th style={{ width: "80px" }} className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                            <ProfileAvatar
                              className="w-10 h-10 rounded-full flex-shrink-0"
                              user={row.userId}
                              src={row.photoUrl || row.profileImage || row.userId?.profileImage}
                              initials={initials(row.customer)}
                              alt={`${row.customer} profile photo`}
                              size={40}
                            />
                            <div>
                              <div className="flex items-center gap-2 font-medium text-foreground">
                                <span>{row.customer}</span>
                                {row.isNew && (
                                  <span
                                    className="res-badge-new"
                                    title={
                                      hasPendingCancellationRequest(row)
                                        ? "Cancellation requested (Requires admin action)"
                                        : row.paymentStatus === "proof_uploaded"
                                          ? "Payment proof uploaded (Requires admin verification)"
                                          : "Requires admin review / approval"
                                    }
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
              {sortedReservations.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(1, Math.ceil(sortedReservations.length / itemsPerPage))}
                  totalItems={sortedReservations.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onLimitChange={(newLimit) => {
                    setItemsPerPage(newLimit);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[5, 10, 20, 50]}
                  itemLabel="reservations"
                  variant="numbered"
                  className="mt-4 pt-4 border-t border-border"
                />
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
