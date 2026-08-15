import React from "react";
import { useNavigate } from "react-router-dom";
import {
 Ticket,
 Calendar,
 Clock,
 MapPin,
 Home,
 CreditCard,
 FileText,
 Shield,
 Download,
} from "lucide-react";
import { generateDepositReceipt } from "../../../../shared/utils/receiptGenerator";
import { useCurrentUser } from "../../../../shared/hooks/queries/useUsers";
import DeadlineBadge from "../../../../shared/components/DeadlineBadge";
import {
 canReservationAccessPayment,
 hasReservationStatus,
} from "../../../../shared/utils/lifecycleNaming";
import { resolveReservationFinancials } from "../../../../shared/utils/depositUtils";

function parseSafeDate(dateStr) {
 if (!dateStr) return null;
 const clean = String(dateStr).split("T")[0];
 const d = new Date(clean + "T12:00:00");
 return isNaN(d) ? null : d;
}

function fmtDate(dateStr) {
 const d = parseSafeDate(dateStr);
 if (!d) return "-";
 return d.toLocaleDateString("en-US", {
 weekday: "short",
 month: "short",
 day: "numeric",
 });
}

function fmtDateLong(dateStr) {
 const d = parseSafeDate(dateStr);
 if (!d) return "-";
 return d.toLocaleDateString("en-US", {
 month: "long",
 day: "numeric",
 year: "numeric",
 });
}

export default function ReservationSidePanel({ reservation, onClick, profileData }) {
  const navigate = useNavigate();
  const { data: profile } = useCurrentUser();
  const activeProfile = profileData || profile;
  const [isDark, setIsDark] = React.useState(() => {
    const root = document.documentElement;
    return root.getAttribute("data-theme") === "dark" || root.classList.contains("dark");
  });

  React.useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setIsDark(root.getAttribute("data-theme") === "dark" || root.classList.contains("dark"));
    };

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    syncTheme();
    return () => observer.disconnect();
  }, []);

  if (!reservation) return <EmptyState />;

  const status = reservation.reservationStatus || reservation.status;
  const isConfirmed =
    hasReservationStatus(status, "reserved", "moveIn", "moveOut");
  const isMoveInSettled =
    reservation.initialPaymentStatus === "paid" ||
    reservation.paymentStatus === "paid_in_full";
  const hasVisit = !!(reservation.visitDate && reservation.visitTime);
  const visitApproved = reservation.visitApproved || reservation.scheduleApproved;
  const hasApplication = !!(reservation.firstName && reservation.lastName && reservation.mobileNumber);
  const paymentReady =
    canReservationAccessPayment(status) ||
    hasReservationStatus(status, "payment_pending");
  const pendingReview = hasReservationStatus(status, "pending_application_review");
  const needsRevision = hasReservationStatus(status, "needs_revision");
  const preferenceSelected = Boolean(
    reservation.viewingPreference ||
      reservation.viewingType ||
      reservation.isUrgentMoveIn ||
      hasVisit,
  );

  const viewingPreference =
    reservation.viewingPreference ||
    (reservation.viewingType === "virtual"
      ? "remote_2d_viewing"
      : reservation.viewingType === "inperson"
      ? "physical_visit"
      : reservation.isUrgentMoveIn
      ? "urgent_move_in_review"
      : null);

  const viewingPrefLabel =
    viewingPreference === "physical_visit"
      ? "Physical Visit"
      : viewingPreference === "remote_2d_viewing"
      ? "Remote Viewing"
      : viewingPreference === "urgent_move_in_review"
      ? "Priority Viewing Review"
      : null;

  const room = (typeof reservation.roomId === "object" && reservation.roomId !== null)
    ? reservation.roomId
    : (typeof reservation.room === "object" && reservation.room !== null ? reservation.room : {});
  const roomName = room.name || reservation.roomName || "Room";
  const branch = room.branch || reservation.branch || "-";

  const {
    monthlyRent,
    advanceRent,
    securityDeposit,
    grossTotal,
    reservationFeeAmount,
    remainingDue: moveInRemainingDue,
  } = resolveReservationFinancials(reservation);

  let panelState = "pending";
  if (isConfirmed) panelState = "confirmed";
  else if (paymentReady) panelState = "payment_ready";
  else if (needsRevision) panelState = "needs_revision";
  else if (pendingReview || hasApplication) panelState = "application_review";
  else if (visitApproved) panelState = "approved";
  else if (hasVisit) panelState = "scheduled";
  else if (preferenceSelected) panelState = "preference";

 const panelTone =
 panelState === "confirmed"
 ? {
 accent: "#10B981",
 soft: "rgba(16, 185, 129, 0.10)",
 border: "rgba(16, 185, 129, 0.28)",
 label: "Reservation Details",
 }
 : panelState === "payment_ready"
 ? {
 accent: "#0F766E",
 soft: "rgba(15, 118, 110, 0.10)",
 border: "rgba(15, 118, 110, 0.24)",
 label: "Approved for Payment",
 }
 : panelState === "application_review"
 ? {
 accent: "var(--color-accent, #D4AF37)",
 soft: "rgba(212, 175, 55, 0.12)",
 border: "rgba(212, 175, 55, 0.34)",
 label: "Pending Review",
 }
 : panelState === "needs_revision"
 ? {
 accent: "#EA580C",
 soft: "rgba(234, 88, 12, 0.10)",
 border: "rgba(234, 88, 12, 0.24)",
 label: "Needs Revision",
 }
 : panelState === "approved"
 ? {
 accent: "#2563EB",
 soft: "rgba(37, 99, 235, 0.10)",
 border: "rgba(37, 99, 235, 0.24)",
 label: "Visit Approved",
 }
 : panelState === "scheduled"
 ? {
 accent: "#7C3AED",
 soft: "rgba(124, 58, 237, 0.10)",
 border: "rgba(124, 58, 237, 0.24)",
 label: "Physical Visit Scheduled",
 }
 : panelState === "preference"
 ? {
 accent: viewingPreference === "urgent_move_in_review" ? "#DC2626" : "#2563EB",
 soft: viewingPreference === "urgent_move_in_review" ? "rgba(220, 38, 38, 0.10)" : "rgba(37, 99, 235, 0.10)",
 border: viewingPreference === "urgent_move_in_review" ? "rgba(220, 38, 38, 0.24)" : "rgba(37, 99, 235, 0.24)",
 label:
  viewingPreference === "remote_2d_viewing"
   ? "Remote Viewing Selected"
   : viewingPreference === "urgent_move_in_review"
   ? "Priority Review Requested"
   : viewingPreference === "physical_visit"
   ? "Physical Visit Selected"
   : "Viewing Preference Selected",
 }
 : {
 accent: "var(--text-secondary, #64748B)",
 soft: "rgba(100, 116, 139, 0.10)",
 border: "rgba(100, 116, 139, 0.24)",
 label: "Room Selected",
 };

 return (
 <div
 style={S.card}
 onClick={onClick}
 role={onClick ? "button" : undefined}
 tabIndex={onClick ? 0 : undefined}
 >
 <div style={S.headerShell}>
 <div style={S.roomSection}>
 <div style={S.roomIconWrap}>
 <Home size={20} color="var(--text-secondary, #64748B)" />
 </div>
 <div style={S.roomInfo}>
 <h3 style={S.roomName}>{roomName}</h3>
 <div style={S.roomBranch}>
 <MapPin size={13} style={{ marginRight: 4 }} />
 {branch}
 </div>
 </div>
 </div>
 </div>

      <div
        style={{
          ...S.detailsShell,
          background: isDark
            ? "var(--surface-card, #0F1B2D)"
            : S.detailsShell.background,
        }}
      >
        {hasVisit && (
          <>
            <DetailRow
              icon={<Calendar size={15} color="var(--text-secondary, #94A3B8)" />}
              label="Visit Date"
              value={fmtDate(reservation.visitDate)}
            />
            <DetailRow
              icon={<Clock size={15} color="var(--text-secondary, #94A3B8)" />}
              label="Visit Time"
              value={reservation.visitTime}
            />
          </>
        )}

        {panelState === "preference" && viewingPrefLabel && (
          <DetailRow
            icon={<Calendar size={15} color="var(--text-secondary, #94A3B8)" />}
            label="Preference"
            value={viewingPrefLabel}
          />
        )}

        {(() => {
          const codeValue = isConfirmed
            ? reservation.reservationCode || reservation.code || reservation.visitCode
            : reservation.reservationCode || reservation.code || reservation.visitCode;
          const codeLabel =
            isConfirmed || reservation.reservationCode || reservation.code
              ? "Reservation Code"
              : "Visit Code";

          if (!codeValue) return null;

          return (
            <DetailRow
              icon={<Ticket size={15} color="var(--text-secondary, #94A3B8)" />}
              label={codeLabel}
              value={codeValue}
              mono
              highlight
            />
          );
        })()}

        {reservation.targetMoveInDate && (
          <DetailRow
            icon={<Calendar size={15} color="var(--text-secondary, #94A3B8)" />}
            label="Move-in"
            value={fmtDateLong(reservation.targetMoveInDate)}
          />
        )}

        {hasApplication && (
          <DetailRow
            icon={<FileText size={15} color="var(--text-secondary, #94A3B8)" />}
            label="Application"
            value={
              pendingReview
                ? "Pending Review"
                : needsRevision
                ? "Needs Revision"
                : paymentReady
                ? "Approved"
                : "Submitted"
            }
            success={paymentReady}
          />
        )}

        {isConfirmed && (
          <>
            <DetailRow
              icon={<CreditCard size={15} color="var(--text-secondary, #94A3B8)" />}
              label="Slot Deposit"
              value="Verified (Paid)"
              success
            />
            <DetailRow
              icon={<CreditCard size={15} color="var(--text-secondary, #94A3B8)" />}
              label="Move-In Due"
              value={
                isMoveInSettled
                  ? "Settled (Paid)"
                  : `₱${moveInRemainingDue.toLocaleString()}`
              }
              success={isMoveInSettled}
              highlight={!isMoveInSettled}
            />
          </>
        )}
        {(reservation.depositPaymentDeadline || reservation.paymentDueDate) && (
          <div style={{ marginTop: 10, width: "100%" }}>
            <DeadlineBadge
              dueDate={reservation.depositPaymentDeadline || reservation.paymentDueDate}
              status={reservation.status}
              type="reservation"
              showConsequenceNote={true}
            />
          </div>
        )}
      </div>

      {panelState === "scheduled" && (
        <div style={S.pendingBanner}>
          <Clock size={14} color="#7C3AED" />
          <span style={S.pendingText}>Saved for viewing coordination only</span>
        </div>
      )}

      {panelState === "preference" && viewingPreference === "remote_2d_viewing" && (
        <div style={{ ...S.pendingBanner, background: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(37, 99, 235, 0.2)" }}>
          <Clock size={14} color="#2563EB" />
          <span style={{ ...S.pendingText, color: "#2563EB" }}>Admin will arrange a remote viewing for your room</span>
        </div>
      )}

      {panelState === "preference" && viewingPreference === "urgent_move_in_review" && (
        <div style={{ ...S.pendingBanner, background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)" }}>
          <Clock size={14} color="#DC2626" />
          <span style={{ ...S.pendingText, color: "#DC2626" }}>Priority review request is under review</span>
        </div>
      )}

      {isConfirmed && (
        <div style={S.footerShell}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateDepositReceipt(reservation, activeProfile || profile);
            }}
            style={{
 ...S.downloadBtn,
 background: isDark ? "#142944" : "var(--text-heading, #0F172A)",
 color: isDark ? "#E2E8F0" : "#fff",
 border: isDark ? "1px solid var(--border-card, #2A3B57)" : "none",
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.background = isDark ? "#1B3557" : "#1E293B";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.background = isDark ? "#142944" : "var(--text-heading, #0F172A)";
 }}
 >
 <Download size={14} />
 Download Receipt
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 navigate("/applicant/profile", { state: { tab: "reservation" } });
 }}
 style={{
 ...S.subtleLink,
 color: isDark ? "#C8D3E4" : S.subtleLink.color,
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.color = "var(--color-accent, #D4AF37)";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.color = "";
 }}
 >
 View full reservation {"\u2192"}
 </button>
 </div>
 )}
 </div>
 );
}

function DetailRow({ icon, label, value, mono, highlight, success }) {
  return (
    <div style={S.detailRow}>
      <div style={S.detailLeft}>
        {icon}
        <span style={S.detailLabel}>{label}</span>
      </div>
      <span
        style={{
          ...S.detailValue,
          ...(mono ? S.mono : {}),
          ...(highlight ? { color: "var(--color-accent, #D4AF37)", fontWeight: 700 } : {}),
          ...(success ? { color: "#059669", fontWeight: 700 } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
 return (
 <div style={S.emptyCard}>
 <div style={S.emptyIconWrap}>
 <Ticket size={24} strokeWidth={1.6} color="var(--text-muted, #CBD5E1)" />
 </div>
 <p style={S.emptyText}>Your reservation details will appear here once you start your application</p>
 </div>
 );
}

const S = {
  card: {
    background: "var(--surface-card, #FFFFFF)",
    border: "1px solid var(--border-card, #E2E8F0)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "auto",
    boxSizing: "border-box",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    cursor: "default",
  },

 headerShell: {
 padding: "20px 20px 18px",
 borderBottom: "1px solid var(--border-card, #E2E8F0)",
 },
 statusRow: {
 display: "flex",
 alignItems: "center",
 gap: 10,
 marginBottom: 14,
 },
 statusDot: {
 width: 10,
 height: 10,
 borderRadius: "50%",
 flexShrink: 0,
 },
 statusChip: {
 fontSize: 12,
 fontWeight: 700,
 letterSpacing: "0.05em",
 textTransform: "uppercase",
 padding: "5px 12px",
 borderRadius: 999,
 },

 roomSection: {
 display: "flex",
 alignItems: "center",
 gap: 12,
 },
 roomIconWrap: {
 width: 48,
 height: 48,
 borderRadius: 12,
 background: "rgba(212, 175, 55, 0.14)",
 border: "1px solid rgba(212, 175, 55, 0.26)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 flexShrink: 0,
 },
 roomInfo: {
 minWidth: 0,
 },
 roomName: {
 fontSize: 20,
 fontWeight: 700,
 color: "var(--text-heading, #0F172A)",
 lineHeight: 1.15,
 letterSpacing: "-0.01em",
 margin: 0,
 marginBottom: 2,
 },
 roomBranch: {
 fontSize: 14,
 color: "var(--text-secondary, #64748B)",
 display: "flex",
 alignItems: "center",
 textTransform: "capitalize",
 },

  detailsShell: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "12px 14px",
    background: "var(--surface-card, #FFFFFF)",
  },
 detailRow: {
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 8,
 minHeight: 38,
 borderRadius: 10,
 border: "1px solid var(--border-card, #E2E8F0)",
 background: "var(--surface-card, #FFFFFF)",
 padding: "7px 10px",
 },
 detailLeft: {
 display: "flex",
 alignItems: "center",
 gap: 8,
 minWidth: 0,
 },
 detailLabel: {
 fontSize: 12,
 color: "var(--text-secondary, #64748B)",
 fontWeight: 500,
 },
 detailValue: {
 fontSize: 14,
 fontWeight: 700,
 color: "var(--text-heading, #0F172A)",
 textAlign: "right",
 },
 mono: {
 fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
 letterSpacing: "0.04em",
 fontSize: 13,
 },

 pendingBanner: {
 display: "flex",
 alignItems: "center",
 gap: 8,
 background: "rgba(124, 58, 237, 0.08)",
 border: "1px solid rgba(124, 58, 237, 0.2)",
 borderRadius: 10,
 padding: "10px 12px",
 margin: "0 16px 12px",
 },
 pendingText: {
 fontSize: 13,
 fontWeight: 600,
 color: "#7C3AED",
 },

 footerShell: {
 borderTop: "1px solid var(--border-card, #E2E8F0)",
 padding: "14px 16px 16px",
 },
 downloadBtn: {
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 width: "100%",
 padding: "12px 16px",
 background: "var(--text-heading, #0F172A)",
 color: "#fff",
 border: "none",
 borderRadius: 10,
 fontSize: 14,
 fontWeight: 700,
 cursor: "pointer",
 transition: "background-color 0.15s ease",
 },
 subtleLink: {
 background: "none",
 border: "none",
 color: "var(--text-secondary, #64748B)",
 fontSize: 13,
 fontWeight: 600,
 cursor: "pointer",
 padding: "10px 0 0",
 transition: "color 0.15s",
 textAlign: "center",
 width: "100%",
 },

  emptyCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    border: "1px dashed var(--border-card, #E2E8F0)",
    borderRadius: 20,
    padding: "36px 24px",
    background: "var(--surface-card, #FFFFFF)",
    height: "auto",
    boxSizing: "border-box",
  },
 emptyIconWrap: {
 width: 50,
 height: 50,
 borderRadius: "50%",
 background: "var(--surface-muted, #F8FAFC)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 marginBottom: 12,
 },
 emptyText: {
 fontSize: 13,
 color: "var(--text-secondary, #94A3B8)",
 lineHeight: 1.5,
 margin: 0,
 maxWidth: 210,
 },
};
