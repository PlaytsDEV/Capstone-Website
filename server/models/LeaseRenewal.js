/**
 * ============================================================================
 * LEASE RENEWAL MODEL (Spec §24 — Lease Renewal & Rent Adjustment)
 * ============================================================================
 *
 * Tracks the full lease renewal workflow when a tenant's lease term approaches
 * its end date. A LeaseRenewal document is the formal record of:
 *   - What the old terms were (locked at creation — immutable snapshot)
 *   - What new terms are being proposed
 *   - The approval chain (admin → tenant acknowledgment)
 *   - The outcome (renewed, declined, or expired without action)
 *
 * CRITICAL RULE (Spec §24.3):
 *   The monthly rent on the linked Reservation must NOT be updated
 *   until this document reaches status "tenant_acknowledged" or "renewed".
 *   The controller MUST check this before writing a new rate.
 *
 * RATE CHANGE NOTICE PERIOD (Spec §24.2):
 *   Any rent increase must be communicated at least 30 days before the
 *   new rate takes effect. The `effectiveFrom` date is validated against this.
 *   This value (30 days) is stored in BusinessSettings.renewalNoticeRequiredDays.
 *
 * MONTH-TO-MONTH CONTINUATION (Spec §24.5):
 *   If the lease expires with no formal renewal, admin can approve a
 *   month-to-month continuation. In this case:
 *   - outcome = "month_to_month"
 *   - monthToMonthApprovedAt is set on the linked Stay document
 *   - New bills will be flagged with Bill.isMonthToMonth = true
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const leaseRenewalSchema = new mongoose.Schema(
  {
    // --- Linked Records ---
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
      index: true,
    },
    stayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stay",
      required: true,
      index: true,
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
    // CURRENT TERMS SNAPSHOT (frozen at creation — never mutated)
    // =========================================================================
    // These fields capture the exact lease terms that are expiring.
    // They are the authoritative "before" record for audit comparison.
    currentTerms: {
      type: new mongoose.Schema(
        {
          monthlyRent:     { type: Number, required: true },
          leaseStartDate:  { type: Date, required: true },
          leaseEndDate:    { type: Date, required: true },
          roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true,
          },
          roomName:        { type: String, default: "" },
          bedId:           { type: String, default: null },
          discountPercent: { type: Number, default: 0 },
          contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            default: null,
          },
        },
        { _id: false },
      ),
      required: true,
    },

    // =========================================================================
    // PROPOSED TERMS (can be updated until admin approves)
    // =========================================================================
    proposedTerms: {
      type: new mongoose.Schema(
        {
          monthlyRent:     { type: Number, required: true },
          leaseStartDate:  { type: Date, required: true },
          leaseEndDate:    { type: Date, default: null },
          // null = month-to-month; admin leaves this blank if no fixed end
          discountPercent: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      required: true,
    },

    // When the new rate / terms take effect (Spec §24.2)
    // Must be at least BusinessSettings.renewalNoticeRequiredDays from today.
    effectiveFrom: {
      type: Date,
      required: true,
    },

    // =========================================================================
    // WORKFLOW STATUS
    // =========================================================================
    status: {
      type: String,
      enum: [
        "draft",                // Admin is preparing the proposal
        "pending_approval",     // Submitted for admin sign-off (multi-admin systems)
        "approved",             // Admin has approved; tenant has not yet been notified
        "tenant_notified",      // Tenant has been sent the renewal offer
        "tenant_acknowledged",  // Tenant has seen and accepted the new terms
        "renewed",              // Formal renewal complete; new contract issued
        "declined_by_tenant",   // Tenant chose not to renew
        "expired",              // Admin never actioned before lease end date
        "month_to_month",       // Lease expired; admin approved continuation
        "cancelled",            // Admin cancelled the renewal proposal
      ],
      default: "draft",
      index: true,
    },

    // =========================================================================
    // APPROVAL CHAIN
    // =========================================================================

    // --- Admin Approval ---
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvalNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
      // Admin's notes explaining the new terms (especially for rent increases)
    },

    // --- Tenant Notification ---
    tenantNotifiedAt: {
      type: Date,
      default: null,
    },
    tenantResponseDeadline: {
      type: Date,
      default: null,
      // Admin-set deadline for the tenant to respond.
      // If no response by this date → status may transition to "expired"
      // or admin manually decides on month-to-month.
    },

    // --- Tenant Acknowledgment ---
    tenantAcknowledgedAt: {
      type: Date,
      default: null,
    },
    tenantDeclinedAt: {
      type: Date,
      default: null,
    },
    tenantDeclineReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    // =========================================================================
    // OUTCOME
    // =========================================================================
    outcome: {
      type: String,
      enum: [
        "renewed",
        "month_to_month",
        "tenant_moved_out",  // Tenant chose to vacate rather than renew
        "cancelled",
        "expired",
        null,
      ],
      default: null,
    },

    // New contract generated on successful renewal
    newContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },

    // Month-to-month approval (Spec §24.5)
    monthToMonthApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    monthToMonthApprovedAt: {
      type: Date,
      default: null,
    },

    // =========================================================================
    // RENT CHANGE AUDIT
    // =========================================================================
    rentChanged: {
      type: Boolean,
      default: false,
      // True when proposedTerms.monthlyRent !== currentTerms.monthlyRent
    },
    rentChangePercent: {
      type: Number,
      default: null,
      // ((proposed - current) / current) * 100 — stored for reporting
    },
    rentChangeReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
      // Required when rentChanged = true. Cannot be blank.
    },

    // =========================================================================
    // METADATA
    // =========================================================================
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // Admin who opened the renewal process
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

// Prevent two active renewal workflows for the same reservation simultaneously
leaseRenewalSchema.index(
  { reservationId: 1, status: 1 },
  {
    name: "lease_renewal_active_unique",
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          "draft",
          "pending_approval",
          "approved",
          "tenant_notified",
          "tenant_acknowledged",
        ],
      },
      isArchived: false,
    },
  },
);

// Dashboard queries
leaseRenewalSchema.index({ branch: 1, status: 1, effectiveFrom: 1 });
leaseRenewalSchema.index({ tenantId: 1, status: 1 });

// ============================================================================
// PRE-SAVE GUARDS
// ============================================================================

leaseRenewalSchema.pre("save", function guardRenewalRules(next) {
  // 1. Rent changes require a written reason
  const proposedRent = this.proposedTerms?.monthlyRent;
  const currentRent  = this.currentTerms?.monthlyRent;

  if (proposedRent !== undefined && currentRent !== undefined) {
    const changed = proposedRent !== currentRent;
    if (changed) {
      const hasReason =
        typeof this.rentChangeReason === "string" &&
        this.rentChangeReason.trim().length > 0;
      if (!hasReason) {
        return next(
          new Error(
            `[LeaseRenewal pre-save] Rent is changing from ₱${currentRent} to ` +
              `₱${proposedRent} — a non-empty rentChangeReason is required. ` +
              `Explain the basis for this rate adjustment before saving.`,
          ),
        );
      }
      // Auto-compute rentChangePercent and rentChanged flag
      this.rentChanged = true;
      this.rentChangePercent =
        Math.round(((proposedRent - currentRent) / currentRent) * 10000) / 100;
    } else {
      this.rentChanged = false;
      this.rentChangePercent = 0;
    }
  }

  // 2. effectiveFrom cannot be in the past on a new document
  if (this.isNew && this.effectiveFrom && this.effectiveFrom <= new Date()) {
    return next(
      new Error(
        `[LeaseRenewal pre-save] effectiveFrom must be a future date. ` +
          `The new lease terms cannot take effect retroactively.`,
      ),
    );
  }

  next();
});

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("LeaseRenewal", leaseRenewalSchema);
