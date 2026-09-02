import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";
import {
  CANONICAL_UTILITY_EVENT_TYPES,
  normalizeUtilityEventType,
} from "../utils/lifecycleNaming.js";
import { isValidPhysicalMeterReading } from "../utils/physicalMeterReading.js";

const utilityReadingSchema = new mongoose.Schema(
  {
    utilityType: {
      type: String,
      enum: ["electricity", "water"],
      required: true,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },

    reading: {
      type: Number,
      required: true,
      validate: {
        validator: isValidPhysicalMeterReading,
        message: "Physical meter reading must be finite and non-negative.",
      },
    },
    date: {
      type: Date,
      required: true,
    },
    eventType: {
      type: String,
      enum: CANONICAL_UTILITY_EVENT_TYPES,
      required: true,
      set: normalizeUtilityEventType,
    },
    readingStatus: {
      type: String,
      enum: ["recorded", "locked", "corrected", "voided"],
      default: "recorded",
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    activeTenantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    utilityPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UtilityPeriod",
      default: null,
    },

    // For an explicit reset event, `reading` is the new meter opening and this
    // object records the old meter's final physical value plus its evidence.
    meterReset: {
      oldMeterFinalReading: {
        type: Number,
        default: null,
        validate: {
          validator: (value) =>
            value == null || isValidPhysicalMeterReading(value),
          message: "Old meter final reading must be finite and non-negative.",
        },
      },
      evidenceReferences: [{ type: String, trim: true }],
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

utilityReadingSchema.index({ utilityType: 1, roomId: 1, date: 1 });
utilityReadingSchema.index({ utilityType: 1, roomId: 1, utilityPeriodId: 1 });
utilityReadingSchema.index({ branch: 1, date: -1 });
utilityReadingSchema.index({ utilityType: 1, roomId: 1, readingStatus: 1 });
// Compound index optimizing the transfer workflow's "latest reading for a room" fallback query:
// findOne({ roomId, utilityType, isArchived: false }).sort({ date: -1, createdAt: -1 })
utilityReadingSchema.index({ roomId: 1, utilityType: 1, isArchived: 1, date: -1 }, { name: "transfer_meter_lookup" });

utilityReadingSchema.pre("validate", function (next) {
  if (this.eventType) {
    this.eventType = normalizeUtilityEventType(this.eventType);
  }

  if (
    ["meterReplacement", "meterRollover"].includes(this.eventType) &&
    !isValidPhysicalMeterReading(this.meterReset?.oldMeterFinalReading)
  ) {
    return next(
      new Error(
        "Meter replacement/rollover requires the old meter final reading and the new meter opening reading.",
      ),
    );
  }
  if (
    ["meterReplacement", "meterRollover"].includes(this.eventType) &&
    !(this.meterReset?.evidenceReferences || []).some((reference) =>
      String(reference || "").trim(),
    )
  ) {
    return next(
      new Error(
        "Meter replacement/rollover requires at least one evidence reference.",
      ),
    );
  }

  next();
});

export default mongoose.model("UtilityReading", utilityReadingSchema);
