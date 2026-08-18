import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

export const ROOM_SELECTION_LOCKED_MESSAGE =
  "Room selection is locked while your reservation is under review.";

const ROOM_SELECTION_LOCKING_STATUSES = Object.freeze([
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

const ROOM_RESELECTION_ALLOWED_STATUSES = Object.freeze([
  "cancelled",
  "rejected",
  "expired",
  "archived",
]);

const TRUE_VALUES = new Set(["true", "approved", "allowed"]);

export const hasAdminApprovedRoomReselection = (reservation = {}) => {
  const explicitValue =
    reservation.roomReselectionApproved ??
    reservation.reselectionApproved ??
    reservation.allowRoomReselection ??
    reservation.roomChangeApproved ??
    reservation.adminApprovedReselection;

  if (explicitValue === true) return true;
  if (typeof explicitValue === "string") {
    return TRUE_VALUES.has(explicitValue.trim().toLowerCase());
  }

  const reselectionStatus = String(
    reservation.roomReselectionStatus ||
      reservation.reselectionStatus ||
      reservation.roomChangeStatus ||
      "",
  )
    .trim()
    .toLowerCase();

  return TRUE_VALUES.has(reselectionStatus);
};

const hasSavedViewingPreference = (reservation = {}) => {
  const explicitPreference = String(reservation.viewingPreference || "")
    .trim()
    .toLowerCase();
  const viewingType = String(reservation.viewingType || "")
    .trim()
    .toLowerCase();

  return Boolean(
    explicitPreference ||
      reservation.visitDate ||
      reservation.visitTime ||
      reservation.visitStatus ||
      reservation.remoteViewingAcknowledged ||
      reservation.isUrgentMoveIn ||
      ["remote_2d", "remote_2d_viewing", "virtual", "urgent_move_in", "urgent_move_in_review"].includes(
        viewingType,
      ),
  );
};

const hasSubmittedApplicationOrPayment = (reservation = {}) => {
  const status = normalizeReservationStatus(
    reservation.reservationStatus || reservation.status,
  );

  return Boolean(
    reservation.applicationSubmittedAt ||
      reservation.paymentDate ||
      reservation.proofOfPaymentUrl ||
      hasReservationStatus(
        status,
        "pending_application_review",
        "needs_revision",
        "approved_for_payment",
        "payment_pending",
        "reserved",
        "moveIn",
        "moveOut",
      ),
  );
};

export const canApplicantReselectRoom = (reservation = {}) => {
  if (!reservation) return true;
  if (hasAdminApprovedRoomReselection(reservation)) return true;

  const status = normalizeReservationStatus(
    reservation.reservationStatus || reservation.status,
  );

  if (hasReservationStatus(status, ROOM_RESELECTION_ALLOWED_STATUSES)) {
    return true;
  }

  if (hasReservationStatus(status, ROOM_SELECTION_LOCKING_STATUSES)) {
    return false;
  }

  if (hasSubmittedApplicationOrPayment(reservation)) {
    return false;
  }

  if (reservation.visitStatus === "no_show") {
    return true;
  }

  if (reservation.roomConfirmed === true) {
    return false;
  }

  if (hasSavedViewingPreference(reservation)) {
    return false;
  }

  return true;
};

export const isApplicantRoomSelectionLocked = (reservation = {}) =>
  Boolean(reservation) && !canApplicantReselectRoom(reservation);

export const getReservationStageAccess = (reservation, stageId) => {
  const normalizedStageId = Number(stageId);
  const readOnly =
    normalizedStageId === 1 && isApplicantRoomSelectionLocked(reservation);

  return {
    stageId: normalizedStageId,
    readOnly,
    canChangeRoom: normalizedStageId === 1 ? !readOnly : true,
    canConfirmRoom: normalizedStageId === 1 ? !readOnly : true,
    roomSummaryVisible:
      normalizedStageId === 1 && Boolean(reservation?.room || reservation?.roomId),
    lockedMessage: readOnly ? ROOM_SELECTION_LOCKED_MESSAGE : "",
  };
};
