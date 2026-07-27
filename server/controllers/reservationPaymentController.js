import mongoose from "mongoose";
import { Payment, Reservation, Room, User } from "../models/index.js";
import auditLogger from "../utils/auditLogger.js";
import { isAllowedReservationDocumentUrl } from "./reservations/_helpers.js";
import {
  ReservationDepositSettlementError,
  resolveReservationFee,
  settleReservationDeposit,
  toCentavos,
} from "../services/reservationDepositSettlementService.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";
import { isOwnerRole } from "../config/roles.js";
import { getReservationFeeAmount } from "../utils/businessSettings.js";

const REJECTION_REASON_CODES = new Set([
  "UNREADABLE_PROOF",
  "AMOUNT_MISMATCH",
  "INVALID_REFERENCE",
  "DUPLICATE_PROOF",
  "WRONG_ACCOUNT",
  "PAYMENT_NOT_FOUND",
  "OTHER",
]);

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

export const submitReservationPaymentProof = async (req, res) => {
  try {
    const { reservationId } = req.params;
    if (!mongoose.isValidObjectId(reservationId)) {
      throw new ReservationDepositSettlementError(
        "A valid Reservation ID is required.",
        "INVALID_RESERVATION_ID",
        400,
      );
    }
    const tenant = await getDbUser(req.user.uid);
    if (!tenant) {
      throw new ReservationDepositSettlementError(
        "User not found.",
        "USER_NOT_FOUND",
        404,
      );
    }
    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
      "branch",
    );
    if (!reservation) {
      throw new ReservationDepositSettlementError(
        "Reservation not found.",
        "RESERVATION_NOT_FOUND",
        404,
      );
    }
    if (String(reservation.userId) !== String(tenant._id)) {
      throw new ReservationDepositSettlementError(
        "You can submit proof only for your own Reservation.",
        "RESERVATION_ACCESS_DENIED",
        403,
      );
    }
    if (
      !hasReservationStatus(
        reservation.status,
        "approved_for_payment",
        "payment_pending",
      )
    ) {
      throw new ReservationDepositSettlementError(
        "The Reservation is not ready for payment proof submission.",
        "PAYMENT_READINESS_INCOMPLETE",
        409,
      );
    }
    if (reservation.paymentStatus === "paid") {
      throw new ReservationDepositSettlementError(
        "The Reservation deposit is already confirmed.",
        "PAYMENT_ALREADY_CONFIRMED",
        409,
      );
    }
    if (
      reservation.paymentExpiresAt &&
      new Date(reservation.paymentExpiresAt).getTime() < Date.now()
    ) {
      throw new ReservationDepositSettlementError(
        "The Reservation payment window has expired.",
        "RESERVATION_PAYMENT_EXPIRED",
        409,
      );
    }
    if (reservation.paymongoSessionId) {
      throw new ReservationDepositSettlementError(
        "An online checkout already exists for this Reservation.",
        "ACTIVE_CHECKOUT_EXISTS",
        409,
      );
    }

    const proofUrl = String(
      req.body?.proofUrl || req.body?.proofOfPaymentUrl || "",
    ).trim();
    const paymentReference = String(req.body?.paymentReference || "").trim();
    const paymentMethod = String(req.body?.paymentMethod || "").trim();
    const paidAt = new Date(req.body?.paidAt);
    const amount = Number(req.body?.amount);
    if (!proofUrl || !isAllowedReservationDocumentUrl(proofUrl)) {
      throw new ReservationDepositSettlementError(
        "A valid uploaded payment-proof URL is required.",
        "INVALID_PROOF_OF_PAYMENT_URL",
        422,
      );
    }
    if (!Number.isFinite(amount) || toCentavos(amount) < 0) {
      throw new ReservationDepositSettlementError(
        "A valid submitted payment amount is required.",
        "PAYMENT_AMOUNT_INVALID",
        422,
      );
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._/# -]{2,79}$/.test(paymentReference)) {
      throw new ReservationDepositSettlementError(
        "A valid payment reference is required.",
        "PAYMENT_REFERENCE_INVALID",
        422,
      );
    }
    if (!["bank_transfer", "bank", "cash", "gcash"].includes(paymentMethod)) {
      throw new ReservationDepositSettlementError(
        "Unsupported manual payment method.",
        "PAYMENT_METHOD_INVALID",
        422,
      );
    }
    if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) {
      throw new ReservationDepositSettlementError(
        "A valid payment date is required.",
        "PAYMENT_DATE_INVALID",
        422,
      );
    }

    const duplicate = await Payment.findOne({
      reservationId: reservation._id,
      purpose: "reservation_deposit",
      status: { $in: ["proof_submitted", "under_review"] },
    }).lean();
    if (duplicate) {
      throw new ReservationDepositSettlementError(
        "A payment proof is already awaiting review.",
        "DUPLICATE_PROOF",
        409,
        { paymentId: String(duplicate._id) },
      );
    }

    const expectedAmount = await resolveReservationFee(
      reservation,
      getReservationFeeAmount,
    );
    const payment = await Payment.create({
      tenantId: tenant._id,
      reservationId: reservation._id,
      billId: null,
      purpose: "reservation_deposit",
      branch: reservation.roomId?.branch,
      amount,
      expectedAmount,
      paidAmount: amount,
      currency: "PHP",
      method: paymentMethod === "bank_transfer" ? "bank" : paymentMethod,
      source: "manual_proof",
      paymentReference,
      referenceNumber: paymentReference,
      proofUrl,
      proofImageUrl: proofUrl,
      submittedAt: new Date(),
      processedAt: paidAt,
      status: "under_review",
      metadata: {
        action: "reservation.payment_proof_submitted",
        previousReservationStatus: reservation.status,
      },
    });

    reservation.proofOfPaymentUrl = proofUrl;
    reservation.paymentStatus = "partial";
    reservation.status = "payment_pending";
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation_payment",
      payment._id,
      null,
      payment.toObject(),
      "reservation.payment_proof_submitted",
    );
    return res.status(201).json({
      message: "Payment proof submitted for administrator review.",
      payment,
      reservation,
    });
  } catch (error) {
    return paymentError(res, error);
  }
};

export const listReservationPaymentReviews = async (req, res) => {
  try {
    const admin = await getDbUser(req.user.uid);
    if (!admin) {
      throw new ReservationDepositSettlementError(
        "Administrator not found.",
        "USER_NOT_FOUND",
        404,
      );
    }
    const query = { purpose: "reservation_deposit" };
    if (req.query.status) {
      query.status = String(req.query.status);
    } else {
      query.status = {
        $in: [
          "under_review",
          "amount_mismatch",
          "reconciliation_required",
          "confirmed",
          "rejected",
        ],
      };
    }
    if (!isOwnerRole(admin.role)) query.branch = admin.branch;

    const payments = await Payment.find(query)
      .populate("tenantId", "firstName lastName email")
      .populate({
        path: "reservationId",
        select:
          "reservationCode status paymentStatus reservationFeeAmount paymongoPaymentId roomId selectedBed",
        populate: { path: "roomId", select: "name roomNumber branch type" },
      })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    return res.json({ payments });
  } catch (error) {
    return paymentError(res, error);
  }
};

export const approveReservationPaymentProof = async (req, res) => {
  try {
    const { reservationId, paymentId } = req.params;
    const admin = await getDbUser(req.user.uid);
    if (!admin) {
      throw new ReservationDepositSettlementError(
        "Administrator not found.",
        "USER_NOT_FOUND",
        404,
      );
    }
    const [reservation, proof] = await Promise.all([
      Reservation.findById(reservationId),
      Payment.findOne({
        _id: paymentId,
        reservationId,
        purpose: "reservation_deposit",
      }),
    ]);
    if (!reservation || !proof) {
      throw new ReservationDepositSettlementError(
        "Payment proof record not found.",
        "PAYMENT_ATTEMPT_NOT_FOUND",
        404,
      );
    }
    await assertAdminBranch({ admin, reservation });
    if (proof.status !== "under_review") {
      throw new ReservationDepositSettlementError(
        "This payment proof is no longer awaiting review.",
        "PAYMENT_PROOF_NOT_REVIEWABLE",
        409,
        { status: proof.status },
      );
    }
    if (reservation.paymongoPaymentId || reservation.paymentMethod === "paymongo") {
      throw new ReservationDepositSettlementError(
        "A PayMongo settlement already exists for this Reservation.",
        "PAYMONGO_SETTLEMENT_ALREADY_EXISTS",
        409,
      );
    }

    const result = await settleReservationDeposit({
      reservationId,
      source: "manual_proof",
      paidAmount: proof.paidAmount ?? proof.amount,
      paymentReference: proof.paymentReference || proof.referenceNumber,
      idempotencyKey: `manual-proof:${proof._id}`,
      evidence: {
        proofUrl: proof.proofUrl || proof.proofImageUrl,
        paymentMethod: proof.method,
        submittedAt: proof.submittedAt,
        currency: proof.currency,
      },
      actor: { id: admin._id, role: admin.role },
      paidAt: proof.processedAt || proof.submittedAt || new Date(),
      existingPaymentId: proof._id,
    });

    await auditLogger.logModification(
      req,
      "reservation_payment",
      result.payment._id,
      proof.toObject(),
      result.payment.toObject(),
      "reservation.payment_proof_approved",
    );
    return res.json({
      message: "Reservation payment confirmed.",
      payment: result.payment,
      reservation: result.reservation,
      idempotent: result.idempotent,
    });
  } catch (error) {
    return paymentError(res, error);
  }
};

export const rejectReservationPaymentProof = async (req, res) => {
  try {
    const { reservationId, paymentId } = req.params;
    const reasonCode = String(req.body?.reasonCode || "").trim().toUpperCase();
    const reason = String(req.body?.reason || "").trim();
    if (!REJECTION_REASON_CODES.has(reasonCode) || reason.length < 3) {
      throw new ReservationDepositSettlementError(
        "A valid rejection reason code and explanation are required.",
        "PAYMENT_REJECTION_REASON_REQUIRED",
        422,
      );
    }
    const admin = await getDbUser(req.user.uid);
    const reservation = await Reservation.findById(reservationId);
    const payment = await Payment.findOne({
      _id: paymentId,
      reservationId,
      purpose: "reservation_deposit",
    });
    if (!admin || !reservation || !payment) {
      throw new ReservationDepositSettlementError(
        "Payment proof record not found.",
        "PAYMENT_ATTEMPT_NOT_FOUND",
        404,
      );
    }
    await assertAdminBranch({ admin, reservation });
    if (payment.status !== "under_review") {
      throw new ReservationDepositSettlementError(
        "This payment proof is no longer awaiting review.",
        "PAYMENT_PROOF_NOT_REVIEWABLE",
        409,
      );
    }
    const previous = payment.toObject();
    payment.status = "rejected";
    payment.rejectedAt = new Date();
    payment.rejectedBy = admin._id;
    payment.rejectionReasonCode = reasonCode;
    payment.rejectionReason = reason;
    payment.metadata = {
      ...(payment.metadata || {}),
      action: "reservation.payment_proof_rejected",
      actorRole: admin.role,
    };
    await payment.save();

    reservation.paymentStatus = "pending";
    reservation.status = "approved_for_payment";
    await reservation.save();

    await auditLogger.logModification(
      req,
      "reservation_payment",
      payment._id,
      previous,
      payment.toObject(),
      "reservation.payment_proof_rejected",
    );
    return res.json({
      message: "Payment proof rejected. The evidence was preserved.",
      payment,
      reservation,
    });
  } catch (error) {
    return paymentError(res, error);
  }
};
