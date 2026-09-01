import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";
import { UTILITY_REVIEW_OUTCOMES } from "./UtilityPeriod.js";

export const UTILITY_HISTORICAL_GAP_REASONS = Object.freeze([
  "UNKNOWN_PREBASELINE_TENANT_LIABILITY",
  "UNKNOWN_VACANCY_BRANCH_CONSUMPTION",
]);

const resolutionSchema = new mongoose.Schema({
  outcome: { type: String, enum: UTILITY_REVIEW_OUTCOMES, required: true },
  explanation: { type: String, required: true },
  evidenceReferences: [{ type: String }],
  approvalReference: { type: String, required: true },
  financialDispositionType: { type: String, required: true },
  financialAmount: { type: Number, required: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reviewedAt: { type: Date, required: true },
  resolvedAt: { type: Date, required: true },
  auditLogId: { type: String, required: true },
}, { _id: false });

const utilityHistoricalGapSchema = new mongoose.Schema({
  repairKey: { type: String, required: true, index: true },
  utilityType: { type: String, enum: ["electricity", "water"], required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
  branch: { type: String, enum: ROOM_BRANCHES, required: true },
  utilityPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: "UtilityPeriod", required: true },
  intervalStart: { type: Date, required: true },
  intervalEnd: { type: Date, required: true },
  reason: { type: String, enum: UTILITY_HISTORICAL_GAP_REASONS, required: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  evidenceReferences: [{ type: String }],
  reviewState: { type: String, enum: ["PENDING", "RESOLVED", "NOT_REQUIRED"], required: true },
  blocksTransfer: { type: Boolean, required: true },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  openedAt: { type: Date, required: true },
  reviewOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewReference: { type: String, required: true },
  resolution: { type: resolutionSchema, default: null },
  isArchived: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  // Production creation is deliberately owned by the controlled lifecycle
  // index migration, not model initialization during application deployment.
  autoCreate: false,
  autoIndex: false,
});

utilityHistoricalGapSchema.pre("validate", function (next) {
  if (new Date(this.intervalEnd) <= new Date(this.intervalStart)) {
    return next(new Error("Historical utility-gap interval must have positive duration."));
  }
  if (this.reason === "UNKNOWN_PREBASELINE_TENANT_LIABILITY" && !this.reservationId) {
    return next(new Error("A tenant-liability gap requires an affected reservation."));
  }
  next();
});

utilityHistoricalGapSchema.index({ repairKey: 1, roomId: 1, utilityType: 1 }, { unique: true });
utilityHistoricalGapSchema.index({ reservationId: 1, blocksTransfer: 1, reviewState: 1, isArchived: 1 });

export default mongoose.model("UtilityHistoricalGap", utilityHistoricalGapSchema);
