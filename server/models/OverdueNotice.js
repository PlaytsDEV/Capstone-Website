/**
 * ============================================================================
 * OVERDUE NOTICE MODEL (Spec §21 — 3-Notice State Machine)
 * ============================================================================
 *
 * Tracks the formal 3-step notice escalation process for overdue bills.
 *
 * WORKFLOW:
 *   Bill becomes overdue
 *     → Notice 1 issued (friendly reminder with full balance breakdown)
 *     → If still unpaid → Notice 2 issued (formal warning)
 *     → If still unpaid → Notice 3 issued (final demand)
 *     → If still unpaid → Escalated to TerminationReview (see P3-02)
 *
 * RULES (Spec §21.3):
 *   - Each notice records the peso total at time of sending (amount may change
 *     due to accumulating late fees; the notice freezes the amount at that moment).
 *   - An admin must explicitly issue each notice — the system prepares and sends,
 *     but a human triggers.
 *   - Notice 3 must explicitly link to a TerminationReview if escalation follows.
 *   - Delivery is attempted via email + in-app notification. Both outcomes are logged.
 *   - A notice cannot be issued if a previous notice for the same bill is still
 *     in "pending" delivery state.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const overdueNoticeSchema = new mongoose.Schema(
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

    // --- Notice Identity ---
    // Which notice in the sequence (1, 2, or 3).
    // Uniqueness is enforced by index: only one notice per (billId + noticeNumber).
    noticeNumber: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },

    // --- Amount Snapshot (Spec §21.3) ---
    // Frozen at the moment of issuance. Accumulating late fees after
    // this point do not change the notice's stated amount.
    outstandingAmountAtIssuance: {
      type: Number,
      required: true,
      min: 0,
    },
    penaltyAmountAtIssuance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmountAtIssuance: {
      type: Number,
      required: true,
      min: 0,
      // = outstandingAmountAtIssuance + penaltyAmountAtIssuance
    },
    daysOverdueAtIssuance: {
      type: Number,
      required: true,
      min: 0,
    },

    // --- Issuance ---
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // The admin who triggered the notice send
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    noticeMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
      // Optional admin note included in the notice body
    },

    // --- Delivery ---
    deliveryStatus: {
      type: String,
      enum: [
        "pending",    // Issuance recorded, delivery not yet attempted
        "sent",       // Delivery attempted; at least one channel succeeded
        "failed",     // All delivery channels failed
        "partial",    // Some channels succeeded, some failed
      ],
      default: "pending",
    },
    delivery: {
      email: {
        status: {
          type: String,
          enum: ["not_attempted", "sent", "failed"],
          default: "not_attempted",
        },
        sentAt: { type: Date, default: null },
        error: { type: String, default: "" },
      },
      notification: {
        status: {
          type: String,
          enum: ["not_attempted", "sent", "failed"],
          default: "not_attempted",
        },
        sentAt: { type: Date, default: null },
        error: { type: String, default: "" },
      },
    },

    // --- Tenant Response ---
    // Populated if the tenant contacts Lilycrest in response to the notice.
    tenantAcknowledgedAt: {
      type: Date,
      default: null,
    },
    tenantResponse: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    tenantResponseRecordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // --- Escalation Link (Notice 3 only) ---
    // Populated when this Notice 3 results in a TerminationReview being opened.
    escalatedToReviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TerminationReview",
      default: null,
      // See P3-02 TerminationReview model
    },
    escalatedAt: {
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

// Core uniqueness: one notice per (bill, notice number).
// Prevents issuing Notice 1 twice for the same bill.
overdueNoticeSchema.index(
  { billId: 1, noticeNumber: 1 },
  {
    unique: true,
    name: "overdue_notice_bill_number_unique",
    partialFilterExpression: { isArchived: false },
  },
);

// Fast lookups for dashboard (all notices for a tenant, or for a branch)
overdueNoticeSchema.index({ tenantId: 1, issuedAt: -1 });
overdueNoticeSchema.index({ branch: 1, issuedAt: -1 });
overdueNoticeSchema.index({ reservationId: 1 });

// ============================================================================
// STATICS
// ============================================================================

/**
 * Count the number of notices issued for a specific bill.
 * Used by the Bill model to update overdueNoticeCount.
 */
overdueNoticeSchema.statics.countForBill = async function (billId) {
  return this.countDocuments({ billId, isArchived: false });
};

/**
 * Get the latest notice for a bill.
 */
overdueNoticeSchema.statics.latestForBill = async function (billId) {
  return this.findOne({ billId, isArchived: false })
    .sort({ noticeNumber: -1 })
    .lean();
};

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("OverdueNotice", overdueNoticeSchema);
