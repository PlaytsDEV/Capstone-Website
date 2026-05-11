import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, X, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { showNotification } from "../../../../shared/utils/notification";
import { PoliciesTermsModal } from "../../modals/PoliciesAndConsent";
import { useVisitAvailability } from "../../../../shared/hooks/queries/useReservations";
import { useFirebaseAuth } from "../../../../shared/hooks/FirebaseAuthContext";

/* ── Available time slots ─────────────────────────────────────────────── */
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

/* ── Helper: generate next N weekdays ───────────────────────────────── */
function fmtDate(date) {
 return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateFull(dateStr) {
 if (!dateStr) return "N/A";
 const cleanDate = String(dateStr).split("T")[0];
 return new Date(cleanDate + "T12:00:00").toLocaleDateString("en-US", {
 weekday: "long", month: "long", day: "numeric", year: "numeric",
 });
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
 disabledCode: isWeekend ? "VISIT_DATE_CLOSED" : "",
 })),
 };
 });
}

function normalizeBranchKey(value) {
 const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
 if (normalized === "gil-puyat" || normalized === "guadalupe") return normalized;
 return "";
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

 cells.push({
 type: "date",
 key: iso,
 dateRow,
 isOutsideWindow: !dateByIso.has(iso),
 });
 }

 return cells;
}

const VISIT_ERROR_MESSAGES = {
 VISIT_DATE_SAME_DAY: "Visits must be scheduled at least one day in advance.",
 VISIT_DATE_IN_PAST: "That date has already passed.",
 VISIT_DATE_CLOSED: "Visits are closed on that date.",
 VISIT_CAPACITY_REACHED: "That time slot is full.",
 VISIT_SLOT_CONFLICT: "That room already has a visit at that time.",
 VISIT_SLOT_CLOSED: "This time is outside working hours.",
};

function formatRemainingSlots(slot) {
 const remaining = Number(slot?.remaining);
 if (!Number.isFinite(remaining)) return "";
 if (remaining <= 0) return "Full";
 return `${remaining} ${remaining === 1 ? "slot" : "slots"} left`;
}

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
const ReservationVisitStep = ({
 targetMoveInDate, viewingType, setViewingType,
 isOutOfTown, setIsOutOfTown, currentLocation, setCurrentLocation,
 visitApproved, onPrev, onNext,
 visitorName, setVisitorName, visitorPhone, setVisitorPhone, visitorEmail, setVisitorEmail,
 visitDate, setVisitDate, visitTime, setVisitTime,
 reservationData, reservationCode, visitCode,
 onSaveVisit, onAfterClose, readOnly, agreedToPrivacy,
 scheduleRejected, scheduleRejectionReason,
}) => {
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

 useEffect(() => {
 if (visitCode) setResolvedVisitCode(visitCode);
 }, [visitCode]);

 const handleConfirmSubmit = async () => {
 setShowConfirmModal(false);
 setIsSaving(true);
 let saveSucceeded = false;
 let shouldOpenReceipt = false;
 try {
 const code = onSaveVisit ? await onSaveVisit() : null;
 saveSucceeded = true;
 const finalCode = code || visitCode || null;
 if (finalCode) {
 setResolvedVisitCode(finalCode);
 shouldOpenReceipt = true;
 } else {
 showNotification(
 "Your visit was saved, but the pass is still being prepared. Please reopen it from your dashboard in a moment.",
 "info",
 4000,
 );
 }
 } catch (err) {
 console.error("Failed to save visit:", err);
 // Fallback message ensures we don't dump raw technical errors
 const errorCode = err?.response?.data?.code;
 const errorMessage =
 VISIT_ERROR_MESSAGES[errorCode] ||
 err?.response?.data?.error ||
 "We encountered an unexpected issue while scheduling your visit. Please try again.";
 showNotification(errorMessage, "error", 5000);
 } finally {
 setIsSaving(false);
 }

 if (saveSucceeded) {
 setIsSubmitted(true);
 }

 if (shouldOpenReceipt) {
 setShowReceiptModal(true);
 }
 };

 const handleReturnToDashboard = () => {
 setShowReceiptModal(false);
 if (onAfterClose) onAfterClose();
 else navigate("/applicant/profile");
 };

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

 return (
 <div className="rf-visit-step">
 {/* Step Header */}
 <div className="main-header">
 <div className="main-header-badge"><span>Step 2 · Verification</span></div>
 <h2 className="main-header-title">Schedule Your Visit</h2>
 <p className="main-header-subtitle">
 Pick an available date and time to visit the dormitory. Review our
 policies before confirming your booking.
 </p>
 </div>

 {/* Rejection Banner */}
 {scheduleRejected && (
 <div className="rf-rejection-banner">
 <AlertTriangle size={20} color="var(--rf-error-text)" style={{ flexShrink: 0, marginTop: 2 }} />
 <div>
 <div className="rf-rejection-banner__title">Your previous visit schedule was rejected</div>
 {scheduleRejectionReason && (
 <div className="rf-rejection-banner__reason">
 <strong>Reason:</strong> {scheduleRejectionReason}
 </div>
 )}
 <div className="rf-rejection-banner__hint">
 Please select a new date and time below to reschedule your visit.
 </div>
 </div>
 </div>
 )}

 {/* Read-Only Banner */}
 {scheduleLocked && (
 <div className="rf-locked-banner">
 <div className="info-box-title">This section is locked</div>
 <div className="info-text">Your visit has been scheduled. This step can no longer be edited.</div>
 </div>
 )}

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

 {/* Confirmation Modal */}
 {showConfirmModal && (
 <ConfirmModal
 visitDate={visitDate}
 visitTime={visitTime}
 onConfirm={handleConfirmSubmit}
 onClose={() => setShowConfirmModal(false)}
 />
 )}

 {isSaving && <SavingVisitModal />}

 {/* Receipt Modal */}
 {showReceiptModal && (
 <ReceiptModal
 visitDate={visitDate}
 visitTime={visitTime}
 visitCode={resolvedVisitCode}
 reservationCode={reservationCode}
 reservationData={reservationData}
 onClose={handleReturnToDashboard}
 />
 )}

 {/* Policies Modal */}
 <PoliciesTermsModal
 isOpen={showPoliciesModal}
 onClose={() => setShowPoliciesModal(false)}
 />
 </div>
 );
};

/* ══════════════════════════════════════════════════════════════
 ConfirmModal — extracted sub-component
 ══════════════════════════════════════════════════════════════ */
function ConfirmModal({ visitDate, visitTime, onConfirm, onClose }) {
 useEffect(() => {
 const handler = (e) => { if (e.key === "Escape") onClose(); };
 document.addEventListener("keydown", handler);
 return () => document.removeEventListener("keydown", handler);
 }, [onClose]);

 return (
 <div className="rf-modal-overlay" onClick={onClose}>
 <div
 className="rf-modal-card"
 style={{ maxWidth: "420px", textAlign: "center" }}
 onClick={(e) => e.stopPropagation()}
 >
 <button type="button" onClick={onClose} className="rf-modal-close-btn" aria-label="Close">
 <X size={18} />
 </button>

 <div className="rf-modal-icon-wrap">
 <Calendar size={24} color="#3B82F6" />
 </div>

 <h3 className="rf-modal-title">Confirm Your Visit</h3>
 <p className="rf-modal-subtitle">You're booking a visit on:</p>

 <div className="rf-confirm-date-box">
 <div className="rf-confirm-date-box__date">
 {visitDate && fmtDateFull(visitDate + "T00:00:00")}
 </div>
 <div className="rf-confirm-date-box__time">
 <Clock size={13} />{visitTime}
 </div>
 </div>

 <div className="rf-modal-actions">
 <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Go Back</button>
 <button onClick={onConfirm} className="btn btn-primary" style={{ flex: 1 }}>Yes, Book Visit</button>
 </div>
 </div>
 </div>
 );
}

function SavingVisitModal() {
 return (
 <div className="rf-modal-overlay">
 <div
 className="rf-modal-card"
 style={{ maxWidth: 420, textAlign: "center", paddingTop: 36, paddingBottom: 36 }}
 >
 <div
 style={{
 width: 52,
 height: 52,
 borderRadius: "50%",
 border: "3px solid rgba(59,130,246,0.14)",
 borderTopColor: "#2563EB",
 margin: "0 auto 16px",
 animation: "rf-spin 0.9s linear infinite",
 }}
 />
 <h3 className="rf-modal-title">Preparing Your Visit Pass</h3>
 <p className="rf-modal-subtitle">
 Saving your schedule and generating your visit code.
 </p>
 </div>
 </div>
 );
}

/* ══════════════════════════════════════════════════════════════
 ReceiptModal — extracted sub-component
 ══════════════════════════════════════════════════════════════ */
function ReceiptModal({ visitDate, visitTime, visitCode, reservationCode, reservationData, onClose }) {
 useEffect(() => {
 const handler = (e) => { if (e.key === "Escape") onClose(); };
 document.addEventListener("keydown", handler);
 return () => document.removeEventListener("keydown", handler);
 }, [onClose]);

 const room = reservationData?.room?.roomNumber || reservationData?.room?.name || reservationData?.room?.title || "N/A";
 const branch = reservationData?.room?.branch || "N/A";

 return (
 <div className="rf-modal-overlay">
 <div className="rf-modal-card" style={{ maxWidth: 420 }}>
 <button type="button" onClick={onClose} className="rf-modal-close-btn" aria-label="Close">
 <X size={18} />
 </button>

 {/* Success header */}
 <div style={{ textAlign: "center", marginBottom: "24px" }}>
 <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(22,163,74,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
 <CheckCircle size={28} color="#16A34A" strokeWidth={2.5} />
 </div>
 <h3 className="rf-modal-title">Visit Confirmed!</h3>
 <p className="rf-modal-subtitle">Your visit has been booked successfully</p>
 </div>

 {/* Receipt card */}
 <div className="rf-receipt-card">
 <div className="rf-receipt-header">
 <span className="rf-receipt-header__label">Booking Summary</span>
 <span className="rf-receipt-header__badge">Visit Scheduled</span>
 </div>
 <div className="rf-receipt-rows">
 {/* Visit code — highlighted row */}
 <div className="rf-receipt-row rf-receipt-row--highlighted">
 <span className="rf-receipt-row__label">Visit Code</span>
 {visitCode
 ? <span className="rf-receipt-row__code">{visitCode}</span>
 : <span className="rf-receipt-row__code rf-receipt-row__code--pending">Generating…</span>
 }
 </div>
 {[
 { label: "Date", value: fmtDateFull(visitDate), capitalize: false },
 { label: "Time", value: visitTime, capitalize: false },
 { label: "Room", value: room, capitalize: false },
 { label: "Branch", value: branch, capitalize: true },
 ].map((row) => (
 <div key={row.label} className="rf-receipt-row">
 <span className="rf-receipt-row__label">{row.label}</span>
 <span
 className="rf-receipt-row__value"
 style={{ textTransform: row.capitalize ? "capitalize" : "none" }}
 >
 {row.value}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Note */}
 <div className="rf-visit-note">
 <Clock size={15} color="var(--rf-info-icon)" style={{ flexShrink: 0, marginTop: "2px" }} />
 <p className="rf-visit-note__text">
 Please arrive on time. After your visit, the admin will verify your attendance and approve your reservation to proceed.
 </p>
 </div>

 <button onClick={onClose} className="btn btn-primary btn-full">Return to Dashboard</button>
 </div>
 </div>
 );
}

export default ReservationVisitStep;
