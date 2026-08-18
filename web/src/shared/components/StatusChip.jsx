/**
 * StatusChip — Centralized status badge component.
 *
 * Covers reservation statuses, payment statuses, and billing statuses
 * so every part of the app renders the same colors and labels.
 *
 * Props:
 *  status  (string)  — raw status value from the API
 *  size    ("sm"|"md") — badge size (default "sm")
 *  variant ("badge"|"text") — pill badge or plain colored text (default "badge")
 */

const STATUS_MAP = {
  // ── Bill statuses ──────────────────────────────────────────
  overdue:          { label: "Overdue",        bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  pending:          { label: "Pending",        bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  paid:             { label: "Paid",           bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  "partially-paid": { label: "Partial",        bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },

  // ── Payment statuses ───────────────────────────────────────
  partial:          { label: "Partial",        bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  settled:          { label: "Settled",        bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },

  // ── Reservation statuses ───────────────────────────────────
  viewing_preference_selected: { label: "Viewing Preference Selected", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  visit_pending:    { label: "Visit Pending",  bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  visit_approved:   { label: "Visit Confirmed", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  schedule_approved:{ label: "Schedule Approved", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  pending_application_review: { label: "Pending Review", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  needs_revision:   { label: "Needs Revision", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  approved_for_payment: { label: "Approved for Payment", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  payment_pending:  { label: "Payment Due",    bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  reserved:         { label: "Reserved",       bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  moveIn:           { label: "Move In",        bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  movein:           { label: "Move In",        bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  moveOut:          { label: "Moved Out",      bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  moveout:          { label: "Moved Out",      bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  cancelled:        { label: "Cancelled",      bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  rejected:         { label: "Rejected",       bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  expired:          { label: "Expired",        bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  noShow:           { label: "No Show",        bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "no-show":        { label: "No Show",        bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  archived:         { label: "Archived",       bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
};

const FALLBACK = { label: "Unknown", bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" };

export default function StatusChip({ status, size = "sm", variant = "badge" }) {
  const cfg = STATUS_MAP[status] || FALLBACK;

  if (variant === "text") {
    return (
      <span
        style={{
          fontSize: size === "sm" ? 12 : 13,
          fontWeight: 700,
          color: cfg.color,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {cfg.label}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: size === "sm" ? "2px 7.5px" : "3px 9px",
        borderRadius: 9999,
        fontSize: size === "sm" ? 10 : 11,
        fontWeight: 700,
        lineHeight: 1.35,
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border || "transparent"}`,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.color,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
