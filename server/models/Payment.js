/**
 * ============================================================================
 * PAYMENT MODEL
 * ============================================================================
 *
 * Separate payment ledger for financial auditing.
 * Each record represents a single payment transaction.
 *
 * BENEFITS:
 * - Financial auditing separate from bill status
 * - Payment history and reporting
 * - Multiple payments per bill support
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { ROOM_BRANCHES } from "../config/branches.js";
import { PAYMENT_METHODS } from "../config/paymentMethods.js";

const paymentSchema = new mongoose.Schema(
  {
    // --- Payment Identity ---
    paymentId: {
      type: String,
      required: true,
      unique: true,
      default: () => `PAY-${uuidv4().slice(0, 8).toUpperCase()}`,
      index: true,
    },

    // --- References ---
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
      index: true,
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null,
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        "reservation_deposit",
        "reservation_fee",
        "initial_payment",
        "rent",
        "regular_rent",
        "utility",
        "penalty",
        "other",
      ],
      default: "other",
      index: true,
    },

    // --- Payment Details ---
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      alias: "paymentMethod",
    },
    source: {
      type: String,
      enum: [
        "admin-manual",
        "tenant-proof",
        "paymongo-polling",
        "paymongo-webhook",
        "paymongo",
        "manual_proof",
        "manual_admin",
        "legacy",
      ],
      default: "admin-manual",
      index: true,
    },
    expectedAmount: { type: Number, default: null, min: 0 },
    paidAmount: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "PHP", uppercase: true, trim: true },
    provider: {
      type: String,
      enum: ["paymongo", "legacy", null],
      default: null,
      index: true,
    },
    providerPaymentId: { type: String, default: null, index: true },
    paymentIntentId: { type: String, default: null, index: true },
    webhookEventReference: { type: String, default: null, index: true },
    settlementTimestamp: { type: Date, default: null },
    externalSessionId: { type: String, default: null, index: true },
    paymentReference: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, default: null },
    proofUrl: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    referenceNumber: {
      type: String,
      default: null,
    },
    externalPaymentId: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    proofImageUrl: {
      type: String,
      default: null,
    },

    // --- Status ---
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "paid",
        "rejected",
        "proof_submitted",
        "under_review",
        "confirmed",
        "amount_mismatch",
        "reconciliation_required",
      ],
      default: "pending",
      index: true,
    },

    // --- Verification ---
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReasonCode: { type: String, default: null, trim: true },
    rejectionReason: {
      type: String,
      default: null,
    },

    // --- Branch ---
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },

    // --- Notes ---
    notes: {
      type: String,
      default: "",
    },

    // --- Plan 3 (D5): Audit Ledger Snapshot ---
    // Captures the bill balance immediately before and after this payment.
    // balanceAfter is always ₱0.00 for full settlements (exact payment only).
    // recordedBy is "system" for PayMongo webhook settlements, or adminId for
    // manually recorded offline (cash / bank transfer) payments.
    balanceBefore: {
      type: Number,
      default: null,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },
    recordedBy: {
      type: String,
      default: "system", // "system" | adminId string
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================================
// INDEXES
// ============================================================================

paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ billId: 1, status: 1 });
paymentSchema.index({ reservationId: 1, purpose: 1, createdAt: -1 });
paymentSchema.index({ branch: 1, createdAt: -1 });
paymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
paymentSchema.index(
  { externalPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalPaymentId: { $type: "string" } },
  },
);
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: "paymongo",
      providerPaymentId: { $type: "string" },
    },
  },
);

paymentSchema.pre("validate", function validateFinancialParent(next) {
  if (!this.billId && !this.reservationId) {
    this.invalidate(
      "billId",
      "A payment must reference either a bill or a reservation.",
    );
  }
  if (this.billId && this.reservationId) {
    this.invalidate(
      "reservationId",
      "A payment cannot reference both a bill and a reservation.",
    );
  }
  next();
});

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get payment history for a tenant
 */
paymentSchema.statics.getPaymentHistory = function (tenantId, options = {}) {
  const { limit = 50 } = options;
  return this.find({ tenantId })
    .populate("billId", "billingMonth totalAmount status")
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Get payments for a specific bill
 */
paymentSchema.statics.getPaymentsForBill = function (billId) {
  return this.find({ billId }).sort({ createdAt: -1 });
};

// ============================================================================
// EXPORT
// ============================================================================

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
