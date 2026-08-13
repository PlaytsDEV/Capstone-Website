/**
 * ============================================================================
 * MOVE-OUT CLEARANCE MODEL (Spec §13 & §26 — Deposit Settlement Engine)
 * ============================================================================
 *
 * Records the complete formal move-out clearance process from first notice
 * to final deposit outcome.
 *
 * PRINCIPLE (Spec §26.1):
 *   "The system calculates and proposes; a person approves."
 *   No deposit outcome is ever automated. The system computes the formula
 *   and presents it — an admin with appropriate permissions approves.
 *
 * FORMULA (Spec §26.3):
 *   Refundable Balance =
 *     Security Deposit
 *     − Unpaid Rent
 *     − Unpaid Electricity
 *     − Unpaid Water
 *     − Penalties & Late Fees
 *     − Damage Charges (from inspection)
 *     − Lost RFID Replacement (sourced from BusinessSettings.rfidReplacementCharge)
 *     − Other Approved Charges
 *
 * ACCOUNT RULE (Spec §26.4):
 *   The tenant account is NEVER deleted. After clearance:
 *   - User.accountStatus → "former_tenant"
 *   - Read-only portal access is retained (billing history, clearance docs)
 *   - If the tenant re-applies, the existing profile is reused
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

// ============================================================================
// SUBDOCUMENTS
// ============================================================================

const damageItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    estimatedCost: {
      type: Number,
      required: true,
      min: 0,
    },
    evidenceUrls: {
      type: [String],
      default: [],
      // Photo URLs from the room inspection
    },
  },
  { _id: true },
);

const otherChargeSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    basisNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      // Contract clause or house rule cited as basis
    },
  },
  { _id: true },
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const moveOutClearanceSchema = new mongoose.Schema(
  {
    // --- Linked Records ---
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
      unique: true, // Only one clearance per reservation
      index: true,
    },
    stayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stay",
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

    // =========================================================================
    // CLEARANCE STATUS (Spec §26.1)
    // =========================================================================
    status: {
      type: String,
      enum: [
        "initiated",            // Tenant gave move-out notice
        "inspection_pending",   // Awaiting room inspection
        "inspection_complete",  // Inspection done; calculation can proceed
        "calculation_pending",  // System has not yet computed the formula
        "under_review",         // Calculation complete; pending admin approval
        "approved",             // Admin approved the deposit outcome
        "disputed",             // Tenant is questioning the result
        "refunded",             // Refund has been released
        "forfeited",            // Deposit forfeited (approved by admin)
      ],
      default: "initiated",
      index: true,
    },

    // =========================================================================
    // MOVE-OUT TIMELINE
    // =========================================================================
    intendedMoveOutDate: {
      type: Date,
      required: true,
      // Date reported by the tenant when they gave notice
    },
    confirmedMoveOutDate: {
      type: Date,
      default: null,
      // Set by admin; this is the official move-out date for billing cutoff
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // Admin who opened the clearance process
    },

    finalMeterReadingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeterReading",
      default: null,
      // The closing electricity/water meter reading taken on move-out date
    },

    // =========================================================================
    // ROOM INSPECTION (Spec §26.1 step 5)
    // =========================================================================
    inspectionCompletedAt: {
      type: Date,
      default: null,
    },
    inspectionCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    roomCondition: {
      type: String,
      enum: ["good", "minor_damage", "major_damage", null],
      default: null,
    },
    damageItems: {
      type: [damageItemSchema],
      default: [],
    },
    totalDamageCharge: {
      type: Number,
      default: 0,
      min: 0,
      // Auto-computed as sum of damageItems[].estimatedCost
    },
    inspectionNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },

    // =========================================================================
    // RFID ASSESSMENT (Spec §26.1 step 5 & §13)
    // =========================================================================
    rfidReturned: {
      type: Boolean,
      default: null,
      // null = not yet assessed; true = returned; false = not returned
    },
    rfidAssessedAt: {
      type: Date,
      default: null,
    },
    rfidAssessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rfidReplacementCharge: {
      type: Number,
      default: 0,
      min: 0,
      // 0 if returned; sourced from BusinessSettings.rfidReplacementCharge if not
    },

    // =========================================================================
    // DEPOSIT CALCULATION (Spec §26.3)
    // =========================================================================

    // Security deposit amount locked from the original pricing snapshot.
    // Never changes after clearance is initiated.
    securityDepositAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Itemized deductions — each populated by the controller at calculation time
    deductions: {
      type: new mongoose.Schema(
        {
          unpaidRent: {
            type: Number,
            default: 0,
            min: 0,
            // Sum of all bills with type "rent" and paymentState != "paid"
          },
          unpaidElectricity: {
            type: Number,
            default: 0,
            min: 0,
          },
          unpaidWater: {
            type: Number,
            default: 0,
            min: 0,
          },
          penalties: {
            type: Number,
            default: 0,
            min: 0,
            // Accumulated late fees across all bills
          },
          damageCharges: {
            type: Number,
            default: 0,
            min: 0,
            // Copied from totalDamageCharge at calculation time
          },
          rfidReplacement: {
            type: Number,
            default: 0,
            min: 0,
            // Copied from rfidReplacementCharge at calculation time
          },
          otherCharges: {
            type: [otherChargeSchema],
            default: [],
          },
          otherChargesTotal: {
            type: Number,
            default: 0,
            min: 0,
            // Auto-computed sum of otherCharges[].amount
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // System-computed total of all deduction categories
    totalDeductions: {
      type: Number,
      default: null,
      min: 0,
    },

    // Refundable balance = securityDepositAmount − totalDeductions
    // Can be negative (tenant owes more than their deposit)
    refundableBalance: {
      type: Number,
      default: null,
    },

    calculatedAt: {
      type: Date,
      default: null,
    },
    calculatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================================================================
    // DEPOSIT OUTCOME & APPROVAL (Spec §13.2)
    // =========================================================================
    depositOutcome: {
      type: String,
      enum: [
        "fully_refundable",      // No deductions; full deposit returned
        "partially_refundable",  // Some deductions; balance returned
        "fully_applied",         // Deposit exactly covers all charges
        "forfeited",             // Admin-approved forfeiture (early term. or serious breach)
        "under_review",          // Calculation complete; awaiting approver
        "under_dispute",         // Tenant questioning the result
        "refunded",              // Refund payment has been released
        null,
      ],
      default: null,
      index: true,
    },

    // Admin approval — REQUIRED before any non-null outcome is final
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvalReason: {
      type: String,
      default: null,
      trim: true,
      // Required (non-blank) before depositOutcome is set to any terminal value
    },

    // =========================================================================
    // REFUND PROCESSING
    // =========================================================================
    refundProcessedAt: {
      type: Date,
      default: null,
    },
    refundReference: {
      type: String,
      default: null,
      trim: true,
      // External bank transfer reference or GCash reference number
    },
    refundProcessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =========================================================================
    // DISPUTE LINK
    // =========================================================================
    // If tenant disputes the clearance calculation, a BillingDispute or
    // a dedicated dispute note is linked here.
    disputeNotes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 3000,
    },
    disputeRaisedAt: {
      type: Date,
      default: null,
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

moveOutClearanceSchema.index({ branch: 1, status: 1, createdAt: -1 });
moveOutClearanceSchema.index({ tenantId: 1, status: 1 });
moveOutClearanceSchema.index({ depositOutcome: 1, branch: 1 });

// ============================================================================
// PRE-SAVE GUARDS
// ============================================================================

moveOutClearanceSchema.pre("save", function guardClearanceRules(next) {
  // 1. Terminal deposit outcomes require approvedBy + approvalReason
  const TERMINAL_OUTCOMES = [
    "fully_refundable",
    "partially_refundable",
    "fully_applied",
    "forfeited",
    "refunded",
  ];

  if (this.depositOutcome && TERMINAL_OUTCOMES.includes(this.depositOutcome)) {
    if (!this.approvedBy) {
      return next(
        new Error(
          `[MoveOutClearance pre-save] depositOutcome "${this.depositOutcome}" ` +
            `requires approvedBy to be set. ` +
            `The system proposes; a human must approve.`,
        ),
      );
    }
    const hasReason =
      typeof this.approvalReason === "string" &&
      this.approvalReason.trim().length > 0;
    if (!hasReason) {
      return next(
        new Error(
          `[MoveOutClearance pre-save] depositOutcome "${this.depositOutcome}" ` +
            `requires a non-empty approvalReason. ` +
            `Record the basis for this decision before saving.`,
        ),
      );
    }
  }

  // 2. Auto-compute totalDamageCharge from damageItems
  if (this.isModified("damageItems") && Array.isArray(this.damageItems)) {
    this.totalDamageCharge = this.damageItems.reduce(
      (sum, item) => sum + (item.estimatedCost || 0),
      0,
    );
  }

  // 3. Auto-compute deductions.otherChargesTotal
  const otherCharges = this.deductions?.otherCharges;
  if (otherCharges && Array.isArray(otherCharges)) {
    this.deductions.otherChargesTotal = otherCharges.reduce(
      (sum, c) => sum + (c.amount || 0),
      0,
    );
  }

  // 4. Auto-compute totalDeductions and refundableBalance if all inputs are present
  const d = this.deductions;
  if (
    d &&
    this.isModified("deductions") &&
    this.securityDepositAmount !== null
  ) {
    const total =
      (d.unpaidRent || 0) +
      (d.unpaidElectricity || 0) +
      (d.unpaidWater || 0) +
      (d.penalties || 0) +
      (d.damageCharges || 0) +
      (d.rfidReplacement || 0) +
      (d.otherChargesTotal || 0);
    this.totalDeductions = Math.round(total * 100) / 100;
    this.refundableBalance =
      Math.round((this.securityDepositAmount - this.totalDeductions) * 100) / 100;
  }

  next();
});

// ============================================================================
// STATICS
// ============================================================================

/**
 * Compute the deposit outcome label from a refundableBalance.
 * Returns the suggested depositOutcome enum value — admin still must approve.
 *
 * @param {number} refundableBalance
 * @param {number} securityDeposit
 * @returns {"fully_refundable"|"partially_refundable"|"fully_applied"|"forfeited"}
 */
moveOutClearanceSchema.statics.deriveOutcome = function (
  refundableBalance,
  securityDeposit,
) {
  if (refundableBalance >= securityDeposit) return "fully_refundable";
  if (refundableBalance > 0) return "partially_refundable";
  if (refundableBalance === 0) return "fully_applied";
  return "forfeited"; // Tenant owes more than their deposit
};

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("MoveOutClearance", moveOutClearanceSchema);
