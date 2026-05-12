import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Home,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { showNotification } from "../../../../shared/utils/notification";
import { useVisitAvailability } from "../../../../shared/hooks/queries/useReservations";
import { useFirebaseAuth } from "../../../../shared/hooks/FirebaseAuthContext";

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

const VIEWING_OPTIONS = [
  {
    value: "physical_visit",
    title: "Schedule Physical Visit",
    description: "Choose a preferred date and time for in-person viewing coordination.",
  },
  {
    value: "remote_2d_viewing",
    title: "Request 2D Remote Viewing",
    description: "Review available room photos and request photo-based viewing assistance.",
  },
  {
    value: "urgent_move_in_review",
    title: "Request Urgent Move-in Review",
    description: "Mark your reservation for faster admin attention without bypassing document review.",
  },
];

const REMOTE_ACKNOWLEDGEMENT =
  "I reviewed the available room photos and understand that this is a photo-based viewing option, not a 3D or 360 tour.";

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

function getTomorrowISO() {
  return toISODate(addDays(new Date(), 1));
}

function fmtDateFull(dateStr) {
  if (!dateStr) return "Not scheduled";
  const cleanDate = String(dateStr).split("T")[0];
  return new Date(`${cleanDate}T12:00:00`).toLocaleDateString("en-US", {
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
}

function formatRemainingSlots(slot) {
  const remaining = Number(slot?.remaining);
  if (!Number.isFinite(remaining)) return "";
  if (remaining <= 0) return "Full";
  return `${remaining} ${remaining === 1 ? "slot" : "slots"} left`;
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
  onPrev,
  onSaveVisit,
  onAfterClose,
  readOnly,
  scheduleRejected,
  scheduleRejectionReason,
}) => {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const selectedPreference = viewingType || "physical_visit";
  const room = reservationData?.room || {};
  const roomImages = Array.isArray(room.images)
    ? room.images.filter((entry) => typeof entry === "string" && entry.trim())
    : [];
  const roomCapacity = Number(room.capacity || 0);
  const currentOccupancy = Number(room.currentOccupancy || 0);
  const availableSlots = Number.isFinite(roomCapacity)
    ? Math.max(roomCapacity - currentOccupancy, 0)
    : null;
  const roomDetails = [
    ["Branch", room.branch || "N/A"],
    ["Floor", room.floor || "N/A"],
    ["Room Number", room.roomNumber || room.name || "N/A"],
    ["Room Type", room.type || "N/A"],
    ["Capacity", room.capacity ? `${room.capacity} occupants` : "N/A"],
    [
      "Available Slots",
      availableSlots == null ? "N/A" : String(availableSlots),
    ],
    [
      "Monthly Rate",
      room.price ? `₱${Number(room.price).toLocaleString()}` : "N/A",
    ],
    ["Notes / Reminders", room.description || "None provided"],
  ];

  const branch = normalizeBranchKey(room.branchKey || room.branch || reservationData?.branch);
  const roomId = room._id || room.roomId || reservationData?.roomId || "";
  const reservationId = reservationData?._id || "";
  const shouldLoadAvailability =
    selectedPreference === "physical_visit" &&
    !readOnly &&
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

  const selectedDateAvailability = useMemo(
    () => availableDates.find((entry) => entry.date === visitDate) || null,
    [availableDates, visitDate],
  );

  const timeSlots = selectedDateAvailability?.slots?.length
    ? selectedDateAvailability.slots
    : [];

  useEffect(() => {
    if (selectedPreference !== "urgent_move_in_review" && isUrgentMoveIn) {
      setIsUrgentMoveIn(false);
    }
    if (selectedPreference === "urgent_move_in_review" && !isUrgentMoveIn) {
      setIsUrgentMoveIn(true);
    }
  }, [isUrgentMoveIn, selectedPreference, setIsUrgentMoveIn]);

  const handleContinue = async () => {
    if (selectedPreference === "physical_visit") {
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

    if (
      selectedPreference === "remote_2d_viewing" &&
      remoteViewingAcknowledged !== true
    ) {
      showNotification(
        "Please acknowledge the photo-based 2D remote viewing notice before continuing.",
        "error",
        3500,
      );
      return;
    }

    setIsSaving(true);
    try {
      await onSaveVisit?.();
      await onAfterClose?.();
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

  const renderReadOnlySummary = () => {
    const option = VIEWING_OPTIONS.find((entry) => entry.value === selectedPreference);
    return (
      <div className="content-card">
        <div className="card-section-title">
          <CheckCircle size={15} style={{ marginRight: 6, flexShrink: 0 }} />
          Viewing / Move-in Preference
        </div>
        <div className="rf-receipt-rows">
          <div className="rf-receipt-row">
            <span className="rf-receipt-row__label">Selected Option</span>
            <span className="rf-receipt-row__value">{option?.title || "Not selected"}</span>
          </div>
          {selectedPreference === "physical_visit" && (
            <>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Preferred Date</span>
                <span className="rf-receipt-row__value">{fmtDateFull(visitDate)}</span>
              </div>
              <div className="rf-receipt-row">
                <span className="rf-receipt-row__label">Preferred Time</span>
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
          {selectedPreference === "remote_2d_viewing" && (
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
          {selectedPreference === "urgent_move_in_review" && (
            <div className="rf-receipt-row">
              <span className="rf-receipt-row__label">Urgent Review</span>
              <span className="rf-receipt-row__value">
                {isUrgentMoveIn ? "Requested" : "Not requested"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rf-visit-step">
      <div className="main-header">
        <div className="main-header-badge"><span>Step 2 · Verification</span></div>
        <h2 className="main-header-title">Viewing / Move-in Preference</h2>
        <p className="main-header-subtitle">
          Choose how you want to proceed with room viewing or move-in coordination.
          Payment will only be available after your application and documents are approved.
        </p>
      </div>

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
              Please update your viewing / move-in preference below.
            </div>
          </div>
        </div>
      )}

      {readOnly ? (
        renderReadOnlySummary()
      ) : (
        <>
          <div className="content-card">
            <div className="card-section-title">
              <Home size={15} style={{ marginRight: 6, flexShrink: 0 }} />
              Choose an Option
            </div>
            <div className="radio-group">
              {VIEWING_OPTIONS.map((option) => (
                <label key={option.value} className="radio-option">
                  <input
                    type="radio"
                    name="viewingPreference"
                    checked={selectedPreference === option.value}
                    onChange={() => {
                      setViewingType(option.value);
                      if (option.value !== "physical_visit") {
                        setVisitDate("");
                        setVisitTime("");
                      }
                    }}
                  />
                  <span className="radio-label">
                    <span className="radio-title">{option.title}</span>
                    <span className="radio-desc">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {selectedPreference === "physical_visit" && (
            <>
              <div className="content-card">
                <div className="card-section-title">
                  <Calendar size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Schedule Physical Visit
                </div>
                <p className="rf-section-hint">
                  This option is for viewing coordination only. It does not unlock payment.
                  You still need to submit your tenant application and required documents.
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
                    <div key={weekday} className="rf-calendar-weekday">{weekday}</div>
                  ))}
                  {calendarDateCells.map((cell) => {
                    if (cell.type === "empty") {
                      return <div key={cell.key} className="rf-date-empty" aria-hidden="true" />;
                    }
                    const dateRow = cell.dateRow;
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
                        <div className={`rf-date-card${selected ? " selected" : ""}${disabled ? " disabled" : ""}`}>
                          {iso === getTomorrowISO() && <span className="rf-today-pill">Tomorrow</span>}
                          <div className="rf-date-day">{date.getDate()}</div>
                          <div className="rf-date-month">
                            {date.toLocaleDateString("en-US", { month: "short" })}
                          </div>
                          <div className="rf-date-capacity">
                            {disabled ? "Closed" : "Open"}
                          </div>
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
                <div className="rf-time-grid">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.label}
                      type="button"
                      className={`rf-time-slot${visitTime === slot.label ? " selected" : ""}`}
                      disabled={!slot.available}
                      onClick={() => setVisitTime(slot.label)}
                    >
                      <span>{slot.label}</span>
                      <small>{formatRemainingSlots(slot) || slot.disabledReason || ""}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedPreference === "remote_2d_viewing" && (
            <>
              <div className="content-card">
                <div className="card-section-title">
                  <Camera size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  2D Remote Viewing
                </div>
                <p className="rf-section-hint">
                  Review the available room photos before proceeding. This is a photo-based
                  viewing option, not a 3D or 360 tour.
                </p>
                {roomImages.length > 0 ? (
                  <div className="rf-room-gallery">
                    {roomImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        className="rf-room-gallery__item"
                        onClick={() => setPreviewImage(image)}
                      >
                        <img src={image} alt={`Room photo ${index + 1}`} className="rf-room-gallery__image" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rf-empty-state">
                    <ImageIcon size={20} />
                    <p>
                      No room photos are currently available. Please schedule a physical visit or contact admin for assistance.
                    </p>
                  </div>
                )}
              </div>

              <div className="content-card">
                <div className="card-section-title">
                  <Home size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                  Room Details Summary
                </div>
                <div className="rf-room-details-grid">
                  {roomDetails.map(([label, value]) => (
                    <div key={label} className="rf-room-details-grid__item">
                      <span className="rf-room-details-grid__label">{label}</span>
                      <strong className="rf-room-details-grid__value">{value}</strong>
                    </div>
                  ))}
                </div>
                <label className="checkbox-group rf-remote-ack">
                  <input
                    type="checkbox"
                    checked={remoteViewingAcknowledged}
                    onChange={(event) => setRemoteViewingAcknowledged(event.target.checked)}
                  />
                  <span>{REMOTE_ACKNOWLEDGEMENT}</span>
                </label>
                <div className="form-group">
                  <label className="form-label" htmlFor="remote-viewing-questions">
                    Questions / Concerns for Admin (Optional)
                  </label>
                  <textarea
                    id="remote-viewing-questions"
                    className="form-input rf-textarea"
                    rows={4}
                    value={remoteViewingQuestions}
                    onChange={(event) => setRemoteViewingQuestions(event.target.value)}
                    placeholder="Ask about the room setup, amenities, move-in reminders, or other photo-based viewing questions."
                  />
                  <div className="form-helper">
                    If you cannot visit physically, you may review the available room photos and
                    request remote viewing assistance. Payment will only be available after your
                    application and documents are approved.
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedPreference === "urgent_move_in_review" && (
            <div className="content-card">
              <div className="card-section-title">
                <AlertTriangle size={15} style={{ marginRight: 6, flexShrink: 0 }} />
                Request Urgent Move-in Review
              </div>
              <div className="rf-payment-info-box">
                <div className="info-box-title">Urgent move-in request recorded</div>
                <div className="info-text">
                  Urgent move-in requests are subject to admin document review and room
                  availability. Payment will only be available after approval.
                </div>
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
              {isSaving ? "Saving…" : "Continue to Tenant Application"}
            </button>
          </div>
        </>
      )}

      {previewImage && (
        <div className="rf-modal-overlay" role="dialog" aria-modal="true">
          <div className="rf-modal-card rf-photo-preview-modal">
            <button
              type="button"
              className="rf-modal-close-btn"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Room preview"
              className="rf-photo-preview-modal__image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationVisitStep;
