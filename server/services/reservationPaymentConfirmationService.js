import crypto from "crypto";
import mongoose from "mongoose";
import PaymongoWebhookEvent from "../models/PaymongoWebhookEvent.js";
import Reservation from "../models/Reservation.js";
import ReservationPaymentAttempt from "../models/ReservationPaymentAttempt.js";
import { roundMoney } from "./billing/billingPolicy.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";
import {
  reconcileReservationPayment,
} from "./reservationPaymentReconciliationService.js";

const WEBHOOK_LEASE_MS = 60_000;
const result = (status, extra = {}) => ({ status, ...extra });

async function markFailure(event, {
  terminal = false,
  code,
  message = "",
  reservationId = null,
  paymentAttemptId = null,
}) {
  await PaymongoWebhookEvent.updateOne(
    { _id: event._id },
    {
      $set: {
        status: terminal ? "terminal_failed" : "retryable_failed",
        reason: code,
        lastErrorCode: code,
        lastErrorMessage: String(message || code).slice(0, 500),
        reservationId,
        paymentAttemptId,
        nextRetryAt: terminal ? null : new Date(),
        processingOwner: null,
        processingExpiresAt: null,
        processedAt: terminal ? new Date() : null,
      },
    },
  );
}
async function acquireWebhookEvent({
  eventId,
  eventType,
  providerObjectId,
  receivedAt,
  payloadSummary,
  correlationId,
  now,
}) {
  try {
    await PaymongoWebhookEvent.create({
      eventId,
      eventType,
      status: "received",
      providerObjectId,
      receivedAt,
      payloadSummary,
      correlationId,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const owner = crypto.randomUUID();
  const acquired = await PaymongoWebhookEvent.findOneAndUpdate(
    {
      eventId,
      $or: [
        { status: { $in: ["received", "retryable_failed"] } },
        { status: "processing", processingExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        processingOwner: owner,
        processingStartedAt: now,
        processingExpiresAt: new Date(now.getTime() + WEBHOOK_LEASE_MS),
        lastAttemptAt: now,
        nextRetryAt: null,
        lastErrorCode: "",
        lastErrorMessage: "",
        correlationId,
      },
      $inc: { attemptCount: 1 },
    },
    { new: true },
  );
  if (acquired) return { state: "acquired", event: acquired, owner };

  const existing = await PaymongoWebhookEvent.findOne({ eventId });
  if (!existing) return { state: "retryable_failed", event: null };
  if (existing.status === "processed") return { state: "processed", event: existing };
  if (existing.status === "terminal_failed") return { state: "terminal_failed", event: existing };
  return { state: "processing", event: existing };
}

export async function confirmReservationPaymentFromWebhook({
  eventId,
  eventType,
  reservationId,
  paymentAttemptId,
  checkoutSessionId,
  paymentId,
  paymentIntentId = null,
  amountMinor,
  currency,
  paymentMethod = "paymongo",
  receivedAt = new Date(),
  correlationId = "",
  now = new Date(),
  reconciliation = reconcileReservationPayment,
}) {
  if (!eventId || !eventType) return result("event_rejected", { reason: "MALFORMED_EVENT" });
  const acquisition = await acquireWebhookEvent({
    eventId,
    eventType,
    providerObjectId: paymentId || checkoutSessionId,
    receivedAt,
    payloadSummary: { reservationId, paymentAttemptId, checkoutSessionId, currency, amountMinor },
    correlationId,
    now,
  });
  if (acquisition.state === "processed") {
    const reservation = acquisition.event?.reservationId
      ? await Reservation.findById(acquisition.event.reservationId).populate("roomId", "name branch")
      : null;
    const reconciliationResult = reservation &&
      reservation.occupancySyncStatus !== "completed"
      ? await reconciliation(reservation._id)
      : null;
    return result("already_processed", {
      reservation,
      reconciliationStatus:
        reconciliationResult?.status || reservation?.occupancySyncStatus || "completed",
    });
  }
  if (acquisition.state === "processing") return result("processing");
  if (acquisition.state === "terminal_failed") {
    return result("event_rejected", { reason: acquisition.event?.reason || "TERMINAL_FAILURE" });
  }
  if (acquisition.state !== "acquired") return result("retryable_failed");

  const webhookEvent = acquisition.event;
  const attemptQuery = paymentAttemptId
    ? { _id: paymentAttemptId }
    : { paymongoCheckoutSessionId: checkoutSessionId };
  const attempt = await ReservationPaymentAttempt.findOne(attemptQuery);
  if (!attempt || (reservationId && String(attempt.reservationId) !== String(reservationId))) {
    await markFailure(webhookEvent, {
      code: "PAYMENT_ATTEMPT_NOT_FOUND",
      message: "Payment attempt is not available yet.",
    });
    return result("retryable_failed", { reason: "PAYMENT_ATTEMPT_NOT_FOUND" });
  }

  const reservation = await Reservation.findById(attempt.reservationId);
  if (!reservation) {
    await markFailure(webhookEvent, {
      terminal: true,
      code: "RESERVATION_NOT_FOUND",
      reservationId: attempt.reservationId,
      paymentAttemptId: attempt._id,
    });
    return result("event_rejected", { reason: "RESERVATION_NOT_FOUND" });
  }

  const paidAmount = roundMoney(Number(amountMinor) / 100);
  const normalizedCurrency = String(currency || "").toUpperCase();
  const amountMatches = paidAmount === roundMoney(attempt.expectedAmount);
  const currencyMatches = normalizedCurrency === String(attempt.currency).toUpperCase();
  const lifecycleAllowed = hasReservationStatus(
    reservation.status,
    "approved_for_payment",
    "payment_pending",
    "reserved",
  );
  if (!amountMatches || !currencyMatches || !lifecycleAllowed) {
    const failureReason = !amountMatches
      ? "PAYMENT_AMOUNT_MISMATCH"
      : !currencyMatches ? "PAYMENT_CURRENCY_MISMATCH" : "PAYMENT_LIFECYCLE_MISMATCH";
    attempt.status = "mismatched";
    attempt.paidAmount = Number.isFinite(paidAmount) ? paidAmount : null;
    attempt.failureReason = failureReason;
    attempt.lastWebhookEventId = eventId;
    attempt.webhookReceivedAt = receivedAt;
    await attempt.save();
    await markFailure(webhookEvent, {
      terminal: true,
      code: failureReason,
      reservationId: reservation._id,
      paymentAttemptId: attempt._id,
    });
    return result("event_rejected", { reason: failureReason });
  }

  if (reservation.paymentStatus === "paid" &&
      reservation.paymentVerificationSource === "paymongo_webhook") {
    await PaymongoWebhookEvent.updateOne(
      { _id: webhookEvent._id },
      {
        $set: {
          status: "processed",
          reservationId: reservation._id,
          paymentAttemptId: attempt._id,
          processedAt: new Date(),
          processingOwner: null,
          processingExpiresAt: null,
        },
      },
    );
    const reconciliationResult = reservation.occupancySyncStatus !== "completed"
      ? await reconciliation(reservation._id)
      : { status: "completed" };
    return result("already_processed", {
      reservation,
      reconciliationStatus: reconciliationResult.status,
    });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const verifiedAt = new Date();
      const updated = await Reservation.findOneAndUpdate(
        {
          _id: reservation._id,
          paymentStatus: { $ne: "paid" },
          status: { $in: ["approved_for_payment", "payment_pending"] },
        },
        {
          $set: {
            paymentStatus: "paid",
            status: "reserved",
            paymentVerificationSource: "paymongo_webhook",
            paymentVerifiedAt: verifiedAt,
            paymentDate: verifiedAt,
            paidAmount,
            paymentCurrency: normalizedCurrency,
            paymentMethod,
            paymongoPaymentId: paymentId,
            paymongoPaymentIntentId: paymentIntentId,
            paymongoSessionId: checkoutSessionId || attempt.paymongoCheckoutSessionId,
            paymongoReference: paymentId || checkoutSessionId,
            paymongoWebhookEventId: eventId,
            webhookReceivedAt: receivedAt,
            reservedAt: verifiedAt,
            reservationFeeAppliedTo: "initial_move_in_charges",
            reservationFeeAppliedAt: verifiedAt,
            reservationFeeApplicationReference: paymentId || checkoutSessionId,
            paymentReconciliationStatus: "pending",
            occupancySyncStatus: "pending",
            paymentNotificationStatus: "pending",
            reconciliationError: "",
          },
        },
        { new: true, session },
      );
      if (!updated) {
        throw Object.assign(new Error("Concurrent payment confirmation conflict."), {
          code: "PAYMENT_CONFIRMATION_CONFLICT",
        });
      }
      await ReservationPaymentAttempt.updateOne(
        { _id: attempt._id, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            paidAmount,
            paymongoPaymentId: paymentId,
            paymongoPaymentIntentId: paymentIntentId,
            paymongoReference: paymentId || checkoutSessionId,
            lastWebhookEventId: eventId,
            webhookReceivedAt: receivedAt,
            failureReason: "",
          },
        },
        { session },
      );
      await PaymongoWebhookEvent.updateOne(
        { _id: webhookEvent._id, processingOwner: acquisition.owner },
        {
          $set: {
            status: "processed",
            reservationId: reservation._id,
            paymentAttemptId: attempt._id,
            processedAt: verifiedAt,
            processingOwner: null,
            processingExpiresAt: null,
          },
        },
        { session },
      );
    });
  } catch (error) {
    await markFailure(webhookEvent, {
      code: error.code || "PAYMENT_CONFIRMATION_FAILED",
      message: error.message,
      reservationId: reservation._id,
      paymentAttemptId: attempt._id,
    }).catch(() => {});
    throw error;
  } finally {
    await session.endSession();
  }

  const reconciliationResult = await reconciliation(reservation._id);
  return result("payment_confirmed", {
    reservation: await Reservation.findById(reservation._id).populate("roomId", "name branch"),
    reconciliationStatus: reconciliationResult.status,
    warning: reconciliationResult.status === "failed"
      ? "Payment was confirmed, but occupancy reconciliation is pending."
      : null,
  });
}
