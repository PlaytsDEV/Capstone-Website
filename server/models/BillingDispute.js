/**
 * ============================================================================
 * BILLING DISPUTE MODEL (Spec §20 — Billing Dispute Engine)
 * ============================================================================
 *
 * Allows tenants to formally contest a bill. During an active dispute:
 *   - Late fee accumulation is FROZEN on the linked bill.
 *   - The overdue notice clock is PAUSED (no new overdue notices can be issued).
 *   - The bill's disputeState is set to "disputed" so dashboards reflect this.
 *
 * DISPUTE FLOW (Spec §20.2):
 *   Tenant raises dispute → Admin acknowledges → Admin investigates
 *     ├─→ Uphold dispute   → Bill is adjusted (admin records the correction)
 *     └─→ Reject dispute   → Bill stands; late fees resume from day dispute closed
 *
 * RULES (Spec §20.3):
 *   - Only ONE active dispute per bill at a time.
 *   - A dispute cannot be opened on a "paid" or "voided" bill.
 *   - Dispute resolution requires a non-empty finding (reason for decision).
 *   - If upheld, the bill's adjustmentHistory[] must be updated before closing.
 *   - Late fees frozen during the dispute period are permanently forgiven —
 *     they do NOT retroactively accumulate after resolution.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const billingDisputeSchema = new mongoose.Schema(
  {
    // --- Linked Records ---
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: true,
      index: true,
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },

    // --- Dispute Details (raised by tenant) ---
    disputeReason: {
      type: String,
      enum: [
        "incorrect_meter_reading",    // Tenant believes the kWh reading is wrong
        "incorrect_sharing_split",    // Tenant believes their share calculation is off
        "wrong_rate_applied",         // Rate used differs from their agreed rate
        "double_charged",             // Same period charged twice
        "already_paid",               // Tenant claims payment was made
        "other",                      // Free-form; requires disputeReasonDetail
      ],
      required: true,
    },
    disputeReasonDetail: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 3000,
      // Tenant's written explanation. Required regardless of disputeReason.
    },

    // --- Amount Context (frozen at dispute open time) ---
    billAmountAtDispute: {
      type: Number,
      required: true,
      min: 0,
      // The bill total at the moment the dispute was opened.
      // Used to compare against the resolved amount for audit.
    },
    penaltyAmountAtDispute: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Supporting Evidence ---
    evidenceUrls: {
      type: [String],
      default: [],
      // URLs of uploaded supporting photos or documents submitted by the tenant
    },

    // --- Dispute Status ---
    status: {
      type: String,
      enum: [
        "open",            // Submitted, not yet acknowledged by admin
        "acknowledged",    // Admin has seen it and is investigating
        "under_review",    // Active investigation in progress
        "upheld",          // Dispute was correct; bill was adjusted
        "rejected",        // Dispute was incorrect; original bill stands
        "withdrawn",       // Tenant withdrew the dispute before resolution
      ],
      default: "open",
      index: true,
    },

    // --- Fee Freeze Tracking (Spec §20.3) ---
    // Tracks the exact window during which late fees were frozen.
    feeFrozenAt: {
      type: Date,
      required: true,
      // Set to Date.now() when the dispute is created.
      // Late fees that would have accumulated from this date to feeFrozenUntil
      // are permanently forgiven — they do NOT resume retroactively.
    },
    feeFrozenUntil: {
      type: Date,
      default: null,
      // Set when the dispute is resolved (upheld, rejected, or withdrawn).
    },
    feeDaysForgivenCount: {
      type: Number,
      default: null,
      // Computed on resolution: (feeFrozenUntil - feeFrozenAt) in days.
      // Stored for audit and reporting.
    },

    // --- Tenant Submission ---
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // --- Admin Acknowledgment ---
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },

    // --- Investigation Notes ---
    adminInvestigationNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
      // Internal admin notes — not visible to tenant
    },

    // --- Resolution ---
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionFinding: {
      type: String,
      default: null,
      trim: true,
      minlength: 10,
      // Required when status is set to "upheld" or "rejected".
      // The admin's written explanation of their decision.
    },

    // --- Upheld Adjustment Link ---
    // When status = "upheld", the bill must be adjusted and the adjustment
    // entry in bill.adjustmentHistory[] is linked here for cross-reference.
    adjustmentAppliedAt: {
      type: Date,
      default: null,
    },
    adjustedBillAmount: {
      type: Number,
      default: null,
      min: 0,
      // The corrected bill amount after the dispute was upheld.
    },

    // --- Withdrawal ---
    withdrawnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    withdrawalReason: {
      type: String,
      default: null,
      trim: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// ============================================================================
// INDEXES
// ============================================================================

// Enforce: only ONE active dispute per bill at a time.
billingDisputeSchema.index(
  { billId: 1, status: 1 },
  {
    name: "billing_dispute_active_unique",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["open", "acknowledged", "under_review"] },
      isArchived: false,
    },
  },
);

// Dashboard queries
billingDisputeSchema.index({ branch: 1, status: 1, submittedAt: -1 });
billingDisputeSchema.index({ tenantId: 1, status: 1 });
billingDisputeSchema.index({ reservationId: 1 });

// ============================================================================
// PRE-SAVE GUARDS
// ============================================================================

billingDisputeSchema.pre("save", function guardResolutionFinding(next) {
  const terminalStatuses = ["upheld", "rejected"];

  if (terminalStatuses.includes(this.status)) {
    const hasFinding =
      typeof this.resolutionFinding === "string" &&
      this.resolutionFinding.trim().length >= 10;

    if (!hasFinding) {
      return next(
        new Error(
          `[BillingDispute pre-save] Cannot set status to "${this.status}" ` +
            `without a resolutionFinding of at least 10 characters. ` +
            `Explain your investigation outcome before closing the dispute.`,
        ),
      );
    }

    // Upheld disputes must have an adjustedBillAmount recorded.
    if (this.status === "upheld" && this.adjustedBillAmount === null) {
      return next(
        new Error(
          `[BillingDispute pre-save] Cannot mark a dispute as "upheld" ` +
            `without recording the adjustedBillAmount. ` +
            `Apply the bill correction and record the new amount first.`,
        ),
      );
    }
  }

  next();
});

// ============================================================================
// STATICS
// ============================================================================

/**
 * Check if a bill currently has an active (unresolved) dispute.
 * Used by billing engine and penalty accumulator before adding late fees.
 */
billingDisputeSchema.statics.hasActiveDispute = async function (billId) {
  return !!(await this.exists({
    billId,
    status: { $in: ["open", "acknowledged", "under_review"] },
    isArchived: false,
  }));
};

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("BillingDispute", billingDisputeSchema);
