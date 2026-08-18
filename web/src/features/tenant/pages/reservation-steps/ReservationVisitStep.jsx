import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bed,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Home,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  Tag,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { showNotification } from "../../../../shared/utils/notification";
import useBodyScrollLock from "../../../../shared/hooks/useBodyScrollLock";
import { useVisitAvailability } from "../../../../shared/hooks/queries/useReservations";
import { useFirebaseAuth } from "../../../../shared/hooks/FirebaseAuthContext";
import { getRemoteViewingImages } from "../check-availability/checkAvailabilityConstants";
import { APP_LOCALE } from "../../../../shared/utils/dateFormat";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";
import { getBedDisplayLabel, getBedShortCode } from "../../../../shared/utils/bedIdentifier";
import { getResolvedMonthlyRate, isPricingDisplayUsable } from "../../utils/pricingDisplayHelpers";
import { getPersistedPhysicalVisitState } from "../../utils/reservationVisitState";
import { canAccessTenantApplication, getPhysicalVisitApplicantState } from "../../utils/physicalVisitFlow";
import {
  canFreelyEditViewingPreference,
  formatVisitSlotLabel,
  getVisitScheduleSubmitLabel,
  getVisitSummaryUiState,
} from "../../utils/reservationVisitUiState";
import { VIEWING_PREFERENCE_LOCKED_MESSAGE } from "../../utils/reservationViewingPreferenceLock";

const TIME_SLOTS = [
  { label: "08:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "09:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "10:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "11:00 AM", available: true, capacity: 5, remaining: 5 },
  { label: "01:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "02:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "03:00 PM", available: true, capacity: 5, remaining: 5 },
  { label: "04:00 PM", available: true, capacity: 5, remaining: 5 },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const VISIT_OPTIONS = [
  {
    value: "physical_visit",
    title: "Schedule Physical Visit",
    description: "Choose a preferred date and time for an in-person room viewing.",
  },
  {
    value: "remote_2d_viewing",
    title: "Request Remote Viewing",
    description:
      "Review available room photos and ask the admin for viewing assistance without visiting in person.",
  },
  {
    value: "urgent_move_in_review",
    title: "Request Priority Viewing Review",
    description:
      "Ask the admin to review your selected room and reservation sooner. Approval and required documents are still required before payment.",
  },
];

const OPTION_ICONS = {
  physical_visit: Calendar,
  remote_2d_viewing: Camera,
  urgent_move_in_review: Zap,
};

const REMOTE_ACKNOWLEDGEMENT =
  "I have reviewed the available room photos and understand that this is a photo-based viewing option, not a 3D or 360-degree tour.";

function toDisplayString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const text = value.map((item) => toDisplayString(item)).filter(Boolean).join(", ");
    return text || fallback;
  }
  if (typeof value === "object") {
    return toDisplayString(
      value.displayName ??
        value.name ??
        value.label ??
        value.title ??
        value.roomNumber ??
        value.slug ??
        value.key ??
        value.code ??
        value.value ??
        value.id,
      fallback,
    );
  }
  return fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value) {
  return `\u20b1${toFiniteNumber(value).toLocaleString()}`;
}

function getRoomName(room) {
  return toDisplayString(room?.name || room?.roomNumber || room?.title || room?.id, "N/A");
}

function getChosenBedCode(selectedBed, roomNumber = "") {
  if (!selectedBed) return "N/A";
  if (typeof selectedBed === "string" && selectedBed.trim()) return selectedBed.trim();
  if (typeof selectedBed === "object") {
    if (selectedBed.code && String(selectedBed.code).trim()) return String(selectedBed.code).trim();
    if (selectedBed.id && String(selectedBed.id).trim()) return String(selectedBed.id).trim();
    const shortCode = getBedShortCode(roomNumber, selectedBed);
    if (shortCode && shortCode.trim()) return shortCode.trim();
    const displayLabel = getBedDisplayLabel(selectedBed);
    if (displayLabel && displayLabel.trim()) return displayLabel.trim();
  }
  return "N/A";
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return weekStart;
}

function endOfWeek(date) {
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
  return weekEnd;
}

function getTomorrowISO() {
  return toISODate(addDays(new Date(), 1));
}

function fmtDateFull(dateStr) {
  if (!dateStr) return "Not scheduled";
  const cleanDate = String(dateStr).split("T")[0];
  return new Date(`${cleanDate}T12:00:00`).toLocaleDateString(APP_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeBranchKey(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (normalized === "gil-puyat" || normalized === "guadalupe") return normalized;
  return "";
}

function toTitleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getFallbackAvailabilityDates(count = 14) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(new Date(), index + 1);
    const isWeekend = [0, 6].includes(date.getDay());
    return {
      date: toISODate(date),
      available: !isWeekend,
      disabledReason: isWeekend ? "Visits are closed on weekends." : "",
      slots: TIME_SLOTS.map((slot) => ({
        ...slot,
        available: !isWeekend,
        disabledReason: isWeekend ? "Visits are closed on weekends." : "",
      })),
    };
  });
}

function buildCalendarCells(dateRows) {
  if (!dateRows?.length) return [];
  const dateByIso = new Map(dateRows.map((dateRow) => [dateRow.date, dateRow]));
  const firstDate = new Date(dateRows[0].date + "T00:00:00");
  const lastDate = new Date(dateRows[dateRows.length - 1].date + "T00:00:00");
  const calendarStart = startOfWeek(firstDate);
  const calendarEnd = endOfWeek(lastDate);
  const cells = [];

  for (let date = new Date(calendarStart); date <= calendarEnd; date = addDays(date, 1)) {
    const iso = toISODate(date);
    const dateRow = dateByIso.get(iso) || {
      date: iso,
      available: false,
      disabledReason: "Not available",
      slots: [],
    };
    cells.push({ type: "date", key: iso, dateRow, isOutsideWindow: !dateByIso.has(iso) });
  }

  return cells;
}

function formatRemainingSlots(slot) {
  const remaining = Number(slot?.remaining);
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Full";
  return `${remaining} ${remaining === 1 ? "slot" : "slots"} left`;
}

function groupSlotsByPeriod(slots = []) {
  return [
    { label: "Morning", slots: slots.filter((slot) => String(slot.label).includes("AM")) },
    { label: "Afternoon", slots: slots.filter((slot) => String(slot.label).includes("PM")) },
  ].filter((group) => group.slots.length);
}

const ReservationVisitStep = ({
  viewingType,
  setViewingType,
  remoteViewingAcknowledged,
  setRemoteViewingAcknowledged,
  remoteViewingQuestions,
  setRemoteViewingQuestions,
  isUrgentMoveIn,
  setIsUrgentMoveIn,
  visitDate,
  setVisitDate,
  visitTime,
  setVisitTime,
  reservationData,
  visitCode,
  visitCompleted,
  onPrev,
  onNext,
  onSaveVisit,
  onVisitSaved,
  onReturnToDashboard,
  readOnly,
  viewingPreferenceAccess = {},
  forceEditMode,
  scheduleRejected,
  scheduleRejectionReason,
  onValidatePreferenceChange,
}) => {
  const navigate = useNavigate();
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftViewingPreference, setDraftViewingPreference] = useState("");
  const [activePreferenceView, setActivePreferenceView] = useState("");
  const [changeModeUnlocked, setChangeModeUnlocked] = useState(false);
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isEditingPhysicalVisit, setIsEditingPhysicalVisit] = useState(() => Boolean(forceEditMode));

  const submittedPreference = viewingPreferenceAccess.submittedPreference || "";
  const hasSubmittedPreference = Boolean(viewingPreferenceAccess.submitted);
  const canResubmitSamePhysicalVisit = Boolean(
    viewingPreferenceAccess.canResubmitSamePreference && submittedPreference === "physical_visit",
  );
  const canStartChangeFlow = Boolean(
    viewingPreferenceAccess.canChangePreference && !readOnly && !canResubmitSamePhysicalVisit,
  );
  const isChangingPreference = Boolean(changeModeUnlocked && canStartChangeFlow);
  const showReadOnlyPreference = Boolean(
    hasSubmittedPreference && !isChangingPreference && !canResubmitSamePhysicalVisit,
  );
  const preferenceReadOnly = Boolean(readOnly || showReadOnlyPreference);
  const optionSelectionLocked = Boolean(viewingPreferenceAccess.lockOptions || preferenceReadOnly);
  const canSubmitViewingPreference = viewingPreferenceAccess.canSubmit !== false;

  const selectedVisit =
    (showReadOnlyPreference && submittedPreference) ||
    activePreferenceView ||
    viewingType ||
    (canResubmitSamePhysicalVisit ? "physical_visit" : "") ||
    "";

  const room = reservationData?.room || {};
  const pricingDisplay = reservationData?.pricingDisplay;
  const hasResolvedMonthlyRate = isPricingDisplayUsable(pricingDisplay);
  const monthlyRent = getResolvedMonthlyRate(pricingDisplay);
  const applianceFees = toFiniteNumber(reservationData?.applianceFees, 0);
  const estimatedMonthlyTotal = hasResolvedMonthlyRate ? monthlyRent + applianceFees : null;
  const reservationFeeAmount = toFiniteNumber(reservationData?.reservationFeeAmount, 2000);

  const uploadedRoomImages = Array.isArray(room.images)
    ? room.images.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const roomImages =
    uploadedRoomImages.length > 0
      ? uploadedRoomImages
      : getRemoteViewingImages(room.type, room.branchKey || room.branch || reservationData?.branch);

  const touchStartXRef = useRef(null);

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (previewImageIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        setPreviewImageIndex((i) => (i !== null ? Math.max(0, i - 1) : null));
      } else if (e.key === "ArrowRight") {
        setPreviewImageIndex((i) => (i !== null ? Math.min(roomImages.length - 1, i + 1) : null));
      } else if (e.key === "Escape") {
        setPreviewImageIndex(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImageIndex, roomImages.length]);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      if (deltaX > 40) {
        setPreviewImageIndex((i) => (i !== null ? Math.max(0, i - 1) : null));
      } else if (deltaX < -40) {
        setPreviewImageIndex((i) => (i !== null ? Math.min(roomImages.length - 1, i + 1) : null));
      }
    }
    touchStartXRef.current = null;
  };

  const chosenBedData =
    reservationData?.selectedBed ||
    reservationData?.selectedBedCode ||
    reservationData?.bedCode ||
    reservationData?.bed;
  const chosenBedCode = getChosenBedCode(chosenBedData, room.roomNumber || room.name);

  const branch = normalizeBranchKey(room.branchKey || room.branch || reservationData?.branch);
  const roomId = room._id || room.roomId || reservationData?.roomId || "";
  const reservationId = reservationData?._id || "";
  const { hasSavedPhysicalVisit } = getPersistedPhysicalVisitState(
    reservationData,
    selectedVisit,
    scheduleRejected,
  );
  const canEditViewingPreference =
    canFreelyEditViewingPreference({ selectedVisit, hasSavedPhysicalVisit }) && !optionSelectionLocked;

  const visitGateReservation = {
    ...(reservationData || {}),
    viewingPreference: selectedVisit,
    viewingType: selectedVisit,
    visitDate: reservationData?.visitDate || visitDate,
    visitTime: reservationData?.visitTime || visitTime,
    visitStatus: reservationData?.visitStatus,
    scheduleApproved: reservationData?.scheduleApproved,
    scheduleRejected: reservationData?.scheduleRejected || scheduleRejected,
    visitApproved: reservationData?.visitApproved,
  };
  const physicalVisitState = getPhysicalVisitApplicantState(visitGateReservation);
  const canProceedFromVisitSummary =
    selectedVisit !== "physical_visit" || canAccessTenantApplication(visitGateReservation);
  const visitSummaryUi = getVisitSummaryUiState({
    selectedVisit,
    reservation: visitGateReservation,
    viewingPreferenceLocked: viewingPreferenceAccess.readOnly,
  });

  const shouldLoadAvailability =
    selectedVisit === "physical_visit" &&
    Boolean(activePreferenceView || canResubmitSamePhysicalVisit) &&
    !preferenceReadOnly &&
    Boolean(branch) &&
    !authLoading &&
    Boolean(firebaseUser);

  const goToDashboard = useCallback(() => {
    navigate("/applicant/profile", { state: { tab: "dashboard" } });
  }, [navigate]);

  const goToReservationStatus = useCallback(() => {
    navigate("/applicant/profile", { state: { tab: "reservation" } });
  }, [navigate]);

  const handleSelectionContinue = () => {
    if (!draftViewingPreference) {
      showNotification("Please choose a viewing preference before continuing.", "error", 3000);
      return;
    }
    setViewingType(draftViewingPreference);
    setActivePreferenceView(draftViewingPreference);
    setIsEditingPhysicalVisit(false);
    if (draftViewingPreference !== "physical_visit") {
      setVisitDate("");
      setVisitTime("");
    }
  };

  const handleBackToSelection = () => {
    setActivePreferenceView("");
    setViewingType("");
    setIsEditingPhysicalVisit(false);
  };

  const handleChangePreferenceRequest = () => {
    if (!canStartChangeFlow) return;
    setShowChangeConfirm(true);
  };

  const handleConfirmPreferenceChange = async () => {
    setShowChangeConfirm(false);
    const canChangeLatest = onValidatePreferenceChange ? await onValidatePreferenceChange() : true;
    if (!canChangeLatest) return;
    setChangeModeUnlocked(true);
    setDraftViewingPreference("");
    setActivePreferenceView("");
    setViewingType("");
    setIsUrgentMoveIn(false);
    setVisitDate("");
    setVisitTime("");
  };

  useEffect(() => {
    if (forceEditMode && canEditViewingPreference) setIsEditingPhysicalVisit(true);
    if (!canEditViewingPreference) setIsEditingPhysicalVisit(false);
  }, [canEditViewingPreference, forceEditMode]);

  useEffect(() => {
    if (showReadOnlyPreference) {
      setDraftViewingPreference("");
      setActivePreferenceView("");
      setChangeModeUnlocked(false);
      return;
    }
    if (canResubmitSamePhysicalVisit) {
      setViewingType("physical_visit");
      setActivePreferenceView("physical_visit");
      setDraftViewingPreference("");
    }
  }, [canResubmitSamePhysicalVisit, setViewingType, showReadOnlyPreference]);

  const availabilityParams = useMemo(
    () => ({ branch, from: getTomorrowISO(), days: 14, roomId, reservationId }),
    [branch, reservationId, roomId],
  );
  const {
    data: availability,
    isError: availabilityError,
    isLoading: loadingAvailability,
    refetch: refetchAvailability,
  } = useVisitAvailability(availabilityParams, { enabled: shouldLoadAvailability });

  const availableDates = useMemo(() => {
    if (availabilityError) return [];
    if (loadingAvailability) return [];
    if (availability?.dates?.length) return availability.dates;
    if (!shouldLoadAvailability) return getFallbackAvailabilityDates(14);
    return [];
  }, [availability, availabilityError, loadingAvailability, shouldLoadAvailability]);

  const calendarDateCells = useMemo(() => buildCalendarCells(availableDates), [availableDates]);
  const selectedDateAvailability = useMemo(
    () => availableDates.find((entry) => entry.date === visitDate) || null,
    [availableDates, visitDate],
  );
  const timeSlots = selectedDateAvailability?.slots?.length ? selectedDateAvailability.slots : [];

  useEffect(() => {
    if (selectedVisit !== "urgent_move_in_review" && isUrgentMoveIn) setIsUrgentMoveIn(false);
    if (selectedVisit === "urgent_move_in_review" && !isUrgentMoveIn) setIsUrgentMoveIn(true);
  }, [isUrgentMoveIn, selectedVisit, setIsUrgentMoveIn]);

  const handleContinueValidation = () => {
    if (isSaving) return;
    if (!selectedVisit) {
      showNotification("Please choose a viewing preference before submitting.", "error", 3000);
      return;
    }
    if (!canSubmitViewingPreference) {
      showNotification(VIEWING_PREFERENCE_LOCKED_MESSAGE, "info", 5000);
      return;
    }

    if (selectedVisit === "physical_visit") {
      if (!visitDate) {
        showNotification("Please select a preferred visit date.", "error", 3000);
        return;
      }
      if (!visitTime) {
        showNotification("Please select a preferred visit time slot.", "error", 3000);
        return;
      }
      if (availabilityError) {
        showNotification(
          "Live visit availability is unavailable right now. Please retry before continuing.",
          "error",
          3500,
        );
        return;
      }
    }

    if (selectedVisit === "remote_2d_viewing" && remoteViewingAcknowledged !== true) {
      showNotification(
        "Please acknowledge the photo-based 2D remote viewing notice before continuing.",
        "error",
        3500,
      );
      return;
    }

    setShowConfirmSubmitModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmSubmitModal(false);
    setIsSaving(true);
    try {
      const savedVisitCode = await onSaveVisit?.();
      await onVisitSaved?.({
        viewingPreference: selectedVisit,
        visitCode: savedVisitCode,
        visitDate,
        visitTime,
      });
      if (selectedVisit === "physical_visit") setIsEditingPhysicalVisit(false);
    } catch (error) {
      if (error?.response?.data?.code === "VISIT_SLOT_CONFLICT") {
        refetchAvailability();
        setVisitTime("");
        showNotification(
          "The selected time slot was just taken by another applicant. Please select an available slot.",
          "error",
          5000,
        );
      } else {
        showNotification(
          error?.response?.data?.error ||
            "We couldn't save your viewing preference. Please try again.",
          "error",
          4000,
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!hasSavedPhysicalVisit) setIsEditingPhysicalVisit(false);
  }, [hasSavedPhysicalVisit]);

  // Shared Room Specifications Sidebar Component
  const renderRoomSummarySidebar = () => (
    <div className="space-y-4">
      {/* Room Details Card */}
      <section className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Home size={16} className="text-slate-700 dark:text-slate-300 flex-shrink-0" />
          <span>Selected Room Details</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Branch</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {formatBranch(room.branch || reservationData?.branch)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Room</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{getRoomName(room)}</span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Room Type</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatRoomType(room.type)}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Chosen Bed</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-slate-500" />
              {chosenBedCode}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Viewing Preference</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {VISIT_OPTIONS.find((entry) => entry.value === selectedVisit)?.title || "Selected"}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Monthly Rent</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {hasResolvedMonthlyRate ? `${formatCurrency(monthlyRent)} / mo` : "Upon Review"}
            </span>
          </div>
        </div>

        {/* Informational Guidance Notice */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Viewing Selection Only</span>
          </div>
          <p className="leading-relaxed">
            Submitting your viewing preference does not charge any immediate fees. Payment is unlocked only after your tenant application is approved.
          </p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Rejection Alert Notice */}
      {scheduleRejected && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-900 dark:text-rose-200">
              Your previous physical visit schedule was rejected
            </div>
            {scheduleRejectionReason && (
              <div className="text-xs text-rose-700 dark:text-rose-300">
                <strong>Reason:</strong> {scheduleRejectionReason}
              </div>
            )}
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Please update your visit schedule or select another viewing preference below.
            </div>
          </div>
        </div>
      )}

      {/* Main Header (Solid Colors, Standalone Icons, Room Designation Pill) */}
      <div className="space-y-2.5 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center px-3 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-full">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Step 2 · Viewing Preference
            </span>
          </div>

          {/* Room Designation Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 self-start sm:self-auto flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {getRoomName(room)} · {formatBranch(room.branch || reservationData?.branch)}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Eye className="w-7 h-7 text-slate-800 dark:text-slate-200 flex-shrink-0" />
            <span>{showReadOnlyPreference ? "Viewing Preference Summary" : "Choose Your Viewing Preference"}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 max-w-2xl">
            {showReadOnlyPreference
              ? "Your viewing preference has already been submitted and is being reviewed."
              : "Select how you would like to view the room before completing your tenant application. Payment unlocks after application approval."}
          </p>
        </div>
      </div>

      {/* STATE A: Read-Only / Submitted Summary View */}
      {showReadOnlyPreference ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Summary Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <section className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-5">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Submitted Viewing Preference</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Selected Option</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {VISIT_OPTIONS.find((entry) => entry.value === selectedVisit)?.title || "Not selected"}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Room Designation</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{getRoomName(room)}</span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Branch Location</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatBranch(room.branch || reservationData?.branch)}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Chosen Bed</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{chosenBedCode}</span>
                </div>

                {selectedVisit === "physical_visit" && (
                  <>
                    <div className="py-3 flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Scheduled Date</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {fmtDateFull(reservationData?.visitDate || visitDate)}
                      </span>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Scheduled Time</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatVisitSlotLabel(reservationData?.visitTime || visitTime)}
                      </span>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Visit Status</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {physicalVisitState?.title || "Physical Visit Scheduled"}
                      </span>
                    </div>
                  </>
                )}

                {selectedVisit === "remote_2d_viewing" && (
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Viewing Method</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Photo Gallery Review
                    </span>
                  </div>
                )}

                {selectedVisit === "urgent_move_in_review" && (
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Review Track</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Priority Viewing Review
                    </span>
                  </div>
                )}
              </div>

              {/* Status Reassurance Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>{physicalVisitState?.title || "Viewing Preference Submitted"}</span>
                </div>
                <p className="leading-relaxed">
                  {physicalVisitState?.message ||
                    "Your viewing preference has been submitted and is being processed by administration."}
                </p>
                <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedVisit === "physical_visit" && !canAccessTenantApplication(visitGateReservation)
                    ? "Your tenant application will be available once your physical visit is completed."
                    : "You may view your overall reservation status or return to your dashboard."}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (5 cols): Room Specifications Sidebar */}
          <div className="lg:col-span-5 space-y-6">{renderRoomSummarySidebar()}</div>

          {/* Action Navigation Footer (Full width at bottom of modal/card) */}
          <div className="col-span-1 lg:col-span-12 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              onClick={onPrev || goToDashboard}
            >
              <ArrowLeft size={14} />
              <span>{onPrev ? "Previous Step" : "Back to Dashboard"}</span>
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {canStartChangeFlow && (
                <button
                  type="button"
                  className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  onClick={handleChangePreferenceRequest}
                >
                  <span>Change Viewing Preference</span>
                </button>
              )}

              {canProceedFromVisitSummary && onNext ? (
                <button
                  type="button"
                  className="w-full sm:w-auto min-w-[180px] h-11 px-6 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  onClick={onNext}
                >
                  <span>Continue to Application</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full sm:w-auto min-w-[180px] h-11 px-6 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  onClick={goToReservationStatus}
                >
                  <span>{viewingPreferenceAccess.statusCtaLabel || "View Reservation Status"}</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : !activePreferenceView ? (
        /* STATE B: Initial Viewing Option Selection View */
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Eye size={16} className="text-slate-700 dark:text-slate-300 flex-shrink-0" />
              <span>How would you like to view the room?</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {VISIT_OPTIONS.map((option) => {
                const OptionIcon = OPTION_ICONS[option.value];
                const isSelected = draftViewingPreference === option.value;
                const disabledByPreferenceLock = optionSelectionLocked && !isSelected;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`group relative w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 ${
                      isSelected
                        ? "border-slate-900 dark:border-slate-100 bg-slate-50/50 dark:bg-slate-800/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/30 dark:hover:bg-slate-800/20"
                    } ${disabledByPreferenceLock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    data-option={option.value}
                    disabled={disabledByPreferenceLock}
                    title={disabledByPreferenceLock ? VIEWING_PREFERENCE_LOCKED_MESSAGE : undefined}
                    onClick={() => {
                      if (disabledByPreferenceLock) {
                        showNotification(VIEWING_PREFERENCE_LOCKED_MESSAGE, "info", 5000);
                        return;
                      }
                      setDraftViewingPreference(option.value);
                      setIsEditingPhysicalVisit(false);
                      if (option.value !== "physical_visit") {
                        setVisitDate("");
                        setVisitTime("");
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    {/* Left Icon Box */}
                    <div
                      className={`p-3 rounded-xl border flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                          : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <OptionIcon size={20} />
                    </div>

                    {/* Option Text Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="block text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {option.title}
                      </span>
                      <span className="block text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {option.description}
                      </span>
                    </div>

                    {/* Right Custom Radio Dot Indicator */}
                    <div className="flex-shrink-0 pt-0.5">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100"
                            : "border-slate-300 dark:border-slate-600 bg-transparent"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Navigation Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              onClick={onPrev || goToDashboard}
            >
              <ArrowLeft size={14} />
              <span>{onPrev ? "Previous Step" : "Back to Dashboard"}</span>
            </button>

            <button
              type="button"
              className="w-full sm:w-auto min-w-[160px] h-11 px-6 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={handleSelectionContinue}
              disabled={!draftViewingPreference}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* STATE C: Option Configuration View (2-Column Responsive Layout) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Option Specific Configuration Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* SUB-FLOW C1: Physical Visit Mode */}
            {selectedVisit === "physical_visit" && (
              <>
                {/* Calendar Date Picker Card */}
                <section
                  id="visit-date-section"
                  className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <Calendar size={16} className="text-slate-700 dark:text-slate-300 flex-shrink-0" />
                      <span>1. Schedule Your Visit Date</span>
                    </div>
                    {visitDate && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {fmtDateFull(visitDate)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Select a date for your in-person room viewing. Viewing schedules are available on upcoming open days.
                  </p>

                  {availabilityError && (
                    <div
                      className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3"
                      role="alert"
                    >
                      <span>Unable to load live visit availability right now.</span>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                        onClick={() => refetchAvailability()}
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Calendar Grid */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400 pb-1">
                      {WEEKDAY_LABELS.map((weekday) => (
                        <div key={weekday} className="py-1">
                          {weekday}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Available visit dates">
                      {calendarDateCells.map((cell) => {
                        const { dateRow } = cell;
                        const iso = dateRow.date;
                        const date = new Date(`${iso}T00:00:00`);
                        const selected = visitDate === iso;
                        const hasSlots = dateRow.slots?.some((slot) => slot.available);
                        const disabled = !hasSlots;

                        return (
                          <button
                            key={iso}
                            type="button"
                            className={`group relative p-2 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center min-h-[64px] sm:min-h-[72px] focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 ${
                              selected
                                ? "border-slate-900 dark:border-slate-100 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                                : disabled
                                ? "border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                            disabled={disabled}
                            title={dateRow.disabledReason || ""}
                            onClick={() => {
                              setVisitDate(iso);
                              if (visitTime) setVisitTime("");
                            }}
                            aria-pressed={selected}
                          >
                            {iso === getTomorrowISO() && (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mb-1 ${
                                  selected
                                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                Soon
                              </span>
                            )}
                            <span className="text-base sm:text-lg font-bold leading-none">{date.getDate()}</span>
                            <span
                              className={`text-[10px] mt-1 font-medium leading-none ${
                                selected
                                  ? "text-white/80 dark:text-slate-900/80"
                                  : disabled
                                  ? "text-slate-400 dark:text-slate-600"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {disabled
                                ? "Closed"
                                : date.toLocaleDateString(APP_LOCALE, { month: "short" })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Time Slot Picker Card */}
                <section
                  id="visit-time-section"
                  className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <Clock size={16} className="text-slate-700 dark:text-slate-300 flex-shrink-0" />
                      <span>2. Choose a Time Slot</span>
                    </div>
                    {visitTime && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {visitTime}
                      </span>
                    )}
                  </div>

                  {visitDate ? (
                    timeSlots.length === 0 ? (
                      <div
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 text-center"
                        role="alert"
                      >
                        No time slots are available for the selected date. Please choose another date.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {groupSlotsByPeriod(timeSlots).map((group) => (
                          <div key={group.label} className="space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {group.label} Slots
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {group.slots.map((slot) => {
                                const isSelected = visitTime === slot.label;
                                const isSlotAvailable = slot.available;

                                return (
                                  <button
                                    key={slot.label}
                                    type="button"
                                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 ${
                                      isSelected
                                        ? "border-slate-900 dark:border-slate-100 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                                        : !isSlotAvailable
                                        ? "border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    }`}
                                    disabled={!isSlotAvailable}
                                    onClick={() => setVisitTime(slot.label)}
                                    aria-pressed={isSelected}
                                  >
                                    <span className="text-sm font-bold">{slot.label}</span>
                                    <span
                                      className={`text-[10px] font-medium mt-0.5 ${
                                        isSelected
                                          ? "text-white/80 dark:text-slate-900/80"
                                          : !isSlotAvailable
                                          ? "text-slate-400 dark:text-slate-600"
                                          : "text-slate-500 dark:text-slate-400"
                                      }`}
                                    >
                                      {formatRemainingSlots(slot) || slot.disabledReason || "Unavailable"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400 text-center">
                      Please select a visit date above to view available time slots.
                    </div>
                  )}
                </section>
              </>
            )}

            {/* SUB-FLOW C2: Remote 2D Viewing Mode */}
            {selectedVisit === "remote_2d_viewing" && (
              <>
                {/* Photo Gallery & Acknowledgement Showcase Card */}
                <section className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <Camera size={16} className="text-slate-700 dark:text-slate-300 flex-shrink-0" />
                      <span>Room Photo Showcase</span>
                    </div>
                    {roomImages.length > 0 && (
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {activeGalleryIndex + 1} of {roomImages.length} photos
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Browse available room photos below. This is a photo-based viewing option and does not include a 3D or 360° tour.
                  </p>

                  {roomImages.length > 0 ? (
                    <div className="space-y-3">
                      {/* Main Featured Photo */}
                      <button
                        type="button"
                        className="group relative block w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none"
                        onClick={() => setPreviewImageIndex(activeGalleryIndex)}
                        aria-label="Open photo in fullscreen"
                      >
                        <img
                          src={roomImages[activeGalleryIndex]}
                          alt={`${getRoomName(room)} photo ${activeGalleryIndex + 1}`}
                          loading="lazy"
                          className="w-full h-64 sm:h-80 object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/85 text-white text-xs font-medium rounded-lg backdrop-blur-sm border border-white/15 shadow-md pointer-events-none">
                          <Maximize2 size={13} className="shrink-0" />
                          <span>View Fullscreen</span>
                        </span>
                      </button>

                      {/* Thumbnails Strip */}
                      {roomImages.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {roomImages.map((image, index) => (
                            <button
                              type="button"
                              key={`${image}-${index}`}
                              onClick={() => setActiveGalleryIndex(index)}
                              aria-label={`Show room photo ${index + 1}`}
                              className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border transition-all ${
                                index === activeGalleryIndex
                                  ? "border-slate-900 dark:border-slate-100 ring-2 ring-slate-900/20 dark:ring-slate-100/20"
                                  : "border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                              }`}
                            >
                              <img
                                src={image}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-2">
                      <ImageIcon size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No room photos available</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Room photos are not currently uploaded for this unit. Please schedule a physical visit or contact the dorm admin.
                      </p>
                    </div>
                  )}

                  {/* Integrated Acknowledgement Checkbox */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <label
                      htmlFor="remote-ack-check"
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        remoteViewingAcknowledged
                          ? "border-slate-900 dark:border-slate-100 bg-slate-50/70 dark:bg-slate-800/40"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <input
                        id="remote-ack-check"
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-400 mt-0.5 flex-shrink-0 cursor-pointer"
                        checked={Boolean(remoteViewingAcknowledged)}
                        disabled={preferenceReadOnly}
                        onChange={(event) => setRemoteViewingAcknowledged(event.target.checked)}
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium select-none">
                        {REMOTE_ACKNOWLEDGEMENT}
                      </span>
                    </label>
                  </div>
                </section>
              </>
            )}

            {/* SUB-FLOW C3: Priority Viewing Review Mode */}
            {selectedVisit === "urgent_move_in_review" && (
              <>
                {/* Priority Review Notice Card */}
                <section className="content-card m-0 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Priority Viewing Review
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Fast-tracked review for time-sensitive move-in applications.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Submit this request if you need the admin to review your selected room and reservation details sooner. Your tenant application and required documents must still be submitted and approved before payment becomes available.
                  </p>

                  {/* 4-Step Process Walkthrough */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      What happens next
                    </span>
                    <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {[
                        "Your priority viewing request is sent directly to the admin queue.",
                        "The admin reviews your selected room details and reservation priority.",
                        "You complete and submit your tenant application and required IDs.",
                        "Payment becomes available only after your tenant application is approved.",
                      ].map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                        >
                          <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-slate-800 dark:text-slate-200">
                            {idx + 1}
                          </div>
                          <span className="leading-tight pt-0.5">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Right Column (5 cols, sticky on desktop): Room Specifications */}
          <div className="lg:col-span-5 lg:sticky lg:top-6">{renderRoomSummarySidebar()}</div>

          {/* Action Navigation Footer (Full width at bottom of card) */}
          <div className="col-span-1 lg:col-span-12 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              onClick={canResubmitSamePhysicalVisit ? goToDashboard : handleBackToSelection}
            >
              <ArrowLeft size={14} />
              <span>{canResubmitSamePhysicalVisit ? "Back to Dashboard" : "Back to Viewing Options"}</span>
            </button>

            <button
              type="button"
              className="w-full sm:w-auto min-w-[180px] h-11 px-6 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={handleContinueValidation}
              disabled={isSaving || !canSubmitViewingPreference}
            >
              <span>{isSaving ? "Saving..." : getVisitScheduleSubmitLabel(selectedVisit)}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Portal 1: Confirm Submission Modal */}
      {showConfirmSubmitModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowConfirmSubmitModal(false)}
          >
            <div
              className="rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Confirm Submission
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedVisit === "physical_visit"
                      ? "Please review your visit schedule before confirming."
                      : selectedVisit === "remote_2d_viewing"
                      ? "Please confirm your remote viewing preference."
                      : "Please confirm your priority review request."}
                  </p>
                </div>
              </div>

              {/* Receipt Breakdown */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs border-y border-slate-100 dark:border-slate-800 py-1">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Viewing Preference:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {VISIT_OPTIONS.find((o) => o.value === selectedVisit)?.title || "Not selected"}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Room Designation:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{getRoomName(room)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Branch Location:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatBranch(room.branch || reservationData?.branch)}
                  </span>
                </div>
                {selectedVisit === "physical_visit" && (
                  <>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Preferred Visit Date:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {fmtDateFull(visitDate || reservationData?.visitDate)}
                      </span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Preferred Visit Time:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {visitTime || reservationData?.visitTime || "Not scheduled"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                  onClick={() => setShowConfirmSubmitModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  onClick={handleConfirmedSubmit}
                  disabled={isSaving}
                >
                  {isSaving ? "Submitting..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Portal 2: Change Preference Warning Modal */}
      {showChangeConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowChangeConfirm(false)}
          >
            <div
              className="rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Change Viewing Preference?
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Changing your viewing preference may reset your current viewing request and require re-submitting your preferred option.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                  onClick={() => setShowChangeConfirm(false)}
                >
                  Keep Current
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0A1628] hover:bg-[#13243D] dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm"
                  onClick={handleConfirmPreferenceChange}
                >
                  Change Preference
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Portal 3: Fullscreen Photo Lightbox */}
      {previewImageIndex !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setPreviewImageIndex(null)}
          >
            <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewImageIndex(null)}
                aria-label="Close photo viewer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="relative max-w-5xl max-h-[85vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={roomImages[previewImageIndex]}
                alt={`${getRoomName(room)} enlarged photo ${previewImageIndex + 1}`}
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
              />

              {roomImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImageIndex((i) => Math.max(0, i - 1));
                    }}
                    disabled={previewImageIndex === 0}
                    aria-label="Previous photo"
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImageIndex((i) => Math.min(roomImages.length - 1, i + 1));
                    }}
                    disabled={previewImageIndex === roomImages.length - 1}
                    aria-label="Next photo"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ReservationVisitStep;
