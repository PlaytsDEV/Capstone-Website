import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

/**
 * ============================================================================
 * UTILITY FINALIZATION
 * ============================================================================
 *
 * Records that one tenant's share of ONE utility (electricity only, today) in
 * ONE still-open UtilityPeriod was ALREADY finalized and billed outside the
 * normal period-close flow — specifically, on the day of an admin Room
 * Transfer (charged as `transfer_settlement.charges.electricity`).
 *
 * WHY IT EXISTS
 *   A room transfer settles the transferring tenant's accrued source-room
 *   electricity BEFORE the physical cutover, using a read-only `computeBilling`
 *   slice `[openPeriod.startReading -> freshSourceClosingReading]`. When that
 *   period later closes normally, the transferee is STILL a full participant
 *   in the canonical allocation (their `moveOut` UtilityReading at the exact
 *   cutover timestamp bounds their segments) — this row does NOT change who
 *   participated or the segment-sharing denominator. It is read at exactly one
 *   point, `upsertDraftBillsForUtility`, to SUPPRESS creation of a duplicate
 *   draft Bill for that tenant and to link the period result back to the
 *   `transfer_settlement` Bill for reconciliation/audit.
 *
 * RECONCILIATION INVARIANT (asserted by closePeriodAndGenerateDrafts + tests)
 *   Sum(draft-bill electricity charges for the period)
 *     + Sum(UtilityFinalization.settledAmount for the period)
 *   ~= period.computedTotalCost
 *
 * WRITTEN: inside the `transferStayWorkflow` cutover transaction, once, only
 * when the source branch bills electricity separately AND a fresh source
 * closing reading was supplied AND the source room has an open electricity
 * period. Never for water (water cannot be finalized before period close —
 * see the Room Transfer completion-flow design notes).
 *
 * IDEMPOTENT: unique on (reservationId, utilityPeriodId, utilityType). A
 * retried cutover upserts rather than duplicating.
 * ============================================================================
 */

const utilityFinalizationSchema = new mongoose.Schema(
  {
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
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    branch: { type: String, enum: ROOM_BRANCHES, required: true },

    utilityType: {
      type: String,
      enum: ["electricity"], // water is NEVER finalized early
      required: true,
    },
    utilityPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityPeriod",
      required: true,
      index: true,
    },

    // The meter reading the transferee's source-room liability was settled
    // through — the fresh closing reading entered during Complete Transfer.
    throughReading: { type: Number, required: true },
    // The ACTUAL physical cutover timestamp (transaction-local `new Date()`
    // from inside transferStayWorkflow — NOT the scheduled date/time).
    throughDate: { type: Date, required: true },

    // The canonical amount settled on transfer day (the transferee's
    // `tenantSummary.billAmount` from the read-only computeBilling slice).
    settledAmount: { type: Number, required: true },
    settledKwh: { type: Number, default: null },

    // The transfer_settlement Bill that carries this amount.
    settlementBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: true,
      index: true,
    },
    scheduledRoomTransferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduledRoomTransfer",
      default: null,
    },

    // Filled in at period close if the canonical per-tenant summary diverges
    // from `settledAmount` beyond tolerance (period still closes for
    // co-occupants; admin follows up).
    reconciliation: {
      periodSummaryAmount: { type: Number, default: null },
      variance: { type: Number, default: null },
      reconciledAt: { type: Date, default: null },
      flagged: { type: Boolean, default: false },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// At most one finalization per (reservation, period, utility).
utilityFinalizationSchema.index(
  { reservationId: 1, utilityPeriodId: 1, utilityType: 1 },
  { unique: true, name: "unique_finalization_per_reservation_period_utility" },
);
// Period-close lookup: "any finalizations for this period?".
utilityFinalizationSchema.index({ utilityPeriodId: 1, utilityType: 1, isArchived: 1 });

export default mongoose.model("UtilityFinalization", utilityFinalizationSchema);
