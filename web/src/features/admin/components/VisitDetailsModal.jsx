import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import {
 CalendarDays, User, Home, MapPin, Clock, Ban, Check, X,
} from "lucide-react";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import "../styles/reservation-details-modal.css";
import { APP_LOCALE, fmtShortDate } from "../../../shared/utils/dateFormat";

/* ─── helpers ────────────────────────────────────────── */
const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : v);

const formatDate = (d) =>
 d
 ? new Date(d).toLocaleDateString(APP_LOCALE, {
 weekday: "long",
 year: "numeric",
 month: "long",
 day: "numeric",
 })
 : "—";

const STATUS_CONFIGS = [
 { test: (s) => s.visitStatus === "allowed_without_visit", bg: "#CCFBF1", color: "#0F766E", dot: "#14b8a6", label: "Allowed to Proceed Without Visit" },
 { test: (s) => s.visitStatus === "visit_completed", bg: "#D1FAE5", color: "#047857", dot: "#10b981", label: "Visit Completed" },
 { test: (s) => s.visitStatus === "no_show", bg: "#FEF3C7", color: "#92400E", dot: "#f59e0b", label: "No-Show" },
 { test: (s) => s.visitStatus === "rescheduled", bg: "#EDE9FE", color: "#7C3AED", dot: "#8b5cf6", label: "Rescheduled" },
 { test: (s) => s.visitStatus === "visit_cancelled", bg: "#FEE2E2", color: "#DC2626", dot: "#ef4444", label: "Visit Cancelled" },
 { test: (s) => s.visitApproved, bg: "#D1FAE5", color: "#047857", dot: "#10b981", label: "Visit Completed" },
 { test: (s) => s.scheduleApproved, bg: "#E0EBF5", color: "#0A5C9B", dot: "#3b82f6", label: "Awaiting Visit" },
 { test: (s) => s.scheduleRejected, bg: "#FEE2E2", color: "#DC2626", dot: "#ef4444", label: "Schedule Rejected" },
];

const getStatusCfg = (schedule) =>
 STATUS_CONFIGS.find((c) => c.test(schedule)) || {
 bg: "#E0EBF5", color: "#0A5C9B", dot: "#3b82f6", label: "Awaiting Visit",
 };

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "GU";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ─── sub-components ─────────────────────────────────── */
const InfoRow = ({ label, value, wide }) => (
  <div className="rdm-info-item" style={wide ? { gridColumn: "span 2" } : {}}>
    <span className="rdm-info-label">{label}</span>
    <span className="rdm-info-value">{value || "—"}</span>
  </div>
);

const SectionCard = ({ icon: Icon, title, children }) => (
  <div
    style={{
      background: "#ffffff",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
    }}
  >
    <h4
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        margin: "0 0 8px",
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#0a1628",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        paddingBottom: 6,
        borderBottom: "1.5px solid #f1f5f9",
      }}
    >
      {Icon && <Icon size={14} style={{ color: "#64748b" }} />}
      {title}
    </h4>
    <div className="rdm-info-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0, gap: "8px 20px" }}>
      {children}
    </div>
  </div>
);

/* ─── main component ──────────────────────────────────── */
export default function VisitDetailsModal({ schedule, onClose, onUpdate }) {
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(!!schedule);
  useEscapeClose(!!schedule, onClose);

  useEffect(() => {
    if (schedule) {
      setRejectReason("");
    }
  }, [schedule]);

  if (!schedule) return null;

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showNotification("Please enter a rejection reason", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      await reservationApi.manageVisit(schedule.id, {
        action: "reject_schedule",
        note: rejectReason.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      showNotification("Visit schedule rejected successfully", "success");
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Error rejecting schedule:", error);
      showNotification("Failed to reject schedule", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showRejectBtn =
    !schedule?.visitApproved &&
    !schedule?.scheduleRejected &&
    !["visit_completed", "no_show", "visit_cancelled"].includes(
      schedule?.visitStatus,
    );

  const cfg = getStatusCfg(schedule);

  const REJECT_PRESETS = [
    { label: "Schedule conflict", text: "The selected date/time conflicts with an existing schedule. Please choose a different slot." },
    { label: "Branch unavailable", text: "The branch is temporarily unavailable for visits on the selected date. Please pick another date." },
    { label: "Capacity reached", text: "Visit capacity has been reached for this date. Please select an alternative date." },
    { label: "Incomplete info", text: "We need additional information before approving your visit. Please update your reservation details." },
  ];

  const initials = getInitials(schedule.customer);

  return createPortal(
    <div className="rdm-overlay" onClick={onClose}>
      <div className="rdm" style={{ maxWidth: 760, width: "100%" }} onClick={(e) => e.stopPropagation()}>

        {/* ── Executive Header ── */}
        <div className="rdm-top-header">
          <div className="rdm-guest-block">
            <div className="rdm-avatar">{initials}</div>
            <div className="rdm-guest-copy">
              <h2 className="rdm-title">{fmt(schedule.customer)}</h2>
              <div className="rdm-header-meta">
                {schedule.reservationCode && schedule.reservationCode !== "—" && (
                  <>
                    <span className="rdm-code">{schedule.reservationCode}</span>
                    <span className="rdm-header-sep">·</span>
                  </>
                )}
                <span className="rdm-header-detail">{fmt(schedule.email)}</span>
              </div>
            </div>
          </div>
          <div className="rdm-header-actions">
            <div
              className="rdm-status-chip"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <span className="rdm-status-dot" style={{ background: cfg.dot }} />
              {cfg.label}
            </div>
            <button className="rdm-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "16px 20px",
            overflowY: "auto",
            maxHeight: "calc(90vh - 110px)",
            background: "#f8fafc",
          }}
        >
          {/* Rejection reason banner */}
          {schedule.scheduleRejected && schedule.scheduleRejectionReason && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderLeft: "4px solid #DC2626",
                borderRadius: "var(--radius-md, 8px)",
                padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#DC2626", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Rejection Reason
              </p>
              <p style={{ fontSize: "13px", color: "#7F1D1D", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {schedule.scheduleRejectionReason}
              </p>
            </div>
          )}

          {/* Customer Information */}
          <SectionCard icon={User} title="Customer Information">
            <InfoRow label="Full Name" value={fmt(schedule.customer)} />
            <InfoRow label="Email" value={fmt(schedule.email)} />
            <InfoRow label="Phone" value={fmt(schedule.phone)} />
            <InfoRow label="Billing Email" value={fmt(schedule.billingEmail)} />
          </SectionCard>

          {/* Room Information */}
          <SectionCard icon={Home} title="Room Information">
            <InfoRow label="Room" value={fmt(schedule.room)} />
            <InfoRow label="Branch" value={fmt(schedule.branch)} />
          </SectionCard>

          {/* Visit Details */}
          <SectionCard icon={CalendarDays} title="Visit Details">
            <div className="rdm-info-item">
              <span className="rdm-info-label">Visit Type</span>
              <span style={{ marginTop: 3 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: "12px",
                    fontWeight: 600,
                    background:
                      schedule.viewingType === "inperson" || schedule.viewingType === "physical_visit"
                        ? "#E0EBF5"
                        : schedule.viewingType === "remote_2d" || schedule.viewingType === "remote_2d_viewing"
                        ? "#FFF7ED"
                        : "#F3E8FF",
                    color:
                      schedule.viewingType === "inperson" || schedule.viewingType === "physical_visit"
                        ? "#0A5C9B"
                        : schedule.viewingType === "remote_2d" || schedule.viewingType === "remote_2d_viewing"
                        ? "#C2410C"
                        : "#6B21A8",
                  }}
                >
                  {schedule.viewingType === "inperson" || schedule.viewingType === "physical_visit"
                    ? "Physical Visit"
                    : schedule.viewingType === "remote_2d" || schedule.viewingType === "remote_2d_viewing"
                    ? "2D Remote Viewing"
                    : "Urgent Move-in Review"}
                </span>
              </span>
            </div>
            <InfoRow label="Requested Date" value={formatDate(schedule.scheduledDate)} />
            <InfoRow label="Visit Date" value={formatDate(schedule.visitDate)} />
            <InfoRow label="Visit Time" value={fmt(schedule.visitTime)} />
            {schedule.isOutOfTown && (
              <div className="rdm-info-item" style={{ gridColumn: "span 2" }}>
                <span className="rdm-info-label">Current Location (Out of Town)</span>
                <span className="rdm-info-value" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MapPin size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                  {schedule.currentLocation || "Not specified"}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Rejection Reasons Section (Integrated Card) */}
          {showRejectBtn && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              }}
            >
              <h4
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: "0 0 4px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#0a1628",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  paddingBottom: 6,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <Ban size={14} style={{ color: "#DC2626" }} />
                Rejection Reason & Presets
              </h4>
              <p style={{ fontSize: 12, color: "#64748b", opacity: 0.9, margin: "4px 0 8px" }}>
                Select a preset reason below or write a custom explanation for the customer.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 8px" }}>
                {REJECT_PRESETS.map((t) => {
                  const isActive = rejectReason === t.text;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setRejectReason(isActive ? "" : t.text)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        border: isActive ? "1px solid #0a1628" : "1px solid #e2e8f0",
                        background: isActive ? "#0a1628" : "#f8fafc",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#ffffff" : "#334155",
                        cursor: "pointer",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxShadow: isActive ? "0 1px 3px rgba(10, 22, 40, 0.15)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "#f1f5f9";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                          e.currentTarget.style.color = "#0f172a";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.color = "#334155";
                        }
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ position: "relative" }}>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
                  placeholder="Type specific reason for rejection..."
                  className="rdm-notes-input"
                  maxLength={500}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 70,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    color: "#0f172a",
                    lineHeight: 1.4,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    transition: "all 0.15s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#0a1628";
                    e.target.style.boxShadow = "0 0 0 2px rgba(10, 22, 40, 0.06)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: rejectReason.length >= 480 ? "#DC2626" : "#9CA3AF",
                    textAlign: "right",
                    marginTop: 2,
                  }}
                >
                  {rejectReason.length}/500
                </div>
              </div>
            </div>
          )}

          {/* Visit History Timeline */}
          {schedule.visitHistory && schedule.visitHistory.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              }}
            >
              <h4
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: "0 0 12px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#0a1628",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  paddingBottom: 8,
                  borderBottom: "1.5px solid #f1f5f9",
                }}
              >
                <Clock size={14} style={{ color: "#64748b" }} />
                Visit Schedule History
              </h4>
              <div>
                {schedule.visitHistory
                  .slice()
                  .sort((a, b) => new Date(b.scheduledAt || b.rejectedAt || 0) - new Date(a.scheduledAt || a.rejectedAt || 0))
                  .map((entry, idx) => {
                    const MAP = {
                      pending: { bg: "#FEF3C7", color: "#92400E", label: "Scheduled" },
                      schedule_approved: { bg: "#D1FAE5", color: "#047857", label: "Schedule Approved" },
                      rejected: { bg: "#FEE2E2", color: "#DC2626", label: "Rejected" },
                      approved: { bg: "#D1FAE5", color: "#047857", label: "Completed" },
                      cancelled: { bg: "#F3F4F6", color: "#6B7280", label: "Cancelled" },
                      rescheduled: { bg: "#EDE9FE", color: "#7C3AED", label: "Rescheduled" },
                      completed: { bg: "#D1FAE5", color: "#047857", label: "Completed" },
                      no_show: { bg: "#FEF3C7", color: "#92400E", label: "No-Show" },
                      visit_cancelled: { bg: "#FEE2E2", color: "#DC2626", label: "Visit Cancelled" },
                      allowed_without_visit: { bg: "#CCFBF1", color: "#0F766E", label: "Allowed to Proceed Without Visit" },
                    };
                    const s = MAP[entry.status] || MAP.pending;
                    const entryDate = entry.visitDate ? fmtShortDate(entry.visitDate) : "N/A";
                    const actionDate = entry.rejectedAt || entry.approvedAt || entry.updatedAt || entry.scheduledAt;
                    const actionDateStr = actionDate
                      ? new Date(actionDate).toLocaleDateString(APP_LOCALE, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "";

                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: idx < schedule.visitHistory.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.color, marginTop: 6, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                              Visit on {entryDate}{entry.visitTime ? ` at ${entry.visitTime}` : ""}
                            </span>
                            <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          </div>
                          {entry.rejectionReason && (
                            <div style={{ fontSize: "12px", color: "#7F1D1D", marginTop: 2 }}>
                              Reason: {entry.rejectionReason}
                            </div>
                          )}
                          {actionDateStr && (
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>{actionDateStr}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Executive Footer Controls ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#ffffff",
            flexShrink: 0,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          {showRejectBtn ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "1px solid #D1D5DB",
                  background: "#FFFFFF",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isSubmitting || !rejectReason.trim()}
                title={!rejectReason.trim() ? "Select a preset or type a reason before confirming rejection" : ""}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 24px",
                  background: isSubmitting || !rejectReason.trim() ? "#FCA5A5" : "#DC2626",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSubmitting || !rejectReason.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSubmitting || !rejectReason.trim() ? "none" : "0 2px 6px rgba(220,38,38,0.25)",
                }}
              >
                <Ban size={15} />
                {isSubmitting ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: "9px 24px",
                background: "var(--color-primary, #0A1628)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1E293B")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-primary, #0A1628)")}
            >
              Close
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body,
  );
}
