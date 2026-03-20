import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, FileText, X, CheckCircle, AlertTriangle } from "lucide-react";
import { showNotification } from "../../../../shared/utils/notification";
import { PoliciesTermsModal } from "../../modals/PoliciesAndConsent";

/* â”€â”€ Available time slots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TIME_SLOTS = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];

/* â”€â”€ Helper: generate next N weekdays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function getAvailableDates(count = 10) {
  const dates = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // start from tomorrow
  while (dates.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      // skip weekends
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function fmtDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDateFull(dateStr) {
  if (!dateStr) return "N/A";
  // Strip any existing time portion before parsing to avoid timezone-shifted dates
  const cleanDate = String(dateStr).split("T")[0];
  return new Date(cleanDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

/* â”€â”€ Inline styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const S = {
  dateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "10px",
    marginBottom: "8px",
  },
  // Phase 5: button reset base â€” used by date + time cards
  cardBtn: {
    all: "unset",
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    cursor: "pointer",
  },
  dateCard: (selected, hovered) => ({
    padding: "12px 10px",
    borderRadius: "10px",
    border: selected ? "2px solid #FF8C42" : "2px solid #E2E8F0",
    background: selected
      ? "rgba(255,140,66,0.08)"
      : hovered
      ? "#F8FAFC"
      : "#fff",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.15s ease",
    position: "relative",
  }),
  dateDay: (selected) => ({
    fontSize: "11px",
    fontWeight: 600,
    color: selected ? "#FF8C42" : "#94A3B8",
    textTransform: "uppercase",
    marginBottom: "4px",
  }),
  dateNum: (selected) => ({
    fontSize: "16px",
    fontWeight: 700,
    color: selected ? "#0A1628" : "#334155",
  }),
  tomorrowPill: {
    position: "absolute",
    top: "-9px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0A1628",
    color: "#fff",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "2px 6px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  },
  timeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
    gap: "8px",
  },
  timeSlot: (selected, hovered) => ({
    padding: "10px 12px",
    borderRadius: "8px",
    border: selected ? "2px solid #FF8C42" : "2px solid #E2E8F0",
    background: selected
      ? "rgba(255,140,66,0.08)"
      : hovered
      ? "#F8FAFC"
      : "#fff",
    cursor: "pointer",
    textAlign: "center",
    fontSize: "14px",
    fontWeight: selected ? 600 : 500,
    color: selected ? "#FF8C42" : "#475569",
    transition: "all 0.15s ease",
  }),
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalCard: {
    background: "white",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "480px",
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
  },
};

/**
 * Step 2 â€” Visit Scheduling & Policies
 * User picks an available date + time slot, reviews policies, then confirms.
 * After confirmation, a receipt is shown and user returns to the dashboard.
 */
const ReservationVisitStep = ({
  targetMoveInDate,
  viewingType,
  setViewingType,
  isOutOfTown,
  setIsOutOfTown,
  currentLocation,
  setCurrentLocation,
  visitApproved,
  onPrev,
  onNext,
  visitorName,
  setVisitorName,
  visitorPhone,
  setVisitorPhone,
  visitorEmail,
  setVisitorEmail,
  visitDate,
  setVisitDate,
  visitTime,
  setVisitTime,
  reservationData,
  reservationCode,
  visitCode,
  onSaveVisit,
  onAfterClose,
  readOnly,
  agreedToPrivacy,
  scheduleRejected,
  scheduleRejectionReason,
}) => {
  const navigate = useNavigate();
  // Initialize from parent state; always true when read-only (already submitted)
  const [policiesAccepted, setPoliciesAccepted] = useState(agreedToPrivacy || readOnly || false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // visitCode resolved after save â€” may differ from prop if code was just generated
  const [resolvedVisitCode, setResolvedVisitCode] = useState(visitCode || null);
  const [isSaving, setIsSaving] = useState(false);
  // Phase 1: hover tracking
  const [hoveredDate, setHoveredDate] = useState(null);
  const [hoveredTime, setHoveredTime] = useState(null);

  const availableDates = useMemo(() => getAvailableDates(10), []);

  /* â”€â”€ handlers â”€â”€ */
  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    try {
      // Save visit to server first â€” this generates visitCode on the backend
      const code = onSaveVisit ? await onSaveVisit() : null;
      setResolvedVisitCode(code || visitCode || null);
    } catch (err) {
      console.error("Failed to save visit:", err);
    } finally {
      setIsSaving(false);
    }
    setIsSubmitted(true);
    setShowReceiptModal(true);
  };

  const handleReturnToDashboard = () => {
    setShowReceiptModal(false);
    if (onAfterClose) onAfterClose();
    else navigate("/applicant/profile");
  };

  const canSubmit = policiesAccepted && visitDate && visitTime && !isSubmitted;

  // Phase 4: dynamic CTA label
  const ctaLabel = useCallback(() => {
    if (!visitDate) return "Select a date to continue";
    if (!visitTime) return "Select a time to continue";
    if (!policiesAccepted) return "Accept policies to continue";
    return "Confirm Visit";
  }, [visitDate, visitTime, policiesAccepted]);

  const handleSubmitWithValidation = () => {
    if (!visitDate) {
      showNotification("Please select a visit date to continue.", "error", 3000);
      const el = document.getElementById("visit-date-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!visitTime) {
      showNotification("Please select a time slot for your visit.", "error", 3000);
      const el = document.getElementById("visit-time-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!policiesAccepted) {
      showNotification("Please agree to the policies and terms to continue.", "error", 3000);
      const el = document.getElementById("visit-policies-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowConfirmModal(true);
  };

  return (
    <div className="reservation-card">
      {/* Step Header */}
      <div className="main-header">
        <div className="main-header-badge">
          <span>Step 2 Â· Verification</span>
        </div>
        <h2 className="main-header-title">Schedule Your Visit</h2>
        <p className="main-header-subtitle">
          Pick an available date and time to visit the dormitory. Review our
          policies before confirming your booking.
        </p>
      </div>

      {/* Rejection Banner */}
      {scheduleRejected && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "16px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#DC2626", marginBottom: "4px" }}>
              Your previous visit schedule was rejected
            </div>
            {scheduleRejectionReason && (
              <div style={{ fontSize: "13px", color: "#7F1D1D", marginBottom: "8px", lineHeight: 1.5 }}>
                <strong>Reason:</strong> {scheduleRejectionReason}
              </div>
            )}
            <div style={{ fontSize: "13px", color: "#991B1B" }}>
              Please select a new date and time below to reschedule your visit.
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Banner */}
      {readOnly && (
        <div
          className="info-box"
          style={{
            background: "#FEF3C7",
            borderColor: "#F59E0B",
            marginBottom: "16px",
          }}
        >
          <div className="info-box-title" style={{ color: "#92400E" }}>
            This section is locked
          </div>
          <div className="info-text" style={{ color: "#78350F" }}>
            Your visit has been scheduled. This step can no longer be edited.
          </div>
        </div>
      )}

      {/* Form content wrapper â€” disable interaction when readOnly */}
      <div
        style={{
          pointerEvents: readOnly ? "none" : "auto",
          opacity: readOnly ? 0.7 : 1,
        }}
      >
        {/* â”€â”€ Card 1: Select Date â”€â”€ */}
        <div className="content-card" id="visit-date-section">
          <div className="card-section-title">
            <Calendar size={15} style={{ marginRight: 6, flexShrink: 0 }} />
            Choose a Date
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "#64748B",
              marginBottom: "14px",
              marginTop: "-8px",
            }}
          >
            Available weekdays for the next 2 weeks
          </p>
          <div style={S.dateGrid}>
            {availableDates.map((date, idx) => {
              const iso = toISODate(date);
              const selected = visitDate === iso;
              const hovered = hoveredDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  style={{ ...S.cardBtn, position: "relative" }}
                  onClick={() => {
                    setVisitDate(iso);
                    if (visitTime) setVisitTime(""); // reset time on date change
                  }}
                  onMouseEnter={() => setHoveredDate(iso)}
                  onMouseLeave={() => setHoveredDate(null)}
                  aria-pressed={selected}
                  aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                >
                  <div style={S.dateCard(selected, hovered)}>
                    {idx === 0 && (
                      <span style={S.tomorrowPill}>Tomorrow</span>
                    )}
                    <div style={S.dateDay(selected)}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div style={S.dateNum(selected)}>
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* â”€â”€ Card 2: Select Time â€” always visible, dimmed until date chosen â”€â”€ */}
        <div
          className="content-card"
          id="visit-time-section"
          style={{
            opacity: visitDate ? 1 : 0.45,
            transition: "opacity 0.2s ease",
            pointerEvents: visitDate ? "auto" : "none",
          }}
        >
          <div className="card-section-title">
            <Clock size={15} style={{ marginRight: 6, flexShrink: 0 }} />
            Choose a Time
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "#64748B",
              marginBottom: "14px",
              marginTop: "-8px",
            }}
          >
            {visitDate ? (
              <>Available time slots for{" "}
              <strong>{fmtDate(new Date(visitDate + "T00:00:00"))}</strong></>
            ) : (
              "Select a date first to see available times"
            )}
          </p>
          <div style={S.timeGrid}>
            {TIME_SLOTS.map((slot) => {
              const selected = visitTime === slot;
              const hovered = hoveredTime === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  style={S.cardBtn}
                  onClick={() => setVisitTime(slot)}
                  onMouseEnter={() => setHoveredTime(slot)}
                  onMouseLeave={() => setHoveredTime(null)}
                  aria-pressed={selected}
                  aria-label={slot}
                >
                  <div style={S.timeSlot(selected, hovered)}>{slot}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* â”€â”€ Card 3: Policies & Terms â€” collapsed to single checkbox line â”€â”€ */}
        <div className="content-card" id="visit-policies-section">
          <div className="card-section-title">
            <FileText size={15} style={{ marginRight: 6, flexShrink: 0 }} />
            Policies, Terms & Conditions
          </div>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="policies-accepted"
              checked={policiesAccepted || readOnly}
              onChange={(e) => setPoliciesAccepted(e.target.checked)}
            />
            <label htmlFor="policies-accepted" className="checkbox-label">
              I have read and agree to the{" "}
              <span
                onClick={() => setShowPoliciesModal(true)}
                style={{
                  color: "#2563EB",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                dormitory policies, terms & conditions, and privacy policy
              </span>
            </label>
          </div>
        </div>

        {/* â”€â”€ Actions â”€â”€ */}
        <div className="stage-buttons" style={{ justifyContent: "flex-end" }}>
          <button
            onClick={handleSubmitWithValidation}
            className="btn btn-primary"
            disabled={isSubmitted || isSaving}
          >
            {isSaving ? "Booking..." : ctaLabel()}
          </button>
        </div>
      </div>
      {/* Close pointer-events wrapper */}

      {/* â•â•â•â•â•â•â•â• Confirmation Modal â€” outside pointerEvents wrapper â•â•â•â•â•â•â•â• */}
      {showConfirmModal && (
        <ConfirmModal
          visitDate={visitDate}
          visitTime={visitTime}
          onConfirm={handleConfirmSubmit}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {/* â•â•â•â•â•â•â•â• Receipt Modal â€” outside pointerEvents wrapper â•â•â•â•â•â•â•â• */}
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ConfirmModal â€” extracted sub-component
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ConfirmModal({ visitDate, visitTime, onConfirm, onClose }) {
  // Escape key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div
        style={{ ...S.modalCard, maxWidth: "420px", textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "none", border: "none", cursor: "pointer",
            color: "#94A3B8", padding: "4px", borderRadius: "6px",
            display: "flex", alignItems: "center",
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Calendar icon */}
        <div
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "#EFF6FF", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}
        >
          <Calendar size={24} color="#3B82F6" />
        </div>

        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1F2937", margin: "0 0 6px" }}>
          Confirm Your Visit
        </h3>
        <p style={{ fontSize: "14px", color: "#6B7280", margin: "0 0 16px", lineHeight: "1.5" }}>
          You're booking a visit on:
        </p>

        <div
          style={{
            background: "#F8FAFC", borderRadius: "10px", padding: "14px 16px",
            marginBottom: "20px", border: "1px solid #E2E8F0",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0A1628", marginBottom: "4px" }}>
            {visitDate && fmtDateFull(visitDate + "T00:00:00")}
          </div>
          <div style={{ fontSize: "14px", color: "#FF8C42", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
            <Clock size={13} />{visitTime}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
            Go Back
          </button>
          <button onClick={onConfirm} className="btn btn-primary" style={{ flex: 1 }}>
            Yes, Book Visit
          </button>
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ReceiptModal â€” extracted sub-component
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ReceiptModal({ visitDate, visitTime, visitCode, reservationCode, reservationData, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const room   = reservationData?.room?.roomNumber || reservationData?.room?.name || reservationData?.room?.title || "N/A";
  const branch = reservationData?.room?.branch || "N/A";

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modalCard, position: "relative", maxWidth: 420 }}>

        {/* X close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "none", border: "none", cursor: "pointer",
            color: "#94A3B8", padding: "4px", borderRadius: "6px",
            display: "flex", alignItems: "center",
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* â”€â”€ Success header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "#DCFCE7", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 12px",
          }}>
            <CheckCircle size={28} color="#16A34A" strokeWidth={2.5} />
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1F2937", margin: "0 0 4px" }}>
            Visit Confirmed!
          </h3>
          <p style={{ fontSize: "14px", color: "#6B7280", margin: 0 }}>
            Your visit has been booked successfully
          </p>
        </div>

        {/* â”€â”€ Receipt card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "16px",
        }}>
          {/* Receipt header strip */}
          <div style={{
            background: "#F9FAFB",
            borderBottom: "1px solid #E5E7EB",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase" }}>
              Booking Summary
            </span>
            <span style={{
              fontSize: "11px", fontWeight: 600, color: "#2563EB",
              background: "#EFF6FF", padding: "2px 8px", borderRadius: 999,
            }}>
              Visit Scheduled
            </span>
          </div>

          {/* Receipt rows */}
          <div style={{ padding: "4px 0" }}>
            {/* Visit code â€” highlighted row */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "11px 16px",
              borderBottom: "1px solid #F3F4F6",
              background: "#FFFBF7",
            }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Visit Code</span>
              <span style={{
                fontSize: "14px", fontWeight: 700,
                color: visitCode ? "#FF8C42" : "#9CA3AF",
                fontFamily: visitCode ? "'Courier New', monospace" : "inherit",
                letterSpacing: visitCode ? "0.08em" : 0,
              }}>
                {visitCode || "Generatingâ€¦"}
              </span>
            </div>

            {[
              { label: "Date",   value: fmtDateFull(visitDate) },
              { label: "Time",   value: visitTime },
              { label: "Room",   value: room },
              { label: "Branch", value: branch, capitalize: true },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: i < arr.length - 1 ? "1px solid #F3F4F6" : "none",
              }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>{row.label}</span>
                <span style={{
                  fontSize: "13px", fontWeight: 600, color: "#111827",
                  textTransform: row.capitalize ? "capitalize" : "none",
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* â”€â”€ Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "10px",
          background: "#F0F9FF", border: "1px solid #BAE6FD",
          borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
        }}>
          <Clock size={15} color="#0284C7" style={{ flexShrink: 0, marginTop: "2px" }} />
          <p style={{ fontSize: "13px", color: "#0369A1", margin: 0, lineHeight: 1.5 }}>
            Please arrive on time. After your visit, the admin will verify your attendance and approve your reservation to proceed.
          </p>
        </div>

        {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <button onClick={onClose} className="btn btn-primary btn-full">
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

export default ReservationVisitStep;

