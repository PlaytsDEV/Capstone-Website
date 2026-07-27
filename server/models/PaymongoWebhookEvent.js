import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  status: {
    type: String,
    enum: ["received", "processing", "processed", "retryable_failed", "terminal_failed"],
    default: "received",
    index: true,
  },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
  paymentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ReservationPaymentAttempt", default: null },
  providerObjectId: { type: String, default: null },
  reason: { type: String, default: "" },
  receivedAt: { type: Date, required: true, default: Date.now },
  processedAt: { type: Date, default: null },
  attemptCount: { type: Number, default: 0, min: 0 },
  lastAttemptAt: { type: Date, default: null },
  nextRetryAt: { type: Date, default: null },
  processingStartedAt: { type: Date, default: null },
  processingExpiresAt: { type: Date, default: null },
  processingOwner: { type: String, default: null },
  lastErrorCode: { type: String, default: "" },
  lastErrorMessage: { type: String, default: "" },
  correlationId: { type: String, default: "" },
  payloadSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.model("PaymongoWebhookEvent", schema);
