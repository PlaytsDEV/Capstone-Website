import dayjs from "dayjs";

/**
 * ============================================================================
 * MAINTENANCE ESCALATION, SLA & VENDOR COST SERVICE (Scenario 5)
 * ============================================================================
 * Handles SLA timeout auto-escalations, duplicate ticket collision guards,
 * tenant-caused damage billing recovery, ticket state machine validation, and
 * off-hours emergency keyword detection.
 */

export const SLA_HOURS = {
  emergency: 6,
  urgent: 24,
  high: 48,
  medium: 72,
  low: 120,
};

export const CRITICAL_EMERGENCY_KEYWORDS = [
  "pipe burst",
  "water leak",
  "electrical fire",
  "power outage",
  "gas leak",
  "lockout",
  "flooding",
  "broken lock",
  "sparking",
];

/**
 * Evaluates maintenance ticket SLA timeout and calculates escalation status.
 */
export function evaluateMaintenanceSLAEscalation(ticket = {}, referenceDate = new Date()) {
  const status = String(ticket.status || "submitted").toLowerCase();
  const priority = String(ticket.priority || "medium").toLowerCase();
  const createdAt = ticket.createdAt ? dayjs(ticket.createdAt) : dayjs(referenceDate);

  if (["resolved", "closed", "tenant_verified", "cancelled"].includes(status)) {
    return {
      isEscalated: false,
      currentPriority: priority,
      effectivePriority: priority,
      hoursOverdue: 0,
      slaStatus: "completed",
    };
  }

  const slaLimitHours = SLA_HOURS[priority] || SLA_HOURS.medium;
  const elapsedHours = dayjs(referenceDate).diff(createdAt, "hour", true);
  const hoursOverdue = Math.max(0, Math.round((elapsedHours - slaLimitHours) * 10) / 10);

  if (hoursOverdue <= 0) {
    return {
      isEscalated: false,
      currentPriority: priority,
      effectivePriority: priority,
      hoursOverdue: 0,
      slaStatus: "healthy",
      hoursRemaining: Math.round((slaLimitHours - elapsedHours) * 10) / 10,
    };
  }

  // Determine escalated priority tier
  let effectivePriority = priority;
  if (priority === "urgent" || priority === "high") {
    effectivePriority = "emergency";
  } else if (priority === "medium") {
    effectivePriority = "high";
  } else if (priority === "low") {
    effectivePriority = "medium";
  }

  return {
    isEscalated: true,
    currentPriority: priority,
    effectivePriority,
    hoursOverdue,
    slaStatus: "overdue",
    warning: `SLA timeout exceeded by ${hoursOverdue} hours. Ticket escalated from '${priority}' to '${effectivePriority}'.`,
  };
}

/**
 * Detects duplicate maintenance requests for the same room & asset category within a time window.
 */
export function detectDuplicateMaintenanceRequest(
  existingTickets = [],
  newRequest = {},
  windowHours = 12
) {
  const newRoomId = String(newRequest.roomId || "");
  const newCategory = String(newRequest.category || "").toLowerCase();
  const newTime = newRequest.createdAt ? dayjs(newRequest.createdAt) : dayjs();

  if (!newRoomId || !newCategory) {
    return { isDuplicate: false, masterTicketId: null };
  }

  const duplicate = existingTickets.find((t) => {
    const isSameRoom = String(t.roomId || "") === newRoomId;
    const isSameCategory = String(t.category || "").toLowerCase() === newCategory;
    const isOpen = !["closed", "resolved", "cancelled", "tenant_verified"].includes(
      String(t.status || "").toLowerCase()
    );
    const tTime = dayjs(t.createdAt);
    const diffHours = Math.abs(newTime.diff(tTime, "hour", true));

    return isSameRoom && isSameCategory && isOpen && diffHours <= windowHours;
  });

  if (duplicate) {
    return {
      isDuplicate: true,
      masterTicketId: duplicate._id || duplicate.id,
      message: `Duplicate maintenance request detected for room category '${newCategory}'. Consolidated under master ticket #${duplicate._id || duplicate.id}.`,
    };
  }

  return { isDuplicate: false, masterTicketId: null };
}

/**
 * Formats maintenance damage billing charge payload for tenant-caused damage recovery.
 */
export function processMaintenanceDamageBilling({
  ticketId,
  tenantId,
  reservationId,
  damageCost = 0,
  description = "Maintenance repair",
} = {}) {
  const amount = Math.max(0, Number(damageCost || 0));

  if (amount <= 0) {
    throw new Error("Maintenance damage cost must be a positive number.");
  }

  return {
    success: true,
    billingCharge: {
      type: "maintenance_damage",
      ticketId,
      tenantId,
      reservationId,
      amount,
      description: `Maintenance Damage Charge: ${description}`,
      issuedAt: new Date(),
      status: "pending",
    },
  };
}

/**
 * Validates maintenance ticket state machine transitions.
 */
export function validateMaintenanceStateTransition(
  currentStatus = "submitted",
  targetStatus,
  { verificationWindowHours = 72, resolvedAt = null } = {}
) {
  const STATUS_ALIAS = {
    pending: "submitted",
    completed: "tenant_verified",
    closed: "tenant_verified",
  };

  const rawCurrent = String(currentStatus || "submitted").toLowerCase();
  const rawTarget = String(targetStatus || "").toLowerCase();

  const current = STATUS_ALIAS[rawCurrent] || rawCurrent;
  const target = STATUS_ALIAS[rawTarget] || rawTarget;

  const VALID_TRANSITIONS = {
    submitted: ["in_progress", "cancelled", "resolved"],
    in_progress: ["resolved", "submitted", "cancelled"],
    resolved: ["tenant_verified", "reopened", "in_progress"],
    reopened: ["in_progress", "resolved"],
    tenant_verified: [],
    cancelled: [],
  };

  const allowed = VALID_TRANSITIONS[current] || [];

  if (!allowed.includes(target)) {
    return {
      valid: false,
      error: `Cannot transition maintenance request status from '${rawCurrent}' to '${rawTarget}'. Allowed target statuses: [${allowed.map((s) => (s === "tenant_verified" ? "completed / tenant_verified" : s)).join(", ")}]`,
    };
  }

  // Re-opening window check (if tenant re-opens resolved ticket past 72h window)
  if (current === "resolved" && target === "reopened" && resolvedAt) {
    const elapsedHours = dayjs().diff(dayjs(resolvedAt), "hour", true);
    if (elapsedHours > verificationWindowHours) {
      return {
        valid: false,
        error: `Cannot reopen resolved ticket: the ${verificationWindowHours}-hour verification window has expired (${Math.round(elapsedHours)}h elapsed).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Evaluates whether a resolved maintenance ticket has exceeded the tenant verification window
 * and qualifies for automatic resolution closure (7-day / 168h timeout fallback).
 */
export function evaluateAutoResolution(
  ticket = {},
  referenceDate = new Date(),
  timeoutHours = 168
) {
  const status = String(ticket.status || "").toLowerCase();
  if (status !== "resolved") {
    return { shouldAutoResolve: false, hoursElapsed: 0, hoursRemaining: 0 };
  }

  const resolvedAt = ticket.resolved_at || ticket.resolvedAt || ticket.updated_at || ticket.updatedAt || ticket.created_at || ticket.createdAt;
  if (!resolvedAt) {
    return { shouldAutoResolve: false, hoursElapsed: 0, hoursRemaining: 0 };
  }

  const elapsedHours = dayjs(referenceDate).diff(dayjs(resolvedAt), "hour", true);
  const hoursRemaining = Math.max(0, Math.round((timeoutHours - elapsedHours) * 10) / 10);

  if (elapsedHours >= timeoutHours) {
    return {
      shouldAutoResolve: true,
      hoursElapsed: Math.round(elapsedHours * 10) / 10,
      hoursRemaining: 0,
      reason: `Auto-completed after exceeding the ${timeoutHours}-hour (7 days) resolution observation window.`,
      targetStatus: "completed",
    };
  }

  return {
    shouldAutoResolve: false,
    hoursElapsed: Math.round(elapsedHours * 10) / 10,
    hoursRemaining,
    reason: `Pending resolution observation (${hoursRemaining}h remaining in 7-day auto-complete window).`,
  };
}

/**
 * Evaluates emergency keywords and off-hours submission triggers.
 */
export function evaluateEmergencyKeywords({
  title = "",
  description = "",
  createdAt = new Date(),
} = {}) {
  const text = `${title} ${description}`.toLowerCase();
  const matchedKeywords = CRITICAL_EMERGENCY_KEYWORDS.filter((kw) => text.includes(kw));

  const created = dayjs(createdAt);
  const hour = created.hour();
  const isOffHours = hour >= 22 || hour < 6; // 10 PM - 6 AM

  const isEmergency = matchedKeywords.length > 0 || (isOffHours && matchedKeywords.length > 0);

  return {
    isEmergency,
    matchedKeywords,
    isOffHours,
    recommendedPriority: isEmergency ? "emergency" : "medium",
    message: isEmergency
      ? `Critical emergency triggered by keywords: [${matchedKeywords.join(", ")}]${isOffHours ? " during off-hours" : ""}`
      : "Standard maintenance triage",
  };
}
