const normalized = (value) => String(value || "").trim().toLowerCase();

const APPROVED_STATUSES = new Set([
  "approved_for_payment", "payment_pending", "reserved", "movein", "moveout",
]);
const COMPLETED_STATUSES = new Set(["movein", "moveout", "completed"]);
const REJECTED_STATUSES = new Set(["rejected"]);
const CANCELLED_STATUSES = new Set(["cancelled", "archived"]);

const hasAssignment = (reservation, context) => Boolean(
  (context.roomExists ?? reservation.roomId) &&
  (context.bedExists ?? (
    reservation.selectedBed?.id ||
    reservation.selectedBed?.code ||
    reservation.selectedBed?.position
  )),
);

export const resolveReservationContractEligibility = (reservation = {}, context = {}) => {
  const status = normalized(reservation.status).replaceAll("_", "");
  const rawStatus = normalized(reservation.status);
  const rejected = REJECTED_STATUSES.has(rawStatus) || Boolean(reservation.rejectedAt);
  const cancelled = CANCELLED_STATUSES.has(rawStatus) || Boolean(reservation.cancelledAt);
  const sourceEvidence = {
    status: reservation.status || null,
    applicationReviewedAt: reservation.applicationReviewedAt || null,
    applicationReviewedBy: reservation.applicationReviewedBy || null,
    approvedForPaymentAt: reservation.approvedForPaymentAt || null,
    tenantExists: Boolean(context.tenantExists ?? reservation.userId),
    roomAssigned: Boolean(context.roomExists ?? reservation.roomId),
    bedAssigned: hasAssignment(reservation, context),
    moveInDate: reservation.confirmedMoveInDate || reservation.moveInDate || null,
    paymentStatus: reservation.paymentStatus || null,
    rejected,
    cancelled,
    legacyConfirmedAt: reservation.legacyContractApprovalConfirmedAt || null,
    legacyConfirmedBy: reservation.legacyContractApprovalConfirmedBy || null,
  };
  const explicitApproval = APPROVED_STATUSES.has(rawStatus) &&
    Boolean(reservation.applicationReviewedAt) &&
    Boolean(reservation.applicationReviewedBy);
  const completed = COMPLETED_STATUSES.has(status);
  const legacyEvidenceComplete = completed &&
    sourceEvidence.tenantExists &&
    sourceEvidence.roomAssigned &&
    sourceEvidence.bedAssigned &&
    Boolean(sourceEvidence.moveInDate) &&
    ["partial", "paid"].includes(normalized(reservation.paymentStatus)) &&
    !rejected && !cancelled;

  if (rejected || cancelled) return {
    eligible: false,
    approvalState: rejected ? "rejected" : "inconsistent",
    blockers: [{
      code: rejected ? "RESERVATION_REJECTED" : "RESERVATION_CANCELLED",
      message: rejected
        ? "The Reservation was rejected."
        : "The Reservation was cancelled.",
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  if (explicitApproval) return {
    eligible: true, approvalState: "approved", blockers: [], sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  if (legacyEvidenceComplete) return {
    eligible: true, approvalState: "legacy_completed", blockers: [], sourceEvidence,
    legacyCompatibilityApplied: true,
  };
  if (completed) return {
    eligible: false,
    approvalState: "inconsistent",
    blockers: [{
      code: "RESERVATION_LEGACY_VERIFICATION_REQUIRED",
      message: "Reservation record needs verification",
      details: {
        description: "This tenant is already marked as moved in, but the Reservation is missing approval metadata required for Contract generation.",
      },
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  return {
    eligible: false,
    approvalState: "pending_review",
    blockers: [{
      code: "CONTRACT_SOURCE_APPROVAL_REQUIRED",
      message: "The reservation and application must be approved before Contract generation.",
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
};
