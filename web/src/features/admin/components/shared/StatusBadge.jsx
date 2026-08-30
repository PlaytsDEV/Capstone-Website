/**
 * StatusBadge — Consistent status chip with dot + label.
 *
 * Predefined statuses:
 * active, moveIn, confirmed, pending, overdue, cancelled,
 * paid, partial, rejected, suspended, banned, maintenance, new
 */
import "./StatusBadge.css";
import { getStageFractionInfo } from "../../../../shared/utils/stageUtils.js";

export default function StatusBadge({
  status,
  label: customLabel,
  module = null,
  showStage = false,
  className = "",
}) {
  const getStatusVariant = (s) => {
    const norm = String(s || "").trim().toLowerCase();
    const successStatuses = [
      "month",
      "movein",
      "move_in",
      "moved_in",
      "approved",
      "schedule_approved",
      "visit_approved",
      "approved_for_payment",
      "completed",
      "resolved",
      "active",
      "published",
      "paid",
      "confirmed",
      "settled",
      "cleared",
      "occupied",
      "healthy",
      "new",
      "new_inquiry",
      "reserved",
      "ready_for_move_in",
      "in_progress",
      "scheduled",
      "provider_assigned",
      "waiting_tenant",
    ];
    const warningStatuses = [
      "pending",
      "visit_pending",
      "pending_application_review",
      "payment_pending",
      "partial",
      "aced-pending",
      "missed",
      "cancellation_requested",
      "disputed",
      "manual_review_required",
      "expired_occupancy_continuing",
      "notice_1",
      "notice_2",
      "pending_clearance",
      "needs_revision",
      "expiring_soon",
      "review_required",
      "under_review",
      "pending_approval",
      "awaiting_signatures",
      "partially_signed",
      "awaiting_notarization",
    ];
    const errorStatuses = [
      "rejected",
      "overdue",
      "no-show",
      "no_show",
      "noshow",
      "banned",
      "suspended",
      "notice_3",
      "terminated",
      "failed",
      "violation",
      "expired",
    ];
    const infoStatuses = [
      "viewing_preference_selected",
      "responded",
      "former_tenant",
      "inquiry",
      "info",
      "information",
      "ready_for_generation",
      "generated",
      "prepared",
      "ready_for_publication",
      "provider_assigned",
      "rolling",
    ];
    const neutralStatuses = [
      "cancelled",
      "canceled",
      "closed",
      "archived",
      "draft",
      "inactive",
      "vacant",
      "maint",
      "maintenance",
      "moved_out",
      "moveout",
      "move_out",
    ];

    if (successStatuses.includes(norm)) return "success";
    if (warningStatuses.includes(norm)) return "warning";
    if (errorStatuses.includes(norm)) return "error";
    if (infoStatuses.includes(norm)) return "info";
    if (neutralStatuses.includes(norm)) return "neutral";
    return "neutral";
  };

  const getBaseLabel = (s) => {
    if (customLabel) return customLabel;
    const norm = String(s || "").trim().toLowerCase();
    if (s === "aced-pending") return "Aced Pending";
    if (norm === "no-show" || norm === "no_show" || norm === "noshow") return "No Show";
    if (norm === "month" || norm === "movein" || norm === "move_in" || norm === "moved_in") return "Move In";
    if (norm === "moveout" || norm === "move_out" || norm === "moved_out") return "Moved Out";
    if (norm === "viewing_preference_selected") return "Viewing Preference Selected";
    if (norm === "visit_pending") return "Visit Pending";
    if (norm === "cancellation_requested") return "Cancellation Requested";
    if (norm === "visit_approved") return "Visit Confirmed";
    if (norm === "pending_application_review") return "Pending Application Review";
    if (norm === "needs_revision") return "Needs Revision";
    if (norm === "approved_for_payment") return "Approved for Payment";
    if (norm === "reserved") return "Reserved";
    if (norm === "ready_for_move_in") return "Ready for Move-In";
    if (norm === "partial") return "Proof Submitted";
    if (norm === "disputed") return "Disputed (Fees Paused)";
    if (norm === "manual_review_required") return "Manual Review Required";
    if (norm === "expired_occupancy_continuing") return "Expired Occupancy";
    if (norm === "rolling") return "Rolling Month-to-Month";
    if (norm === "former_tenant") return "Former Tenant";
    if (norm === "notice_1") return "Overdue Notice 1";
    if (norm === "notice_2") return "Overdue Notice 2";
    if (norm === "notice_3") return "Final Notice (3)";
    if (norm === "vacant") return "Vacant";
    if (norm === "occupied") return "Occupied";
    if (norm === "maint" || norm === "maintenance") return "Maint";
    if (!s) return "Pending";

    // Convert to proper case: capitalize each word
    return String(s)
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  let displayLabel = getBaseLabel(status);

  // If a module is specified or showStage is enabled, apply fractional stage formatting
  if (module || showStage) {
    const targetModule = module || "reservation";
    const stageInfo = getStageFractionInfo(targetModule, status, customLabel);
    if (stageInfo.formattedLabel) {
      displayLabel = stageInfo.formattedLabel;
    }
  }

  const variant = getStatusVariant(status);

  return (
    <span className={`status-badge status-badge--${variant} ${className}`.trim()}>
      <span className="status-badge__dot" />
      {displayLabel}
    </span>
  );
}

