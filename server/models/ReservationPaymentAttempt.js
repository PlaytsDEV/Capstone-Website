import mongoose from "mongoose";

const schema = new mongoose.Schema({
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", required: true, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  branchId: { type: String, required: true, trim: true },
  paymongoCheckoutSessionId: { type: String, default: null, index: true },
  paymongoPaymentIntentId: { type: String, default: null },
  paymongoPaymentId: { type: String, default: null },
  paymongoReference: { type: String, default: null },
  expectedAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: null, min: 0 },
  currency: { type: String, required: true, default: "PHP", uppercase: true },
  status: {
    type: String,
    enum: ["creating", "checkout_created", "pending", "processing", "paid", "failed", "expired", "cancelled", "mismatched", "refunded", "partially_refunded", "manual_exception_review"],
    default: "creating",
    index: true,
  },
  checkoutUrl: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  attemptNumber: { type: Number, required: true, min: 1 },
  idempotencyKey: { type: String, required: true, unique: true },
  failureReason: { type: String, default: "" },
  lastWebhookEventId: { type: String, default: null },
  webhookReceivedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ reservationId: 1, status: 1 }, { name: "reservation_payment_attempt_status" });

export default mongoose.model("ReservationPaymentAttempt", schema);
