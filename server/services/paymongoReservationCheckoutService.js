import crypto from "crypto";
import dayjs from "dayjs";
import { createCheckoutSession } from "../config/paymongo.js";
import ReservationPaymentAttempt from "../models/ReservationPaymentAttempt.js";
import { getReservationCheckoutBlockers } from "./reservationPaymentPolicy.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";

const checkoutError = (message, code, statusCode = 409, details) =>
  Object.assign(new Error(message), { code, statusCode, ...(details ? { details } : {}) });
const ACTIVE_ATTEMPT_STATUSES = ["creating", "checkout_created", "pending", "processing"];

export async function createReservationCheckout({
  reservation,
  applicantId,
  frontendUrl,
  gateway = createCheckoutSession,
}) {
  if (!hasReservationStatus(reservation.status, "approved_for_payment", "payment_pending")) {
    throw checkoutError("Payment is available only after explicit application approval.", "PAYMENT_LOCKED_PENDING_APPLICATION_REVIEW", 403);
  }
  if (reservation.paymentStatus === "paid" || reservation.paymentVerifiedAt) {
    throw checkoutError("Reservation payment is already confirmed.", "ALREADY_PAID");
  }
  const { blockers, pricing } = getReservationCheckoutBlockers(reservation);
  if (blockers.length) {
    throw checkoutError("Reservation is not ready for PayMongo checkout.", blockers[0], 409, { blockers });
  }

  const now = new Date();
  const reusable = await ReservationPaymentAttempt.findOne({
    reservationId: reservation._id,
    applicantId,
    status: { $in: ACTIVE_ATTEMPT_STATUSES },
    expiresAt: { $gt: now },
    checkoutUrl: { $type: "string", $ne: "" },
  }).sort({ createdAt: -1 });
  if (reusable) {
    return {
      checkoutUrl: reusable.checkoutUrl,
      sessionId: reusable.paymongoCheckoutSessionId,
      expectedAmount: reusable.expectedAmount,
      currency: reusable.currency,
      expiresAt: reusable.expiresAt,
      reused: true,
    };
  }

  const attemptNumber = await ReservationPaymentAttempt.countDocuments({ reservationId: reservation._id }) + 1;
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = dayjs().add(24, "hour").toDate();
  const branchId = reservation.roomId?.branch || reservation.branchId || reservation.branch;
  if (!branchId) throw checkoutError("Reservation branch is unresolved.", "BRANCH_REFERENCE_INVALID");

  const attempt = await ReservationPaymentAttempt.create({
    reservationId: reservation._id,
    applicantId,
    branchId,
    expectedAmount: pricing.remainingInitialAmount,
    currency: pricing.currency,
    expiresAt,
    attemptNumber,
    idempotencyKey,
    status: "creating",
  });

  try {
    const result = await gateway({
      amount: pricing.remainingInitialAmount,
      currency: pricing.currency,
      idempotencyKey,
      description: `Lilycrest Dormitory - Initial Move-In Charges (${reservation.reservationCode || reservation._id})`,
      metadata: {
        type: "deposit",
        reservationId: String(reservation._id),
        paymentAttemptId: String(attempt._id),
        userId: String(applicantId),
        expectedAmount: String(pricing.remainingInitialAmount),
        currency: pricing.currency,
      },
      successUrl: `${frontendUrl}/applicant/reservation?payment=processing&session_id={id}`,
      cancelUrl: `${frontendUrl}/applicant/reservation?payment=cancelled&session_id={id}`,
    });
    attempt.paymongoCheckoutSessionId = result.sessionId;
    attempt.checkoutUrl = result.checkoutUrl;
    attempt.status = "checkout_created";
    await attempt.save();

    reservation.paymongoSessionId = result.sessionId;
    reservation.checkoutExpiresAt = expiresAt;
    reservation.paymentExpiresAt = expiresAt;
    reservation.status = "payment_pending";
    reservation.paymentStatus = "pending";
    await reservation.save();

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      expectedAmount: pricing.remainingInitialAmount,
      currency: pricing.currency,
      expiresAt,
      reused: false,
    };
  } catch (error) {
    attempt.status = "failed";
    attempt.failureReason = error.message;
    await attempt.save().catch(() => {});
    throw error;
  }
}
