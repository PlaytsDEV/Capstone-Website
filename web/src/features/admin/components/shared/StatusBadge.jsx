/**
 * StatusBadge — Consistent status chip with dot + label.
 *
 * Predefined statuses:
 * active, moveIn, confirmed, pending, overdue, cancelled,
 * paid, partial, rejected, suspended, banned, maintenance, new
 */
import "./StatusBadge.css";

export default function StatusBadge({ status, label: customLabel }) {
  const getStatusVariant = (s) => {
    const successStatuses = ["month", "moveIn", "approved", "approved_for_payment", "completed", "resolved", "active", "paid", "confirmed"];
    const warningStatuses = ["pending", "viewing_preference_selected", "visit_pending", "pending_application_review", "payment_pending", "partial", "aced-pending", "missed", "cancellation_requested"];
    const errorStatuses = ["cancelled", "rejected", "needs_revision", "overdue", "no-show", "banned", "suspended"];
    const infoStatuses = ["reserved", "visit_approved", "responded", "new"];

    if (successStatuses.includes(s)) return "success";
    if (warningStatuses.includes(s)) return "warning";
    if (errorStatuses.includes(s)) return "error";
    if (infoStatuses.includes(s)) return "info";
    return "neutral";
  };

  const getLabel = (s) => {
    if (customLabel) return customLabel;
    if (s === "aced-pending") return "Aced Pending";
    if (s === "no-show") return "No Show";
    if (s === "month" || s === "moveIn") return "Move In";
    if (s === "viewing_preference_selected") return "Viewing Preference Selected";
    if (s === "visit_pending") return "Visit Pending";
    if (s === "cancellation_requested") return "Cancellation Requested";
    if (s === "visit_approved") return "Visit Approved";
    if (s === "pending_application_review") return "Pending Review";
    if (s === "needs_revision") return "Needs Revision";
    if (s === "approved_for_payment") return "Approved for Payment";
    if (!s) return "Pending";
    
    // Convert to proper case: capitalize each word
    return s
      .replace(/_/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const variant = getStatusVariant(status);
  const displayLabel = getLabel(status);

  return (
    <span className={`status-badge status-badge--${variant}`}>
      {displayLabel}
    </span>
  );
}
