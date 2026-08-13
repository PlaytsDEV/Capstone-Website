import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const affectedReservationSchema = new mongoose.Schema(
  {
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
    tenantName: { type: String, default: "" },
    visitDate: { type: String, default: "" },
    visitSlot: { type: String, default: "" },
    status: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    userPhone: { type: String, default: "" },
  },
  { _id: false },
);

const actorSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    email: { type: String, default: "" },
    role: { type: String, default: "" },
  },
  { _id: false },
);

const visitConflictLogSchema = new mongoose.Schema(
  {
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },
    ruleChangeType: {
      type: String,
      enum: ["blackout_date_conflict", "weekday_removal_conflict", "slot_disabled_conflict"],
      required: true,
    },
    trigger: {
      type: String,
      default: "",
    },
    affectedReservations: {
      type: [affectedReservationSchema],
      default: [],
    },
    affectedCount: {
      type: Number,
      default: 0,
    },
    acknowledgedBy: {
      type: actorSchema,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedBy: {
      type: actorSchema,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    historyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VisitAvailabilityHistory",
      default: null,
    },
  },
  { timestamps: true },
);

visitConflictLogSchema.index({ branch: 1, createdAt: -1 });

export default mongoose.model("VisitConflictLog", visitConflictLogSchema);
