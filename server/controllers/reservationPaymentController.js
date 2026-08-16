import { Reservation, Room, User } from "../models/index.js";
import {
  ReservationDepositSettlementError,
  settleReservationDeposit,
} from "../services/reservationDepositSettlementService.js";
import { isOwnerRole } from "../config/roles.js";

// ============================================================================
// NOTE: Manual payment proof upload/review endpoints have been decommissioned.
// All reservation deposit payments flow through automated PayMongo checkout.
// Removed: submitReservationPaymentProof, listReservationPaymentReviews,
//          approveReservationPaymentProof, rejectReservationPaymentProof
// ============================================================================

const paymentError = (res, error) => {
  const status = error?.statusCode || 500;
  return res.status(status).json({
    code: error?.code || "RESERVATION_PAYMENT_ERROR",
    message: error?.message || "Unable to process Reservation payment.",
    error: error?.message || "Unable to process Reservation payment.",
    ...(error?.details && { details: error.details }),
  });
};

const getDbUser = (firebaseUid) => User.findOne({ firebaseUid });

const assertAdminBranch = async ({ admin, reservation }) => {
  if (isOwnerRole(admin?.role)) return;
  const room = await Room.findById(reservation.roomId).select("branch").lean();
  if (!room || room.branch !== admin?.branch) {
    throw new ReservationDepositSettlementError(
      "You cannot review payments for another branch.",
      "BRANCH_ACCESS_DENIED",
      403,
    );
  }
};

// ---------------------------------------------------------------------------
// Decommissioned stubs — return HTTP 410 Gone so any stale client calls fail
// gracefully with a clear error message instead of a 404 or 500.
// ---------------------------------------------------------------------------

export const submitReservationPaymentProof = async (_req, res) => {
  return res.status(410).json({
    code: "MANUAL_PROOF_DECOMMISSIONED",
    message:
      "Manual payment proof upload has been removed. Please use the PayMongo checkout to pay your Reservation Fee.",
  });
};

export const listReservationPaymentReviews = async (_req, res) => {
  return res.status(410).json({
    code: "MANUAL_PROOF_DECOMMISSIONED",
    message:
      "Manual proof review has been removed. All payments are verified automatically via PayMongo.",
  });
};

export const approveReservationPaymentProof = async (_req, res) => {
  return res.status(410).json({
    code: "MANUAL_PROOF_DECOMMISSIONED",
    message:
      "Manual proof approval has been removed. PayMongo webhooks handle settlement automatically.",
  });
};

export const rejectReservationPaymentProof = async (_req, res) => {
  return res.status(410).json({
    code: "MANUAL_PROOF_DECOMMISSIONED",
    message:
      "Manual proof rejection has been removed. PayMongo webhooks handle settlement automatically.",
  });
};
