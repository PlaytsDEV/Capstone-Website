import {
  ArrowUpDown,
  BedDouble,
  Bug,
  Droplets,
  MoreHorizontal,
  Snowflake,
  Sparkles,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { formatStageStatus } from "./stageUtils.js";

export const MAINTENANCE_REQUEST_TYPE_META = Object.freeze({
  maintenance: { label: "General Maintenance", icon: Wrench, color: "#F59E0B" },
  plumbing: { label: "Plumbing", icon: Droplets, color: "#3B82F6" },
  electrical: { label: "Electrical", icon: Zap, color: "#EF4444" },
  aircon: { label: "Air Conditioning", icon: Snowflake, color: "#06B6D4" },
  elevator: { label: "Elevator", icon: ArrowUpDown, color: "#8B5CF6" },
  furniture: { label: "Furniture / Fixture", icon: BedDouble, color: "#EC4899" },
  internet: { label: "Internet / Network", icon: Wifi, color: "#0284C7" },
  cleaning: { label: "Cleaning", icon: Sparkles, color: "#22C55E" },
  pest: { label: "Pest Control", icon: Bug, color: "#7C3AED" },
  other: { label: "Other", icon: MoreHorizontal, color: "#6B7280" },
});

export const MAINTENANCE_REQUEST_TYPES = Object.freeze(
  Object.keys(MAINTENANCE_REQUEST_TYPE_META),
);

export const MAINTENANCE_URGENCY_META = Object.freeze({
  normal: {
    label: "Normal",
    description: "Standard repair timeline",
    color: "#F59E0B",
    estimate: "1-2 business days",
  },
  urgent: {
    label: "Urgent",
    description: "Needs priority attention",
    color: "#EA580C",
    estimate: "Within 24 hours",
  },
  emergency: {
    label: "Emergency",
    description: "Immediate safety / hazard",
    color: "#DC2626",
    estimate: "Immediate dispatch",
  },
  low: {
    label: "Low",
    description: "Can wait a few days",
    color: "#22C55E",
    estimate: "3-5 business days",
  },
  high: {
    label: "Urgent",
    description: "Needs immediate attention",
    color: "#EF4444",
    estimate: "Within 24 hours",
  },
});

export const MAINTENANCE_URGENCY_LEVELS = Object.freeze([
  "normal",
  "urgent",
  "emergency",
  "low",
  "high",
]);

export const MIN_MAINTENANCE_DESCRIPTION_LENGTH = 10;
export const MAX_MAINTENANCE_DESCRIPTION_LENGTH = 1000;
export const MAX_MAINTENANCE_ATTACHMENTS = 5;

export const ACTIVE_MAINTENANCE_STATUSES = Object.freeze([
  "pending",
  "pending_review",
  "provider_assigned",
  "scheduled",
  "viewed",
  "reviewed",
  "in_progress",
  "waiting_tenant",
  "resolved",
  "reopened",
]);

export const RESOLVED_MAINTENANCE_STATUSES = Object.freeze([
  "resolved",
  "completed",
  "rejected",
  "cancelled",
  "closed",
]);

export const REOPENABLE_MAINTENANCE_STATUSES = Object.freeze([
  "resolved",
  "completed",
]);

export const TERMINAL_ADMIN_MAINTENANCE_STATUSES = Object.freeze([
  "completed",
  "rejected",
  "cancelled",
  "closed",
]);

export const LOCKED_ADMIN_MAINTENANCE_STATUSES = Object.freeze([
  "cancelled",
  "closed",
]);

export const MAINTENANCE_STATUS_META = Object.freeze({
  pending: {
    label: "Pending Review",
    shortLabel: "Pending",
    bg: "#FEF3C7",
    color: "#B45309",
    variant: "warning",
  },
  pending_review: {
    label: "Pending Review",
    shortLabel: "Pending",
    bg: "#FEF3C7",
    color: "#B45309",
    variant: "warning",
  },
  provider_assigned: {
    label: "Provider Assigned",
    shortLabel: "Assigned",
    bg: "#DBEAFE",
    color: "#1D4ED8",
    variant: "info",
  },
  scheduled: {
    label: "Scheduled",
    shortLabel: "Scheduled",
    bg: "#E0F2FE",
    color: "#0369A1",
    variant: "info",
  },
  viewed: {
    label: "Under Review",
    shortLabel: "Under Review",
    bg: "#FEF3C7",
    color: "#B45309",
    variant: "warning",
  },
  reviewed: {
    label: "Under Review",
    shortLabel: "Under Review",
    bg: "#FEF3C7",
    color: "#B45309",
    variant: "warning",
  },
  in_progress: {
    label: "In Progress",
    shortLabel: "In Progress",
    bg: "#DBEAFE",
    color: "#1D4ED8",
    variant: "info",
  },
  waiting_tenant: {
    label: "In Progress",
    shortLabel: "In Progress",
    bg: "#DBEAFE",
    color: "#1D4ED8",
    variant: "info",
  },
  reopened: {
    label: "Reopened",
    shortLabel: "Reopened",
    bg: "#FEE2E2",
    color: "#DC2626",
    variant: "error",
  },
  resolved: {
    label: "Resolved",
    shortLabel: "Resolved",
    bg: "#DCFCE7",
    color: "#15803D",
    variant: "success",
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    bg: "#DCFCE7",
    color: "#15803D",
    variant: "success",
  },
  rejected: {
    label: "Rejected",
    shortLabel: "Rejected",
    bg: "#FEE2E2",
    color: "#DC2626",
    variant: "error",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "Cancelled",
    bg: "#F3F4F6",
    color: "#6B7280",
    variant: "neutral",
  },
  closed: {
    label: "Closed",
    shortLabel: "Closed",
    bg: "#E2E8F0",
    color: "#475569",
    variant: "neutral",
  },
});

export const ADMIN_MAINTENANCE_STATUS_OPTIONS = Object.freeze([
  "pending_review",
  "viewed",
  "reviewed",
  "provider_assigned",
  "scheduled",
  "in_progress",
  "waiting_tenant",
  "resolved",
  "rejected",
  "closed",
]);

export const ADMIN_MAINTENANCE_STATUS_TRANSITIONS = Object.freeze({
  pending: ["viewed", "reviewed", "provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
  pending_review: ["viewed", "reviewed", "provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
  viewed: ["reviewed", "provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
  reviewed: ["provider_assigned", "scheduled", "in_progress", "waiting_tenant", "rejected"],
  provider_assigned: ["scheduled", "in_progress", "waiting_tenant", "resolved", "rejected"],
  scheduled: ["in_progress", "waiting_tenant", "resolved", "rejected"],
  in_progress: ["waiting_tenant", "scheduled", "resolved", "rejected"],
  waiting_tenant: ["in_progress", "scheduled", "resolved", "rejected"],
  reopened: ["viewed", "reviewed", "provider_assigned", "scheduled", "in_progress", "waiting_tenant", "resolved", "rejected"],
  resolved: ["closed"],
  completed: ["closed"],
  rejected: ["closed"],
  cancelled: [],
  closed: [],
});

export const getMaintenanceTypeMeta = (requestType) =>
  MAINTENANCE_REQUEST_TYPE_META[requestType] ||
  MAINTENANCE_REQUEST_TYPE_META.other;

export const getMaintenanceUrgencyMeta = (urgency) =>
  MAINTENANCE_URGENCY_META[urgency] || MAINTENANCE_URGENCY_META.normal;

export const getMaintenanceStatusMeta = (status) =>
  MAINTENANCE_STATUS_META[status] || {
    label: status ? String(status).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown",
    shortLabel: status || "Unknown",
    bg: "#F3F4F6",
    color: "#6B7280",
    variant: "neutral",
  };

export const getAllowedAdminMaintenanceStatuses = (currentStatus) => {
  const current = String(currentStatus || "").toLowerCase();
  const nextStatuses = ADMIN_MAINTENANCE_STATUS_TRANSITIONS[current] || [];

  return [...new Set([current, ...nextStatuses].filter(Boolean))];
};

export const isAdminTerminalMaintenanceStatus = (status) =>
  TERMINAL_ADMIN_MAINTENANCE_STATUSES.includes(
    String(status || "").toLowerCase(),
  );

export const formatMaintenanceType = (requestType) =>
  getMaintenanceTypeMeta(requestType).label;

export const formatMaintenanceUrgency = (urgency) =>
  getMaintenanceUrgencyMeta(urgency).label;

export const formatMaintenanceStatus = (status, options = {}) => {
  if (options?.includeStage) {
    return formatStageStatus("maintenance", status);
  }
  return getMaintenanceStatusMeta(status).label;
};

export const formatMaintenanceStatusWithStage = (status) =>
  formatStageStatus("maintenance", status);

// ═══════════════════════════════════════════════════════════════
// CANONICAL MAINTENANCE STAGE PIPELINE (5 Unified Stages)
// ═══════════════════════════════════════════════════════════════

export const CANONICAL_MAINTENANCE_STEPS = Object.freeze([
  { key: "pending_review", label: "Pending Review", number: 1 },
  { key: "reviewed", label: "Under Review", number: 2 },
  { key: "in_progress", label: "In Progress", number: 3 },
  { key: "resolved", label: "Resolved", number: 4 },
  { key: "completed", label: "Completed", number: 5 },
]);

/**
 * Map a backend status string to the 0-based CANONICAL step index.
 * Returns -1 for terminal/unknown statuses.
 */
export function getMaintenanceStepIndex(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending" || s === "pending_review" || s === "submitted") return 0;
  if (s === "viewed" || s === "reviewed" || s === "under_review") return 1;
  if (s === "provider_assigned" || s === "scheduled" || s === "in_progress" || s === "waiting_tenant") return 2;
  if (s === "resolved") return 3;
  if (s === "completed" || s === "closed") return 4;
  if (s === "reopened") return 2; // Reopened → returns to in_progress step 3
  return -1; // terminal/unknown (rejected, cancelled)
}

/**
 * Returns the recommended next action metadata for the admin
 * based on the current status of a maintenance request.
 * Returns: { actionLabel, actionKey, actionColor, contextNote, requiresSchedule }
 */
export function getNextRecommendedStageAction(request) {
  const status = String(request?.status || "").toLowerCase();

  if (status === "pending" || status === "pending_review" || status === "submitted") {
    return {
      actionLabel: "Review Request",
      actionKey: "mark_reviewed",
      actionColor: "info",
      contextNote: "Review the reported issue and resident photos to prepare for technician assignment.",
      requiresSchedule: false,
    };
  }
  if (status === "viewed" || status === "reviewed" || status === "under_review") {
    return {
      actionLabel: "Confirm Provider & Schedule Visit",
      actionKey: "confirm_dispatch",
      actionColor: "primary",
      contextNote: "Assign an in-house staff member or contractor and set the repair visit schedule.",
      requiresSchedule: true,
    };
  }
  if (
    status === "provider_assigned" ||
    status === "scheduled" ||
    status === "in_progress" ||
    status === "waiting_tenant"
  ) {
    return {
      actionLabel: "Upload Proof & Mark Resolved",
      actionKey: "upload_proof",
      actionColor: "success",
      contextNote: "Technician work in progress. Upload resolution photos to request resident verification.",
      requiresSchedule: false,
    };
  }
  if (status === "resolved") {
    return {
      actionLabel: "Awaiting Resident Verification",
      actionKey: "await_verification",
      actionColor: "warning",
      contextNote: "Work is done. Awaiting the resident's confirmation that the issue is fully fixed.",
      requiresSchedule: false,
    };
  }
  if (status === "completed" || status === "closed") {
    return {
      actionLabel: "Official Completion Report Ready",
      actionKey: "view_report",
      actionColor: "success",
      contextNote: "Maintenance ticket completed and verified by resident. Official completion report available.",
      requiresSchedule: false,
    };
  }
  if (status === "reopened") {
    return {
      actionLabel: "Follow-Up Work In Progress",
      actionKey: "reopen_triage",
      actionColor: "danger",
      contextNote: "Resident reported the issue still persists. Additional technician follow-up required.",
      requiresSchedule: true,
    };
  }
  return null;
}

