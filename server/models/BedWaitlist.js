/**
 * ============================================================================
 * BED WAITLIST MODEL (Spec §11 — Lower-Bed Waitlist)
 * ============================================================================
 *
 * Represents one tenant's position in the queue for a lower bunk bed.
 *
 * RULES (Spec §11.2):
 *   - Queue is ordered by requestedAt ASCENDING (FIFO — strictly first come, first served).
 *   - Declining an offer does NOT remove the tenant from the queue.
 *     They stay in "waiting" status and receive the next available bed.
 *   - Tenant is only removed from the queue if:
 *       a) They explicitly request removal (removedReason: "tenant_requested")
 *       b) Their stay ends (removedReason: "stay_ended")
 *       c) Their transfer completes (status → "transferred")
 *   - Offers are tracked as separate WaitlistOffer documents to support
 *     offer history (a tenant may decline multiple offers over time).
 *
 * ELIGIBILITY CRITERIA (Spec §11.2):
 *   Before sending an offer, the system must verify:
 *     1. Tenant has an "active" (checked-in) stay in the same branch.
 *     2. Tenant has no unpaid overdue balance (bill.dueState = "overdue"
 *        AND bill.paymentState ≠ "paid").
 *     3. Tenant is currently in an UPPER bed (this queue is for lower-bed upgrades).
 *     4. This entry has status = "waiting".
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const bedWaitlistSchema = new mongoose.Schema(
  {
    // --- Subject ---
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

    // --- What they are waiting for ---
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      // The specific room whose lower bed they are waiting for
    },
    currentBedId: {
      type: String,
      required: true,
      // The tenant's current upper bed identifier (e.g. "A2-upper")
    },

    // --- Queue Position (Spec §11.2 — FIFO anchor) ---
    // This is the primary sort key for the queue. Never modified after creation.
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    requestReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      // Tenant's optional stated reason (e.g. "medical — lower bunk recommended")
    },

    // --- Status ---
    status: {
      type: String,
      enum: [
        "waiting",     // In queue, no bed available yet
        "offered",     // A bed was offered; response deadline is running
        "accepted",    // Tenant accepted; room transfer workflow begins
        "declined",    // Tenant refused this specific offer (stays in queue)
        "expired",     // No response before the offer deadline (stays in queue)
        "transferred", // The move to the lower bed is complete
        "removed",     // Withdrawn by tenant or their stay ended
      ],
      default: "waiting",
      index: true,
    },

    // --- Current Offer Reference ---
    // Points to the most recent WaitlistOffer sent for this queue entry.
    // Null when status = "waiting".
    currentOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WaitlistOffer",
      default: null,
    },

    // --- Offer History ---
    declineCount: {
      type: Number,
      default: 0,
      min: 0,
      // Total number of offers this tenant has declined. Informational only.
    },

    // --- Transfer Completion ---
    transferredAt: {
      type: Date,
      default: null,
      // Set when the bed transfer completes and status → "transferred"
    },
    transferredToBedId: {
      type: String,
      default: null,
      // The lower bed they actually moved into
    },

    // --- Removal ---
    removedAt: {
      type: Date,
      default: null,
    },
    removedReason: {
      type: String,
      enum: ["tenant_requested", "stay_ended", "transferred", null],
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // Admin or system that triggered the removal
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

// FIFO queue query: all "waiting" entries for a room, ordered by request time
bedWaitlistSchema.index(
  { roomId: 1, status: 1, requestedAt: 1 },
  { name: "waitlist_fifo_queue" },
);

// Prevent a tenant from having two active queue entries for the same room
bedWaitlistSchema.index(
  { tenantId: 1, roomId: 1 },
  {
    name: "waitlist_tenant_room_unique",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["waiting", "offered", "accepted"] },
      isArchived: false,
    },
  },
);

bedWaitlistSchema.index({ tenantId: 1, status: 1 });
bedWaitlistSchema.index({ branch: 1, status: 1 });

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("BedWaitlist", bedWaitlistSchema);
