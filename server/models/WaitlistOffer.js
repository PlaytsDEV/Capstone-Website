/**
 * ============================================================================
 * WAITLIST OFFER MODEL (Spec §11.3 — Individual Bed Offers)
 * ============================================================================
 *
 * Tracks each individual bed offer sent to a waitlisted tenant.
 * A single BedWaitlist entry can have multiple WaitlistOffer documents
 * if the tenant declines successive offers over time.
 *
 * OFFER LIFECYCLE:
 *   Lower bed becomes available → Admin/system sends offer → Tenant has
 *   `waitlistOfferDeadlineHours` (from BusinessSettings) to respond.
 *     → Accepted → BedWaitlist status → "accepted" → Transfer begins
 *     → Declined → BedWaitlist status → "declined" → stays in queue
 *     → No response → Offer expires → BedWaitlist status → "expired" → stays in queue
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const waitlistOfferSchema = new mongoose.Schema(
  {
    // --- Linked Records ---
    waitlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BedWaitlist",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
    },

    // --- What is being offered ---
    offeredRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    offeredBedId: {
      type: String,
      required: true,
      // The specific lower bed being offered (e.g. "A1-lower")
    },

    // --- Offer Terms ---
    offeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    offerDeadline: {
      type: Date,
      required: true,
      // = offeredAt + BusinessSettings.waitlistOfferDeadlineHours
      // Tenant must respond before this time.
    },
    offeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // The admin who triggered the offer send (null if system-automated)
    },

    // --- Delivery ---
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
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

    // --- Response ---
    status: {
      type: String,
      enum: [
        "pending",   // Offer sent, awaiting tenant response
        "accepted",  // Tenant accepted; transfer workflow is initiated
        "declined",  // Tenant explicitly declined; stays in waitlist queue
        "expired",   // No response before offerDeadline; stays in waitlist queue
      ],
      default: "pending",
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    declineReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
      // Optional; tenant may explain why they declined
    },

    // --- TTL support: auto-expire pending offers after deadline ---
    // A background job checks for pending offers where offerDeadline < now
    // and sets status → "expired". This field enables that efficiently.
    expiresAt: {
      type: Date,
      required: true,
      // Same value as offerDeadline — used by the TTL job index query.
    },
  },
  { timestamps: true },
);

// ============================================================================
// INDEXES
// ============================================================================

// Fast expiry sweep: find all pending offers past their deadline
waitlistOfferSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "waitlist_offer_expiry_sweep" },
);

waitlistOfferSchema.index({ waitlistId: 1, offeredAt: -1 });
waitlistOfferSchema.index({ tenantId: 1, status: 1 });

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("WaitlistOffer", waitlistOfferSchema);
