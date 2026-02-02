/**
 * ============================================================================
 * USER MODEL
 * ============================================================================
 *
 * Stores user profile and account information.
 *
 * AUTHENTICATION:
 * - Firebase Auth is the source of truth for authentication
 * - This model stores profile data and access control
 *
 * BRANCHES:
 * - Users are assigned to a branch (gil-puyat, guadalupe, or empty)
 * - Empty branch means user hasn't selected one yet (Gmail signup)
 *
 * ROLES:
 * - user: Default role, not yet a tenant
 * - tenant: Active tenant (moved in)
 * - admin: Branch administrator
 * - superAdmin: System-wide administrator
 *
 * SOFT DELETE:
 * - Use isArchived=true to soft delete
 * - Archived users cannot log in
 *
 * ============================================================================
 */

import mongoose from "mongoose";

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const userSchema = new mongoose.Schema(
  {
    // --- Authentication Link ---
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // --- Credentials ---
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      index: true,
    },

    // --- Profile ---
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },

    // --- Branch & Role ---
    branch: {
      type: String,
      enum: ["gil-puyat", "guadalupe", ""],
      default: "",
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "tenant", "admin", "superAdmin"],
      default: "user",
    },

    // --- Status ---
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
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

userSchema.index({ branch: 1, role: 1 });
userSchema.index({ isArchived: 1, isActive: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Soft delete this user
 * @param {ObjectId} archivedById - ID of user performing the archive
 */
userSchema.methods.archive = async function (archivedById = null) {
  this.isArchived = true;
  this.isActive = false;
  this.archivedAt = new Date();
  this.archivedBy = archivedById;
  return this.save();
};

/**
 * Restore an archived user
 */
userSchema.methods.restore = async function () {
  this.isArchived = false;
  this.isActive = true;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Find all active (non-archived) users
 */
userSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isArchived: false });
};

/**
 * Find all archived users
 */
userSchema.statics.findArchived = function (filter = {}) {
  return this.find({ ...filter, isArchived: true });
};

// ============================================================================
// EXPORT
// ============================================================================

const User = mongoose.model("User", userSchema);

export default User;
