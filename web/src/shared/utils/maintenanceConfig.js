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

export const ACTIVE_MAINTENANCE_STATUSES = Object.freeze([
  "pending",
  "pending_review",
  "provider_assigned",
  "scheduled",
  "viewed",
  "in_progress",
  "waiting_tenant",
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
  "resolved",
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
    bg: "#FEF3C7",
    color: "#F59E0B",
    variant: "warning",
  },
  pending_review: {
    label: "Pending Review",
    bg: "#FEF3C7",
    color: "#F59E0B",
    variant: "warning",
  },
  provider_assigned: {
    label: "Provider Assigned",
    bg: "#E0E7FF",
    color: "#4338CA",
    variant: "info",
  },
  scheduled: {
    label: "Scheduled",
    bg: "#CFFAFE",
    color: "#0891B2",
    variant: "info",
  },
  viewed: {
    label: "Viewed",
    bg: "#FEF3C7",
    color: "#D97706",
    variant: "warning",
  },
  in_progress: {
    label: "In Progress",
    bg: "#DBEAFE",
    color: "#3B82F6",
    variant: "info",
  },
  waiting_tenant: {
    label: "Waiting for Tenant",
    bg: "#E0F2FE",
    color: "#0284C7",
    variant: "info",
  },
  reopened: {
    label: "Reopened",
    bg: "#FEE2E2",
    color: "#B91C1C",
    variant: "error",
  },
  resolved: {
    label: "Resolved",
    bg: "#D1FAE5",
    color: "#059669",
    variant: "success",
  },
  completed: {
    label: "Completed",
    bg: "#DCFCE7",
    color: "#22C55E",
    variant: "success",
  },
  rejected: {
    label: "Rejected",
    bg: "#FEE2E2",
    color: "#DC2626",
    variant: "error",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#F3F4F6",
    color: "#9CA3AF",
    variant: "neutral",
  },
  closed: {
    label: "Closed",
    bg: "#E2E8F0",
    color: "#475569",
    variant: "neutral",
  },
});

export const ADMIN_MAINTENANCE_STATUS_OPTIONS = Object.freeze([
  "pending_review",
  "provider_assigned",
  "scheduled",
  "viewed",
  "in_progress",
  "waiting_tenant",
  "resolved",
  "completed",
  "rejected",
  "closed",
]);

export const ADMIN_MAINTENANCE_STATUS_TRANSITIONS = Object.freeze({
  pending: ["viewed", "provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant", "completed", "resolved"],
  pending_review: ["provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant", "completed", "resolved"],
  provider_assigned: ["scheduled", "in_progress", "waiting_tenant", "completed", "resolved", "rejected"],
  scheduled: ["in_progress", "waiting_tenant", "completed", "resolved", "rejected"],
  viewed: ["provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
  in_progress: ["waiting_tenant", "scheduled", "resolved", "completed", "rejected"],
  waiting_tenant: ["in_progress", "scheduled", "resolved", "completed", "rejected"],
  reopened: ["provider_assigned", "scheduled", "in_progress", "waiting_tenant", "completed", "resolved", "rejected"],
  resolved: ["completed", "closed", "reopened"],
  completed: ["closed", "reopened"],
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
    label: status || "Unknown",
    bg: "#F3F4F6",
    color: "#9CA3AF",
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

export const formatMaintenanceStatus = (status) =>
  getMaintenanceStatusMeta(status).label;

