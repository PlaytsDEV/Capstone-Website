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
    // --- Reservation ID & References ---
    reservationCode: {
      type: String,
      unique: true,
      sparse: true,
    },
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

    // Bed Assignment
    selectedBed: {
      id: String,
      position: String, // "upper", "lower", "single"
    },

    // =========================================================================
    // STAGE 1: SUMMARY
    // =========================================================================
    targetMoveInDate: Date,
    leaseDuration: {
      type: Number,
      default: 12, // months
    },
    billingEmail: String,

    // =========================================================================
    // STAGE 2: VISIT
    // =========================================================================
    viewingType: {
      type: String,
      default: "inperson",
    },
    isOutOfTown: Boolean,
    currentLocation: String,
    visitApproved: {
      type: Boolean,
      default: false,
    },

    // =========================================================================
    // STAGE 3: DETAILS
    // =========================================================================

    // Photo Documents
    selfiePhotoUrl: String,

    // Personal Information
    firstName: String,
    lastName: String,
    middleName: String,
    nickname: String,
    mobileNumber: String,
    birthday: Date,
    maritalStatus: String, // "single", "married", "divorced", "widowed"
    nationality: String,
    educationLevel: String, // "highschool", "college", "graduate", "other"

    // Address Information
    address: {
      unitHouseNo: String,
      street: String,
      barangay: String,
      city: String,
      province: String,
    },

    // Identity Documents
    validIDFrontUrl: String,
    validIDBackUrl: String,
    validIDType: String,
    nbiClearanceUrl: String,
    nbiReason: String,
    companyIDUrl: String,
    companyIDReason: String,

    // Emergency Contact
    emergencyContact: {
      name: String,
      relationship: String,
      contactNumber: String,
    },
    healthConcerns: String,

    // Employment Information
    employment: {
      employerSchool: String,
      employerAddress: String,
      employerContact: String,
      startDate: Date,
      occupation: String,
      previousEmployment: String,
    },

    // Dorm-Related Questions
    preferredRoomType: String, // "private", "double-sharing", "quadruple-sharing"
    preferredRoomNumber: String,
    referralSource: String,
    referrerName: String,
    estimatedMoveInTime: String,
    workSchedule: String, // "day", "night", "variable", "others"
    workScheduleOther: String,

    // Agreements
    agreedToPrivacy: {
      type: Boolean,
      default: false,
    },
    agreedToCertification: {
      type: Boolean,
      default: false,
    },

    // =========================================================================
    // STAGE 4: PAYMENT
    // =========================================================================
    proofOfPaymentUrl: String,

    // --- Reservation Dates & Pricing ---
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      default: null,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    applianceFees: {
      type: Number,
      default: 0,
    },

    // --- Status ---
    status: {
      type: String,
      enum: ["pending", "confirmed", "checked-in", "checked-out", "cancelled"],
      default: "pending",
      index: true,
    },

    // --- Payment ---
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
// PRE-SAVE HOOKS
// ============================================================================

/**
 * Generate reservation code before saving if not already set
 */
reservationSchema.pre("save", async function (next) {
  if (!this.reservationCode) {
    // Generate a short unique code: RES-ABC123 (6 characters)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "RES-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.reservationCode = code;
  }
  next();
});

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
