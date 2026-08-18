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
 *
 * Because that mirror cannot see room/bed assignment or Stay/Reservation
 * occupancy conflicts, it must never be the sole basis for claiming final
 * "Move-in ready!" — see getMoveInReadinessLabel below, which only makes
 * that claim when the server has attached an authoritative
 * `reservation.moveInReadiness` (getStructuredMoveInReadinessSummary in
 * server/services/structuredInitialPaymentService.js, attached to the
 * single-reservation detail response). When that authoritative field isn't
 * present yet, the label falls back to honest, non-final wording instead of
 * guessing.
 */

import {
  hasReservationStatus,
  normalizeReservationStatus,
} from "../../../shared/utils/lifecycleNaming.js";

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

const AUTHORITATIVE_READY_LABEL = "Move-in ready!";
const REQUIREMENTS_PENDING_LABEL = "Reservation secured — move-in requirements pending";
const AWAITING_CONFIRMATION_LABEL = "Applicant requirements complete — final confirmation pending";

/**
 * Reads the server-attached `reservation.moveInReadiness` (see
 * getStructuredMoveInReadinessSummary on the backend) without recomputing
 * or second-guessing it. Returns `{ status: "unknown" }` when the field
 * hasn't been fetched/attached yet — callers must treat "unknown" as "not
 * confirmed", never as "ready".
 */
export const getAuthoritativeMoveInStatus = (reservation) => {
  const readiness = reservation?.moveInReadiness;
  if (!readiness || typeof readiness !== "object" || !readiness.status) {
    return { status: "unknown", blockers: [] };
  }
  return {
    status: readiness.status,
    blockers: Array.isArray(readiness.blockers) ? readiness.blockers : [],
  };
};

/**
 * The single source of truth for the tenant dashboard's move-in status
 * label. Only claims final "Move-in ready!" when the backend-authoritative
 * `reservation.moveInReadiness.status` is explicitly "ready" (or the
 * reservation predates the structured workflow entirely, matching the
 * original unchanged legacy behavior). Applicant-side completeness
 * (getStructuredMoveInReadiness) alone — which cannot see room/bed
 * assignment or occupancy conflicts — is never enough on its own to produce
 * that claim; it can only produce the softer "final confirmation pending"
 * wording while authoritative data is unavailable, or the "requirements
 * pending" wording once it (or the backend) reports something outstanding.
 */
export const getMoveInReadinessLabel = (reservation) => {
  const applicant = getStructuredMoveInReadiness(reservation);
  if (applicant.ready === null) {
    // Legacy (pre-structured) workflow — unchanged behavior. Callers only
    // reach this label once the reservation status already implies the
    // legacy flow considers move-in confirmed.
    return AUTHORITATIVE_READY_LABEL;
  }
  const authoritative = getAuthoritativeMoveInStatus(reservation);
  if (authoritative.status === "ready") return AUTHORITATIVE_READY_LABEL;
  if (authoritative.status === "blocked") return REQUIREMENTS_PENDING_LABEL;
  // authoritative.status === "unknown" (not yet fetched) or "not_applicable"
  // — never claim final readiness from applicant-only data.
  return applicant.ready ? AWAITING_CONFIRMATION_LABEL : REQUIREMENTS_PENDING_LABEL;
};

/**
 * Checks if the tenant has actually reached and completed/submitted Step 3 (Application form).
 * Early draft states (pending, viewing_preference_selected, visit_pending, visit_approved)
 * have not chosen an intended move-in date unless an application was submitted or certified.
 */
export const isApplicationFilledOrSubmitted = (reservation) => {
  if (!reservation) return false;
  const status = normalizeReservationStatus(
    reservation?.reservationStatus || reservation?.status,
  );
  if (!status) return true; // Standalone test fixtures / mock objects
  if (
    hasReservationStatus(
      status,
      "pending_application_review",
      "needs_revision",
      "approved_for_payment",
      "payment_pending",
      "reserved",
      "moveIn",
      "moveOut",
      "rejected",
    )
  ) {
    return true;
  }
  return Boolean(
    reservation?.applicationSubmittedAt ||
      (reservation?.agreedToCertification &&
        reservation?.firstName &&
        reservation?.lastName),
  );
};

/**
 * Resolves the primary (confirmed-priority) move-in date to display, plus
 * whether the originally-requested date should be shown as a separate,
 * clearly-labeled secondary value because it differs from the confirmed one.
 * Returns lifecycle-aware metadata (dateType: "confirmed" | "preferred" | "unset",
 * displayLabel: "Confirmed Move-in" | "Preferred Move-in" | "To be scheduled").
 * `readMoveInDate` should be shared/utils/lifecycleNaming.js's readMoveInDate.
 */
export const resolveDisplayMoveInDate = (reservation, readMoveInDateFn, formatDate) => {
  if (!reservation || typeof reservation !== "object") {
    return {
      primaryDate: null,
      dateType: "unset",
      displayLabel: "To be scheduled",
      showRequested: false,
      requestedDate: null,
    };
  }

  const status = normalizeReservationStatus(
    reservation?.reservationStatus || reservation?.status,
  );
  const isConfirmed = Boolean(
    reservation?.confirmedMoveInDate ||
      hasReservationStatus(status, "reserved", "moveIn", "moveOut"),
  );

  const applicationFilled = isApplicationFilledOrSubmitted(reservation);

  const confirmedDate =
    reservation?.confirmedMoveInDate ||
    (isConfirmed
      ? reservation?.moveInDate
      : reservation?.targetMoveInDate &&
          reservation?.moveInDate &&
          reservation.moveInDate !== reservation.targetMoveInDate
        ? reservation.moveInDate
        : null) ||
    null;

  const requestedDate = applicationFilled
    ? reservation?.intendedMoveInDate ||
      reservation?.targetMoveInDate ||
      reservation?.finalMoveInDate ||
      null
    : null;

  let primaryDate = null;
  let dateType = "unset";
  let displayLabel = "To be scheduled";

  if (confirmedDate) {
    primaryDate = confirmedDate;
    dateType = "confirmed";
    displayLabel = "Confirmed Move-in";
  } else if (isConfirmed && (requestedDate || reservation?.moveInDate)) {
    primaryDate = requestedDate || reservation?.moveInDate || null;
    dateType = "confirmed";
    displayLabel = "Confirmed Move-in";
  } else if (requestedDate) {
    primaryDate = requestedDate;
    dateType = "preferred";
    displayLabel = "Preferred Move-in";
  } else {
    primaryDate = null;
    dateType = "unset";
    displayLabel = "To be scheduled";
  }

  const showRequested = Boolean(
    confirmedDate &&
      requestedDate &&
      typeof formatDate === "function" &&
      formatDate(confirmedDate) !== formatDate(requestedDate),
  );

  return {
    primaryDate,
    dateType,
    displayLabel,
    showRequested,
    requestedDate,
  };
};
