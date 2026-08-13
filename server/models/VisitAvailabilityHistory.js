import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

// ── Re-use the same sub-schemas shape as VisitAvailability ──────────────────

const visitSlotSnapshotSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    capacity: { type: Number, default: 5, min: 0 },
  },
  { _id: false },
);

const blackoutDateSnapshotSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    reason: { type: String, default: "", trim: true },
  },
  { _id: false },
);

// ── Snapshot: full copy of settings at the time of save ─────────────────────

const snapshotSchema = new mongoose.Schema(
  {
    enabledWeekdays: { type: [Number], default: [] },
    slots: { type: [visitSlotSnapshotSchema], default: [] },
    blackoutDates: { type: [blackoutDateSnapshotSchema], default: [] },
  },
  { _id: false },
);

// ── Diff: pre-computed before/after delta ────────────────────────────────────

const diffSchema = new mongoose.Schema(
  {
    added: { type: mongoose.Schema.Types.Mixed, default: {} },
    removed: { type: mongoose.Schema.Types.Mixed, default: {} },
    modified: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

// ── Actor: who made the change ───────────────────────────────────────────────

const actorSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    email: { type: String, default: "" },
    role: { type: String, default: "" },
  },
  { _id: false },
);

// ── Main Schema ──────────────────────────────────────────────────────────────

const visitAvailabilityHistorySchema = new mongoose.Schema(
  {
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },
    snapshot: {
      type: snapshotSchema,
      required: true,
    },
    changedBy: {
      type: actorSchema,
      default: null,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    changeDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    diff: {
      type: diffSchema,
      default: () => ({ added: {}, removed: {}, modified: {} }),
    },
  },
  { timestamps: false },
);

// Compound index for fast paginated reads per branch (newest-first)
visitAvailabilityHistorySchema.index({ branch: 1, changedAt: -1 });

export default mongoose.model(
  "VisitAvailabilityHistory",
  visitAvailabilityHistorySchema,
);
