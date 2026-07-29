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
import { ROOM_BRANCHES } from "../config/branches.js";

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
    },
    roomNumber: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },

    // --- Location Details ---
    floor: {
      type: Number,
      default: 1,
      min: 1,
    },

    // --- Branch ---
    branch: {
      type: String,
      required: true,
      enum: ROOM_BRANCHES,
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
    shortTermRate: {
      type: Number,
      default: null,
      min: 0,
    },
    longTermDiscountPercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    // --- Features ---
    amenities: {
      type: [String],
      default: [],
    },
    policies: {
      type: [String],
      default: [],
    },
    intendedTenant: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },

    // --- Bed Details ---
    beds: {
      type: [
        {
          id: { type: String },
          position: {
            type: String,
            enum: ["upper", "lower", "single"],
            required: true,
          },
          bunkBlock: {
            type: String,
            default: "A",
          },
          code: {
            type: String,
            default: null,
          },
          // 5-state: available, locked (temp hold), reserved (confirmed), occupied, maintenance
          status: {
            type: String,
            enum: ["available", "locked", "reserved", "occupied", "maintenance", "cleaning_in_progress"],
            default: "available",
          },
          // Lock expiry for temporary bed holds
          lockExpiresAt: {
            type: Date,
            default: null,
          },
          lockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          occupiedBy: {
            userId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            reservationId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Reservation",
              default: null,
            },
            occupiedSince: {
              type: Date,
              default: null,
            },
          },
        },
      ],
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ============================================================================
// INDEXES
// ============================================================================

roomSchema.index({ branch: 1, type: 1 });
roomSchema.index({ branch: 1, available: 1 });
roomSchema.index({ isArchived: 1, available: 1 });
roomSchema.index(
  { branch: 1, roomNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
  },
);

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

/**
 * Mark a bed as occupied
 * @param {string} bedId - The bed ID to occupy
 * @param {string} userId - User ID occupying the bed
 * @param {string} reservationId - Reservation ID for tracking
 * @returns {boolean} - true if successful, false if bed not found
 */
roomSchema.methods.occupyBed = function (bedId, userId, reservationId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;

  bed.status = "occupied";
  bed.occupiedBy = {
    userId,
    reservationId,
    occupiedSince: new Date(),
  };
  return true;
};

/**
 * Mark a bed as vacant
 * @param {string} bedId - The bed ID to vacate
 * @returns {boolean} - true if successful, false if bed not found
 */
roomSchema.methods.vacateBed = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;

  bed.status = "available";
  bed.occupiedBy = {
    userId: null,
    reservationId: null,
    occupiedSince: null,
  };
  return true;
};

/**
 * Mark a bed as cleaning_in_progress during move-out turnover
 * @param {string} bedId - The bed ID to mark for cleaning
 * @returns {boolean} - true if successful
 */
roomSchema.methods.markBedForCleaning = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;

  bed.status = "cleaning_in_progress";
  bed.occupiedBy = {
    userId: null,
    reservationId: null,
    occupiedSince: null,
  };
  return true;
};

/**
 * Complete bed turnover cleaning (cleaning_in_progress -> available)
 * @param {string} bedId - The bed ID to mark clean
 * @returns {boolean} - true if successful
 */
roomSchema.methods.completeBedCleaning = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;

  bed.status = "available";
  return true;
};

/**
 * Lock a bed for maintenance (admin only)
 * @param {string} bedId - The bed ID to lock
 * @returns {boolean} - true if successful
 */
roomSchema.methods.lockBedForMaintenance = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;
  bed.status = "maintenance";
  bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
  return true;
};

/**
 * Unlock a bed from maintenance
 * @param {string} bedId - The bed ID to unlock
 * @returns {boolean} - true if successful
 */
roomSchema.methods.unlockBed = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed || bed.status !== "maintenance") return false;
  bed.status = "available";
  return true;
};

/**
 * Get all available beds
 * @returns {array} - Array of available beds
 */
roomSchema.methods.getAvailableBeds = function () {
  return this.beds.filter((bed) => bed.status === "available");
};

/**
 * Lock a bed temporarily for a user (prevents race conditions)
 * @param {string} bedId - The bed ID to lock
 * @param {ObjectId} userId - User requesting the lock
 * @param {number} lockMinutes - Lock duration in minutes (default 10)
 * @returns {boolean} - true if successful
 */
roomSchema.methods.lockBed = function (bedId, userId, lockMinutes = 10) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed || bed.status !== "available") return false;
  bed.status = "locked";
  bed.lockedBy = userId;
  bed.lockExpiresAt = new Date(Date.now() + lockMinutes * 60 * 1000);
  return true;
};

/**
 * Extend an existing bed lock for a user (called during active draft autosaves)
 * @param {string} bedId - The bed ID
 * @param {ObjectId} userId - User holding the lock
 * @param {number} extensionMinutes - Minutes to extend (default 15, max 30)
 * @returns {boolean} - true if lock was extended
 */
roomSchema.methods.extendBedLock = function (bedId, userId, extensionMinutes = 15) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed) return false;
  const now = new Date();
  const isExpired = bed.status === "locked" && bed.lockExpiresAt && bed.lockExpiresAt < now;
  const isOwnedByUser = bed.status === "locked" && String(bed.lockedBy) === String(userId);
  const isAvailable = bed.status === "available";

  if (isAvailable || isExpired || isOwnedByUser) {
    bed.status = "locked";
    bed.lockedBy = userId;
    const maxLock = Date.now() + 30 * 60 * 1000;
    const targetLock = Date.now() + extensionMinutes * 60 * 1000;
    bed.lockExpiresAt = new Date(Math.min(maxLock, targetLock));
    return true;
  }
  return false;
};

/**
 * Confirm a locked bed (lock → reserved)
 * @param {string} bedId - The bed ID
 * @param {ObjectId} userId - User who locked it
 * @returns {boolean} - true if successful
 */
roomSchema.methods.confirmBedLock = function (bedId, userId) {
  const bed = this.beds.find((b) => b.id === bedId);
  if (!bed || bed.status !== "locked") return false;
  if (String(bed.lockedBy) !== String(userId)) return false;
  bed.status = "reserved";
  bed.lockExpiresAt = null;
  return true;
};

/**
 * Release all expired bed locks back to available
 * @returns {number} - Number of beds unlocked
 */
roomSchema.methods.unlockExpiredBeds = function () {
  const now = new Date();
  let unlocked = 0;
  for (const bed of this.beds) {
    if (bed.status === "locked" && bed.lockExpiresAt && bed.lockExpiresAt < now) {
      bed.status = "available";
      bed.lockedBy = null;
      bed.lockExpiresAt = null;
      unlocked++;
    }
  }
  return unlocked;
};

/**
 * Get all occupied beds
 * @returns {array} - Array of occupied beds
 */
roomSchema.methods.getOccupiedBeds = function () {
  return this.beds.filter((bed) => bed.status === "occupied");
};

/**
 * Check if a specific bed is available
 * @param {string} bedId - The bed ID to check
 * @returns {boolean} - true if bed is available
 */
roomSchema.methods.isBedAvailable = function (bedId) {
  const bed = this.beds.find((b) => b.id === bedId);
  return bed ? bed.status === "available" : false;
};

/**
 * Increase room occupancy (ATOMIC — prevents race conditions)
 * Uses MongoDB $inc to guarantee no two concurrent operations can overbook.
 *
 * @param {string} roomId - The room ObjectId
 * @returns {Promise<Room|null>} Updated room or null if already at capacity
 */
roomSchema.statics.atomicIncreaseOccupancy = async function (roomId, session) {
  const opts = { new: true };
  if (session) opts.session = session;
  return this.findOneAndUpdate(
    {
      _id: roomId,
      $expr: { $lt: ["$currentOccupancy", "$capacity"] },
    },
    [
      {
        $set: {
          currentOccupancy: { $add: ["$currentOccupancy", 1] },
          available: {
            $lt: [{ $add: ["$currentOccupancy", 1] }, "$capacity"],
          },
        },
      },
    ],
    opts,
  );
};

/**
 * Decrease room occupancy (ATOMIC — prevents negative values)
 *
 * @param {string} roomId - The room ObjectId
 * @returns {Promise<Room|null>} Updated room or null if already at 0
 */
roomSchema.statics.atomicDecreaseOccupancy = async function (roomId, session) {
  const opts = { new: true };
  if (session) opts.session = session;
  return this.findOneAndUpdate(
    {
      _id: roomId,
      currentOccupancy: { $gt: 0 },
    },
    [
      {
        $set: {
          currentOccupancy: { $subtract: ["$currentOccupancy", 1] },
          // Derive available correctly: decremented occupancy must be < capacity
          // (was hardcoded `true` which could prematurely flip availability on multi-tenant rooms)
          available: {
            $and: [
              { $lt: [{ $subtract: ["$currentOccupancy", 1] }, "$capacity"] },
              { $ne: ["$isArchived", true] },
            ],
          },
        },
      },
    ],
    opts,
  );
};

/**
 * Increase room occupancy (instance method — backward compat)
 */
roomSchema.methods.increaseOccupancy = function () {
  this.currentOccupancy = Math.min(this.currentOccupancy + 1, this.capacity);
  this.available = this.currentOccupancy < this.capacity;
  return this;
};

/**
 * Decrease room occupancy (instance method — backward compat)
 */
roomSchema.methods.decreaseOccupancy = function () {
  this.currentOccupancy = Math.max(this.currentOccupancy - 1, 0);
  this.available = this.currentOccupancy < this.capacity;
  return this;
};

/**
 * Update room availability based on current occupancy
 */
roomSchema.methods.updateAvailability = function () {
  this.available = this.currentOccupancy < this.capacity && !this.isArchived;
  return this;
};

// ============================================================================
// INDEXES
// ============================================================================

roomSchema.index({ branch: 1, isArchived: 1, available: 1 });
roomSchema.index({ branch: 1, type: 1, isArchived: 1 });

// ============================================================================
// DRIFT DETECTION — PRE-SAVE HOOK
// ============================================================================

/**
 * Warn (non-blocking) when currentOccupancy is positive but no beds are
 * occupied or reserved. This surfaces counter drift early in server logs
 * without preventing the save or disrupting normal operations.
 *
 * Full reconciliation is handled by recalculateRoomOccupancy().
 */
roomSchema.pre("save", function (next) {
  if (
    (this.isModified("beds") || this.isModified("currentOccupancy")) &&
    this.currentOccupancy > 0
  ) {
    const activeBedsCount = (this.beds || []).filter(
      (b) => b.status === "occupied" || b.status === "reserved",
    ).length;

    if (activeBedsCount === 0 && this.currentOccupancy > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Room pre-save drift] Room "${this.name}" (${this._id}) has currentOccupancy=${this.currentOccupancy} but 0 occupied/reserved beds. Run recalculateRoomOccupancy to repair.`,
      );
    }
  }
  next();
});

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
