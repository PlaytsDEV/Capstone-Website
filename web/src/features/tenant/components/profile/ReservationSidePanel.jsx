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
  readMoveInDate,
} from "../../../../shared/utils/lifecycleNaming";
import { resolveDisplayMoveInDate } from "../../utils/reservationReadiness";
import { resolveReservationFinancials } from "../../../../shared/utils/depositUtils";
import { fmtDate, fmtShortDate } from "../../../../shared/utils/dateFormat";

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

  return (
    <div
      style={{
        ...S.card,
        background: isDark ? "var(--surface-card, #0F1B2D)" : "#FFFFFF",
        borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)",
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 18px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = isDark ? "var(--border-card, #3B506D)" : "var(--border-subtle, #CBD5E1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(15, 23, 42, 0.04)";
        e.currentTarget.style.borderColor = isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)";
      }}
    >
      <div
        style={{
          ...S.headerShell,
          borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)",
        }}
      >
        <div style={S.roomSection}>
          <div style={S.roomIconWrap}>
            <Home size={20} color={isDark ? "#F8FAFC" : "var(--text-secondary, #64748B)"} />
          </div>
          <div style={S.roomInfo}>
            <h3 style={{ ...S.roomName, color: isDark ? "#FFFFFF" : "var(--text-heading, #0F172A)" }}>{roomName}</h3>
            <div style={{ ...S.roomBranch, color: isDark ? "#94A3B8" : "var(--text-secondary, #64748B)" }}>
              <MapPin size={12} style={{ marginRight: 3 }} />
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
              icon={<Calendar size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label="Visit Date"
              value={fmtShortDate(reservation.visitDate)}
              isDark={isDark}
            />
            <DetailRow
              icon={<Clock size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label="Visit Time"
              value={reservation.visitTime}
              isDark={isDark}
            />
          </>
        )}

        {panelState === "preference" && viewingPrefLabel && (
          <DetailRow
            icon={<Calendar size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
            label="Preference"
            value={viewingPrefLabel}
            isDark={isDark}
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
              icon={<Ticket size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label={codeLabel}
              value={codeValue}
              mono
              isDark={isDark}
            />
          );
        })()}

        {(() => {
          const { primaryDate, dateType, displayLabel } = resolveDisplayMoveInDate(
            reservation,
            readMoveInDate,
            fmtShortDate,
          );

          const moveIn = primaryDate || readMoveInDate(reservation) || reservation.targetMoveInDate;
          const daysLeft = moveIn
            ? Math.ceil((new Date(moveIn) - new Date()) / (1000 * 60 * 60 * 24))
            : null;
          const isCheckedIn =
            hasReservationStatus(status, "moveIn", "moveOut") ||
            Boolean(reservation.checkInDate);
          const showCountdown = isConfirmed && daysLeft !== null && daysLeft >= 0 && !isCheckedIn;

          const countdownText = showCountdown
            ? daysLeft > 0
              ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} away`
              : "Today!"
            : null;

          return (
            <DetailRow
              icon={<Calendar size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label={displayLabel || (dateType === "confirmed" ? "Confirmed Move-in" : "Preferred Move-in")}
              value={primaryDate ? fmtShortDate(primaryDate) : "Not specified yet"}
              subValue={countdownText}
              isDark={isDark}
            />
          );
        })()}

        {hasApplication && (
          <DetailRow
            icon={<FileText size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
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
            color={
              paymentReady
                ? (isDark ? "#34D399" : "#059669")
                : pendingReview
                ? (isDark ? "#FBBF24" : "#D97706")
                : needsRevision
                ? (isDark ? "#F87171" : "#DC2626")
                : (isDark ? "#34D399" : "#059669")
            }
            isDark={isDark}
          />
        )}

        {isConfirmed && (
          <>
            <DetailRow
              icon={<CreditCard size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label="Reservation Fee"
              value="Paid (₱2,000)"
              color={isDark ? "#34D399" : "#059669"}
              isDark={isDark}
            />
            <DetailRow
              icon={<CreditCard size={14} color={isDark ? "#94A3B8" : "var(--text-secondary, #64748B)"} />}
              label="Advance & Deposit"
              value={
                isMoveInSettled
                  ? "Settled"
                  : `₱${moveInRemainingDue.toLocaleString()}`
              }
              color={
                isMoveInSettled
                  ? (isDark ? "#34D399" : "#059669")
                  : undefined
              }
              isDark={isDark}
            />
          </>
        )}
        {(reservation.depositPaymentDeadline || reservation.paymentDueDate) && (
          <div style={{ marginTop: 6, width: "100%" }}>
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
        <div style={{ ...S.pendingBanner, borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)" }}>
          <Clock size={13} color="#2563EB" />
          <span style={S.pendingText}>Saved for viewing coordination only</span>
        </div>
      )}

      {panelState === "preference" && viewingPreference === "remote_2d_viewing" && (
        <div style={{ ...S.pendingBanner, borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)" }}>
          <Clock size={13} color="#2563EB" />
          <span style={{ ...S.pendingText, color: "#2563EB" }}>Admin will arrange a remote viewing for your room</span>
        </div>
      )}

      {panelState === "preference" && viewingPreference === "urgent_move_in_review" && (
        <div style={{ ...S.pendingBanner, borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)" }}>
          <Clock size={13} color="#DC2626" />
          <span style={{ ...S.pendingText, color: "#DC2626" }}>Priority review request is under review</span>
        </div>
      )}

      {isConfirmed && (
        <div
          style={{
            ...S.footerShell,
            borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)",
          }}
        >
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
            <Download size={13.5} />
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
              e.currentTarget.style.color = isDark ? "#93C5FD" : "#1D4ED8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isDark ? "#C8D3E4" : S.subtleLink.color;
            }}
          >
            View full reservation {"\u2192"}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value, subValue, mono, color, isDark }) {
  return (
    <div
      style={{
        ...S.detailRow,
        background: isDark ? "rgba(255, 255, 255, 0.03)" : "var(--surface-card, #FFFFFF)",
        borderColor: isDark ? "var(--border-card, #2A3B57)" : "var(--border-card, #E2E8F0)",
      }}
    >
      <div style={S.detailLeft}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </span>
        <span
          style={{
            ...S.detailLabel,
            color: isDark ? "#94A3B8" : "var(--text-secondary, #64748B)",
          }}
        >
          {label}
        </span>
      </div>
      <div style={S.detailRight}>
        <span
          style={{
            ...S.detailValue,
            color: color || (isDark ? "#F8FAFC" : "var(--text-heading, #0F172A)"),
            ...(mono ? S.mono : {}),
          }}
        >
          {value}
        </span>
        {subValue && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: isDark ? "#34D399" : "#059669",
              lineHeight: 1.15,
              marginTop: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={S.emptyCard}>
      <div style={S.emptyIconWrap}>
        <Ticket size={22} strokeWidth={1.6} color="var(--text-muted, #CBD5E1)" />
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
    transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
    cursor: "default",
  },

  headerShell: {
    padding: "14px 16px 12px",
    borderBottom: "1px solid var(--border-card, #E2E8F0)",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusChip: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: 999,
  },

  roomSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  roomIconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "transparent",
  },
  roomInfo: {
    minWidth: 0,
  },
  roomName: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text-heading, #0F172A)",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    margin: 0,
    marginBottom: 2,
  },
  roomBranch: {
    fontSize: 12.5,
    color: "var(--text-secondary, #64748B)",
    display: "flex",
    alignItems: "center",
    textTransform: "capitalize",
  },

  detailsShell: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 12px",
    background: "var(--surface-card, #FFFFFF)",
  },
  detailRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 35,
    borderRadius: 8,
    border: "1px solid var(--border-card, #E2E8F0)",
    background: "var(--surface-card, #FFFFFF)",
    padding: "6px 10px",
  },
  detailLeft: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    flexShrink: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: "var(--text-secondary, #64748B)",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  detailRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 0,
    flexShrink: 0,
    textAlign: "right",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-heading, #0F172A)",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    letterSpacing: "0.03em",
    fontSize: 12,
  },

  pendingBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface-card, #FFFFFF)",
    border: "1px solid var(--border-card, #E2E8F0)",
    borderRadius: 8,
    padding: "8px 10px",
    margin: "0 12px 10px",
  },
  pendingText: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-secondary, #475569)",
  },

  footerShell: {
    borderTop: "1px solid var(--border-card, #E2E8F0)",
    padding: "12px 12px 14px",
  },
  downloadBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "9px 12px",
    background: "var(--text-heading, #0F172A)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  subtleLink: {
    background: "none",
    border: "none",
    color: "var(--text-secondary, #64748B)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: "6px 0 0",
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
    borderRadius: 16,
    padding: "32px 20px",
    background: "var(--surface-card, #FFFFFF)",
    height: "auto",
    boxSizing: "border-box",
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "var(--surface-card, #FFFFFF)",
    border: "1px solid var(--border-card, #E2E8F0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 12.5,
    color: "var(--text-secondary, #94A3B8)",
    lineHeight: 1.5,
    margin: 0,
    maxWidth: 210,
  },
};
