import {
  canAccessTenantApplication,
  getReservationViewingPreference,
} from "./physicalVisitFlow.js";
import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

export const VIEWING_PREFERENCE_LOCKED_MESSAGE =
  "Your viewing preference is already submitted and locked while admin reviews your reservation.";

export const SUBMIT_VIEWING_PREFERENCE_LABEL = "Submit Viewing Preference";
export const VIEW_RESERVATION_STATUS_LABEL = "View Reservation Status";

const VIEWING_PREFERENCE_LOCKING_STATUSES = Object.freeze([
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
]);

const VIEWING_PREFERENCE_CHANGE_ALLOWED_STATUSES = Object.freeze([
  "cancelled",
  "rejected",
  "expired",
  "archived",
]);

const APPLICATION_OR_PAYMENT_STARTED_STATUSES = Object.freeze([
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
]);

const VISIT_PROCESSING_STATUSES = Object.freeze([
  "visit_pending",
  "visit_approved",
]);

const TRUE_VALUES = new Set(["true", "approved", "allowed", "reset"]);

const asReservation = (reservation) =>
  reservation && typeof reservation === "object" ? reservation : {};

const isTruthyApprovalValue = (value) => {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

const normalizePreferenceValue = (value) =>
  getReservationViewingPreference({ viewingPreference: value, viewingType: value });

const getExplicitViewingTypePreference = (reservation = {}) => {
  const rawViewingType = String(reservation.viewingType || "").trim().toLowerCase();
  if (!rawViewingType || rawViewingType === "inperson") return null;
  return normalizePreferenceValue(rawViewingType);
};

export const hasAdminAllowedViewingPreferenceChange = (reservation = {}) => {
  const safeReservation = asReservation(reservation);
  const explicitValue =
    safeReservation.viewingPreferenceChangeAllowed ??
    safeReservation.allowViewingPreferenceChange ??
    safeReservation.viewingPreferenceReset ??
    safeReservation.adminApprovedViewingPreferenceChange ??
    safeReservation.preferenceChangeApproved;

  if (isTruthyApprovalValue(explicitValue)) return true;

  const status = String(
    safeReservation.viewingPreferenceChangeStatus ||
      safeReservation.preferenceChangeStatus ||
      "",
  )
    .trim()
    .toLowerCase();

  return TRUE_VALUES.has(status);
};

export const getSubmittedViewingPreference = (reservation = {}) => {
  const safeReservation = asReservation(reservation);
  const explicitPreference = normalizePreferenceValue(safeReservation.viewingPreference);
  if (explicitPreference) return explicitPreference;
  const explicitViewingTypePreference = getExplicitViewingTypePreference(safeReservation);
  if (explicitViewingTypePreference) return explicitViewingTypePreference;
  if (safeReservation.isUrgentMoveIn) return "urgent_move_in_review";
  if (
    safeReservation.remoteViewingAcknowledged ||
    String(safeReservation.remoteViewingQuestions || "").trim()
  ) {
    return "remote_2d_viewing";
  }
  if (
    safeReservation.visitDate ||
    safeReservation.visitTime ||
    safeReservation.visitCode ||
    safeReservation.visitScheduledAt ||
    safeReservation.visitStatus ||
    safeReservation.scheduleApproved ||
    safeReservation.scheduleApprovedAt
  ) {
    return "physical_visit";
  }
  return null;
};

export const isViewingPreferenceSubmitted = (reservation = {}) => {
  const safeReservation = asReservation(reservation);
  const submittedPreference = getSubmittedViewingPreference(safeReservation);
  const status = normalizeReservationStatus(
    safeReservation.reservationStatus || safeReservation.status,
  );
  return Boolean(
    submittedPreference ||
      hasReservationStatus(status, VIEWING_PREFERENCE_LOCKING_STATUSES) ||
      safeReservation.visitDate ||
      safeReservation.visitTime ||
      safeReservation.visitCode ||
      safeReservation.visitScheduledAt ||
      safeReservation.visitStatus ||
      safeReservation.scheduleApproved ||
      safeReservation.scheduleApprovedAt ||
      safeReservation.scheduleRejectedAt ||
      safeReservation.visitOutcomeUpdatedAt ||
      safeReservation.remoteViewingAcknowledged ||
      String(safeReservation.remoteViewingQuestions || "").trim() ||
      safeReservation.isUrgentMoveIn,
  );
};

export const hasSubmittedViewingPreference = isViewingPreferenceSubmitted;

export const isViewingPreferenceChangeAllowed = (reservation = {}) => {
  const safeReservation = asReservation(reservation);
  if (!isViewingPreferenceSubmitted(safeReservation)) return true;

  const status = normalizeReservationStatus(
    safeReservation.reservationStatus || safeReservation.status,
  );

  if (hasReservationStatus(status, VIEWING_PREFERENCE_CHANGE_ALLOWED_STATUSES)) {
    return true;
  }

  const hardBlocked = Boolean(
    hasReservationStatus(status, APPLICATION_OR_PAYMENT_STARTED_STATUSES) ||
      safeReservation.applicationSubmittedAt ||
      safeReservation.paymentDate ||
      safeReservation.proofOfPaymentUrl ||
      String(safeReservation.paymentStatus || "").trim().toLowerCase() === "paid" ||
      safeReservation.paymongoPaymentId ||
      safeReservation.paymongoSessionId ||
      safeReservation.visitCode ||
      safeReservation.visitScheduledAt ||
      hasReservationStatus(status, VISIT_PROCESSING_STATUSES) ||
      safeReservation.scheduleApproved ||
      safeReservation.scheduleApprovedAt ||
      safeReservation.visitApproved ||
      safeReservation.visitOutcomeUpdatedAt ||
      canAccessTenantApplication(safeReservation),
  );

  if (hardBlocked) return false;
  return hasAdminAllowedViewingPreferenceChange(safeReservation);
};

export const canChangeViewingPreference = isViewingPreferenceChangeAllowed;

export const canResubmitSameViewingPreference = (
  reservation = {},
  requestedPreference = "",
) => {
  const safeReservation = asReservation(reservation);
  const submittedPreference = getSubmittedViewingPreference(safeReservation);
  const normalizedRequested =
    requestedPreference || submittedPreference || getReservationViewingPreference(safeReservation);

  return Boolean(
    submittedPreference === "physical_visit" &&
      normalizedRequested === "physical_visit" &&
      safeReservation.scheduleRejected === true &&
      !safeReservation.applicationSubmittedAt &&
      !hasReservationStatus(
        safeReservation.reservationStatus || safeReservation.status,
        "pending_application_review",
        "approved_for_payment",
        "payment_pending",
        "reserved",
        "moveIn",
        "moveOut",
      ),
  );
};

export const canApplicantSubmitViewingPreference = (
  reservation = {},
  requestedPreference = "",
) => {
  const safeReservation = asReservation(reservation);
  if (!isViewingPreferenceSubmitted(safeReservation)) return true;
  if (isViewingPreferenceChangeAllowed(safeReservation)) return true;
  return canResubmitSameViewingPreference(safeReservation, requestedPreference);
};

export const isViewingPreferenceLocked = (
  reservation = {},
  requestedPreference = "",
) => {
  const safeReservation = asReservation(reservation);
  if (!isViewingPreferenceSubmitted(safeReservation)) return false;
  if (isViewingPreferenceChangeAllowed(safeReservation)) return false;
  return !canResubmitSameViewingPreference(safeReservation, requestedPreference);
};

export const getViewingPreferenceStepAccess = (
  reservation = {},
  requestedPreference = "",
) => {
  const safeReservation = asReservation(reservation);
  const submittedPreference = getSubmittedViewingPreference(safeReservation);
  const submitted = isViewingPreferenceSubmitted(safeReservation);
  const canChangePreference = isViewingPreferenceChangeAllowed(safeReservation);
  const canResubmitSame = canResubmitSameViewingPreference(
    safeReservation,
    requestedPreference || submittedPreference,
  );
  const canSubmit = !submitted || canChangePreference || canResubmitSame;
  const locked = isViewingPreferenceLocked(
    safeReservation,
    requestedPreference || submittedPreference,
  );

  return {
    submitted,
    submittedPreference,
    requestedPreference: requestedPreference || submittedPreference || "",
    locked,
    readOnly: locked,
    lockOptions: submitted && !canChangePreference,
    canChangePreference,
    canResubmitSamePreference: canResubmitSame,
    canSubmit,
    message: locked ? VIEWING_PREFERENCE_LOCKED_MESSAGE : "",
    primaryLabel: canSubmit ? SUBMIT_VIEWING_PREFERENCE_LABEL : "",
    statusCtaLabel: locked ? VIEW_RESERVATION_STATUS_LABEL : "",
  };
};
