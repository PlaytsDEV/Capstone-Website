import mongoose from "mongoose";
import PaymongoWebhookEvent from "../models/PaymongoWebhookEvent.js";
import Reservation from "../models/Reservation.js";
import ReservationPaymentAttempt from "../models/ReservationPaymentAttempt.js";
import { roundMoney } from "./billing/billingPolicy.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";

const result = (status, extra = {}) => ({ status, ...extra });

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
}) {
  if (!eventId || !eventType) return result("event_rejected", { reason: "MALFORMED_EVENT" });

  let webhookEvent;
  try {
    webhookEvent = await PaymongoWebhookEvent.create({
      eventId,
      eventType,
      status: "processing",
      providerObjectId: paymentId || checkoutSessionId,
      receivedAt,
      payloadSummary: { reservationId, paymentAttemptId, checkoutSessionId, currency, amountMinor },
    });
  } catch (error) {
    if (error?.code === 11000) return result("already_processed");
    throw error;
  }

  const attemptQuery = paymentAttemptId
    ? { _id: paymentAttemptId }
    : { paymongoCheckoutSessionId: checkoutSessionId };
  const attempt = await ReservationPaymentAttempt.findOne(attemptQuery);
  if (!attempt || (reservationId && String(attempt.reservationId) !== String(reservationId))) {
    webhookEvent.status = "event_unmatched";
    webhookEvent.reason = "PAYMENT_ATTEMPT_NOT_FOUND";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return result("event_unmatched");
  }

  const reservation = await Reservation.findById(attempt.reservationId);
  if (!reservation) {
    webhookEvent.status = "event_unmatched";
    webhookEvent.reason = "RESERVATION_NOT_FOUND";
    webhookEvent.paymentAttemptId = attempt._id;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return result("event_unmatched");
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
    attempt.status = "mismatched";
    attempt.paidAmount = Number.isFinite(paidAmount) ? paidAmount : null;
    attempt.failureReason = !amountMatches
      ? "PAYMENT_AMOUNT_MISMATCH"
      : !currencyMatches ? "PAYMENT_CURRENCY_MISMATCH" : "PAYMENT_LIFECYCLE_MISMATCH";
    attempt.lastWebhookEventId = eventId;
    attempt.webhookReceivedAt = receivedAt;
    await attempt.save();
    webhookEvent.status = "event_rejected";
    webhookEvent.reason = attempt.failureReason;
    webhookEvent.reservationId = reservation._id;
    webhookEvent.paymentAttemptId = attempt._id;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return result("event_rejected", { reason: attempt.failureReason });
  }

  if (
    reservation.paymentStatus === "paid" &&
    reservation.paymentVerificationSource === "paymongo_webhook"
  ) {
    webhookEvent.status = "already_processed";
    webhookEvent.reservationId = reservation._id;
    webhookEvent.paymentAttemptId = attempt._id;
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return result("already_processed", { reservation });
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
          },
        },
        { new: true, session },
      );
      if (!updated) throw Object.assign(new Error("Concurrent payment confirmation conflict."), {
        code: "PAYMENT_CONFIRMATION_CONFLICT",
      });

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
        { _id: webhookEvent._id },
        {
          $set: {
            status: "payment_confirmed",
            reservationId: reservation._id,
            paymentAttemptId: attempt._id,
            processedAt: verifiedAt,
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return result("payment_confirmed", {
    reservation: await Reservation.findById(reservation._id).populate("roomId", "name branch"),
  });
}
