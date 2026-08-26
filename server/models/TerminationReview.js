/**
 * ============================================================================
 * TERMINATION REVIEW MODEL (Spec §22 — Termination Review Board)
 * ============================================================================
 *
 * A formal case record opened when a tenant's situation is escalated beyond
 * the 3-notice overdue process or via a serious policy violation.
 *
 * TRIGGERS (Spec §22.1):
 *   a) "notice_exhaustion"    — All 3 overdue notices sent; tenant still has
 *                               unpaid balance and no approved payment plan.
 *   b) "violation_escalation" — A confirmed TenantViolation is escalated
 *                               (e.g. 3rd confirmed violation, serious breach).
 *   c) "manual"               — Admin opens the review directly (rare, requires reason).
 *
 * OUTCOME OPTIONS (Spec §22.4):
 *   - "payment_plan_approved"   Tenant is granted a structured payment schedule
 *   - "deadline_extension"      Deadline extended with conditions
 *   - "pre_termination_notice"  Formal pre-termination letter issued
 *   - "termination_approved"    Admin board approves move-out / eviction
 *   - "case_dismissed"          Review closed without adverse action
 *
 * PRINCIPLE (Spec §22.5):
 *   "The computer never evicts anyone. It surfaces the case, the human decides."
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const terminationReviewSchema = new mongoose.Schema(
  {
    // --- Linked Records ---
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
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

    // --- Trigger ---
    triggerType: {
      type: String,
      enum: [
        "notice_exhaustion",    // All 3 overdue notices sent with no resolution
        "violation_escalation", // Confirmed TenantViolation escalated
        "manual",               // Admin opened directly — rare; requires triggerReason
      ],
      required: true,
    },
    triggerReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
      // Required when triggerType = "manual"; describes why the review was opened.
    },

    // --- Source References ---
    // Populated based on triggerType.
    triggeredByNoticeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OverdueNotice",
      default: null,
      // Set when triggerType = "notice_exhaustion"
    },
    triggeredByViolationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenantViolation",
      default: null,
      // Set when triggerType = "violation_escalation"
    },
    triggeredByBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null,
      // The overdue bill that ultimately triggered the review
    },

    // --- Balance Snapshot (Spec §22.2) ---
    // Frozen at the time the review is opened.
    // These do NOT update if the tenant makes a partial payment after opening.
    totalOutstandingAtOpen: {
      type: Number,
      default: null,
      min: 0,
    },
    penaltyAmountAtOpen: {
      type: Number,
      default: null,
      min: 0,
    },
    daysOverdueAtOpen: {
      type: Number,
      default: null,
      min: 0,
    },

    // --- Case Status ---
    status: {
      type: String,
      enum: [
        "open",              // Review is open; pending admin decision
        "under_review",      // Actively being discussed by the board
        "pending_response",  // Waiting for tenant response before final decision
        "resolved",          // A decision has been made and actioned
        "closed",            // Case closed without adverse action
      ],
      default: "open",
      index: true,
    },

    // --- Admin Board (Spec §22.3) ---
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // The admin who opened the case (may differ from the decision maker)
    },
    openedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Admins participating in the review (can be >1 for serious cases)
    reviewBoardMembers: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // --- Tenant Engagement (Spec §22.3) ---
    // Did the tenant respond to being informed of the review?
    tenantNotifiedAt: {
      type: Date,
      default: null,
    },
    tenantResponseDeadline: {
      type: Date,
      default: null,
    },
    tenantResponse: {
      type: String,
      default: null,
      trim: true,
      maxlength: 3000,
    },
    tenantRespondedAt: {
      type: Date,
      default: null,
    },

    // --- Internal Review Notes & Recommendation ---
    recommendation: {
      type: String,
      enum: [
        "pending",
        "recommend_probation",
        "recommend_payment_plan",
        "recommend_pre_termination",
        "recommend_dismissal",
      ],
      default: "pending",
    },
    recommendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recommendationNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
    reviewNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
      // Admin board's internal discussion notes (not shown to tenant)
    },

    // --- Decision (Spec §22.4) ---
    // Only populated when status = "resolved" or "closed".
    decision: {
      outcome: {
        type: String,
        enum: [
          "payment_plan_approved",
          "deadline_extension",
          "pre_termination_notice",
          "termination_approved",
          "case_dismissed",
          null,
        ],
        default: null,
      },
      outcomeDetail: {
        type: String,
        default: null,
        trim: true,
        maxlength: 3000,
        // Required when outcome is not null. Explains the specific terms.
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
    },

    // --- Payment Plan (if outcome = "payment_plan_approved") ---
    paymentPlan: {
      type: new mongoose.Schema(
        {
          totalAmount: { type: Number, required: true },
          numberOfInstallments: { type: Number, required: true, min: 1 },
          installmentAmount: { type: Number, required: true },
          firstPaymentDue: { type: Date, required: true },
          approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          approvedAt: { type: Date, default: Date.now },
          installments: {
            type: [
              {
                dueDate: { type: Date, required: true },
                amount: { type: Number, required: true },
                status: {
                  type: String,
                  enum: ["pending", "paid", "missed"],
                  default: "pending",
                },
                paidAt: { type: Date, default: null },
                billId: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "Bill",
                  default: null,
                },
              },
            ],
            default: [],
          },
        },
        { _id: false },
      ),
      default: null,
    },

    // --- Pre-Termination Notice (if outcome = "pre_termination_notice") ---
    preTerminationNotice: {
      type: new mongoose.Schema(
        {
          issuedAt: { type: Date, default: null },
          issuedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          vacateByDate: { type: Date, default: null },
          noticeText: { type: String, default: "", trim: true },
          deliveredVia: {
            type: String,
            enum: ["email", "in_app", "both", "physical"],
            default: "both",
          },
          deliveredAt: { type: Date, default: null },
          tenantAcknowledgedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },

    // --- Resolution ---
    resolvedAt: {
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

// Fast query: all open reviews for a branch (admin dashboard)
terminationReviewSchema.index({ branch: 1, status: 1, openedAt: -1 });

// Fast query: reviews for a specific tenant
terminationReviewSchema.index({ tenantId: 1, status: 1 });

// Prevent duplicate open reviews for the same reservation.
// A reservation can only have ONE open or under_review case at a time.
terminationReviewSchema.index(
  { reservationId: 1, status: 1 },
  {
    name: "termination_review_active_unique",
    partialFilterExpression: {
      status: { $in: ["open", "under_review", "pending_response"] },
      isArchived: false,
    },
    // Note: this is a sparse partial index, not a strict unique — multiple
    // resolved/closed reviews are allowed for the same reservation (history).
  },
);

// ============================================================================
// PRE-SAVE GUARD
// ============================================================================

// When outcome is set, outcomeDetail must be provided.
terminationReviewSchema.pre("save", function guardOutcomeDetail(next) {
  const outcome = this.decision?.outcome;
  const outcomeDetail = this.decision?.outcomeDetail;

  if (outcome && outcome !== null) {
    const hasDetail =
      typeof outcomeDetail === "string" && outcomeDetail.trim().length > 0;
    if (!hasDetail) {
      return next(
        new Error(
          `[TerminationReview pre-save] A non-null decision.outcome requires ` +
            `a non-empty decision.outcomeDetail. Explain the specific terms ` +
            `of the "${outcome}" decision before saving.`,
        ),
      );
    }
  }

  // triggerType = "manual" requires a triggerReason
  if (this.triggerType === "manual") {
    const hasReason =
      typeof this.triggerReason === "string" &&
      this.triggerReason.trim().length > 0;
    if (!hasReason) {
      return next(
        new Error(
          `[TerminationReview pre-save] triggerType "manual" requires a ` +
            `non-empty triggerReason explaining why this review was opened directly.`,
        ),
      );
    }
  }

  next();
});

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("TerminationReview", terminationReviewSchema);
