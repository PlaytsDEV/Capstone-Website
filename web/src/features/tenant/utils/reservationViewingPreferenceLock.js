import { getReservationViewingPreference } from "./physicalVisitFlow.js";
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

const TRUE_VALUES = new Set(["true", "approved", "allowed", "reset"]);

const isTruthyApprovalValue = (value) => {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

export const hasAdminAllowedViewingPreferenceChange = (reservation = {}) => {
  const explicitValue =
    reservation.viewingPreferenceChangeAllowed ??
    reservation.allowViewingPreferenceChange ??
    reservation.viewingPreferenceReset ??
    reservation.adminApprovedViewingPreferenceChange ??
    reservation.preferenceChangeApproved;

  if (isTruthyApprovalValue(explicitValue)) return true;

  const status = String(
    reservation.viewingPreferenceChangeStatus ||
      reservation.preferenceChangeStatus ||
      "",
  )
    .trim()
    .toLowerCase();

  return TRUE_VALUES.has(status);
};

export const getSubmittedViewingPreference = (reservation = {}) => {
  const explicitPreference = getReservationViewingPreference(reservation);
  if (explicitPreference) return explicitPreference;
  if (
    reservation.remoteViewingAcknowledged ||
    String(reservation.remoteViewingQuestions || "").trim()
  ) {
    return "remote_2d_viewing";
  }
  return null;
};

export const isViewingPreferenceSubmitted = (reservation = {}) => {
  const submittedPreference = getSubmittedViewingPreference(reservation);
  const status = normalizeReservationStatus(
    reservation.reservationStatus || reservation.status,
  );
  return Boolean(
    submittedPreference ||
      hasReservationStatus(status, VIEWING_PREFERENCE_LOCKING_STATUSES) ||
      reservation.visitDate ||
      reservation.visitTime ||
      reservation.visitCode ||
      reservation.visitScheduledAt ||
      reservation.visitStatus ||
      reservation.scheduleApproved ||
      reservation.scheduleApprovedAt ||
      reservation.scheduleRejectedAt ||
      reservation.visitOutcomeUpdatedAt ||
      reservation.remoteViewingAcknowledged ||
      String(reservation.remoteViewingQuestions || "").trim() ||
      reservation.isUrgentMoveIn,
  );
};

export const isViewingPreferenceChangeAllowed = (reservation = {}) => {
  if (!isViewingPreferenceSubmitted(reservation)) return true;
  if (hasAdminAllowedViewingPreferenceChange(reservation)) return true;

  const status = normalizeReservationStatus(
    reservation.reservationStatus || reservation.status,
  );

  return hasReservationStatus(status, VIEWING_PREFERENCE_CHANGE_ALLOWED_STATUSES);
};

export const canResubmitSameViewingPreference = (
  reservation = {},
  requestedPreference = "",
) => {
  const submittedPreference = getSubmittedViewingPreference(reservation);
  const normalizedRequested =
    requestedPreference || submittedPreference || getReservationViewingPreference(reservation);

  return Boolean(
    submittedPreference === "physical_visit" &&
      normalizedRequested === "physical_visit" &&
      reservation.scheduleRejected === true &&
      !reservation.applicationSubmittedAt &&
      !hasReservationStatus(
        reservation.reservationStatus || reservation.status,
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
  if (!isViewingPreferenceSubmitted(reservation)) return true;
  if (isViewingPreferenceChangeAllowed(reservation)) return true;
  return canResubmitSameViewingPreference(reservation, requestedPreference);
};

export const getViewingPreferenceStepAccess = (
  reservation = {},
  requestedPreference = "",
) => {
  const submittedPreference = getSubmittedViewingPreference(reservation);
  const submitted = isViewingPreferenceSubmitted(reservation);
  const canChangePreference = isViewingPreferenceChangeAllowed(reservation);
  const canResubmitSame = canResubmitSameViewingPreference(
    reservation,
    requestedPreference || submittedPreference,
  );
  const canSubmit = !submitted || canChangePreference || canResubmitSame;
  const locked = submitted && !canChangePreference && !canResubmitSame;

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
