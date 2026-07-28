import React from "react";
import { Calendar, AlertTriangle, Clock, Info, ShieldAlert } from "lucide-react";

/**
 * Format date nicely to Month DD, YYYY
 */
function formatDate(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * DeadlineBadge — Renders upcoming deadlines or past due date badges,
 * along with clear overdue policy consequence notes.
 *
 * @param {Object} props
 * @param {string|Date} props.dueDate - Target deadline timestamp
 * @param {string} [props.status] - Raw status ("pending" | "overdue" | "paid" | "partially-paid" etc)
 * @param {"bill"|"reservation"} [props.type] - Context type (default "bill")
 * @param {boolean} [props.showConsequenceNote] - If true, renders the detailed overdue consequence banner
 * @param {number} [props.penaltyRate] - Daily late penalty amount (default 50)
 * @param {string} [props.className] - Additional CSS class overrides
 */
export default function DeadlineBadge({
  dueDate,
  status = "pending",
  type = "bill",
  showConsequenceNote = false,
  penaltyRate = 50,
  className = "",
}) {
  if (!dueDate) return null;

  const targetDate = new Date(dueDate);
  if (Number.isNaN(targetDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(targetDate);
  checkDate.setHours(0, 0, 0, 0);

  const diffMs = checkDate.getTime() - today.getTime();
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const isPaid = status === "paid";
  const isOverdue = status === "overdue" || (!isPaid && daysDiff < 0);

  const formattedDate = formatDate(dueDate);

  // Badge Text & Styles
  let labelText = "";
  let badgeStyle = {
    bg: "var(--surface-subtle, #f8fafc)",
    color: "var(--text-secondary, #475569)",
    border: "var(--border-card, #e2e8f0)",
  };

  if (isPaid) {
    labelText = `Paid (Due was ${formattedDate})`;
    badgeStyle = {
      bg: "#f0fdf4",
      color: "#166534",
      border: "#bbf7d0",
    };
  } else if (isOverdue) {
    const daysLate = Math.abs(daysDiff);
    labelText = `Was Due: ${formattedDate} (${daysLate} day${daysLate === 1 ? "" : "s"} overdue)`;
    badgeStyle = {
      bg: "#fef2f2",
      color: "#991b1b",
      border: "#fecaca",
    };
  } else if (daysDiff === 0) {
    labelText = `Due Today! (${formattedDate})`;
    badgeStyle = {
      bg: "#fffbeba0",
      color: "#92400e",
      border: "#fde68a",
    };
  } else if (daysDiff === 1) {
    labelText = `Due Tomorrow (${formattedDate})`;
    badgeStyle = {
      bg: "#fffbeba0",
      color: "#92400e",
      border: "#fde68a",
    };
  } else {
    labelText = `Due: ${formattedDate} (in ${daysDiff} days)`;
    badgeStyle = {
      bg: "#eff6ff",
      color: "#1e40af",
      border: "#bfdbfe",
    };
  }

  return (
    <div className={`deadline-badge-container ${className}`} style={{ display: "inline-flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: badgeStyle.bg,
          color: badgeStyle.color,
          border: `1px solid ${badgeStyle.border}`,
          width: "fit-content",
        }}
      >
        {isOverdue ? (
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        ) : daysDiff <= 1 && !isPaid ? (
          <Clock size={14} style={{ flexShrink: 0 }} />
        ) : (
          <Calendar size={14} style={{ flexShrink: 0 }} />
        )}
        <span>{labelText}</span>
      </div>

      {showConsequenceNote && !isPaid && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: "1.5",
            backgroundColor: isOverdue ? "#fef2f2" : "#f8fafc",
            border: `1px solid ${isOverdue ? "#fecaca" : "#e2e8f0"}`,
            color: isOverdue ? "#991b1b" : "#334155",
            marginTop: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4, color: isOverdue ? "#991b1b" : "#1e293b" }}>
            {isOverdue ? (
              <>
                <ShieldAlert size={15} color="#dc2626" />
                <span>What happens after overdue? (Policy Consequence Note)</span>
              </>
            ) : (
              <>
                <Info size={15} color="#2563eb" />
                <span>Upcoming Deadline Policy</span>
              </>
            )}
          </div>
          {isOverdue ? (
            type === "bill" ? (
              <span>
                This statement is past due. A daily late payment penalty rate of <strong>₱{penaltyRate}/day</strong> is automatically accrued on overdue balances until paid in full. Continued non-payment will result in automated payment reminders, potential utility service restrictions, and dormitory administrative review.
              </span>
            ) : (
              <span>
                This reservation deposit payment is past due. Failure to settle the balance within the grace period will result in automatic reservation cancellation and forfeiture of your allocated bed slot.
              </span>
            )
          ) : (
            type === "bill" ? (
              <span>
                Please ensure full payment is settled on or before <strong>{formattedDate}</strong> to maintain your active account status and avoid daily late penalties (₱{penaltyRate}/day).
              </span>
            ) : (
              <span>
                Please complete deposit payment on or before <strong>{formattedDate}</strong> to lock in your reservation slot.
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
