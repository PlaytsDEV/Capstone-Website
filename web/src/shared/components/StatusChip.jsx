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
  overdue:          { label: "Overdue",        bg: "#FEF2F2", color: "#DC2626" },
  pending:          { label: "Pending",        bg: "#FFFBEB", color: "#D97706" },
  paid:             { label: "Paid",           bg: "#F0FDF4", color: "#059669" },
  "partially-paid": { label: "Partial",        bg: "#EFF6FF", color: "#2563EB" },

  // ── Payment statuses ───────────────────────────────────────
  partial:          { label: "Partial",        bg: "#EFF6FF", color: "#2563EB" },

  // ── Reservation statuses ───────────────────────────────────
  viewing_preference_selected: { label: "Viewing Preference Selected", bg: "#EFF6FF", color: "#2563EB" },
  visit_pending:    { label: "Visit Pending",  bg: "#FFFBEB", color: "#D97706" },
  visit_approved:   { label: "Legacy Visit Approved", bg: "#EFF6FF", color: "#2563EB" },
  pending_application_review: { label: "Pending Review", bg: "#FFFBEB", color: "#D97706" },
  needs_revision:   { label: "Needs Revision", bg: "#FFF7ED", color: "#EA580C" },
  approved_for_payment: { label: "Approved for Payment", bg: "#ECFEFF", color: "#0F766E" },
  payment_pending:  { label: "Payment Due",    bg: "#FFFBEB", color: "#D97706" },
  reserved:         { label: "Reserved",       bg: "#F0FDF4", color: "#059669" },
  moveIn:           { label: "Moved In",       bg: "#ECFDF5", color: "#047857" },
  moveOut:          { label: "Moved Out",      bg: "#F3F4F6", color: "#6B7280" },
  cancelled:        { label: "Cancelled",      bg: "#FEF2F2", color: "#DC2626" },
  expired:          { label: "Expired",        bg: "#F3F4F6", color: "#9CA3AF" },
  noShow:           { label: "No Show",        bg: "#FEF2F2", color: "#DC2626" },
};

const FALLBACK = { label: "Unknown", bg: "#F3F4F6", color: "#6B7280" };

export default function StatusChip({ status, size = "sm", variant = "badge" }) {
  const cfg = STATUS_MAP[status] || FALLBACK;

  if (variant === "text") {
    return (
      <span
        style={{
          fontSize: size === "sm" ? 13 : 14,
          fontWeight: 600,
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
        gap: 5,
        padding: size === "sm" ? "3px 9px" : "5px 12px",
        borderRadius: 20,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        backgroundColor: cfg.bg,
        color: cfg.color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
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
