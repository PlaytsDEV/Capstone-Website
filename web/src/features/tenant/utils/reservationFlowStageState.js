import {
  canReservationAccessPayment,
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";
import { canAccessTenantApplication } from "./physicalVisitFlow.js";
import { isViewingPreferenceSubmitted } from "./reservationViewingPreferenceLock.js";

const APPLICATION_SUBMITTED_STATUSES = [
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
];

const ROOM_CONFIRMED_STATUSES = [
  "viewing_preference_selected",
  "visit_pending",
  "visit_approved",
  ...APPLICATION_SUBMITTED_STATUSES,
];

const PAYMENT_SUBMITTED_STATUSES = [
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
];

const CONFIRMED_STATUSES = ["reserved", "moveIn", "moveOut"];

const buildState = (state, meta = {}) => ({
  state,
  isActive: state === "active",
  isComplete: state === "complete",
  isReady: state === "ready",
  isLocked: state === "locked",
  helperLabel: "",
  ...meta,
});

export const getReservationFlowStageState = ({
  stageId,
  currentStage = 1,
  reservation = {},
  applicationSubmitted = false,
  paymentSubmitted = false,
  paymentApproved = false,
} = {}) => {
  const normalizedStageId = Number(stageId);
  const normalizedCurrentStage = Number(currentStage) || 1;
  const status = normalizeReservationStatus(
    reservation?.reservationStatus || reservation?.status || "pending",
  );
  const isActive = normalizedStageId === normalizedCurrentStage;
  const viewingPreferenceSubmitted = isViewingPreferenceSubmitted(reservation);
  const applicationAccessible = canAccessTenantApplication(reservation);
  const roomConfirmed =
    Boolean(reservation?.roomConfirmed) ||
    viewingPreferenceSubmitted ||
    hasReservationStatus(status, ROOM_CONFIRMED_STATUSES);
  const tenantApplicationSubmitted =
    Boolean(applicationSubmitted || reservation?.applicationSubmittedAt) ||
    hasReservationStatus(status, APPLICATION_SUBMITTED_STATUSES);
  const paymentAccessible = canReservationAccessPayment(status);
  const reservationPaymentSubmitted =
    Boolean(paymentSubmitted || reservation?.proofOfPaymentUrl) ||
    hasReservationStatus(status, PAYMENT_SUBMITTED_STATUSES);
  const reservationConfirmed =
    Boolean(paymentApproved) || hasReservationStatus(status, CONFIRMED_STATUSES);

  if (normalizedStageId === 1) {
    if (isActive) return buildState("active");
    return roomConfirmed ? buildState("complete", { helperLabel: "Complete" }) : buildState("locked");
  }

  if (normalizedStageId === 2) {
    if (isActive) return buildState("active");
    return viewingPreferenceSubmitted
      ? buildState("complete", { helperLabel: "Complete" })
      : buildState("locked");
  }

  if (normalizedStageId === 3) {
    if (tenantApplicationSubmitted) {
      return buildState("complete", { helperLabel: "Submitted" });
    }
    if (applicationAccessible) {
      return isActive
        ? buildState("active")
        : buildState("ready", { helperLabel: "Ready" });
    }
    return buildState("locked");
  }

  if (normalizedStageId === 4) {
    if (reservationPaymentSubmitted) {
      return buildState("complete", { helperLabel: "Submitted" });
    }
    if (paymentAccessible) {
      return isActive
        ? buildState("active")
        : buildState("ready", { helperLabel: "Ready" });
    }
    return buildState("locked");
  }

  if (normalizedStageId === 5) {
    if (reservationConfirmed) {
      return isActive
        ? buildState("active", { showCheck: true })
        : buildState("complete", { helperLabel: "Complete", showCheck: true });
    }
    return buildState("locked");
  }

  return buildState("locked");
};
