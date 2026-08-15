const toLabel = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const MAINTENANCE_REQUEST_TYPES = Object.freeze([
  "maintenance",
  "plumbing",
  "electrical",
  "aircon",
  "elevator",
  "furniture",
  "internet",
  "cleaning",
  "pest",
  "other",
]);

export const MAINTENANCE_URGENCY_LEVELS = Object.freeze([
  "normal",
  "urgent",
  "emergency",
  "low",
  "high",
]);

export const MIN_MAINTENANCE_DESCRIPTION_LENGTH = 10;

export const MAINTENANCE_STATUSES = Object.freeze([
  "pending",
  "pending_review",
  "provider_assigned",
  "scheduled",
  "viewed",
  "in_progress",
  "waiting_tenant",
  "resolved",
  "completed",
  "reopened",
  "rejected",
  "cancelled",
  "closed",
]);

export const ADMIN_MAINTENANCE_STATUSES = Object.freeze([
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

export const OPEN_MAINTENANCE_STATUSES = Object.freeze([
  "pending",
  "pending_review",
  "provider_assigned",
  "scheduled",
  "viewed",
  "in_progress",
  "waiting_tenant",
  "reopened",
]);

export const REOPENABLE_MAINTENANCE_STATUSES = Object.freeze([
  "resolved",
  "completed",
]);

export const MAINTENANCE_REQUEST_TYPE_LABELS = Object.freeze({
  maintenance: "Maintenance",
  plumbing: "Plumbing",
  electrical: "Electrical",
  aircon: "Air Conditioning",
  elevator: "Elevator",
  furniture: "Furniture / Fixture",
  internet: "Internet / Network",
  cleaning: "Cleaning",
  pest: "Pest Control",
  other: "Other",
});

export const MAINTENANCE_STATUS_LABELS = Object.freeze({
  pending: "Pending Review",
  pending_review: "Pending Review",
  provider_assigned: "Provider Assigned",
  scheduled: "Scheduled",
  viewed: "Viewed",
  in_progress: "In Progress",
  waiting_tenant: "Waiting for Tenant",
  resolved: "Resolved",
  completed: "Completed",
  reopened: "Reopened",
  rejected: "Rejected",
  cancelled: "Cancelled",
  closed: "Closed",
});

export const MAINTENANCE_RESOLUTION_ESTIMATES = Object.freeze({
  normal: "1-2 business days",
  urgent: "Within 24 hours",
  emergency: "Immediate / Priority",
  low: "3-5 business days",
  high: "Within 24 hours",
});

export const LEGACY_MAINTENANCE_TYPE_MAP = Object.freeze({
  hardware: "maintenance",
  appliance: "maintenance",
  air_conditioning: "aircon",
  "air-conditioning": "aircon",
  furniture_fixture: "furniture",
  "furniture/fixture": "furniture",
  internet_network: "internet",
  "internet/network": "internet",
  network: "internet",
  pest_control: "pest",
  "pest control": "pest",
});

export const LEGACY_MAINTENANCE_URGENCY_MAP = Object.freeze({
  medium: "normal",
});

export const LEGACY_MAINTENANCE_STATUS_MAP = Object.freeze({
  "in-progress": "in_progress",
  "on-hold": "in_progress",
  pending_review: "pending_review",
});

const ADMIN_STATUS_TRANSITIONS = Object.freeze({
  pending: ["viewed", "provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
  pending_review: ["provider_assigned", "scheduled", "in_progress", "rejected", "waiting_tenant"],
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

export const normalizeMaintenanceType = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_MAINTENANCE_TYPE_MAP[normalized] || normalized;
};

export const normalizeMaintenanceUrgency = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_MAINTENANCE_URGENCY_MAP[normalized] || normalized;
};

export const normalizeMaintenanceStatus = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_MAINTENANCE_STATUS_MAP[normalized] || normalized;
};

export const isValidMaintenanceType = (value) =>
  MAINTENANCE_REQUEST_TYPES.includes(normalizeMaintenanceType(value));

export const isValidMaintenanceUrgency = (value) =>
  MAINTENANCE_URGENCY_LEVELS.includes(normalizeMaintenanceUrgency(value));

export const isValidMaintenanceStatus = (value) =>
  MAINTENANCE_STATUSES.includes(normalizeMaintenanceStatus(value));

export const isAdminMutableMaintenanceStatus = (value) =>
  ADMIN_MAINTENANCE_STATUSES.includes(normalizeMaintenanceStatus(value));

export const isOpenMaintenanceStatus = (value) =>
  OPEN_MAINTENANCE_STATUSES.includes(normalizeMaintenanceStatus(value));

export const canAdminTransitionMaintenanceStatus = (currentStatus, nextStatus) => {
  const current = normalizeMaintenanceStatus(currentStatus);
  const next = normalizeMaintenanceStatus(nextStatus);

  if (!current || !next) return false;
  if (current === next) {
    return current !== "cancelled" && current !== "closed";
  }

  return (ADMIN_STATUS_TRANSITIONS[current] || []).includes(next);
};

export const formatMaintenanceTypeLabel = (value) =>
  MAINTENANCE_REQUEST_TYPE_LABELS[normalizeMaintenanceType(value)] ||
  toLabel(value);

export const formatMaintenanceStatusLabel = (value) =>
  MAINTENANCE_STATUS_LABELS[normalizeMaintenanceStatus(value)] ||
  toLabel(value);

export const getResolutionEstimate = (urgency) =>
  MAINTENANCE_RESOLUTION_ESTIMATES[normalizeMaintenanceUrgency(urgency)] ||
  MAINTENANCE_RESOLUTION_ESTIMATES.normal;

export const buildMaintenanceNotificationTitle = (requestType) =>
  `${formatMaintenanceTypeLabel(requestType)} Request Update`;

export const buildMaintenanceNotificationBody = (requestType, status) =>
  `Your ${formatMaintenanceTypeLabel(requestType).toLowerCase()} request is now ${formatMaintenanceStatusLabel(status)}.`;

