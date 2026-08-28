/**
 * ============================================================================
 * TENANT CREDIT MODEL
 * ============================================================================
 *
 * A reusable, auditable, category-scoped credit balance held for a tenant.
 * The first producer is the room-transfer settlement: when a tenant moves to
 * a cheaper room part-way through an already-paid rent cycle, the unused
 * prepaid value of the old room becomes an excess RENT credit that must be
 * preserved and automatically consumed by future eligible regular rent Bills
 * — never refunded silently, never applied to utilities / penalties /
 * damages / security deposit / reservation fees.
 *
 * INVARIANTS
 *   - remainingBalance = originalAmount - consumedAmount, always, and both
 *     0 <= consumedAmount <= originalAmount.
 *   - A credit is only ever consumed against a Bill whose category matches
 *     `category` (currently only "rent").
 *   - Consumption is recorded as an append-only `applications[]` entry keyed
 *     by { billId } — a given Bill can consume from a given credit at most
 *     once (enforced by the service, and by the compound index below).
 *   - Records are NEVER deleted after consumption; `status` flips to
 *     "consumed" when remainingBalance reaches 0.
 *
 * IDEMPOTENCY
 *   - `idempotencyKey` is unique (sparse): a retried producer (e.g. a
 *     re-run room transfer for the same predecessor Contract) resolves the
 *     existing credit instead of creating a second one.
 * ============================================================================
 */

import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", required: true },
    amount: { type: Number, required: true, min: 0 },
    appliedAt: { type: Date, default: Date.now },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Free-form so a future consumer can record its own context.
    note: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const tenantCreditSchema = new mongoose.Schema(
  {
    // Owner — both are stored so callers that only have one identifier still work.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null, index: true },
    branch: { type: String, default: "" },

    // What produced this credit.
    sourceType: {
      type: String,
      enum: ["room_transfer"],
      required: true,
      index: true,
    },
    // A stable reference into the producing domain (e.g. the transfer
    // settlement Bill id, or the predecessor Contract id).
    sourceRef: {
      kind: { type: String, default: "" }, // "bill" | "contract" | "reservation"
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    // The transfer event this credit belongs to (predecessor Contract id is
    // the canonical transfer identifier in this codebase — see
    // contractRoomTransferActivationService / resolveRoomTransferSuccessor).
    transferReference: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", default: null, index: true },

    // What the credit may be spent on. Only "rent" today.
    category: {
      type: String,
      enum: ["rent"],
      required: true,
      default: "rent",
      index: true,
    },

    // Money. originalAmount is immutable after creation; the service only
    // ever increments consumedAmount and re-derives remainingBalance.
    originalAmount: { type: Number, required: true, min: 0 },
    consumedAmount: { type: Number, required: true, min: 0, default: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },

    applications: { type: [applicationSchema], default: [] },

    status: {
      type: String,
      enum: ["active", "consumed", "void"],
      default: "active",
      index: true,
    },

    // Producer-supplied idempotency key. Unique + sparse so a retried
    // producer resolves the existing credit rather than creating a duplicate.
    idempotencyKey: { type: String, default: null },

    reason: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

tenantCreditSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "unique_tenant_credit_idempotency" },
);
// Fast "does this tenant have spendable rent credit" lookup.
tenantCreditSchema.index({ userId: 1, category: 1, status: 1, isArchived: 1 });
// A given Bill may consume from a given credit at most once.
tenantCreditSchema.index({ _id: 1, "applications.billId": 1 });

tenantCreditSchema.methods.recomputeBalance = function recomputeBalance() {
  const consumed = Math.round(Number(this.consumedAmount || 0) * 100) / 100;
  const original = Math.round(Number(this.originalAmount || 0) * 100) / 100;
  this.consumedAmount = consumed;
  this.remainingBalance = Math.max(0, Math.round((original - consumed) * 100) / 100);
  this.status = this.status === "void" ? "void" : this.remainingBalance <= 0 ? "consumed" : "active";
  return this;
};

export default mongoose.model("TenantCredit", tenantCreditSchema);
