import mongoose from "mongoose";
import { BUSINESS } from "../config/constants.js";

const settingsChangeActorSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const branchOverrideSchema = new mongoose.Schema(
  {
    isApplianceFeeEnabled: {
      type: Boolean,
      default: false,
    },
    applianceFeeAmountPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    changedBy: {
      type: settingsChangeActorSchema,
      default: null,
    },
    changedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const businessSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    reservationFeeAmount: {
      type: Number,
      default: BUSINESS.DEPOSIT_AMOUNT,
      min: 0,
    },
    penaltyRatePerDay: {
      type: Number,
      default: BUSINESS.PENALTY_RATE_PER_DAY,
      min: 0,
    },
    maxPenaltyCapPercent: {
      type: Number,
      default: BUSINESS.MAX_PENALTY_CAP_PERCENT,
      min: 0,
      max: 100,
    },
    defaultElectricityRatePerKwh: {
      type: Number,
      default: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
      min: 0,
    },
    defaultWaterRatePerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    noShowGraceDays: {
      type: Number,
      default: BUSINESS.NOSHOW_GRACE_DAYS,
      min: 0,
    },
    stalePendingHours: {
      type: Number,
      default: BUSINESS.STALE_PENDING_HOURS,
      min: 0,
    },
    staleVisitPendingHours: {
      type: Number,
      default: BUSINESS.STALE_VISIT_PENDING_HOURS,
      min: 0,
    },
    visitPendingWarnDays: {
      type: Number,
      default: BUSINESS.VISIT_PENDING_WARN_DAYS,
      min: 0,
    },
    staleVisitApprovedHours: {
      type: Number,
      default: BUSINESS.STALE_VISIT_APPROVED_HOURS,
      min: 0,
    },
    stalePaymentPendingHours: {
      type: Number,
      default: BUSINESS.STALE_PAYMENT_PENDING_HOURS,
      min: 0,
    },
    archiveCancelledAfterDays: {
      type: Number,
      default: BUSINESS.ARCHIVE_CANCELLED_AFTER_DAYS,
      min: 0,
    },
    // Spec §9.2: Duration of the bed checkout lock window.
    // When an applicant reaches the payment step, their selected bed is held
    // for this many minutes. If they don't complete payment, the lock is released.
    // Default: 30 minutes. Range: 5–120 minutes.
    checkoutLockDurationMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 120,
    },
    // Spec §11.3: Hours a waitlisted tenant has to respond to a lower-bed offer.
    // If the deadline passes with no response, the offer expires automatically
    // and the tenant stays in the waitlist queue for the next available bed.
    // Default: 48 hours. Range: 12–168 hours (half-day to one week).
    waitlistOfferDeadlineHours: {
      type: Number,
      default: 48,
      min: 12,
      max: 168,
    },
    // Spec §24.2: Minimum calendar days of advance notice required before a
    // rent increase takes effect. Validated against LeaseRenewal.effectiveFrom.
    // Default: 30 days. Range: 7–60 days.
    renewalNoticeRequiredDays: {
      type: Number,
      default: 30,
      min: 7,
      max: 60,
    },
    // Spec §26.1 & §13: RFID replacement charge applied when the tenant does
    // not return their RFID card at move-out. Sourced from here — never
    // hardcoded in the clearance controller.
    // Default: ₱1,000. Range: ₱500–₱3,000.
    rfidReplacementCharge: {
      type: Number,
      default: 1000,
      min: 500,
      max: 3000,
    },
    // Spec §26.4: Committed processing period for deposit refunds after
    // clearance approval. Displayed on the tenant's portal so they know
    // when to expect their refund. Default: 30 days. Range: 1–90 days.
    depositRefundProcessingDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 90,
    },
    longTermLeaseMinMonths: {
      type: Number,
      default: BUSINESS.LONG_TERM_LEASE_MIN_MONTHS || 6,
      min: 1,
    },
    defaultLongTermDiscountPercent: {
      type: Number,
      default: BUSINESS.DEFAULT_LONG_TERM_DISCOUNT_PERCENT || 10,
      min: 0,
      max: 100,
    },
    isDiscountEnabled: {
      type: Boolean,
      default: true,
    },
    quadrupleDiscountPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    doubleDiscountPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    privateDiscountPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    branchOverrides: {
      type: Map,
      of: branchOverrideSchema,
      default: () => ({
        "gil-puyat": {
          isApplianceFeeEnabled: false,
          applianceFeeAmountPerUnit: 0,
          changedBy: null,
          changedAt: null,
        },
        guadalupe: {
          isApplianceFeeEnabled: true,
          applianceFeeAmountPerUnit: 200,
          changedBy: null,
          changedAt: null,
        },
      }),
    },
    changedBy: {
      type: settingsChangeActorSchema,
      default: null,
    },
    changedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("BusinessSettings", businessSettingsSchema);
