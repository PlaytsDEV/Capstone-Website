<<<<<<< HEAD
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, X, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
=======
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Home,
  Image as ImageIcon,
  X,
  Zap,
} from "lucide-react";
>>>>>>> main
import { showNotification } from "../../../../shared/utils/notification";
import { useVisitAvailability } from "../../../../shared/hooks/queries/useReservations";
import { useFirebaseAuth } from "../../../../shared/hooks/FirebaseAuthContext";
import { getRemoteViewingImages } from "../check-availability/checkAvailabilityConstants";
import { APP_LOCALE } from "../../../../shared/utils/dateFormat";
import { getPersistedPhysicalVisitState } from "../../utils/reservationVisitState";

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
      disabledReason: isWeekend ? "Visits are closed on that date." : "",
      slots: TIME_SLOTS.map((slot) => ({
        ...slot,
        available: !isWeekend,
        disabledReason: isWeekend ? "Visits are closed on that date." : "",
      })),
    };
  });
}

function buildCalendarCells(dateRows) {
<<<<<<< HEAD
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

 cells.push({
 type: "date",
 key: iso,
 dateRow,
 isOutsideWindow: !dateByIso.has(iso),
 });
 }

 return cells;
=======
  if (!dateRows?.length) return [];
  const firstDate = new Date(`${dateRows[0].date}T00:00:00`);
  const leadingDays = firstDate.getDay();
  return [
    ...Array.from({ length: leadingDays }, (_, index) => ({
      type: "empty",
      key: `empty-start-${index}`,
    })),
    ...dateRows.map((dateRow) => ({
      type: "date",
      key: dateRow.date,
      dateRow,
    })),
  ];
>>>>>>> main
}

function formatRemainingSlots(slot) {
  const remaining = Number(slot?.remaining);
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Full";
  return `${remaining} ${remaining === 1 ? "slot" : "slots"} left`;
}

<<<<<<< HEAD
function getSlotDisplayStatus(slot) {
 if (slot?.available) {
 return formatRemainingSlots(slot);
 }
 if (slot?.disabledCode === "VISIT_CAPACITY_REACHED" || Number(slot?.remaining) <= 0) return "Full";
 return slot?.disabledReason || "";
}

function hasAvailableSlots(dateRow) {
 return Boolean(dateRow?.slots?.some((slot) => slot.available));
}

function getDisabledDateLabel(dateRow) {
 if (hasAvailableSlots(dateRow)) return "";
 if (dateRow?.disabledReason) return dateRow.disabledReason;
 const disabledCodes = new Set((dateRow?.slots || []).map((slot) => slot.disabledCode).filter(Boolean));
 if (disabledCodes.has("VISIT_CAPACITY_REACHED")) return "Full";
 if (disabledCodes.has("VISIT_SLOT_CONFLICT")) return "Room conflict";
 if (disabledCodes.has("VISIT_DATE_CLOSED")) return "Closed";
 return dateRow?.disabledReason || "No available times";
}

function getSlotAriaStatus(slot) {
 if (slot?.available) {
 const status = getSlotDisplayStatus(slot);
 return status ? `, ${status}` : ", available";
 }
 if (slot?.disabledCode === "VISIT_SLOT_CONFLICT") return ", room conflict";
 if (slot?.disabledCode === "VISIT_CAPACITY_REACHED" || Number(slot?.remaining) <= 0) return ", full";
 return slot?.disabledReason ? `, ${slot.disabledReason}` : ", unavailable";
}

function groupSlotsByPeriod(slots = []) {
 return [
 { label: "Morning", slots: slots.filter((slot) => String(slot.label).includes("AM")) },
 { label: "Afternoon", slots: slots.filter((slot) => String(slot.label).includes("PM")) },
 ].filter((group) => group.slots.length);
}

function formatMoney(value) {
 const amount = Number(value || 0);
 return `PHP ${amount.toLocaleString()}/mo`;
}

function getSelectedVisitSummary({ visitDate, visitTime, reservationData }) {
 const room = reservationData?.room || {};
 const roomName = room.roomNumber || room.name || room.title || "Selected room";
 const branch = room.branch || reservationData?.branch || "Branch";
 const price = formatMoney(room.price);

 if (!visitDate) {
 return {
 status: "empty",
 title: "Select a date and time to continue",
 detail: `${roomName} - ${branch} - ${price}`,
 mobile: "No visit selected",
 rows: [],
 };
 }

 const fullDate = fmtDateFull(visitDate);
 if (!visitTime) {
 return {
 status: "partial",
 title: fullDate,
 detail: "Choose an available time slot",
 mobile: fullDate,
 rows: [
 { label: "Date", value: fullDate },
 { label: "Time", value: "Not selected" },
 ],
 };
 }

 return {
 status: "complete",
 title: `${fullDate} at ${visitTime}`,
 detail: `${roomName} - ${branch} - ${price}`,
 mobile: `${fmtDate(new Date(visitDate + "T00:00:00"))} - ${visitTime}`,
 rows: [
 { label: "Date", value: fullDate },
 { label: "Time", value: visitTime },
 { label: "Room", value: roomName },
 { label: "Branch", value: branch },
 { label: "Price", value: price },
 ],
 };
}

/**
 * Step 2 — Visit Scheduling & Policies
 */
=======
>>>>>>> main
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
  forceEditMode,
  scheduleRejected,
  scheduleRejectionReason,
}) => {
<<<<<<< HEAD
 const navigate = useNavigate();
 const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
 const [policiesAccepted, setPoliciesAccepted] = useState(agreedToPrivacy || readOnly || false);
 const [showReceiptModal, setShowReceiptModal] = useState(false);
 const [showConfirmModal, setShowConfirmModal] = useState(false);
 const [showPoliciesModal, setShowPoliciesModal] = useState(false);
 const [isSubmitted, setIsSubmitted] = useState(false);
 const [resolvedVisitCode, setResolvedVisitCode] = useState(visitCode || null);
 const [isSaving, setIsSaving] = useState(false);
 const [dateWindowDays, setDateWindowDays] = useState(14);
 const scheduleLocked = (readOnly || isSubmitted) && !scheduleRejected;
 const canEditSchedule = !scheduleLocked;

 const branch = normalizeBranchKey(
 reservationData?.room?.branchKey ||
 reservationData?.room?.branch ||
 reservationData?.branch,
 );
 const roomId = reservationData?.room?._id || reservationData?.roomId || "";
 const reservationId = reservationData?._id || "";
 const canLoadAvailability = Boolean(branch) && canEditSchedule && !authLoading && Boolean(firebaseUser);
 const availabilityParams = useMemo(
 () => ({
 branch,
 from: getTomorrowISO(),
 days: dateWindowDays,
 roomId,
 reservationId,
 }),
 [branch, dateWindowDays, roomId, reservationId],
 );
 const {
 data: availability,
 isError: availabilityError,
 isLoading: loadingAvailability,
 refetch: refetchAvailability,
 } = useVisitAvailability(
 availabilityParams,
 { enabled: canLoadAvailability },
 );
 const availabilityUnavailable = canLoadAvailability && availabilityError;
 const availableDates = useMemo(
 () => {
 if (availabilityError) return [];
 if (loadingAvailability) return [];
 if (availability?.dates?.length) return availability.dates;
 // Only show fallback dates when the query was never enabled (no branch/auth).
 // When the API loaded successfully but returned nothing, keep the list empty
 // so the UI shows a real "no availability" state instead of fake slots.
 if (!canLoadAvailability) return getFallbackAvailabilityDates(dateWindowDays);
 return [];
 },
 [availability, availabilityError, loadingAvailability, canLoadAvailability, dateWindowDays],
 );
 const calendarDateCells = useMemo(
 () => buildCalendarCells(availableDates),
 [availableDates],
 );
 const selectedDateAvailability = useMemo(
 () => availableDates.find((date) => date.date === visitDate) || null,
 [availableDates, visitDate],
 );
 const selectedTimeSlots = selectedDateAvailability?.slots?.length
 ? selectedDateAvailability.slots
 : [];
 const groupedTimeSlots = useMemo(
 () => groupSlotsByPeriod(selectedTimeSlots),
 [selectedTimeSlots],
 );
 const selectedVisitSummary = useMemo(
 () => getSelectedVisitSummary({ visitDate, visitTime, reservationData }),
 [visitDate, visitTime, reservationData],
 );
=======
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(null);
  const [isEditingPhysicalVisit, setIsEditingPhysicalVisit] = useState(() => Boolean(forceEditMode));

  const selectedVisit = viewingType || "physical_visit";
  const room = reservationData?.room || {};
  const uploadedRoomImages = Array.isArray(room.images)
    ? room.images.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const roomImages =
    uploadedRoomImages.length > 0
      ? uploadedRoomImages
      : getRemoteViewingImages(
          room.type,
          room.branchKey || room.branch || reservationData?.branch,
        );
  const roomCapacity = Number(room.capacity || 0);
  const currentOccupancy = Number(room.currentOccupancy || 0);
  const availableSlots = Number.isFinite(roomCapacity)
    ? Math.max(roomCapacity - currentOccupancy, 0)
    : null;
  const roomDetails = [
    ["Branch", room.branch ? toTitleCase(room.branch) : "N/A"],
    ["Floor", room.floor || "N/A"],
    ["Room Number", room.roomNumber || room.name || "N/A"],
    ["Room Type", room.type ? toTitleCase(room.type) : "N/A"],
    ["Capacity", room.capacity ? `${room.capacity} occupants` : "N/A"],
    ["Available Slots", availableSlots == null ? "N/A" : String(availableSlots)],
    [
      "Monthly Rate",
      room.price ? `₱${Number(room.price).toLocaleString()}` : "N/A",
    ],
    ["Notes / Reminders", room.description || "None provided"],
  ];
>>>>>>> main

  const branch = normalizeBranchKey(room.branchKey || room.branch || reservationData?.branch);
  const roomId = room._id || room.roomId || reservationData?.roomId || "";
  const reservationId = reservationData?._id || "";
  const { hasSavedPhysicalVisit } = getPersistedPhysicalVisitState(
    reservationData,
    selectedVisit,
    scheduleRejected,
  );
  const showPhysicalVisitSummary =
    !readOnly && hasSavedPhysicalVisit && !isEditingPhysicalVisit;
  const shouldLoadAvailability =
    selectedVisit === "physical_visit" &&
    !readOnly &&
    !showPhysicalVisitSummary &&
    Boolean(branch) &&
    !authLoading &&
    Boolean(firebaseUser);

  const availabilityParams = useMemo(
    () => ({
      branch,
      from: getTomorrowISO(),
      days: 14,
      roomId,
      reservationId,
    }),
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

  const calendarDateCells = useMemo(
    () => buildCalendarCells(availableDates),
    [availableDates],
  );

<<<<<<< HEAD
 const handleSubmitWithValidation = () => {
 if (availabilityError) {
 showNotification("Cannot schedule a visit while availability data is unavailable. Please use the retry button above.", "error", 4000);
 document.getElementById("visit-date-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 if (!visitDate) {
 showNotification("Please select a visit date to continue.", "error", 3000);
 document.getElementById("visit-date-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 const dateAvailability = availableDates.find((date) => date.date === visitDate);
 if (dateAvailability && !dateAvailability.slots?.some((slot) => slot.available)) {
 showNotification(dateAvailability.disabledReason || "Visits are closed on that date.", "error", 3000);
 document.getElementById("visit-date-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 if (!visitTime) {
 showNotification("Please select a time slot for your visit.", "error", 3000);
 document.getElementById("visit-time-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 const slotAvailability = dateAvailability?.slots?.find((slot) => slot.label === visitTime);
 if (slotAvailability && !slotAvailability.available) {
 showNotification(slotAvailability.disabledReason || "That time slot is unavailable.", "error", 3000);
 document.getElementById("visit-time-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 if (!policiesAccepted) {
 showNotification("Please agree to the policies and terms to continue.", "error", 3000);
 document.getElementById("visit-policies-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 return;
 }
 setShowConfirmModal(true);
 };
=======
  const selectedDateAvailability = useMemo(
    () => availableDates.find((entry) => entry.date === visitDate) || null,
    [availableDates, visitDate],
  );

  const timeSlots = selectedDateAvailability?.slots?.length
    ? selectedDateAvailability.slots
    : [];

  useEffect(() => {
    if (selectedVisit !== "urgent_move_in_review" && isUrgentMoveIn) {
      setIsUrgentMoveIn(false);
    }
    if (selectedVisit === "urgent_move_in_review" && !isUrgentMoveIn) {
      setIsUrgentMoveIn(true);
    }
  }, [isUrgentMoveIn, selectedVisit, setIsUrgentMoveIn]);
>>>>>>> main

  useEffect(() => {
    if (!hasSavedPhysicalVisit) {
      setIsEditingPhysicalVisit(false);
    }
  }, [hasSavedPhysicalVisit]);

  useEffect(() => {
    if (previewImageIndex === null) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape") setPreviewImageIndex(null);
      if (e.key === "ArrowLeft") setPreviewImageIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setPreviewImageIndex((i) => Math.min(roomImages.length - 1, i + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewImageIndex, roomImages.length]);

  const handleContinue = async () => {
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

<<<<<<< HEAD
 {scheduleLocked ? (
 <div className="content-card">
 <div className="card-section-title">
 <CheckCircle size={15} style={{ marginRight: 6, flexShrink: 0 }} />
 Scheduled Visit
 </div>
 <div className="rf-receipt-rows">
 <div className="rf-receipt-row">
 <span className="rf-receipt-row__label">Date</span>
 <span className="rf-receipt-row__value">{fmtDateFull(visitDate)}</span>
 </div>
 <div className="rf-receipt-row">
 <span className="rf-receipt-row__label">Time</span>
 <span className="rf-receipt-row__value">{visitTime || "N/A"}</span>
 </div>
 {resolvedVisitCode && (
 <div className="rf-receipt-row rf-receipt-row--highlighted">
 <span className="rf-receipt-row__label">Visit Code</span>
 <span className="rf-receipt-row__code">{resolvedVisitCode}</span>
 </div>
 )}
 </div>
 </div>
 ) : (
 <>
 {/* Form content wrapper */}
 <div className={`rf-visit-form-stack${scheduleLocked ? " rf-readonly-wrapper" : ""}`}>
 {/* Availability API error banner */}
 {availabilityError && !scheduleLocked && (
 <div className="rf-locked-banner" style={{ borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.06)", alignItems: "center" }}>
 <AlertTriangle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
 <div style={{ flex: 1 }}>
 <div className="info-box-title" style={{ color: "#DC2626" }}>Availability unavailable</div>
 <div className="info-text">Could not load visit schedule. Retry or refresh the page.</div>
 </div>
 <button
 type="button"
 onClick={() => refetchAvailability()}
 style={{ flexShrink: 0, padding: "4px 12px", borderRadius: 6, border: "1px solid #DC2626", background: "transparent", color: "#DC2626", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
 >
 Retry
 </button>
 </div>
 )}

 {/* ── Card 1: Select Date ── */}
 <div className={`content-card rf-visit-summary-card rf-visit-summary-card--${selectedVisitSummary.status}`}>
 <div className="rf-visit-summary-main">
 <div>
 <div className="rf-visit-summary-eyebrow">Visit Summary</div>
 <div className="rf-visit-summary-title">{selectedVisitSummary.title}</div>
 <div className="rf-visit-summary-detail">{selectedVisitSummary.detail}</div>
 </div>
 {selectedVisitSummary.status === "complete" && (
 <CheckCircle className="rf-visit-summary-icon" size={22} aria-hidden="true" />
 )}
 </div>
 {selectedVisitSummary.rows.length > 0 && (
 <div className="rf-visit-summary-rows">
 {selectedVisitSummary.rows.map((row) => (
 <div key={row.label} className="rf-visit-summary-row">
 <span>{row.label}</span>
 <strong>{row.value}</strong>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="content-card" id="visit-date-section">
 <div className="card-section-title">
 <Calendar size={15} style={{ marginRight: 6, flexShrink: 0 }} />
 Choose a Date
 </div>
 <p className="rf-section-hint">
 {authLoading || loadingAvailability
 ? "Checking branch availability..."
 : `Future visit dates for the next ${dateWindowDays === 14 ? "2" : "4"} weeks`}
 </p>
 {availabilityUnavailable && (
 <div className="rf-availability-alert" role="alert">
 Unable to load live visit availability. Please refresh before choosing a schedule.
 </div>
 )}
 {availableDates.length === 0 && !authLoading && !loadingAvailability ? (
 <div className="rf-empty-availability" role="status">
 <strong>No visit dates are available right now.</strong>
 <span>Please retry or check again later for updated branch availability.</span>
 </div>
 ) : (
 <div className="rf-calendar-grid" aria-label="Visit dates by week">
 {WEEKDAY_LABELS.map((weekday) => (
 <div key={weekday} className="rf-calendar-weekday">
 {weekday}
 </div>
 ))}
 {calendarDateCells.map((cell) => {
 const dateRow = cell.dateRow;
 const iso = dateRow.date;
 const date = new Date(iso + "T00:00:00");
 const selected = visitDate === iso;
 const disabledLabel = cell.isOutsideWindow ? "Not available" : getDisabledDateLabel(dateRow);
 const disabled = readOnly || Boolean(disabledLabel);
 const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
 return (
 <button
 key={iso}
 type="button"
 className="rf-date-btn"
 disabled={disabled}
 title={disabledLabel}
 onClick={() => { setVisitDate(iso); if (visitTime) setVisitTime(""); }}
 aria-pressed={selected}
 aria-label={`${dateLabel}${selected ? ", selected" : ""}${disabledLabel ? `, ${disabledLabel}` : ", available"}`}
 >
 <div className={`rf-date-card${selected ? " selected" : ""}${disabled ? " disabled" : ""}${cell.isOutsideWindow ? " outside-window" : ""}`}>
 {iso === getTomorrowISO() && <span className="rf-today-pill">Tomorrow</span>}
 {selected && (
 <span className="rf-selection-mark" aria-hidden="true">
 <CheckCircle size={15} />
 </span>
 )}
 <div className="rf-date-day">
 {date.toLocaleDateString("en-US", { weekday: "short" })}
 </div>
 <div className="rf-date-num">
 {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
 </div>
 {disabledLabel && <small className="rf-date-status">{disabledLabel}</small>}
 {selected && <span className="sr-only">Selected</span>}
 </div>
 </button>
 );
 })}
 </div>
 )}
 <button
 type="button"
 className="rf-show-more-dates"
 onClick={() => setDateWindowDays((days) => (days === 14 ? 28 : 14))}
 disabled={loadingAvailability}
 aria-expanded={dateWindowDays > 14}
 >
 {dateWindowDays === 14 ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
 {dateWindowDays === 14 ? "Show more dates" : "Show fewer dates"}
 </button>
 </div>

 {/* ── Card 2: Select Time ── */}
 <div
 className="content-card rf-visit-time-card"
 id="visit-time-section"
 style={{ opacity: visitDate ? 1 : 0.45, transition: "opacity 0.2s ease", pointerEvents: visitDate ? "auto" : "none" }}
 >
 <div className="card-section-title">
 <Clock size={15} style={{ marginRight: 6, flexShrink: 0 }} />
 Choose a Time
 </div>
 <p className="rf-section-hint">
 {visitDate
 ? <><span>Available time slots for </span><strong>{fmtDate(new Date(visitDate + "T00:00:00"))}</strong></>
 : "Select a date first to see available times"}
 </p>
 {!visitDate ? (
 <div className="rf-empty-availability rf-empty-availability--quiet" role="status">
 Select a date first to see available visit times.
 </div>
 ) : selectedTimeSlots.length === 0 || !selectedTimeSlots.some((slot) => slot.available) ? (
 <div className="rf-empty-availability" role="status">
 <strong>No available times for this date.</strong>
 <span>Try another date.</span>
 </div>
 ) : (
 <div className="rf-time-groups">
 {availabilityUnavailable && (
 <div className="rf-time-grid__message">
 Live slot counts are unavailable right now.
 </div>
 )}
 {groupedTimeSlots.map((group) => (
 <div key={group.label} className="rf-time-group">
 <div className="rf-time-group-label">{group.label}</div>
 <div className="rf-time-grid">
 {group.slots.map((slot) => {
 const selected = visitTime === slot.label;
 const disabled = readOnly || !slot.available;
 const statusText = getSlotDisplayStatus(slot);
 return (
 <button
 key={slot.label}
 type="button"
 className="rf-time-btn"
 disabled={disabled}
 title={slot.disabledReason || ""}
 onClick={() => setVisitTime(slot.label)}
 aria-pressed={selected}
 aria-label={`${slot.label}${selected ? ", selected" : ""}${getSlotAriaStatus(slot)}`}
 >
 <div className={`rf-time-slot${selected ? " selected" : ""}${disabled ? " disabled" : ""}`}>
 {selected && (
 <span className="rf-selection-mark" aria-hidden="true">
 <CheckCircle size={15} />
 </span>
 )}
 <span>{slot.label}</span>
 {statusText && (
 <small>{statusText}</small>
 )}
 {selected && <span className="sr-only">Selected</span>}
 </div>
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* ── Card 3: Policies & Terms ── */}
 <div className="rf-inline-policy" id="visit-policies-section">
 <div className="checkbox-group">
 <input
 type="checkbox"
 id="policies-accepted"
 checked={policiesAccepted || readOnly}
 onChange={(e) => setPoliciesAccepted(e.target.checked)}
 />
 <label htmlFor="policies-accepted" className="checkbox-label">
 I have read and agree to the{" "}
 <span className="rf-policies-link" onClick={() => setShowPoliciesModal(true)}>
 dormitory policies, terms & conditions, and privacy policy
 </span>
 </label>
 </div>
 </div>

 {/* ── Actions ── */}
 <div className="stage-buttons rf-visit-actions" style={{ justifyContent: "flex-end" }}>
 <div className="rf-mobile-action-summary">
 <span>Selected visit</span>
 <strong>{selectedVisitSummary.mobile}</strong>
 </div>
 <button
 onClick={handleSubmitWithValidation}
 className="btn btn-primary"
 disabled={isSubmitted || isSaving}
 >
 {isSaving ? "Booking..." : "Confirm Visit"}
 </button>
 </div>
 </div>
 </>
 )}
=======
    if (selectedVisit === "remote_2d_viewing" && remoteViewingAcknowledged !== true) {
      showNotification(
        "Please acknowledge the photo-based 2D remote viewing notice before continuing.",
        "error",
        3500,
      );
      return;
    }

    setIsSaving(true);
    try {
      const savedVisitCode = await onSaveVisit?.();
      await onVisitSaved?.({
        viewingPreference: selectedVisit,
        visitCode: savedVisitCode,
        visitDate,
        visitTime,
      });

      if (selectedVisit === "physical_visit") {
        setIsEditingPhysicalVisit(false);
      }
    } catch (error) {
      showNotification(
        error?.response?.data?.error ||
          "We couldn't save your viewing preference. Please try again.",
        "error",
        4000,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderVisitSummary = ({ title, withActions = false }) => {
    const option = VISIT_OPTIONS.find((entry) => entry.value === selectedVisit);

    return (
      <div className="content-card">
        <div className="card-section-title">
          <CheckCircle size={15} style={{ marginRight: 6, flexShrink: 0 }} />
          {title}
        </div>
        <div className="rf-receipt-rows">
          <div className="rf-receipt-row">
            <span className="rf-receipt-row__label">Selected Option</span>
            <span className="rf-receipt-row__value">{option?.title || "Not selected"}</span>
          </div>
          {selectedVisit === "physical_visit" && (
            <>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Preferred Visit Date</span>
                <span className="rf-receipt-row__value">{fmtDateFull(visitDate)}</span>
              </div>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Preferred Visit Time</span>
                <span className="rf-receipt-row__value">{visitTime || "Not scheduled"}</span>
              </div>
              {visitCode && (
                <div className="rf-receipt-row rf-receipt-row--highlighted">
                  <span className="rf-receipt-row__label">Visit Code</span>
                  <span className="rf-receipt-row__code">{visitCode}</span>
                </div>
              )}
            </>
          )}
          {selectedVisit === "remote_2d_viewing" && (
            <>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Acknowledgement</span>
                <span className="rf-receipt-row__value">
                  {remoteViewingAcknowledged ? "Confirmed" : "Pending"}
                </span>
              </div>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Questions / Concerns</span>
                <span className="rf-receipt-row__value">
                  {remoteViewingQuestions || "None provided"}
                </span>
              </div>
            </>
          )}
          {selectedVisit === "urgent_move_in_review" && (
            <div className="rf-receipt-row">
              <span className="rf-receipt-row__label">Urgent Review</span>
              <span className="rf-receipt-row__value">
                {isUrgentMoveIn ? "Requested" : "Not requested"}
              </span>
            </div>
          )}
        </div>
>>>>>>> main

        {withActions && (
          <div className="stage-buttons">
            <button type="button" className="btn btn-secondary" onClick={onPrev}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditingPhysicalVisit(true)}
            >
              Change Viewing Preference
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onReturnToDashboard?.()}
            >
              Return to Dashboard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNext?.()}
            >
              Proceed to Application
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rf-visit-step">
      {scheduleRejected && (
        <div className="rf-rejection-banner">
          <AlertTriangle
            size={20}
            color="var(--rf-error-text)"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <div className="rf-rejection-banner__title">
              Your previous physical visit schedule was rejected
            </div>
            {scheduleRejectionReason && (
              <div className="rf-rejection-banner__reason">
                <strong>Reason:</strong> {scheduleRejectionReason}
              </div>
            )}
            <div className="rf-rejection-banner__hint">
              Please update your visit details below.
            </div>
          </div>
        </div>
      )}

      {readOnly ? (
        <>
          <div className="main-header">
            <div className="main-header-badge"><span>Step 2 · Viewing Preference</span></div>
            <h2 className="main-header-title">Choose Your Viewing Preference</h2>
            <p className="main-header-subtitle">
              Select how you would like to view the room before completing your tenant
              application. Payment will only be available after your application and
              required documents are approved.
            </p>
          </div>
          <div className="rf-rejection-banner" style={{ background: "rgba(37, 99, 235, 0.06)", border: "1px solid rgba(37, 99, 235, 0.18)" }}>
            <AlertTriangle size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="rf-rejection-banner__title" style={{ color: "#1D4ED8" }}>
                Viewing preference is locked
              </div>
              <div className="rf-rejection-banner__hint" style={{ color: "#3B82F6" }}>
                Your application has been submitted. Contact admin if you need to make changes.
              </div>
            </div>
          </div>
          {renderVisitSummary({ title: "Viewing Preference Summary" })}
        </>
      ) : showPhysicalVisitSummary ? (
        <>
          <div className="main-header">
            <div className="main-header-badge"><span>Step 2 · Viewing Preference</span></div>
            <h2 className="main-header-title">Choose Your Viewing Preference</h2>
            <p className="main-header-subtitle">
              Select how you would like to view the room before completing your tenant
              application. Payment will only be available after your application and
              required documents are approved.
            </p>
          </div>
          {renderVisitSummary({ title: "Viewing Preference Summary", withActions: true })}
        </>
      ) : (
        <>
          <div className="content-card rf-step2-main-card">
            <div className="rf-step2-inner-header">
              <div className="main-header-badge"><span>Step 2 · Viewing Preference</span></div>
              <h2 className="main-header-title">Choose Your Viewing Preference</h2>
              <p className="main-header-subtitle">
                Select how you would like to view the room before completing your tenant
                application. Payment will only be available after your application and
                required documents are approved.
              </p>
            </div>
            <div className="rf-step2-header-sep" />
            <div className="card-section-title">
              <Eye size={15} style={{ marginRight: 6, flexShrink: 0 }} />
              How would you like to view the room?
            </div>
            <div className="rf-option-cards">
              {VISIT_OPTIONS.map((option) => {
                const OptionIcon = OPTION_ICONS[option.value];
                const isSelected = selectedVisit === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rf-option-card${isSelected ? " selected" : ""}`}
                    data-option={option.value}
                    onClick={() => {
                      setViewingType(option.value);
                      setIsEditingPhysicalVisit(false);
                      if (option.value !== "physical_visit") {
                        setVisitDate("");
                        setVisitTime("");
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <div className="rf-option-card__icon">
                      <OptionIcon size={20} />
                    </div>
                    <div className="rf-option-card__body">
                      <span className="rf-option-card__title">{option.title}</span>
                      <span className="rf-option-card__desc">{option.description}</span>
                    </div>
                    <div className="rf-option-card__check">
                      {isSelected && <CheckCircle size={12} color="white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>{/* end rf-step2-main-card */}

          {selectedVisit === "physical_visit" && (
            <>
              <div className="rf-selection-confirm">
                <CheckCircle size={14} />
                <span>Current selection: <strong>Physical Visit</strong></span>
              </div>
              <div className="content-card">
                <div className="card-section-title">
                  <Calendar size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Schedule Your Visit
                </div>
                <p className="rf-section-hint">
                  Choose your preferred visit date and time. This schedule is for room
                  viewing only and does not confirm occupancy or unlock payment.
                </p>
                {availabilityError && (
                  <div className="rf-availability-alert" role="alert">
                    Unable to load live visit availability right now.
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginLeft: 12 }}
                      onClick={() => refetchAvailability()}
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div className="rf-calendar-grid" aria-label="Available visit dates">
                  {WEEKDAY_LABELS.map((weekday) => (
                    <div key={weekday} className="rf-calendar-weekday">
                      {weekday}
                    </div>
                  ))}
                  {calendarDateCells.map((cell) => {
                    if (cell.type === "empty") {
                      return (
                        <div
                          key={cell.key}
                          className="rf-date-empty"
                          aria-hidden="true"
                        />
                      );
                    }
                    const { dateRow } = cell;
                    const iso = dateRow.date;
                    const date = new Date(`${iso}T00:00:00`);
                    const selected = visitDate === iso;
                    const disabled = !dateRow.slots?.some((slot) => slot.available);
                    return (
                      <button
                        key={iso}
                        type="button"
                        className="rf-date-btn"
                        disabled={disabled}
                        title={dateRow.disabledReason || ""}
                        onClick={() => {
                          setVisitDate(iso);
                          if (visitTime) setVisitTime("");
                        }}
                        aria-pressed={selected}
                      >
                        <div
                          className={`rf-date-card${selected ? " selected" : ""}${
                            disabled ? " disabled" : ""
                          }`}
                        >
                          {iso === getTomorrowISO() && (
                            <span className="rf-today-pill">Tomorrow</span>
                          )}
                          <div className="rf-date-day">{WEEKDAY_LABELS[date.getDay()]}</div>
                          <div className="rf-date-num">{date.getDate()}</div>
                          <small>
                            {disabled
                              ? "Closed"
                              : date.toLocaleDateString(APP_LOCALE, { month: "short" })}
                          </small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="content-card">
                <div className="card-section-title">
                  <Clock size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Choose a Time Slot
                </div>
                {visitDate ? (
                  <div className="rf-time-grid">
                    {timeSlots.length === 0 ? (
                      <div className="rf-time-grid__message" role="alert">
                        No time slots are available for the selected date.
                      </div>
                    ) : (
                      timeSlots.map((slot) => (
                        <button
                          key={slot.label}
                          type="button"
                          className={`rf-time-slot${visitTime === slot.label ? " selected" : ""}${slot.available ? "" : " disabled"}`}
                          disabled={!slot.available}
                          onClick={() => setVisitTime(slot.label)}
                        >
                          <span>{slot.label}</span>
                          {formatRemainingSlots(slot) ? (
                            <small className="rf-slot-badge">{formatRemainingSlots(slot)}</small>
                          ) : slot.disabledReason ? (
                            <small className="rf-slot-badge rf-slot-badge--full">{slot.disabledReason}</small>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="rf-section-hint">
                    Select a date above to see available time slots.
                  </p>
                )}
              </div>
            </>
          )}

          {selectedVisit === "remote_2d_viewing" && (
            <>
              <div className="rf-selection-confirm">
                <CheckCircle size={14} />
                <span>Current selection: <strong>Remote Viewing</strong></span>
              </div>
              <div className="content-card">
                <div className="card-section-title">
                  <Camera size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Room Photo Review
                  {roomImages.length > 0 && (
                    <span className="rf-gallery-count-badge">
                      <ImageIcon size={11} />
                      {roomImages.length} {roomImages.length === 1 ? "photo" : "photos"}
                    </span>
                  )}
                </div>
                <p className="rf-section-hint">
                  Browse available room photos before continuing. This is a photo-based
                  viewing option and does not include a 3D or 360° tour.
                </p>
                {roomImages.length > 0 ? (
                  <div className="rf-room-gallery">
                    {roomImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        className="rf-room-gallery__item"
                        onClick={() => setPreviewImageIndex(index)}
                        aria-label={`View photo ${index + 1} of ${roomImages.length}`}
                      >
                        <img
                          src={image}
                          alt={`Room photo ${index + 1}`}
                          className="rf-room-gallery__image"
                        />
                        <div className="rf-room-gallery__hover-overlay">
                          <span className="rf-room-gallery__hover-label">
                            <Eye size={12} />
                            View photo
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rf-empty-state rf-empty-state--centered">
                    <div className="rf-empty-state__icon">
                      <ImageIcon size={32} />
                    </div>
                    <p className="rf-empty-state__title">No room photos available</p>
                    <p className="rf-empty-state__desc">
                      No room photos are currently available. Please schedule a physical
                      visit or contact admin for assistance.
                    </p>
                  </div>
                )}
              </div>

              <div className="content-card">
                <div className="card-section-title">
                  <Home size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Selected Room Summary
                </div>
                <div className="rf-room-details-grid">
                  {roomDetails.map(([label, value]) => (
                    <div key={label} className="rf-room-details-grid__item">
                      <span className="rf-room-details-grid__label">{label}</span>
                      <strong className="rf-room-details-grid__value">{value}</strong>
                    </div>
                  ))}
                </div>

                <label
                  className={`rf-ack-card${remoteViewingAcknowledged ? " ack-checked" : ""}`}
                  htmlFor="remote-ack-check"
                >
                  <input
                    id="remote-ack-check"
                    type="checkbox"
                    className="rf-ack-card__checkbox"
                    checked={remoteViewingAcknowledged}
                    onChange={(event) => setRemoteViewingAcknowledged(event.target.checked)}
                  />
                  <span className="rf-ack-card__text">{REMOTE_ACKNOWLEDGEMENT}</span>
                </label>

                <div className="form-group">
                  <label className="form-label" htmlFor="remote-viewing-questions">
                    Questions or Concerns{" "}
                    <span style={{ fontWeight: 400, color: "var(--rf-text-muted)" }}>
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    id="remote-viewing-questions"
                    className="form-textarea rf-textarea"
                    rows={4}
                    value={remoteViewingQuestions}
                    maxLength={1500}
                    onChange={(event) => setRemoteViewingQuestions(event.target.value)}
                    placeholder="Ask about the room setup, amenities, layout, or anything you would like the admin to clarify before your application."
                  />
                  <div className="form-helper">
                    Your questions will be forwarded to the admin for review. Payment
                    is only available after your application and required documents are
                    approved.
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedVisit === "urgent_move_in_review" && (
            <div className="content-card">
              <div className="rf-selection-confirm rf-selection-confirm--inline">
                <CheckCircle size={14} />
                <span>Current selection: <strong>Priority Viewing Review</strong></span>
              </div>

              <div className="rf-urgent-banner">
                <div className="rf-urgent-banner__icon">
                  <Zap size={22} />
                </div>
                <div className="rf-urgent-banner__body">
                  <div className="rf-urgent-banner__title">Priority Viewing Review Requested</div>
                  <div className="rf-urgent-banner__subtitle">
                    Your request has been recorded. An admin will review your room
                    selection and reservation details sooner. Your tenant application
                    and required documents must still be submitted and approved before
                    payment becomes available.
                  </div>
                </div>
              </div>

              <div className="rf-urgent-steps">
                <div className="rf-urgent-steps__label">What happens next</div>
                {[
                  "Your priority viewing request is sent to the admin.",
                  "Admin reviews your selected room and reservation details sooner.",
                  "You still need to submit your tenant application and required documents.",
                  "Payment becomes available only after your application is approved.",
                ].map((step, idx) => (
                  <div key={idx} className="rf-urgent-step-row">
                    <div className="rf-urgent-step-num">{idx + 1}</div>
                    <div className="rf-urgent-step-text">{step}</div>
                  </div>
                ))}
              </div>

              <div
                className="card-section-title"
                style={{ paddingTop: 0, marginTop: 4, borderTop: "none" }}
              >
                <Home size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                Selected Room Summary
              </div>
              <div className="rf-room-details-grid">
                {roomDetails.map(([label, value]) => (
                  <div key={label} className="rf-room-details-grid__item">
                    <span className="rf-room-details-grid__label">{label}</span>
                    <strong className="rf-room-details-grid__value">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stage-buttons">
            <button type="button" className="btn btn-secondary" onClick={onPrev}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleContinue}
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : selectedVisit === "physical_visit"
                  ? "Save Visit Schedule"
                  : selectedVisit === "urgent_move_in_review"
                    ? "Save and Return to Dashboard"
                    : "Save and Return to Dashboard"}
            </button>
          </div>
        </>
      )}

      {previewImageIndex !== null && (
        <div
          className="rf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImageIndex(null)}
        >
          <div
            className="rf-modal-card rf-photo-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="rf-modal-close-btn"
              onClick={() => setPreviewImageIndex(null)}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>

            {roomImages.length > 1 && (
              <div className="rf-photo-nav">
                <button
                  type="button"
                  className="rf-photo-nav__btn"
                  onClick={() => setPreviewImageIndex((i) => Math.max(0, i - 1))}
                  disabled={previewImageIndex === 0}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="rf-photo-nav__counter">
                  {previewImageIndex + 1} of {roomImages.length}
                </span>
                <button
                  type="button"
                  className="rf-photo-nav__btn"
                  onClick={() => setPreviewImageIndex((i) => Math.min(roomImages.length - 1, i + 1))}
                  disabled={previewImageIndex === roomImages.length - 1}
                  aria-label="Next photo"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            <img
              src={roomImages[previewImageIndex]}
              alt={`Room photo ${previewImageIndex + 1}`}
              className="rf-photo-preview-modal__image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationVisitStep;
