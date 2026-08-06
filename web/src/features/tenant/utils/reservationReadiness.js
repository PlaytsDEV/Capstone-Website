/**
 * Truthful payment/readiness labeling for the tenant reservation dashboard.
 *
 * IMPORTANT — drift disclosure: getStructuredMoveInReadiness below is a
 * FRONTEND MIRROR of the backend's authoritative gate,
 * getStructuredMoveInBlockers() in server/services/structuredInitialPaymentService.js
 * (called from the move-in status transition in
 * server/controllers/reservations/reservationLifecycleController.js). It is
 * read-only/display-only — it never gates the actual move-in mutation, which
 * always re-checks the real conditions server-side (Bill status, Room/Stay
 * conflicts, etc.) regardless of what this function returns. This mirror
 * intentionally omits checks that require server-only data the serialized
 * reservation doesn't carry (Bill.status/remainingAmount directly, Room/Stay
 * conflict lookups) and instead uses the reservation's own
 * `initialPaymentStatus` field as a proxy for Bill settlement. See
 * reservationReadiness.test.mjs for fixtures cross-checked against the
 * backend's structuredMoveInReadiness.test.js scenarios.
 */

const STRUCTURED_WORKFLOW_VERSION = "structured-initial-payment-v1";

export const isStructuredWorkflow = (reservation) =>
  reservation?.financialWorkflowVersion === STRUCTURED_WORKFLOW_VERSION;

export const getReservationFeeStatusLabel = (reservation) => {
  if (!isStructuredWorkflow(reservation)) {
    // Legacy (pre-structured) workflow — unchanged wording.
    return "Payment verified";
  }
  return reservation.reservationFeePaymentStatus === "verified"
    ? "Reservation fee verified"
    : "Reservation fee pending";
};

/**
 * Fails closed: any missing/unreadable input, or a reservation that isn't
 * using the structured workflow object at all, is NOT reported ready.
 */
export const getStructuredMoveInReadiness = (reservation) => {
  if (!reservation || typeof reservation !== "object") {
    return { ready: false, reasons: ["Reservation data unavailable"] };
  }
  if (!isStructuredWorkflow(reservation)) {
    return { ready: null, reasons: [] };
  }
  const reasons = [];
  if (reservation.reservationFeePaymentStatus !== "verified") {
    reasons.push("Reservation fee not yet verified");
  }
  if (!reservation.pricingSnapshot?.approvedAt) {
    reasons.push("Pricing has not been approved yet");
  }
  if (reservation.initialPaymentStatus !== "paid") {
    reasons.push("Structured initial-payment Bill is not fully paid");
  }
  const documentsComplete = Boolean(
    reservation.selfiePhotoUrl &&
      reservation.validIDFrontUrl &&
      reservation.validIDBackUrl &&
      reservation.agreedToPrivacy &&
      reservation.agreedToCertification,
  );
  if (!documentsComplete) reasons.push("Required documents are incomplete");
  if (!reservation.emergencyContact?.name || !reservation.emergencyContact?.contactNumber) {
    reasons.push("Emergency contact is incomplete");
  }
  if (!reservation.houseRulesPreparedAt) reasons.push("House rules acknowledgment pending");
  return { ready: reasons.length === 0, reasons };
};

/**
 * Resolves the primary (confirmed-priority) move-in date to display, plus
 * whether the originally-requested date should be shown as a separate,
 * clearly-labeled secondary value because it differs from the confirmed one.
 * `readMoveInDate` should be shared/utils/lifecycleNaming.js's readMoveInDate.
 */
export const resolveDisplayMoveInDate = (reservation, readMoveInDate, formatDate) => {
  const confirmedDate = readMoveInDate(reservation);
  const requestedDate = reservation?.targetMoveInDate || null;
  if (!confirmedDate && !requestedDate) {
    return { primaryDate: null, showRequested: false, requestedDate: null };
  }
  const primaryDate = confirmedDate || requestedDate;
  const showRequested = Boolean(
    confirmedDate &&
      requestedDate &&
      formatDate(confirmedDate) !== formatDate(requestedDate),
  );
  return { primaryDate, showRequested, requestedDate };
};
