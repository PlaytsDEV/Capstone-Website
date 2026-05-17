import { hasReservationStatus } from "../../../../shared/utils/lifecycleNaming.js";

export const RESERVATION_FEE_NON_REFUNDABLE_NOTICE =
  "The reservation fee is non-refundable. If admin approves your cancellation request, the paid reservation fee will not be returned.";

const CANCELLATION_REQUEST_STATUSES = new Set([
  "pending",
  "viewing_preference_selected",
  "visit_pending",
  "visit_approved",
  "pending_application_review",
  "needs_revision",
  "approved_for_payment",
  "payment_pending",
  "reserved",
]);

export const hasPaidReservationFee = (reservation = {}) => {
  const status = reservation?.reservationStatus || reservation?.status;
  return Boolean(
    reservation?.paymentStatus === "paid" ||
      reservation?.paymentDate ||
      reservation?.reservedAt ||
      hasReservationStatus(status, "reserved"),
  );
};

export const getReservationCancellationUiState = (reservation = null) => {
  if (!reservation) {
    return { visible: false, canRequest: false, isPending: false };
  }

  const status = reservation.reservationStatus || reservation.status;
  const isTerminal = hasReservationStatus(
    status,
    "cancelled",
    "rejected",
    "archived",
    "moveIn",
    "moveOut",
  );

  if (isTerminal) {
    return { visible: false, canRequest: false, isPending: false };
  }

  const isPending =
    reservation.cancellationRequested && reservation.cancellationStatus === "pending";

  if (isPending) {
    return { visible: true, canRequest: false, isPending: true };
  }

  const statusKey = String(status || "").trim();
  const canRequest =
    hasPaidReservationFee(reservation) && CANCELLATION_REQUEST_STATUSES.has(statusKey);

  return {
    visible: canRequest,
    canRequest,
    isPending: false,
  };
};
