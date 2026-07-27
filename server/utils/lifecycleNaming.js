export const USER_ROLE_NAMES = Object.freeze([
  "applicant",
  "tenant",
  "branch_admin",
  "owner",
]);

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

export const LEGACY_RESERVATION_STATUS_MAP = Object.freeze({});

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
  approved_for_payment: [
    "needs_revision",
    "pending_application_review",
    "payment_pending",
    "reserved",
    "cancelled",
    "archived",
  ],
  payment_pending: [
    "approved_for_payment",
    "needs_revision",
    "reserved",
    "cancelled",
    "archived",
  ],
  reserved: [
    "payment_pending",
    "approved_for_payment",
    "moveIn",
    "cancelled",
    "archived",
  ],
  moveIn: ["moveOut", "archived"],
  moveOut: ["archived"],
  rejected: ["archived"],
  cancelled: ["archived"],
  archived: ["cancelled", "rejected", "moveOut"],
});

const RESERVATION_STATUS_QUERY_MAP = Object.freeze({
  pending: ["pending"],
  viewing_preference_selected: ["viewing_preference_selected"],
  visit_pending: ["visit_pending"],
  visit_approved: ["visit_approved"],
  pending_application_review: ["pending_application_review"],
  needs_revision: ["needs_revision"],
  approved_for_payment: ["approved_for_payment"],
  payment_pending: ["payment_pending"],
  reserved: ["reserved"],
  moveIn: ["moveIn"],
  moveOut: ["moveOut"],
  rejected: ["rejected"],
  cancelled: ["cancelled"],
  archived: ["archived"],
});

export const CANONICAL_UTILITY_EVENT_TYPES = Object.freeze([
  "moveIn",
  "moveOut",
  "regularBilling",
  "periodStart",
  "periodEnd",
  "manualAdjustment",
]);

export const LEGACY_UTILITY_EVENT_TYPE_MAP = Object.freeze({});

const UTILITY_EVENT_QUERY_MAP = Object.freeze({
  moveIn: ["moveIn"],
  moveOut: ["moveOut"],
  regularBilling: ["regularBilling"],
  periodStart: ["periodStart"],
  periodEnd: ["periodEnd"],
  manualAdjustment: ["manualAdjustment"],
});

export const normalizeReservationStatus = (status) => {
  if (status == null) return null;
  const value = String(status).trim();
  return LEGACY_RESERVATION_STATUS_MAP[value] || value;
};

export const reservationStatusesForQuery = (...statuses) => {
  const values = new Set();

  statuses
    .flat()
    .map((status) => normalizeReservationStatus(status))
    .filter(Boolean)
    .forEach((status) => {
      const aliases = RESERVATION_STATUS_QUERY_MAP[status] || [status];
      aliases.forEach((alias) => values.add(alias));
    });

  return [...values];
};

export const ACTIVE_OCCUPANCY_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("reserved", "moveIn"),
);

export const PAYMENT_UNLOCK_RESERVATION_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("approved_for_payment", "payment_pending"),
);

export const CURRENT_RESIDENT_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("moveIn"),
);

export const BILLABLE_RESERVATION_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("moveIn", "moveOut"),
);

export const ACTIVE_STAY_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("reserved", "moveIn"),
);

export const PAST_STAY_STATUS_QUERY = Object.freeze(
  reservationStatusesForQuery("moveOut", "cancelled"),
);

export const isReservationStatus = (status, expectedStatus) =>
  normalizeReservationStatus(status) ===
  normalizeReservationStatus(expectedStatus);

export const hasReservationStatus = (status, ...expectedStatuses) => {
  const normalized = normalizeReservationStatus(status);
  return expectedStatuses
    .flat()
    .map((entry) => normalizeReservationStatus(entry))
    .filter(Boolean)
    .includes(normalized);
};

export const canTransitionReservationStatus = (
  currentStatus,
  nextStatus,
) => {
  const current = normalizeReservationStatus(currentStatus);
  const next = normalizeReservationStatus(nextStatus);

  if (!current || !next) return false;
  if (current === next) return true;

  return (ALLOWED_RESERVATION_STATUS_TRANSITIONS[current] || []).includes(next);
};

export const normalizeUtilityEventType = (eventType) => {
  if (eventType == null) return null;
  const value = String(eventType).trim();
  return LEGACY_UTILITY_EVENT_TYPE_MAP[value] || value;
};

export const utilityEventTypesForQuery = (...eventTypes) => {
  const values = new Set();

  eventTypes
    .flat()
    .map((eventType) => normalizeUtilityEventType(eventType))
    .filter(Boolean)
    .forEach((eventType) => {
      const aliases = UTILITY_EVENT_QUERY_MAP[eventType] || [eventType];
      aliases.forEach((alias) => values.add(alias));
    });

  return [...values];
};

export const LIFECYCLE_UTILITY_EVENT_QUERY = Object.freeze(
  utilityEventTypesForQuery("moveIn", "moveOut"),
);

export const isUtilityEventType = (eventType, expectedEventType) =>
  normalizeUtilityEventType(eventType) ===
  normalizeUtilityEventType(expectedEventType);

export const hasUtilityEventType = (eventType, ...expectedEventTypes) => {
  const normalized = normalizeUtilityEventType(eventType);
  return expectedEventTypes
    .flat()
    .map((entry) => normalizeUtilityEventType(entry))
    .filter(Boolean)
    .includes(normalized);
};

/**
 * Read the canonical move-in date from a reservation document.
 * Priority order (highest → lowest):
 *   1. confirmedMoveInDate — admin-confirmed actual move-in date (set at moveIn action)
 *   2. moveInDate          — required schema field, set at creation / admin move-in
 *   3. intendedMoveInDate  — tenant's desired date from Step 1
 *   4. targetMoveInDate    — @deprecated legacy field, kept for old records
 */
export const readMoveInDate = (value) =>
  value?.confirmedMoveInDate ??
  value?.moveInDate ??
  value?.intendedMoveInDate ??
  value?.targetMoveInDate ??
  null;

export const readMoveOutDate = (value) => value?.moveOutDate ?? null;

export const buildMoveInBeforeQuery = (date) => ({
  moveInDate: { $lt: date },
});

export const buildMoveOutAfterOrMissingQuery = (date) => ({
  $or: [
    { moveOutDate: null },
    { moveOutDate: { $gt: date } },
  ],
});

export const ensureReservationDateAliases = (value) => {
  if (!value || typeof value !== "object") return value;

  if (value.moveInDate === undefined && value.checkInDate !== undefined) {
    value.moveInDate = value.checkInDate;
  }
  if (value.moveOutDate === undefined && value.checkOutDate !== undefined) {
    value.moveOutDate = value.checkOutDate;
  }

  return value;
};

export const normalizeReservationPayload = (payload = {}) => {
  const next = { ...payload };

  if (next.status !== undefined) {
    next.status = normalizeReservationStatus(next.status);
  }

  if (next.moveInDate === undefined && next.checkInDate !== undefined) {
    next.moveInDate = next.checkInDate;
  }

  if (next.moveOutDate === undefined && next.checkOutDate !== undefined) {
    next.moveOutDate = next.checkOutDate;
  }

  if (next.moveInTime === undefined && next.checkInTime !== undefined) {
    next.moveInTime = next.checkInTime;
  }

  if (next.moveOutTime === undefined && next.checkOutTime !== undefined) {
    next.moveOutTime = next.checkOutTime;
  }

  if (next.eventType !== undefined) {
    next.eventType = normalizeUtilityEventType(next.eventType);
  }

  return next;
};

export const serializeReservation = (
  reservation,
  { includeLegacyDates = false } = {},
) => {
  if (!reservation) return reservation;

  const plain =
    typeof reservation.toObject === "function"
      ? reservation.toObject()
      : { ...reservation };

  const moveInDate = readMoveInDate(plain);
  const moveOutDate = readMoveOutDate(plain);
  const status =
    normalizeReservationStatus(plain.status || plain.reservationStatus) ||
    plain.status ||
    plain.reservationStatus ||
    null;
  const userRef = plain.userId;
  const hasResolvedUser =
    Boolean(userRef) &&
    typeof userRef === "object" &&
    (userRef.firstName || userRef.lastName || userRef.email);
  const hasUserReference = Boolean(
    (hasResolvedUser && userRef._id) ||
      (!hasResolvedUser && userRef),
  );
  const customerName = hasResolvedUser
    ? `${userRef.firstName || ""} ${userRef.lastName || ""}`.trim() ||
      userRef.email ||
      "Unknown"
    : hasUserReference
      ? "Deleted account"
      : "Unknown";

  const cancelledByRef = plain.cancelledBy;
  const cancelledById = typeof cancelledByRef === "object" ? String(cancelledByRef._id || "") : String(cancelledByRef || "");
  const userIdVal = typeof userRef === "object" ? String(userRef._id || "") : String(userRef || "");
  const isOwnUser = (cancelledById && userIdVal && cancelledById === userIdVal) || plain.cancellationSource === "applicant";

  let cancelledByName = null;
  if (isOwnUser) {
    cancelledByName = customerName;
  } else if (typeof cancelledByRef === "object" && cancelledByRef?.role) {
    const role = cancelledByRef.role;
    cancelledByName =
      role === "branch_admin"
        ? "Branch Admin"
        : role === "owner"
          ? "System Owner"
          : role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } else if (plain.cancellationSource === "admin") {
    cancelledByName = "Branch Admin";
  } else if (plain.cancellationSource === "system") {
    cancelledByName = "System Sweeper (24h Hold Expired)";
  } else if (plain.cancelledAt) {
    cancelledByName = "Branch Admin";
  }

  const cancelledByRole = isOwnUser
    ? "applicant"
    : (typeof cancelledByRef === "object" && cancelledByRef?.role) || plain.cancellationSource || null;

  const serialized = {
    ...plain,
    visitStatus: plain.visitStatus ?? reservation.visitStatus,
    visitApproved: plain.visitApproved ?? reservation.visitApproved,
    scheduleApproved: plain.scheduleApproved ?? reservation.scheduleApproved,
    scheduleRejected: plain.scheduleRejected ?? reservation.scheduleRejected,
    visitDate: plain.visitDate ?? reservation.visitDate,
    visitTime: plain.visitTime ?? reservation.visitTime,
    viewingPreference: plain.viewingPreference ?? reservation.viewingPreference,
    status,
    reservationStatus: status,
    moveInDate,
    moveOutDate,
    customer: plain.customer || customerName,
    guestName: plain.guestName || customerName,
    email:
      plain.email ||
      (hasResolvedUser ? userRef.email || plain.billingEmail || null : plain.billingEmail || null),
    cancelledByName,
    cancelledByRole,
  };

  if (includeLegacyDates) {
    serialized.checkInDate = moveInDate;
    serialized.checkOutDate = moveOutDate;
  } else {
    delete serialized.checkInDate;
    delete serialized.checkOutDate;
  }

  return serialized;
};

export const serializeReservations = (reservations, options) =>
  Array.isArray(reservations)
    ? reservations.map((reservation) => serializeReservation(reservation, options))
    : [];

const normalizeSegmentEventTypes = (segment = {}) => ({
  ...segment,
  startEventType: normalizeUtilityEventType(segment.startEventType),
  endEventType: normalizeUtilityEventType(segment.endEventType),
});

export const serializeUtilityReading = (reading) => {
  if (!reading) return reading;

  const plain =
    typeof reading.toObject === "function" ? reading.toObject() : { ...reading };

  return {
    ...plain,
    eventType: normalizeUtilityEventType(plain.eventType),
  };
};

export const serializeUtilityReadings = (readings) =>
  Array.isArray(readings)
    ? readings.map((reading) => serializeUtilityReading(reading))
    : [];

export const serializeUtilityPeriod = (period) => {
  if (!period) return period;

  const plain =
    typeof period.toObject === "function" ? period.toObject() : { ...period };

  return {
    ...plain,
    segments: Array.isArray(plain.segments)
      ? plain.segments.map((segment) => normalizeSegmentEventTypes(segment))
      : [],
  };
};
