import mongoose from "mongoose";

const paymongoWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["paymongo"], default: "paymongo" },
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    receivedAt: { type: Date, default: Date.now, required: true },
    signatureVerified: { type: Boolean, default: false, required: true },
    processingStatus: {
      type: String,
      enum: ["received", "processing", "processed", "failed", "ignored"],
      default: "received",
      index: true,
    },
    processedAt: { type: Date, default: null },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "" },
    safeMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model("PaymongoWebhookEvent", paymongoWebhookEventSchema);
