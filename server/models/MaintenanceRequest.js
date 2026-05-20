/**
 * ============================================================================
 * MAINTENANCE REQUEST MODEL
 * ============================================================================
 *
 * Canonical maintenance request storage aligned to the maintenance_requests
 * contract used by the tenant/mobile and admin maintenance workflows.
 *
 * Public contract fields mirror the reference schema. Additional internal
 * fields such as branch, roomId, reservationId, and userId are retained so the
 * rest of this repo can continue to scope and relate maintenance data.
 *
 * ============================================================================
 */

import crypto from "crypto";
import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";
import {
    MAINTENANCE_REQUEST_TYPES,
    MAINTENANCE_STATUSES,
    MAINTENANCE_URGENCY_LEVELS,
} from "../config/maintenance.js";

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Attachment",
      trim: true,
    },
    uri: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      default: "application/octet-stream",
      trim: true,
    },
    context: {
      type: String,
      default: null,
      trim: true,
    },
    visibility: {
      type: String,
      enum: ["tenant_admin", "admin_only", null],
      default: "tenant_admin",
      index: true,
    },
    branchId: {
      type: String,
      enum: [...ROOM_BRANCHES, null],
      default: null,
      index: true,
    },
    uploadedBy: {
      type: String,
      default: null,
      trim: true,
    },
    senderRole: {
      type: String,
      default: null,
      trim: true,
    },
    relatedId: {
      type: String,
      default: null,
      trim: true,
    },
    url: {
      type: String,
      default: null,
      trim: true,
    },
    filename: {
      type: String,
      default: null,
      trim: true,
    },
    mimeType: {
      type: String,
      default: null,
      trim: true,
    },
    size: {
      type: Number,
      default: null,
      min: 0,
    },
    isRemoved: {
      type: Boolean,
      default: false,
      index: true,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: String,
      default: null,
      trim: true,
    },
    removedByRole: {
      type: String,
      default: null,
      trim: true,
    },
    removedByName: {
      type: String,
      default: null,
      trim: true,
    },
    removedReason: {
      type: String,
      default: null,
      trim: true,
    },
    removedScope: {
      type: String,
      enum: ["tenant_only", "request", null],
      default: null,
      index: true,
    },
  },
  { _id: false, strict: false },
);

const reopenHistorySchema = new mongoose.Schema(
  {
    reopened_at: {
      type: Date,
      required: true,
    },
    previous_status: {
      type: String,
      required: true,
      enum: MAINTENANCE_STATUSES,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: MAINTENANCE_STATUSES,
    },
    actor_id: {
      type: String,
      default: null,
      trim: true,
    },
    actor_name: {
      type: String,
      default: null,
      trim: true,
    },
    actor_role: {
      type: String,
      default: null,
      trim: true,
    },
    note: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const workLogSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    actor_id: {
      type: String,
      default: null,
      trim: true,
    },
    actor_name: {
      type: String,
      default: null,
      trim: true,
    },
    actor_role: {
      type: String,
      default: null,
      trim: true,
    },
    logged_at: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const conversationEntrySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      default: null,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    sender_id: {
      type: String,
      default: null,
      trim: true,
    },
    sender_name: {
      type: String,
      default: null,
      trim: true,
    },
    sender_role: {
      type: String,
      default: null,
      trim: true,
    },
    sender_side: {
      type: String,
      enum: ["tenant", "admin"],
      default: "admin",
    },
    created_at: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const buildRequestId = () =>
  `maint_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const maintenanceRequestSchema = new mongoose.Schema(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    request_type: {
      type: String,
      required: true,
      enum: MAINTENANCE_REQUEST_TYPES,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    urgency: {
      type: String,
      enum: MAINTENANCE_URGENCY_LEVELS,
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: "pending",
      index: true,
    },

    assigned_to: {
      type: String,
      default: null,
      trim: true,
    },
    notes: {
      type: String,
      default: null,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    reopen_note: {
      type: String,
      default: null,
    },
    reopen_history: {
      type: [reopenHistorySchema],
      default: [],
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },

    cancelled_at: {
      type: Date,
      default: null,
    },
    reopened_at: {
      type: Date,
      default: null,
    },
    assigned_at: {
      type: Date,
      default: null,
    },
    work_started_at: {
      type: Date,
      default: null,
    },
    closed_at: {
      type: Date,
      default: null,
    },
    resolution_note: {
      type: String,
      default: null,
    },
    work_log: {
      type: [workLogSchema],
      default: [],
    },
    conversation: {
      type: [conversationEntrySchema],
      default: [],
    },

    // Internal compatibility/supporting fields
    resolved_at: {
      type: Date,
      default: null,
    },
    branch: {
      type: String,
      enum: ROOM_BRANCHES,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },
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
      type: String,
      default: null,
      trim: true,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    restoredBy: {
      type: String,
      default: null,
      trim: true,
    },
    // Prevents duplicate SLA breach notifications for the same unresolved breach.
    // Reset to false whenever status changes so re-escalation fires correctly.
    // Covered by the compound index { status, urgency, created_at, slaBreachNotified }.
    slaBreachNotified: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "maintenance_requests",
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

maintenanceRequestSchema.pre("validate", function ensureRequestId(next) {
  if (!this.request_id) {
    this.request_id = buildRequestId();
  }
  next();
});

// Prevent unbounded array growth — keep the most recent entries.
const MAINTENANCE_ARRAY_CAPS = {
  work_log: 200,
  statusHistory: 200,
  reopen_history: 30,
  conversation: 200,
};

maintenanceRequestSchema.pre("save", function (next) {
  for (const [field, cap] of Object.entries(MAINTENANCE_ARRAY_CAPS)) {
    if (Array.isArray(this[field]) && this[field].length > cap) {
      this[field] = this[field].slice(-cap);
    }
  }
  next();
});

maintenanceRequestSchema.index({ branch: 1, status: 1, created_at: -1 });
maintenanceRequestSchema.index({ branch: 1, request_type: 1, created_at: -1 });
maintenanceRequestSchema.index({ user_id: 1, created_at: -1 });
maintenanceRequestSchema.index({ roomId: 1, status: 1, created_at: -1 });
// Covers the SLA breach detection query in slaAlertJob.js
maintenanceRequestSchema.index({ status: 1, urgency: 1, created_at: -1, slaBreachNotified: 1 });

const MaintenanceRequest = mongoose.model(
  "MaintenanceRequest",
  maintenanceRequestSchema,
);

export default MaintenanceRequest;
