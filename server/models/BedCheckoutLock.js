/**
 * ============================================================================
 * BED CHECKOUT LOCK MODEL (Spec §9.2 — Concurrency Guard)
 * ============================================================================
 *
 * Prevents race conditions where two applicants simultaneously reach the
 * payment step for the same last-available bed.
 *
 * MECHANISM:
 *   1. When an applicant's reservation moves to "payment_pending", a
 *      BedCheckoutLock document is created for their (roomId + bedId).
 *   2. All bed-availability checks query this collection in addition to
 *      the Reservation status.
 *   3. A MongoDB TTL index on `expiresAt` auto-deletes stale locks.
 *   4. On payment success OR explicit cancellation, the lock is released
 *      immediately (document deleted).
 *
 * LOCK DURATION:
 *   Sourced from BusinessSettings.checkoutLockDurationMinutes (default: 30).
 *   Never hardcoded.
 *
 * ATOMICITY:
 *   Lock acquisition uses findOneAndUpdate with upsert:true and a unique
 *   index on [roomId + bedId]. This means only ONE request can "win" the
 *   upsert for a given bed — all subsequent concurrent requests receive a
 *   duplicate-key error and are rejected with HTTP 409.
 *
 * ============================================================================
 */

import mongoose from "mongoose";

const bedCheckoutLockSchema = new mongoose.Schema(
  {
    // --- What is locked ---
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    bedId: {
      type: String,
      required: true,
      // The bed identifier string (e.g. "A1-lower", "B2-upper")
    },
    branch: {
      type: String,
      required: true,
    },

    // --- Who holds the lock ---
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Lock lifecycle ---
    lockedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL index on this field — MongoDB auto-deletes the document after expiry.
      // Duration = BusinessSettings.checkoutLockDurationMinutes (default: 30 min).
    },

    // --- Audit ---
    releaseReason: {
      type: String,
      enum: [
        "payment_success",    // Paid — lock released, bed is now reserved
        "payment_failed",     // Payment attempt failed
        "user_abandoned",     // User left the payment page
        "admin_release",      // Admin manually released
        "ttl_expired",        // Expired naturally (set by cleanup job for audit)
      ],
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Optimistic concurrency version key — helps detect stale reads
    versionKey: "__v",
  },
);

// ============================================================================
// INDEXES
// ============================================================================

// Compound unique index — only ONE lock per (room, bed) at any time.
// This is the core concurrency guard: the second concurrent upsert fails
// with a duplicate-key error (E11000), which the controller translates to
// HTTP 409 with a clear message to the applicant.
bedCheckoutLockSchema.index(
  { roomId: 1, bedId: 1 },
  {
    unique: true,
    name: "bed_checkout_lock_unique",
    // Partial filter: only enforce uniqueness for active (non-released) locks.
    // Released locks are kept briefly for audit before TTL removes them.
    partialFilterExpression: { releaseReason: null },
  },
);

// TTL index — MongoDB auto-deletes documents when the current time
// passes `expiresAt`. This is the self-healing mechanism: if the server
// crashes mid-payment, the lock is automatically released by the DB engine.
bedCheckoutLockSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "bed_checkout_lock_ttl",
  },
);

// Supporting lookup index
bedCheckoutLockSchema.index({ reservationId: 1 });
bedCheckoutLockSchema.index({ userId: 1 });

// ============================================================================
// STATICS
// ============================================================================

/**
 * Acquire a checkout lock for a specific bed.
 *
 * @param {Object} params
 * @param {string} params.roomId
 * @param {string} params.bedId
 * @param {string} params.branch
 * @param {string} params.reservationId
 * @param {string} params.userId
 * @param {number} params.lockDurationMinutes  Sourced from BusinessSettings
 * @returns {Promise<{ acquired: boolean, lock: Document|null, conflictReservationId: string|null }>}
 */
bedCheckoutLockSchema.statics.acquireLock = async function ({
  roomId,
  bedId,
  branch,
  reservationId,
  userId,
  lockDurationMinutes = 30,
}) {
  const expiresAt = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

  try {
    const lock = await this.findOneAndUpdate(
      // Match: this exact bed has no active lock
      { roomId, bedId, releaseReason: null },
      // Set: create or claim the lock
      {
        $setOnInsert: {
          roomId,
          bedId,
          branch,
          reservationId,
          userId,
          lockedAt: new Date(),
          expiresAt,
          releaseReason: null,
          releasedAt: null,
        },
      },
      {
        upsert: true,
        new: true,
        // runValidators ensures required fields pass schema validation
        runValidators: true,
      },
    );

    // If the returned document belongs to this reservation, acquisition succeeded
    const acquired = String(lock.reservationId) === String(reservationId);
    return { acquired, lock: acquired ? lock : null, conflictReservationId: acquired ? null : String(lock.reservationId) };
  } catch (err) {
    // E11000 = duplicate key — another request won the race
    if (err.code === 11000) {
      const existing = await this.findOne({ roomId, bedId, releaseReason: null }).lean();
      return {
        acquired: false,
        lock: null,
        conflictReservationId: existing ? String(existing.reservationId) : null,
      };
    }
    throw err;
  }
};

/**
 * Release a checkout lock.
 *
 * @param {string} reservationId
 * @param {string} reason  One of the releaseReason enum values
 */
bedCheckoutLockSchema.statics.releaseLock = async function (reservationId, reason) {
  return this.findOneAndUpdate(
    { reservationId, releaseReason: null },
    { $set: { releaseReason: reason, releasedAt: new Date() } },
    { new: true },
  );
};

/**
 * Check whether a specific bed is currently locked by a DIFFERENT reservation.
 *
 * @param {string} roomId
 * @param {string} bedId
 * @param {string} [excludeReservationId]  The calling reservation's own ID (excluded)
 * @returns {Promise<boolean>}
 */
bedCheckoutLockSchema.statics.isBedLocked = async function (
  roomId,
  bedId,
  excludeReservationId = null,
) {
  const query = { roomId, bedId, releaseReason: null, expiresAt: { $gt: new Date() } };
  if (excludeReservationId) {
    query.reservationId = { $ne: excludeReservationId };
  }
  return !!(await this.exists(query));
};

// ============================================================================
// EXPORT
// ============================================================================

export default mongoose.model("BedCheckoutLock", bedCheckoutLockSchema);
