import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  status: {
    type: String,
    enum: ["processing", "payment_confirmed", "already_processed", "event_ignored", "event_unmatched", "event_rejected"],
    default: "processing",
  },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
  paymentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ReservationPaymentAttempt", default: null },
  providerObjectId: { type: String, default: null },
  reason: { type: String, default: "" },
  receivedAt: { type: Date, required: true, default: Date.now },
  processedAt: { type: Date, default: null },
  payloadSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.model("PaymongoWebhookEvent", schema);
