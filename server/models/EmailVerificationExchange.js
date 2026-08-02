import mongoose from "mongoose";

const emailVerificationExchangeSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    kind: { type: String, enum: ["action", "session"], required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    emailHash: { type: String, required: true },
    continuePath: { type: String, required: true, default: "/signin" },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emailVerificationExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.EmailVerificationExchange ||
  mongoose.model("EmailVerificationExchange", emailVerificationExchangeSchema);
