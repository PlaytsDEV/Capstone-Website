import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Download,
  Filter,
  History,
  Layers,
  MessageSquare,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  Search,
  ArrowLeft,
  RefreshCw,
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
  isReservationMoveInReady,
  readMoveInDate,
} from "../../../shared/utils/lifecycleNaming";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";
import ReservationDetailsModal from "../components/ReservationDetailsModal";
import VisitSchedulesTab from "../components/VisitSchedulesTab";
import VisitAvailabilityTab from "../components/VisitAvailabilityTab";
import InquiriesPage from "./InquiriesPage";
import Pagination from "../../../shared/components/Pagination";
import AdminPageHeader from "../../../shared/components/AdminPageHeader";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";
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
  sortReservationsWithPriority,
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
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState(() => requestedTab || "reservations");

  const handleTabChange = useCallback(
    (nextTab) => {
      setActiveTabState(nextTab);
      const nextParams = new URLSearchParams(searchParams);
      if (nextTab === "reservations") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", nextTab);
      }
      setSearchParams(nextParams, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const tabInUrl = searchParams.get("tab") || "reservations";
    if (tabInUrl !== activeTab) {
      setActiveTabState(tabInUrl);
    }
  }, [searchParams, activeTab]);

  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("search") || "",
  );
  const [categoryFilter, setCategoryFilter] = useState(
    () => searchParams.get("category") || "all",
  );
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") || "all",
  );
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

  useEffect(() => {
    const urlCategory = searchParams.get("category");
    if (urlCategory && urlCategory !== categoryFilter) {
      setCategoryFilter(urlCategory);
    }
  }, [searchParams, categoryFilter]);

  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams, statusFilter]);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    variant: "info",
    onConfirm: null,
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const {
    data: rawReservations,
    isLoading: loading,
    error: queryError,
    refetch: refetchReservationsQuery,
    isFetching,
  } = useReservations(
    { view: "admin-list", archive: isOwner ? "all" : "active" },
    {
      enabled: Boolean(user),
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );
  const error = queryError?.message || null;

  const reservations = useMemo(
    () =>
      Array.isArray(rawReservations)
        ? rawReservations.map((raw) => mapReservationAdminRow(raw, seenIds))
        : [],
    [rawReservations, seenIds],
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

    const pendingReview = activeReservations.filter(
      (reservation) =>
        reservation.status === "pending_application_review" ||
        reservation.status === "needs_revision",
    ).length;

    const approvedForPayment = activeReservations.filter(
      (reservation) =>
        reservation.status === "approved_for_payment" ||
        reservation.status === "payment_pending",
    ).length;

    const reserved = activeReservations.filter(
      (reservation) => reservation.status === "reserved",
    ).length;

    const movedIn = activeReservations.filter((reservation) =>
      hasReservationStatus(
        reservation.status,
        "moveIn",
        "move_in",
        "moved_in",
        "occupied",
      ),
    ).length;

    const cancellationRequested = activeReservations.filter(
      hasPendingCancellationRequest,
    ).length;

    const cancelled = activeReservations.filter(
      (reservation) => reservation.status === "cancelled",
    ).length;

    const rejected = activeReservations.filter(
      (reservation) => reservation.status === "rejected",
    ).length;

    const archived = reservations.filter(
      (reservation) => reservation.isArchived,
    ).length;

    const activeWorkflowCount = activeReservations.length;
    const actionRequiredCount = overdue + cancellationRequested;
    const closedArchiveCount = cancelled + rejected + (isOwner ? archived : 0);

    return {
      total: activeReservations.length,
      isNew,
      pendingApplicationReview: activeReservations.filter(
        (reservation) => reservation.status === "pending_application_review",
      ).length,
      needsRevision: activeReservations.filter(
        (reservation) => reservation.status === "needs_revision",
      ).length,
      pendingReview,
      approvedForPayment,
      reserved,
      movedIn,
      overdue,
      cancellationRequested,
      cancelled,
      rejected,
      archived,
      categoryActiveWorkflow: activeWorkflowCount,
      categoryActionRequired: actionRequiredCount,
      categoryClosedArchive: closedArchiveCount,
    };
  }, [activeReservations, isOwner, reservations]);

  const filteredReservations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const isArchivedTarget =
        statusFilter === "archived" ||
        (categoryFilter === "closed_archive" && statusFilter === "archived");
      const matchArchive = isArchivedTarget
        ? reservation.isArchived
        : !reservation.isArchived;
      if (!matchArchive) return false;

      const matchSearch =
        !query ||
        reservation.customer.toLowerCase().includes(query) ||
        reservation.email.toLowerCase().includes(query) ||
        reservation.reservationCode.toLowerCase().includes(query) ||
        reservation.room.toLowerCase().includes(query);

      let matchStatus = true;

      if (categoryFilter === "active_workflow") {
        if (reservation.isArchived) return false;
        if (statusFilter === "all" || statusFilter === "all_active") {
          matchStatus = !["cancelled", "rejected"].includes(reservation.status);
        } else if (statusFilter === "new") {
          matchStatus = Boolean(reservation.isNew);
        } else if (statusFilter === "under_review" || statusFilter === "pending_review") {
          matchStatus =
            reservation.status === "pending_application_review" ||
            reservation.status === "needs_revision";
        } else if (statusFilter === "approved_for_payment") {
          matchStatus =
            reservation.status === "approved_for_payment" ||
            reservation.status === "payment_pending";
        } else if (statusFilter === "reserved") {
          matchStatus = reservation.status === "reserved";
        } else if (statusFilter === "moveIn" || statusFilter === "moved_in" || statusFilter === "move_in") {
          matchStatus = hasReservationStatus(
            reservation.status,
            "moveIn",
            "move_in",
            "moved_in",
            "occupied",
          );
        } else {
          matchStatus = hasReservationStatus(reservation.status, statusFilter);
        }
      } else if (categoryFilter === "action_required") {
        if (reservation.isArchived) return false;
        if (statusFilter === "all") {
          matchStatus =
            checkOverdueReservation(reservation) ||
            hasPendingCancellationRequest(reservation);
        } else if (statusFilter === "overdue") {
          matchStatus = checkOverdueReservation(reservation);
        } else if (statusFilter === "cancellation_requested") {
          matchStatus = hasPendingCancellationRequest(reservation);
        } else {
          matchStatus =
            checkOverdueReservation(reservation) ||
            hasPendingCancellationRequest(reservation);
        }
      } else if (categoryFilter === "closed_archive") {
        if (statusFilter === "all") {
          matchStatus =
            reservation.status === "cancelled" ||
            reservation.status === "rejected" ||
            (isOwner && reservation.isArchived);
        } else if (statusFilter === "cancelled") {
          matchStatus = reservation.status === "cancelled" && !reservation.isArchived;
        } else if (statusFilter === "rejected") {
          matchStatus = reservation.status === "rejected" && !reservation.isArchived;
        } else if (statusFilter === "archived") {
          matchStatus = Boolean(reservation.isArchived);
        } else {
          matchStatus =
            reservation.status === "cancelled" ||
            reservation.status === "rejected" ||
            Boolean(reservation.isArchived);
        }
      } else {
        // categoryFilter === "all"
        if (statusFilter === "all" || statusFilter === "all_active") {
          matchStatus = true;
        } else if (statusFilter === "archived") {
          matchStatus = Boolean(reservation.isArchived);
        } else if (statusFilter === "new") {
          matchStatus = Boolean(reservation.isNew);
        } else if (statusFilter === "pending_review" || statusFilter === "under_review") {
          matchStatus =
            reservation.status === "pending_application_review" ||
            reservation.status === "needs_revision";
        } else if (statusFilter === "pending_application_review") {
          matchStatus = reservation.status === "pending_application_review";
        } else if (statusFilter === "needs_revision") {
          matchStatus = reservation.status === "needs_revision";
        } else if (statusFilter === "approved_for_payment") {
          matchStatus =
            reservation.status === "approved_for_payment" ||
            reservation.status === "payment_pending";
        } else if (statusFilter === "payment_pending") {
          matchStatus = reservation.status === "payment_pending";
        } else if (statusFilter === "reserved") {
          matchStatus = reservation.status === "reserved";
        } else if (statusFilter === "moveIn" || statusFilter === "moved_in" || statusFilter === "move_in") {
          matchStatus = hasReservationStatus(
            reservation.status,
            "moveIn",
            "move_in",
            "moved_in",
            "occupied",
          );
        } else if (statusFilter === "overdue") {
          matchStatus = checkOverdueReservation(reservation);
        } else if (statusFilter === "in_progress") {
          matchStatus = IN_PROGRESS_STATUSES.includes(reservation.status);
        } else if (statusFilter === "cancellation_requested") {
          matchStatus = hasPendingCancellationRequest(reservation);
        } else if (statusFilter === "cancelled") {
          matchStatus = reservation.status === "cancelled";
        } else if (statusFilter === "rejected") {
          matchStatus = reservation.status === "rejected";
        } else {
          matchStatus = hasReservationStatus(reservation.status, statusFilter);
        }
      }

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
    categoryFilter,
    isOwner,
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
        categoryFilter !== "all" ||
        statusFilter !== "all" ||
        activeAdvancedFilterCount > 0,
      ),
    [activeAdvancedFilterCount, branchFilter, categoryFilter, isOwner, searchTerm, statusFilter],
  );

  const handleResetAllFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setBranchFilter(isOwner ? "all" : user?.branch || "all");
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
  }, [isOwner, user?.branch]);


  const sortedReservations = useMemo(
    () =>
      sortReservationsWithPriority(
        filteredReservations,
        sortState,
        statusFilter,
      ),
    [filteredReservations, sortState, statusFilter],
  );

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
        subtext: "Total active reservations",
      },
      {
        key: "pending_review",
        label: "Pending Review",
        value: counts.pendingApplicationReview + counts.needsRevision,
        icon: Clock,
        color: "amber",
        subtext: "Needs review / action",
      },
      {
        key: "reserved",
        label: "Reserved",
        value: counts.reserved,
        icon: CheckCircle,
        color: "emerald",
        subtext: "Confirmed paid reservations",
      },
      {
        key: "moveIn",
        label: "Move In",
        value: counts.movedIn,
        icon: User,
        color: "emerald",
        subtext: "Checked-in tenants",
      },
    ],
    [counts],
  );

  const tabs = useMemo(
    () => [
      { id: "reservations", label: "Reservations", icon: CalendarCheck, iconClassName: "text-emerald-600 dark:text-emerald-400" },
      { id: "visits", label: "Visit Schedules", icon: CalendarDays, iconClassName: "text-amber-500 dark:text-amber-400" },
      { id: "availability", label: "Availability Rules", icon: SlidersHorizontal, iconClassName: "text-sky-500 dark:text-sky-400" },
      { id: "inquiries", label: "Inquiries", icon: MessageSquare, iconClassName: "text-blue-500 dark:text-blue-400" },
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
      queryClient.setQueriesData({ queryKey: ["reservations"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((r) =>
          String(r._id || r.id) === String(reservationId)
            ? { ...r, isViewedByAdmin: true, lastAdminViewedAt: new Date().toISOString() }
            : r,
        );
      });
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
          initialPaymentStatus: reservation.initialPaymentStatus,
          reservationFeePaymentStatus: reservation.reservationFeePaymentStatus,
          initialPaymentSettledAt: reservation.initialPaymentSettledAt,
          initialPaymentPaidAt: reservation.initialPaymentPaidAt,
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

  const refetchReservations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    if (typeof refetchReservationsQuery === "function") {
      await refetchReservationsQuery();
    }
  }, [queryClient, refetchReservationsQuery]);

  const handleDelete = useCallback(
    (reservationId) => {
      const targetRes = reservations.find((r) => r.id === reservationId);
      if (targetRes) {
        if (hasReservationStatus(targetRes.status, "moveIn")) {
          showNotification(
            "This tenant has already moved in. To end their stay or remove this record, please process a move-out from the Tenants workspace.",
            "warning",
            5000,
          );
          return;
        }

        if (hasReservationStatus(targetRes.status, "reserved")) {
          showNotification(
            "This reservation is confirmed. Please complete the move-in process or cancel the reservation before deleting.",
            "warning",
            5000,
          );
          return;
        }

        if (hasReservationStatus(targetRes.status, "approved_for_payment")) {
          showNotification(
            "This application has been approved for payment. If the applicant is not proceeding, please cancel the reservation first.",
            "warning",
            5000,
          );
          return;
        }
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
              error?.message || "Unable to delete reservation. Please try again.",
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
              error?.message || "Unable to permanently delete reservation. Please try again.",
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
              error?.message || "Unable to restore reservation. Please try again.",
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
      showNotification("Unable to generate PDF report. Please try again.", "error");
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
                initials={rowInitials}
                alt={`${row.customer} profile`}
                size={36}
                defaultOnly
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
                          : row.isResubmitted
                            ? "Resubmitted documents awaiting review"
                            : row.applicationSubmittedAt
                              ? "New application submitted (Requires admin review)"
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
        render: (row) => {
          const isMoveInSettled =
            isReservationMoveInReady(row) ||
            row.initialPaymentStatus === "paid" ||
            row.paymentStatus === "paid_in_full" ||
            Boolean(row.initialPaymentSettledAt) ||
            Boolean(row.initialPaymentPaidAt);

          const displayStatus =
            row.status === "reserved" && isMoveInSettled
              ? "ready_for_move_in"
              : row.status;

          return (
            <StatusBadge
              module="reservation"
              status={checkOverdueReservation(row) ? "overdue" : displayStatus}
            />
          );
        },
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
                      title={
                        hasReservationStatus(row.status, "moveIn")
                          ? "This tenant has already moved in. Process a move-out from the Tenants workspace."
                          : hasReservationStatus(row.status, "reserved")
                            ? "This reservation is confirmed. Complete the move-in or cancel the reservation first."
                            : "This application is approved for payment. Cancel the reservation first if not proceeding."
                      }
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

  if (loading && !rawReservations) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Pattern 1 Sticky Sub-Header */}
      <AdminPageHeader
        title="Reservations"
        subtitle="Review applications, confirm documents, and move accepted tenants toward assignment."
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === "reservations" && (
        <>
          {queryError && (
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-light)",
              }}
              className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Unable to load reservations
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {queryError?.message ||
                      "A network or authentication issue occurred while loading reservation records. Please check your connection or try again."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetchReservations()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-muted text-foreground transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
                />
                <span>{isFetching ? "Retrying..." : "Retry Loading"}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {summaryItems.map((item) => (
              <div
                key={item.key}
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-light)",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                }}
                className="border rounded-xl p-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </span>
                  <div
                    className={`flex shrink-0 items-center justify-center ${
                      item.color === "blue"
                        ? "text-sky-600 dark:text-sky-400"
                        : item.color === "amber"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
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
                {/* Category Selector with Explicit Icon Prefix */}
                <div className="relative inline-flex items-center">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                    className="h-9 pl-8 pr-7 border rounded-lg text-xs font-medium focus:outline-none focus:border-[var(--primary)] focus:ring-0 cursor-pointer hover:bg-muted transition-colors"
                    title="Filter by workflow category"
                  >
                    <option value="all">All Categories ({counts.total})</option>
                    <option value="active_workflow">Active Workflow ({counts.categoryActiveWorkflow})</option>
                    <option value="action_required">Action Required ({counts.categoryActionRequired})</option>
                    <option value="closed_archive">Closed &amp; Archived ({counts.categoryClosedArchive})</option>
                  </select>
                </div>

                {/* Status Selector with Explicit Icon Prefix */}
                <div className="relative inline-flex items-center">
                  <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ backgroundColor: "var(--input-background)", borderColor: "var(--border-light)" }}
                    className="h-9 pl-8 pr-7 border rounded-lg text-xs font-medium focus:outline-none focus:border-[var(--primary)] focus:ring-0 cursor-pointer hover:bg-muted transition-colors"
                    title="Filter by reservation status"
                  >
                    {categoryFilter === "all" && (
                      <>
                        <option value="all">All Statuses ({counts.total})</option>
                        <optgroup label="Active Workflow">
                          <option value="new">New Applications ({counts.isNew})</option>
                          <option value="under_review">Under Review ({counts.pendingReview})</option>
                          <option value="needs_revision">Needs Revision ({counts.needsRevision})</option>
                          <option value="approved_for_payment">Approved for Payment ({counts.approvedForPayment})</option>
                          <option value="reserved">Reserved ({counts.reserved})</option>
                          <option value="moveIn">Move In ({counts.movedIn})</option>
                        </optgroup>
                        <optgroup label="Action Required">
                          <option value="overdue">Overdue Move-In ({counts.overdue})</option>
                          <option value="cancellation_requested">Cancellation Requests ({counts.cancellationRequested})</option>
                        </optgroup>
                        <optgroup label="Closed & Archived">
                          <option value="cancelled">Cancelled ({counts.cancelled})</option>
                          <option value="rejected">Rejected ({counts.rejected})</option>
                          {isOwner && <option value="archived">Archived ({counts.archived})</option>}
                        </optgroup>
                      </>
                    )}

                    {categoryFilter === "active_workflow" && (
                      <>
                        <option value="all">All Active Stages ({counts.categoryActiveWorkflow})</option>
                        <option value="new">New Applications ({counts.isNew})</option>
                        <option value="under_review">Under Review ({counts.pendingReview})</option>
                        <option value="needs_revision">Needs Revision ({counts.needsRevision})</option>
                        <option value="approved_for_payment">Approved for Payment ({counts.approvedForPayment})</option>
                        <option value="reserved">Reserved ({counts.reserved})</option>
                        <option value="moveIn">Move In ({counts.movedIn})</option>
                      </>
                    )}

                    {categoryFilter === "action_required" && (
                      <>
                        <option value="all">All Action Required ({counts.categoryActionRequired})</option>
                        <option value="overdue">Overdue Move-In ({counts.overdue})</option>
                        <option value="cancellation_requested">Cancellation Requests ({counts.cancellationRequested})</option>
                      </>
                    )}

                    {categoryFilter === "closed_archive" && (
                      <>
                        <option value="all">All Closed & Archived ({counts.categoryClosedArchive})</option>
                        <option value="cancelled">Cancelled ({counts.cancelled})</option>
                        <option value="rejected">Rejected ({counts.rejected})</option>
                        {isOwner && <option value="archived">Archived ({counts.archived})</option>}
                      </>
                    )}
                  </select>
                </div>

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

            <ActiveFilterTags
              searchTerm={searchTerm}
              onClearSearch={() => setSearchTerm("")}
              categoryFilter={categoryFilter}
              onClearCategory={() => {
                setCategoryFilter("all");
                setStatusFilter("all");
              }}
              statusFilter={statusFilter}
              onClearStatus={() => setStatusFilter("all")}
              branchFilter={isOwner ? branchFilter : null}
              onClearBranch={isOwner ? () => setBranchFilter("all") : undefined}
              advancedFilters={advancedFilters}
              onClearAdvancedField={(field) =>
                setAdvancedFilters((prev) => ({ ...prev, [field]: "any" }))
              }
              onClearAll={handleResetAllFilters}
              isOwner={isOwner}
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
              isOwner={isOwner}
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
                        className="text-left py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
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
                            (sortState.dir === "↑" ? "↑" : "↓")}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: "80px" }} className="text-right py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <ProfileAvatar
                              className="w-8 h-8 rounded-full flex-shrink-0"
                              user={row.userId}
                              initials={initials(row.customer)}
                              alt={`${row.customer} profile`}
                              size={32}
                              defaultOnly
                            />
                            <div>
                              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                                <span>{row.customer}</span>
                                {row.isNew && (
                                  <span
                                    className="res-badge-new"
                                    title={
                                      hasPendingCancellationRequest(row)
                                        ? "Cancellation requested (Requires admin action)"
                                        : row.isResubmitted
                                          ? "Resubmitted documents awaiting review"
                                          : row.applicationSubmittedAt
                                            ? "New application submitted (Requires admin review)"
                                            : "Requires admin review / approval"
                                    }
                                  >
                                    <span className="res-badge-new__dot" />
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {row.email}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {row.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="text-[13px] font-medium text-foreground">
                            {row.room}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.roomType || "Room"}, {row.branch}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            {isArchivedView ? (
                              <>
                                <StatusBadge status="archived" />
                                <span className="text-[11px] text-muted-foreground">
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
                                  module="reservation"
                                  status={
                                    checkOverdueReservation(row)
                                      ? "overdue"
                                      : row.status === "reserved" &&
                                          (isReservationMoveInReady(row) ||
                                            row.initialPaymentStatus === "paid" ||
                                            row.paymentStatus === "paid_in_full" ||
                                            Boolean(row.initialPaymentSettledAt) ||
                                            Boolean(row.initialPaymentPaidAt))
                                        ? "ready_for_move_in"
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
                        <td className="py-2.5 px-4 text-[13px] font-normal tabular-nums text-foreground">
                          {isArchivedView
                            ? formatShortDate(row.archivedAt)
                            : formatShortDate(row.moveInDate)}
                        </td>
                        <td className="py-2.5 px-4 text-[13px] font-normal tabular-nums text-foreground">
                          {isArchivedView
                            ? row.archivedByName || "-"
                            : formatShortDate(row.createdAt)}
                        </td>
                        <td className="py-2.5 px-4">
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
                        className="py-12 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <Calendar className="w-8 h-8 text-muted-foreground/40 mb-1" />
                          <p className="text-sm font-medium text-foreground">
                            {isArchivedView
                              ? "No archived reservations found"
                              : hasActiveFilters
                                ? "No reservations match your filters"
                                : "No reservations found for this branch"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isArchivedView
                              ? "Archived reservation records will appear here once deleted from the active list."
                              : hasActiveFilters
                                ? "Try adjusting your search terms, status tabs, or advanced date filters to see more results."
                                : "New room applications and reservations submitted by applicants will appear here."}
                          </p>
                          {hasActiveFilters && !isArchivedView && (
                            <button
                              type="button"
                              onClick={handleResetAllFilters}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-light)] hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset All Filters</span>
                            </button>
                          )}
                        </div>
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
