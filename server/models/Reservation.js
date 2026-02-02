/**
 * ============================================================================
 * RESERVATION MODEL
 * ============================================================================
 *
 * Stores room reservation/booking information.
 *
 * WORKFLOW:
 * 1. User creates reservation (status: pending)
 * 2. Admin confirms reservation (status: confirmed)
 * 3. Tenant checks in (status: checked-in)
 * 4. Tenant checks out (status: checked-out)
 *
 * CANCELLATION:
 * - Reservations can be cancelled before check-in
 * - Cancelled reservations remain in system for records
 *
 * PAYMENT:
 * - paymentStatus tracks payment progress
 * - pending → partial → paid
 *
 * SOFT DELETE:
 * - Use isArchived=true to soft delete
 * - Archived reservations are hidden from active lists
 *
 * ============================================================================
 */

import mongoose from "mongoose";

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const reservationSchema = new mongoose.Schema(
  {
    // --- References ---
    userId: {
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

    // --- Dates ---
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      default: null,
    },

    // --- Status ---
    status: {
      type: String,
      enum: ["pending", "confirmed", "checked-in", "checked-out", "cancelled"],
      default: "pending",
      index: true,
    },

    // --- Payment ---
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending",
    },

    // --- Notes ---
    notes: {
      type: String,
      default: "",
    },

    // --- Soft Delete ---
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================================
// INDEXES
// ============================================================================

reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ roomId: 1, checkInDate: 1 });
reservationSchema.index({ status: 1, checkInDate: 1 });
reservationSchema.index({ isArchived: 1, status: 1 });

// ============================================================================
// METHODS
// ============================================================================

/**
 * Soft delete this reservation
 */
reservationSchema.methods.archive = async function (archivedById = null) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = archivedById;
  return this.save();
};

/**
 * Restore an archived reservation
 */
reservationSchema.methods.restore = async function () {
  this.isArchived = false;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

/**
 * Cancel this reservation
 */
reservationSchema.methods.cancel = async function () {
  this.status = "cancelled";
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find all active (non-archived) reservations
 */
reservationSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isArchived: false });
};

/**
 * Find all archived reservations
 */
reservationSchema.statics.findArchived = function (filter = {}) {
  return this.find({ ...filter, isArchived: true });
};

/**
 * Find pending reservations
 */
reservationSchema.statics.findPending = function (filter = {}) {
  return this.find({ ...filter, isArchived: false, status: "pending" });
};

// ============================================================================
// EXPORT
// ============================================================================

const Reservation = mongoose.model("Reservation", reservationSchema);

export default Reservation;
