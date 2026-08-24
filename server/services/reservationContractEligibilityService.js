import { readMoveInDate } from "../utils/lifecycleNaming.js";

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

// Canonical bed-requirement rule, shared with contractService.js's
// roomTypeRequiresBedAssignment() (same predicate, kept in sync there):
// a Room's own beds[] always carries distinct upper/lower slots regardless
// of room type, but only rooms with more than one occupant (double-sharing,
// quadruple-sharing) make that distinction load-bearing — two different
// tenants can occupy the same room concurrently, each in their own bed
// (confirmed against real occupancy data: a double-sharing room's two beds
// are independently occupied by two different tenants/reservations). A
// private room's second bed slot is never assigned to anyone else, so which
// physical bed the sole occupant is in has no legal/occupancy meaning.
// Private is the only exemption — every other/unknown room type is treated
// as requiring a bed (fail safe, not fail open).
export const roomRequiresIndividualBed = (roomType) => {
  const value = String(roomType || "").trim().toLowerCase();
  return value !== "private";
};

const roomTypeRequiresBedAssignment = roomRequiresIndividualBed;

const resolveRoomType = (reservation, context) =>
  context.roomType || reservation.roomId?.type || reservation.preferredRoomType || "";

export const resolveReservationContractEligibility = (reservation = {}, context = {}) => {
  const status = normalized(reservation.status).replaceAll("_", "");
  const rawStatus = normalized(reservation.status);
  const rejected = REJECTED_STATUSES.has(rawStatus) || Boolean(reservation.rejectedAt);
  const cancelled = CANCELLED_STATUSES.has(rawStatus) || Boolean(reservation.cancelledAt);
  const cancellationPending = Boolean(reservation.cancellationRequested) &&
    normalized(reservation.cancellationStatus) === "pending";
  const sourceEvidence = {
    status: reservation.status || null,
    applicationReviewedAt: reservation.applicationReviewedAt || null,
    applicationReviewedBy: reservation.applicationReviewedBy || null,
    approvedForPaymentAt: reservation.approvedForPaymentAt || null,
    tenantExists: Boolean(context.tenantExists ?? reservation.userId),
    roomAssigned: Boolean(context.roomExists ?? reservation.roomId),
    bedAssigned: hasAssignment(reservation, context),
    moveInDate: readMoveInDate(reservation),
    paymentStatus: reservation.paymentStatus || null,
    rejected,
    cancelled,
    cancellationPending,
    legacyConfirmedAt: reservation.legacyContractApprovalConfirmedAt || null,
    legacyConfirmedBy: reservation.legacyContractApprovalConfirmedBy || null,
  };
  const roomType = resolveRoomType(reservation, context);
  const bedRequired = roomTypeRequiresBedAssignment(roomType);
  sourceEvidence.roomType = roomType || null;
  sourceEvidence.bedRequired = bedRequired;
  const reviewed = APPROVED_STATUSES.has(rawStatus) &&
    Boolean(reservation.applicationReviewedAt) &&
    Boolean(reservation.applicationReviewedBy);
  const explicitApproval = reviewed && (!bedRequired || sourceEvidence.bedAssigned);
  const approvedButMissingBed = reviewed && bedRequired && !sourceEvidence.bedAssigned;
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
      category: "BUSINESS_CONFLICT",
      retryable: false,
      humanActionRequired: true,
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  // A pending cancellation request means the tenant's continued occupancy is
  // unresolved — generating a new legal contract while that is open would
  // hand the tenant a document the business may be about to void. This is
  // checked ahead of approval/legacy evidence so an otherwise-eligible
  // reservation is still held for Admin review while the request is open.
  if (cancellationPending) return {
    eligible: false,
    approvalState: "cancellation_pending",
    blockers: [{
      code: "RESERVATION_CANCELLATION_PENDING",
      message: "The Reservation has an open cancellation request awaiting Admin review.",
      category: "PENDING_CANCELLATION",
      retryable: false,
      humanActionRequired: true,
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  if (explicitApproval) return {
    eligible: true, approvalState: "approved", blockers: [], sourceEvidence,
    legacyCompatibilityApplied: false,
  };
  // The reservation is approved, but this is a shared room (double- or
  // quadruple-sharing) and no individual bed/slot has been assigned yet —
  // do not fabricate one. This is a distinct, retryable state from "not yet
  // approved" so Job 19 and the real generator report the actual blocker
  // instead of a misleading "needs approval" message for an
  // already-approved reservation.
  if (approvedButMissingBed) return {
    eligible: false,
    approvalState: "bed_assignment_required",
    blockers: [{
      code: "RESERVATION_BED_ASSIGNMENT_REQUIRED",
      message: "This Reservation is approved, but has no individual bed assignment yet.",
      category: "PENDING_ADMIN_ACTION",
      retryable: true,
      humanActionRequired: true,
    }],
    sourceEvidence,
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
      category: "HISTORICAL_METADATA",
      retryable: false,
      humanActionRequired: true,
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
      category: "PENDING_ADMIN_ACTION",
      retryable: false,
      humanActionRequired: true,
    }],
    sourceEvidence,
    legacyCompatibilityApplied: false,
  };
};
