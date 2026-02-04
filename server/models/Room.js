/**
 * ============================================================================
 * ROOM MODEL
 * ============================================================================
 *
 * Stores dormitory room information.
 *
 * BRANCHES:
 * - Each room belongs to a specific branch (gil-puyat or guadalupe)
 * - Rooms cannot be "general" - they must have a physical location
 *
 * ROOM TYPES:
 * - private: Single occupancy
 * - double-sharing: 2 occupants
 * - quadruple-sharing: 4 occupants
 *
 * OCCUPANCY:
 * - capacity: Maximum number of tenants
 * - currentOccupancy: Current number of tenants
 * - isFull virtual: Returns true when room is at capacity
 *
 * SOFT DELETE:
 * - Use isArchived=true to soft delete
 * - Archived rooms are hidden from listings
 *
 * ============================================================================
 */

import mongoose from "mongoose";

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const roomSchema = new mongoose.Schema(
  {
    // --- Basic Info ---
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },

    // --- Branch ---
    branch: {
      type: String,
      required: true,
      enum: ["gil-puyat", "guadalupe"],
      index: true,
    },

    // --- Room Type & Capacity ---
    type: {
      type: String,
      required: true,
      enum: ["private", "double-sharing", "quadruple-sharing"],
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Pricing ---
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyPrice: {
      type: Number,
      default: null,
    },

    // --- Features ---
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },

    // --- Availability ---
    available: {
      type: Boolean,
      default: true,
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

roomSchema.index({ branch: 1, type: 1 });
roomSchema.index({ branch: 1, available: 1 });
roomSchema.index({ isArchived: 1, available: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

/**
 * Check if room is at full capacity
 */
roomSchema.virtual("isFull").get(function () {
  return this.currentOccupancy >= this.capacity;
});

/**
 * Get available slots
 */
roomSchema.virtual("availableSlots").get(function () {
  return Math.max(0, this.capacity - this.currentOccupancy);
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Soft delete this room
 */
roomSchema.methods.archive = async function (archivedById = null) {
  this.isArchived = true;
  this.available = false;
  this.archivedAt = new Date();
  this.archivedBy = archivedById;
  return this.save();
};

/**
 * Restore an archived room
 */
roomSchema.methods.restore = async function () {
  this.isArchived = false;
  this.available = true;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find all active (non-archived) rooms
 */
roomSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isArchived: false });
};

/**
 * Find all archived rooms
 */
roomSchema.statics.findArchived = function (filter = {}) {
  return this.find({ ...filter, isArchived: true });
};

/**
 * Find available rooms for a branch
 */
roomSchema.statics.findAvailable = function (branch = null) {
  const filter = { isArchived: false, available: true };
  if (branch) filter.branch = branch;
  return this.find(filter);
};

// ============================================================================
// EXPORT
// ============================================================================

const Room = mongoose.model("Room", roomSchema);

export default Room;
