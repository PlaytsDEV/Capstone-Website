export const CANONICAL_RESERVATION_STATUSES = Object.freeze([
  "pending",
  "viewing_preference_selected",
  "visit_pending",
  "visit_approved",
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
  "rejected",
  "cancelled",
  "archived",
]);

export const ALLOWED_RESERVATION_STATUS_TRANSITIONS = Object.freeze({
  pending: [
    "viewing_preference_selected",
    "pending_application_review",
    "visit_pending",
    "visit_approved",
    "cancelled",
    "archived",
  ],
  viewing_preference_selected: [
    "visit_pending",
    "pending_application_review",
    "cancelled",
    "archived",
  ],
  visit_pending: [
    "visit_approved",
    "pending_application_review",
    "cancelled",
    "archived",
  ],
  visit_approved: [
    "visit_pending",
    "pending_application_review",
    "approved_for_payment",
    "payment_pending",
    "cancelled",
    "archived",
  ],
  pending_application_review: [
    "needs_revision",
    "approved_for_payment",
    "rejected",
    "cancelled",
    "archived",
  ],
  needs_revision: [
    "pending_application_review",
    "approved_for_payment",
    "rejected",
    "cancelled",
    "archived",
  ],
  approved_for_payment: ["payment_pending", "reserved", "cancelled", "archived"],
  payment_pending: ["reserved", "cancelled", "archived"],
  reserved: ["moveIn", "cancelled", "archived"],
  moveIn: ["moveOut", "archived"],
  moveOut: ["archived"],
  rejected: ["archived"],
  cancelled: ["archived"],
  archived: [],
});

export const RESERVATION_STATUS_LABELS = Object.freeze({
  pending: "Room Selected",
  viewing_preference_selected: "Viewing Preference Selected",
  visit_pending: "Visit Pending",
  visit_approved: "Visit Confirmed",
  pending_application_review: "Pending Application Review",
  needs_revision: "Needs Revision",
  approved_for_payment: "Approved for Payment",
  payment_pending: "Payment Pending",
  reserved: "Reserved",
  moveIn: "Move In",
  moveOut: "Moved Out",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
});

export const RESERVATION_STATUS_APPEARANCE = Object.freeze({
  pending: {
    label: RESERVATION_STATUS_LABELS.pending,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  viewing_preference_selected: {
    label: RESERVATION_STATUS_LABELS.viewing_preference_selected,
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    dot: "#3b82f6",
  },
  visit_pending: {
    label: RESERVATION_STATUS_LABELS.visit_pending,
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    dot: "#3b82f6",
  },
  visit_approved: {
    label: RESERVATION_STATUS_LABELS.visit_approved,
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    dot: "#3b82f6",
  },
  pending_application_review: {
    label: RESERVATION_STATUS_LABELS.pending_application_review,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  needs_revision: {
    label: RESERVATION_STATUS_LABELS.needs_revision,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  approved_for_payment: {
    label: RESERVATION_STATUS_LABELS.approved_for_payment,
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    dot: "#10b981",
  },
  payment_pending: {
    label: RESERVATION_STATUS_LABELS.payment_pending,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  reserved: {
    label: RESERVATION_STATUS_LABELS.reserved,
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    dot: "#10b981",
  },
  moveIn: {
    label: RESERVATION_STATUS_LABELS.moveIn,
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    dot: "#10b981",
  },
  moveOut: {
    label: RESERVATION_STATUS_LABELS.moveOut,
    color: "#64748b",
    bg: "#f8fafc",
    border: "#e2e8f0",
    dot: "#94a3b8",
  },
  rejected: {
    label: RESERVATION_STATUS_LABELS.rejected,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
  },
  cancelled: {
    label: RESERVATION_STATUS_LABELS.cancelled,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
  },
  archived: {
    label: RESERVATION_STATUS_LABELS.archived,
    color: "#475569",
    bg: "#f8fafc",
    border: "#e2e8f0",
    dot: "#94a3b8",
  },
});

export const RESERVATION_STAGE_MAP = Object.freeze({
  pending: { step: 1, total: 5, label: "Room Selected" },
  viewing_preference_selected: {
    step: 2,
    total: 5,
    label: "Viewing Preference Selected",
  },
  visit_pending: { step: 2, total: 5, label: "Visit Scheduled" },
  visit_approved: { step: 3, total: 5, label: "Visit Approved" },
  pending_application_review: {
    step: 3,
    total: 5,
    label: "Pending Application Review",
  },
  needs_revision: { step: 3, total: 5, label: "Needs Revision" },
  approved_for_payment: { step: 4, total: 5, label: "Approved for Payment" },
  payment_pending: { step: 4, total: 5, label: "Payment Pending" },
  reserved: { step: 5, total: 5, label: "Confirmed" },
  moveIn: { step: 6, total: 6, label: "Move In" },
  moveOut: { step: 6, total: 6, label: "Completed" },
  rejected: { step: 0, label: "Rejected" },
  cancelled: { step: 0, label: "Cancelled" },
  archived: { step: 0, label: "Archived" },
});

export const RESERVATION_STAGE_GUIDANCE = Object.freeze({
  pending:
    "Waiting for the tenant to confirm a room and select a viewing preference.",
  viewing_preference_selected:
    "Viewing preference selected. Waiting for the tenant to submit the application and documents.",
  visit_pending:
    "Visit scheduled and auto-confirmed. Waiting for the applicant to attend.",
  visit_approved:
    "Visit confirmed. Waiting for the tenant to complete the application.",
  pending_application_review:
    "Application and documents submitted. Payment stays locked until admin review is complete.",
  needs_revision:
    "Application needs corrections. Payment remains locked until the tenant resubmits and admin approves it.",
  approved_for_payment:
    "Application approved. The applicant can now proceed to reservation payment.",
  payment_pending:
    "Payment started and waiting for settlement confirmation from the payment gateway.",
});

export const ADMIN_RESERVATION_ACTIONS_BY_STATUS = Object.freeze({
  pending: ["cancelled"],
  viewing_preference_selected: ["cancelled"],
  visit_pending: ["cancelled"],
  visit_approved: ["cancelled"],
  pending_application_review: [
    "approve_for_payment",
    "needs_revision",
    "rejected",
    "cancelled",
  ],
  needs_revision: ["approve_for_payment", "rejected", "cancelled"],
  approved_for_payment: ["cancelled"],
  payment_pending: ["cancelled"],
  reserved: ["moveIn", "cancelled", "extend"],
  moveIn: ["moveOut"],
  moveOut: [],
  rejected: [],
  cancelled: [],
  archived: [],
});

const LEGACY_RESERVATION_STATUS_MAP = Object.freeze({});
const LEGACY_UTILITY_EVENT_TYPE_MAP = Object.freeze({});

export const normalizeReservationStatus = (status) => {
  if (status == null) return null;
  const value = String(status).trim();
  return LEGACY_RESERVATION_STATUS_MAP[value] || value;
};

export const normalizeUtilityEventType = (eventType) => {
  if (eventType == null) return null;
  const value = String(eventType).trim();
  return LEGACY_UTILITY_EVENT_TYPE_MAP[value] || value;
};

export const hasReservationStatus = (status, ...expectedStatuses) => {
  const normalizedStatus = normalizeReservationStatus(status);
  return expectedStatuses
    .flat()
    .map((entry) => normalizeReservationStatus(entry))
    .filter(Boolean)
    .includes(normalizedStatus);
};

export const isReservationTransitionAllowed = (currentStatus, nextStatus) => {
  const current = normalizeReservationStatus(currentStatus);
  const next = normalizeReservationStatus(nextStatus);

  if (!current || !next) return false;
  if (current === next) return true;

  return (ALLOWED_RESERVATION_STATUS_TRANSITIONS[current] || []).includes(next);
};

export const isUtilityEventType = (eventType, expectedEventType) =>
  normalizeUtilityEventType(eventType) ===
  normalizeUtilityEventType(expectedEventType);

export const readMoveInDate = (value) =>
  value?.confirmedMoveInDate ??
  value?.moveInDate ??
  value?.intendedMoveInDate ??
  value?.targetMoveInDate ??
  null;

export const readMoveOutDate = (value) => value?.moveOutDate ?? null;

export const getReservationStatusLabel = (status) => {
  const normalized = normalizeReservationStatus(status);
  if (!normalized) return "Unknown";

  if (RESERVATION_STATUS_LABELS[normalized]) {
    return RESERVATION_STATUS_LABELS[normalized];
  }

  return String(normalized)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getReservationStatusAppearance = (status) =>
  RESERVATION_STATUS_APPEARANCE[normalizeReservationStatus(status)] ||
  RESERVATION_STATUS_APPEARANCE.pending;

export const getAllowedReservationActions = (status) =>
  ADMIN_RESERVATION_ACTIONS_BY_STATUS[normalizeReservationStatus(status)] || [];

export const canReservationAccessPayment = (status) =>
  hasReservationStatus(status, "approved_for_payment", "payment_pending");

const normalizeLifecycleObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = normalizeLifecyclePayload(entry);
  }

  if ("status" in result || "reservationStatus" in result) {
    const status = normalizeReservationStatus(
      result.status ?? result.reservationStatus,
    );
    if (status) {
      result.status = status;
      result.reservationStatus = status;
    }
  }

  if ("moveInDate" in result || "checkInDate" in result) {
    const moveInDate = readMoveInDate(result);
    result.moveInDate = moveInDate;
    delete result.checkInDate;
  }

  if ("moveOutDate" in result || "checkOutDate" in result) {
    const moveOutDate = readMoveOutDate(result);
    result.moveOutDate = moveOutDate;
    delete result.checkOutDate;
  }

  if ("eventType" in result) {
    result.eventType = normalizeUtilityEventType(result.eventType);
  }
  if ("startEventType" in result) {
    result.startEventType = normalizeUtilityEventType(result.startEventType);
  }
  if ("endEventType" in result) {
    result.endEventType = normalizeUtilityEventType(result.endEventType);
  }

  return result;
};

export const normalizeLifecyclePayload = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLifecyclePayload(entry));
  }

  return normalizeLifecycleObject(value);
};
