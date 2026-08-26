/**
 * ============================================================================
 * TENANT VIOLATION MODEL (Spec §23 — Violations and Warnings)
 * ============================================================================
 *
 * Tracks formal house-rule violation records for tenants.
 *
 * PURPOSE:
 *   - Creates a documented evidence trail for deposit deductions, pre-termination,
 *     and escalation to the Termination Review Board (P3-02).
 *   - Maintains a running warning count across ALL reservations for a tenant
 *     (a returning tenant carries their violation history forward).
 *
 * VIOLATION TYPES (Spec §23.2):
 *   Smoking, cooking, unauthorized appliances, unauthorized visitors,
 *   RFID misuse, unauthorized bed/room transfer, property damage,
 *   repeated cleanliness issues, persistent unpaid bills, or custom.
 *
 * WORKFLOW (Spec §23.1):
 *   Incident reported → Admin reviews → Tenant response collected
 *     → Admin decision (confirmed | dismissed)
 *       ├─→ confirmed → warning_issued | penalty_issued | escalated
 *       └─→ dismissed → resolved
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const VIOLATION_TYPES = Object.freeze([
  "smoking_inside",
  "cooking_in_room",
  "unauthorized_appliance",
  "unauthorized_visitors",
  "rfid_misuse",             // Lending the RFID card to a non-tenant
  "unauthorized_bed_transfer",
  "unauthorized_room_transfer",
  "property_damage",
  "cleanliness_issues",
  "persistent_unpaid_bills",
  "custom",                  // Requires customViolationDescription
]);

const tenantViolationSchema = new mongoose.Schema(
  {
    // --- Subject ---
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null,
      required: false,
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

    // --- Incident Details ---
    violationType: {
      type: String,
      enum: VIOLATION_TYPES,
      required: true,
    },
    customViolationDescription: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
      // Required when violationType = "custom"
    },
    dateOfIncident: {
      type: Date,
      required: true,
    },
    timeOfIncident: {
      type: String,
      default: null,
      trim: true,
      // HH:MM format — optional but encouraged
    },
    locationOfIncident: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
      // e.g. "Room 401", "Hallway 2nd Floor", "Common Area"
    },

    // --- Status (Spec §23.4) ---
    status: {
      type: String,
      enum: [
        "reported",           // Filed, not yet reviewed by admin
        "under_review",       // Admin is checking the evidence
        "awaiting_response",  // Tenant has been asked to explain
        "confirmed",          // Violation is established
        "dismissed",          // Not substantiated
        "warning_issued",     // Formal warning was given
        "penalty_issued",     // A penalty was applied under policy
        "resolved",           // Case is closed
        "escalated",          // Referred for pre-termination review
      ],
      default: "reported",
      index: true,
    },

    // --- Evidence ---
    evidenceUrls: {
      type: [String],
      default: [],
      // Photo URLs or incident note file links
    },
    evidenceNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
      // Admin's written description of the evidence
    },

    // --- Warning Count (Spec §23.3) ---
    // Auto-computed at filing time: count of all prior CONFIRMED violations
    // for this tenant (across ALL reservations). Stored for audit clarity.
    warningNumber: {
      type: Number,
      default: null,
      min: 1,
      // e.g. 1 = first confirmed warning, 2 = second, 3 = third
      // Computed and stored by the controller at the time the violation
      // is confirmed — NOT when it is reported.
    },

    // --- Penalty ---
    penaltyApplied: {
      type: Number,
      default: null,
      min: 0,
      // Peso amount; null if no monetary penalty was imposed
    },
    penaltyReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
      // Required when penaltyApplied > 0
    },
    penaltyApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // --- Tenant Response ---
    tenantResponseDeadline: {
      type: Date,
      default: null,
      // Admin sets a deadline for the tenant to respond.
      // When this passes with no response, admin is notified.
    },
    tenantResponse: {
      type: String,
      default: null,
      trim: true,
      maxlength: 3000,
      // Tenant's written explanation
    },
    tenantRespondedAt: {
      type: Date,
      default: null,
    },

    // --- Admin Decision ---
    adminDecision: {
      type: String,
      enum: ["confirmed", "dismissed", null],
      default: null,
      // Must be set before status can advance to warning_issued, penalty_issued,
      // or escalated. Cannot be null when status = "confirmed" or "dismissed".
    },
    adminDecisionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
      // Required before adminDecision can be saved — cannot be blank.
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },

    // --- Resolution ---
    resolution: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
      // Final resolution note
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },

    // --- Escalation Link (Spec §23.5) ---
    // Populated when status = "escalated".
    // Setting status to "escalated" must also create a TerminationReview
    // with triggerType = "violation_escalation".
    escalatedToReviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TerminationReview",
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },

    // --- Reporter ---
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // The staff or admin who filed the violation report
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
// CONSTANTS EXPORT
// ============================================================================

export { VIOLATION_TYPES };

// ============================================================================
// INDEXES
// ============================================================================

// Fast queries for admin dashboard
tenantViolationSchema.index({ branch: 1, status: 1, createdAt: -1 });
tenantViolationSchema.index({ branch: 1, isArchived: 1, createdAt: -1 });
tenantViolationSchema.index({ tenantId: 1, status: 1 });
tenantViolationSchema.index({ tenantId: 1, isArchived: 1 });
tenantViolationSchema.index({ reservationId: 1 });

// ============================================================================
// PRE-SAVE GUARDS
// ============================================================================

tenantViolationSchema.pre("save", function guardViolationRules(next) {
  // 1. "custom" violationType requires a description
  if (this.violationType === "custom") {
    const hasDescription =
      typeof this.customViolationDescription === "string" &&
      this.customViolationDescription.trim().length > 0;
    if (!hasDescription) {
      return next(
        new Error(
          `[TenantViolation pre-save] violationType "custom" requires a ` +
            `non-empty customViolationDescription.`,
        ),
      );
    }
  }

  // 2. adminDecision requires adminDecisionReason
  if (this.adminDecision !== null) {
    const hasReason =
      typeof this.adminDecisionReason === "string" &&
      this.adminDecisionReason.trim().length > 0;
    if (!hasReason) {
      return next(
        new Error(
          `[TenantViolation pre-save] adminDecision "${this.adminDecision}" ` +
            `requires a non-empty adminDecisionReason. ` +
            `Record the basis for this decision before saving.`,
        ),
      );
    }
  }

  // 3. Escalation requires adminDecision = "confirmed" first
  if (this.status === "escalated" && this.adminDecision !== "confirmed") {
    return next(
      new Error(
        `[TenantViolation pre-save] Cannot escalate a violation ` +
          `(status = "escalated") before adminDecision is set to "confirmed". ` +
          `Unsubstantiated or undecided violations cannot be escalated.`,
      ),
    );
  }

  // 4. penaltyApplied > 0 requires penaltyReason
  if (this.penaltyApplied !== null && this.penaltyApplied > 0) {
    const hasPenaltyReason =
      typeof this.penaltyReason === "string" &&
      this.penaltyReason.trim().length > 0;
    if (!hasPenaltyReason) {
      return next(
        new Error(
          `[TenantViolation pre-save] A penaltyApplied of ₱${this.penaltyApplied} ` +
            `requires a non-empty penaltyReason.`,
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
 * Compute the current warning count for a tenant.
 * Returns the number of prior CONFIRMED violations across ALL reservations.
 * Call this BEFORE creating a new violation to get the warningNumber to store.
 *
 * @param {string} tenantId
 * @returns {Promise<number>}  e.g. 0 (no priors), 1 (one prior), etc.
 */
tenantViolationSchema.statics.computeWarningCount = async function (tenantId) {
  return this.countDocuments({
    tenantId,
    adminDecision: "confirmed",
    isArchived: false,
  });
};

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("TenantViolation", tenantViolationSchema);
