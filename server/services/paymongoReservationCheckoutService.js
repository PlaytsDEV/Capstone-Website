import crypto from "crypto";
import { createCheckoutSession } from "../config/paymongo.js";
import ReservationPaymentAttempt from "../models/ReservationPaymentAttempt.js";
import {
  getReservationCheckoutBlockers,
} from "./reservationPaymentPolicy.js";
import {
  evaluateReservationPaymentReadiness,
  paymentReadinessError,
} from "./reservationPaymentReadinessService.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";

const checkoutError = (message, code, statusCode = 409, details) =>
  Object.assign(new Error(message), { code, statusCode, ...(details ? { details } : {}) });

const CREATION_LEASE_MS = 60_000;
const ACTIVE_ATTEMPT_STATUSES = ["creating", "checkout_created", "pending", "processing"];
const paymentKey = (reservationId) =>
  `reservation:${reservationId}:initial-payment`;
const deterministicIdempotencyKey = (key) =>
  `lilycrest-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 40)}`;

async function acquireAttempt({ reservation, applicantId, quote, now }) {
  const activeAttemptKey = paymentKey(reservation._id);
  const owner = crypto.randomUUID();
  const creationLeaseExpiresAt = new Date(now.getTime() + CREATION_LEASE_MS);
  const idempotencyKey = deterministicIdempotencyKey(activeAttemptKey);
  let attempt;
  let ownsCreation = false;

  try {
    attempt = await ReservationPaymentAttempt.create({
      reservationId: reservation._id,
      applicantId,
      branchId: reservation.roomId?.branch || reservation.branchId || reservation.branch,
      paymentPurpose: "initial_move_in",
      activeAttemptKey,
      expectedAmount: quote.amountDue,
      currency: quote.currency,
      expiresAt: reservation.paymentExpiresAt,
      attemptNumber: 1,
      idempotencyKey,
      pricingSnapshot: quote,
      quoteHash: quote.quoteHash,
      status: "creating",
      creationOwner: owner,
      creationLeaseExpiresAt,
    });
    ownsCreation = true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    attempt = await ReservationPaymentAttempt.findOne({ activeAttemptKey });
    if (!attempt) {
      throw checkoutError(
        "Payment checkout is being initialized. Please retry.",
        "PAYMENT_CHECKOUT_IN_PROGRESS",
      );
    }
  }

  if (!ownsCreation && attempt.checkoutUrl &&
      ACTIVE_ATTEMPT_STATUSES.includes(attempt.status) &&
      (!attempt.expiresAt || attempt.expiresAt > now)) {
    return { attempt, ownsCreation: false, reusable: true };
  }

  if (!ownsCreation) {
    const leaseActive = attempt.status === "creating" &&
      attempt.creationLeaseExpiresAt && attempt.creationLeaseExpiresAt > now;
    if (leaseActive) {
      throw checkoutError(
        "Payment checkout is already being created.",
        "PAYMENT_CHECKOUT_IN_PROGRESS",
      );
    }
    attempt = await ReservationPaymentAttempt.findOneAndUpdate(
      {
        _id: attempt._id,
        $or: [
          { status: { $in: ["failed", "expired", "cancelled"] } },
          { status: "creating", creationLeaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "creating",
          creationOwner: owner,
          creationLeaseExpiresAt,
          failureReason: "",
          expectedAmount: quote.amountDue,
          pricingSnapshot: quote,
          quoteHash: quote.quoteHash,
          expiresAt: reservation.paymentExpiresAt,
        },
      },
      { new: true },
    );
    if (!attempt) {
      throw checkoutError(
        "Payment checkout is already in progress.",
        "PAYMENT_CHECKOUT_IN_PROGRESS",
      );
    }
    ownsCreation = true;
  }

  return { attempt, ownsCreation, reusable: false, owner };
}
export async function createReservationCheckout({
  reservation,
  applicantId,
  frontendUrl,
  gateway = createCheckoutSession,
  now = new Date(),
}) {
  if (!hasReservationStatus(reservation.status, "approved_for_payment", "payment_pending")) {
    throw checkoutError(
      "Payment is available only after explicit application approval.",
      "PAYMENT_LOCKED_PENDING_APPLICATION_REVIEW",
      409,
    );
  }
  if (reservation.paymentStatus === "paid" || reservation.paymentVerifiedAt) {
    throw checkoutError("Reservation payment is already confirmed.", "ALREADY_PAID");
  }
  if (hasReservationStatus(reservation.status, "moveIn")) {
    throw checkoutError("The tenant has already moved in.", "INVALID_LIFECYCLE_TRANSITION");
  }

  const readiness = await evaluateReservationPaymentReadiness(reservation);
  if (!readiness.ready) throw paymentReadinessError(readiness);
  const { blockers, quote } = getReservationCheckoutBlockers(reservation, now);
  if (blockers.includes("PAYMENT_DEADLINE_EXPIRED")) {
    throw checkoutError(
      "The approved payment deadline has expired.",
      "PAYMENT_DEADLINE_EXPIRED",
    );
  }
  if (blockers.length) {
    throw checkoutError(
      "Reservation is not ready for PayMongo checkout.",
      "PAYMENT_READINESS_INCOMPLETE",
      422,
      { missingFields: blockers },
    );
  }

  const acquisition = await acquireAttempt({ reservation, applicantId, quote, now });
  const { attempt } = acquisition;
  if (acquisition.reusable) {
    return {
      checkoutUrl: attempt.checkoutUrl,
      sessionId: attempt.paymongoCheckoutSessionId,
      expectedAmount: attempt.expectedAmount,
      currency: attempt.currency,
      expiresAt: attempt.expiresAt,
      reused: true,
    };
  }

  try {
    const result = await gateway({
      amount: quote.amountDue,
      currency: quote.currency,
      idempotencyKey: attempt.idempotencyKey,
      description: `Lilycrest Dormitory - Initial Move-In Charges (${reservation.reservationCode || reservation._id})`,
      metadata: {
        type: "deposit",
        reservationId: String(reservation._id),
        paymentAttemptId: String(attempt._id),
        userId: String(applicantId),
        expectedAmount: String(quote.amountDue),
        currency: quote.currency,
        quoteHash: quote.quoteHash,
      },
      successUrl: `${frontendUrl}/applicant/reservation?payment=processing&session_id={id}`,
      cancelUrl: `${frontendUrl}/applicant/reservation?payment=cancelled&session_id={id}`,
    });

    const updatedAttempt = await ReservationPaymentAttempt.findOneAndUpdate(
      { _id: attempt._id, creationOwner: acquisition.owner, status: "creating" },
      {
        $set: {
          paymongoCheckoutSessionId: result.sessionId,
          checkoutUrl: result.checkoutUrl,
          status: "checkout_created",
          creationOwner: null,
          creationLeaseExpiresAt: null,
        },
      },
      { new: true },
    );
    if (!updatedAttempt) {
      throw checkoutError(
        "Payment checkout ownership was lost before completion.",
        "PAYMENT_CHECKOUT_IN_PROGRESS",
      );
    }

    reservation.paymongoSessionId = result.sessionId;
    reservation.checkoutExpiresAt = reservation.paymentExpiresAt;
    reservation.status = "payment_pending";
    reservation.paymentStatus = "pending";
    await reservation.save();

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      expectedAmount: quote.amountDue,
      currency: quote.currency,
      expiresAt: reservation.paymentExpiresAt,
      reused: false,
    };
  } catch (error) {
    await ReservationPaymentAttempt.updateOne(
      { _id: attempt._id, creationOwner: acquisition.owner },
      {
        $set: {
          status: "failed",
          failureReason: error.code || error.message,
          creationOwner: null,
          creationLeaseExpiresAt: null,
        },
      },
    ).catch(() => {});
    throw error;
  }
}
