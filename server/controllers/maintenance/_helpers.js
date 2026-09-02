/**
 * ============================================================================
 * MAINTENANCE CONTROLLER INTERNAL HELPERS
 * ============================================================================
 *
 * Shared helper functions, serializers, formatting utilities, and access controls
 * for maintenance subcontrollers.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import {
  ADMIN_MAINTENANCE_STATUSES,
  MAX_MAINTENANCE_ATTACHMENTS,
  MAX_MAINTENANCE_ATTACHMENT_BYTES,
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  OPEN_MAINTENANCE_STATUSES,
  REOPENABLE_MAINTENANCE_STATUSES,
  TENANT_CANCELLABLE_MAINTENANCE_STATUSES,
  TENANT_EDITABLE_MAINTENANCE_STATUSES,
  TENANT_RESCHEDULABLE_MAINTENANCE_STATUSES,
  canAdminTransitionMaintenanceStatus,
  formatMaintenanceTypeLabel,
  formatMaintenanceStatusLabel,
  getResolutionEstimate,
  isAdminMutableMaintenanceStatus,
  isValidMaintenanceStatus,
  normalizeMaintenanceStatus,
  normalizeMaintenanceType,
  normalizeMaintenanceUrgency,
} from "../../config/maintenance.js";
import { ROOM_BRANCHES, ROOM_BRANCH_LABELS } from "../../config/branches.js";
import { AppError } from "../../middleware/errorHandler.js";
import { MaintenanceRequest, Reservation, Room, ServiceProvider, User } from "../../models/index.js";
import { toCategoryKey } from "../../models/ServiceProvider.js";
import { clean } from "../../utils/sanitize.js";
import { DELETED_ACCOUNT_LABEL } from "../../utils/userReference.js";
import {
  generateMaintenanceReportText,
} from "../../services/maintenanceAiService.js";
import {
  resolveMaintenanceRequestBranch,
} from "../../services/attachmentUploadService.js";

export const USER_SELECT_FIELDS =
  "user_id firstName lastName email phone branch role";

export const MAINTENANCE_LIMIT_MAX = 200;
export const SLA_TARGET_HOURS = Object.freeze({
  low: 120,
  normal: 72,
  high: 24,
});
export const DUPLICATE_REQUEST_WINDOW_HOURS = 12;
export const CLOSED_MAINTENANCE_STATUSES = new Set([
  "resolved",
  "completed",
  "rejected",
  "cancelled",
  "closed",
]);
export const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i;
export const PDF_FILE_PATTERN = /\.pdf(?:$|[?#])/i;
export const SUPPORTED_PROGRESS_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/*",
  "application/pdf",
]);
export const SUPPORTED_PROGRESS_ATTACHMENT_EXTENSION_PATTERN =
  /\.(jpe?g|png|webp|heic|heif|pdf)(?:$|[?#])/i;

export const buildMaintenanceRequestId = () =>
  `maint_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const getAttachmentFileType = (type, name, uri) => {
  const source = `${type || ""} ${name || ""} ${uri || ""}`.toLowerCase();
  if (source.includes("image/") || IMAGE_FILE_PATTERN.test(source)) return "image";
  if (source.includes("application/pdf") || PDF_FILE_PATTERN.test(source)) return "pdf";
  return "file";
};

export const getAttachmentSize = (entry) => {
  const rawSize =
    typeof entry === "object" && entry
      ? entry.size ?? entry.fileSize
      : null;
  const size = Number(rawSize);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

export const parseLimit = (value, fallback = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAINTENANCE_LIMIT_MAX);
};

export const toOptionalText = (value) => {
  if (value == null) return null;
  const sanitized = clean(String(value)).trim();
  return sanitized ? sanitized : null;
};

export const sanitizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

export const parseOptionalAmount = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("Enter a valid amount.", 400, "INVALID_AMOUNT", [
      { field, message: "Enter a valid amount." },
    ]);
  }
  return amount;
};

export const normalizeRoomBranch = (value) => {
  const branch = String(value || "").trim().toLowerCase();
  return ROOM_BRANCHES.includes(branch) ? branch : null;
};

export const buildActorSnapshot = (user) => ({
  actor_id: user?.user_id || null,
  actor_name:
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.email ||
    user?.user_id ||
    null,
  actor_role: user?.role || null,
});

export const appendStatusHistory = (request, event) => {
  request.statusHistory = [
    ...(Array.isArray(request.statusHistory) ? request.statusHistory : []),
    event,
  ];
  return event;
};

export const appendWorkLogEntry = (request, entry) => {
  request.work_log = [
    ...(Array.isArray(request.work_log) ? request.work_log : []),
    entry,
  ];
};

export const appendConversationEntry = (request, entry) => {
  const normalizedEntry = {
    ...entry,
    update_id: entry.update_id || `reply_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    type: entry.type || (entry.sender_side === "tenant" ? "tenant_reply" : "admin_reply"),
    kind: entry.kind || entry.type || (entry.sender_side === "tenant" ? "tenant_reply" : "admin_reply"),
    visibility: "tenant",
    visibleToTenant: true,
    isTenantVisible: true,
  };

  request.conversation = [
    ...(Array.isArray(request.conversation) ? request.conversation : []),
    normalizedEntry,
  ];
  request.publicReplies = [
    ...(Array.isArray(request.publicReplies) ? request.publicReplies : []),
    normalizedEntry,
  ];
  request.tenantReplies = [
    ...(Array.isArray(request.tenantReplies) ? request.tenantReplies : []),
    normalizedEntry,
  ];
  return normalizedEntry;
};

export const getSlaState = (request) => {
  const urgency = normalizeMaintenanceUrgency(request?.urgency) || "normal";
  const baseTimestamp = request?.reopened_at || request?.created_at;
  const targetHours = SLA_TARGET_HOURS[urgency] || SLA_TARGET_HOURS.normal;
  const targetAt = baseTimestamp
    ? new Date(new Date(baseTimestamp).getTime() + targetHours * 60 * 60 * 1000)
    : null;
  const isClosed = CLOSED_MAINTENANCE_STATUSES.has(
    normalizeMaintenanceStatus(request?.status),
  );
  const isDelayed =
    Boolean(targetAt) && !isClosed && Date.now() > targetAt.getTime();
  let label = "on_track";
  if (isClosed) {
    label = "closed";
  } else if (isDelayed) {
    label = "delayed";
  } else if (urgency === "high") {
    label = "priority";
  }

  return {
    targetHours,
    targetAt,
    isDelayed,
    isHighPriorityUnresolved: urgency === "high" && !isClosed,
    label,
  };
};

export const inferAttachmentType = ({ name, uri, fallbackType }) => {
  const explicitType = toOptionalText(fallbackType);
  if (explicitType) return explicitType;

  const source = `${name || ""} ${uri || ""}`.toLowerCase();
  if (PDF_FILE_PATTERN.test(source)) return "application/pdf";
  if (IMAGE_FILE_PATTERN.test(source)) return "image/*";
  return "application/octet-stream";
};

export const getAttachmentUri = (entry) => {
  if (typeof entry === "string") {
    return toOptionalText(entry);
  }

  return (
    toOptionalText(entry?.url) ||
    toOptionalText(entry?.downloadUrl) ||
    toOptionalText(entry?.downloadURL) ||
    toOptionalText(entry?.download_url) ||
    toOptionalText(entry?.publicUrl) ||
    toOptionalText(entry?.publicURL) ||
    toOptionalText(entry?.public_url) ||
    toOptionalText(entry?.secureUrl) ||
    toOptionalText(entry?.secureURL) ||
    toOptionalText(entry?.secure_url) ||
    toOptionalText(entry?.uri) ||
    toOptionalText(entry?.href) ||
    toOptionalText(entry?.src) ||
    toOptionalText(entry?.imageUrl) ||
    toOptionalText(entry?.imageURL) ||
    toOptionalText(entry?.image_url) ||
    toOptionalText(entry?.fileUrl) ||
    toOptionalText(entry?.fileURL) ||
    toOptionalText(entry?.file_url) ||
    toOptionalText(entry?.mediaUrl) ||
    toOptionalText(entry?.mediaURL) ||
    toOptionalText(entry?.media_url) ||
    toOptionalText(entry?.path)
  );
};

export const normalizeRemovalScope = (value) => {
  const scope = String(value || "").trim().toLowerCase();
  if (["tenant_only", "tenant-only", "tenant"].includes(scope)) return "tenant_only";
  if (["request", "all", "request_only", "request-only"].includes(scope)) return "request";
  return "";
};

export const normalizeProviderSource = (value) => {
  const source = String(value || "").trim().toLowerCase();
  if (["directory", "saved", "provider"].includes(source)) return "directory";
  if (["manual", "other"].includes(source)) return "manual";
  if (["none", "unassign", "unassigned", "clear"].includes(source)) return "none";
  return "";
};

export const normalizeTextList = (items = []) =>
  [...new Set(
    (Array.isArray(items) ? items : [items])
      .flatMap((item) => String(item || "").split(","))
      .map((item) => toOptionalText(item))
      .filter(Boolean),
  )];

export const getMaintenanceCategoryLabel = (request) =>
  formatMaintenanceTypeLabel(request?.request_type || "maintenance");

export const GENERIC_MAINTENANCE_FALLBACK_CATEGORIES = Object.freeze([
  "Maintenance",
  "General Maintenance",
]);

export const buildCategoryCandidatesFromValues = (values) => {
  const labels = (Array.isArray(values) ? values : [values]).flatMap((value) => {
    const raw = toOptionalText(value);
    const normalizedType = normalizeMaintenanceType(raw);
    const label = normalizedType ? formatMaintenanceTypeLabel(normalizedType) : raw;
    return [raw, normalizedType, label].filter(Boolean);
  });

  return {
    labels: [...new Set(labels)],
    keys: [...new Set(labels.map(toCategoryKey).filter(Boolean))],
  };
};

export const getCategoryCandidates = (value) => {
  if (!toOptionalText(value)) return { labels: [], keys: [] };
  return buildCategoryCandidatesFromValues(value);
};

export const isGenericMaintenanceCategory = (value) => {
  const raw = toOptionalText(value);
  if (!raw) return false;
  return normalizeMaintenanceType(raw) === "maintenance" || toCategoryKey(raw) === "general-maintenance";
};

export const getGenericMaintenanceFallbackCandidates = (value) =>
  isGenericMaintenanceCategory(value)
    ? buildCategoryCandidatesFromValues(GENERIC_MAINTENANCE_FALLBACK_CATEGORIES)
    : { labels: [], keys: [] };

export const getAssignableProviderCategoryCandidates = (value) => {
  const category = getCategoryCandidates(value);
  if (!isGenericMaintenanceCategory(value)) return category;
  const fallback = getGenericMaintenanceFallbackCandidates(value);

  return {
    labels: [...new Set([...category.labels, ...fallback.labels])],
    keys: [...new Set([...category.keys, ...fallback.keys])],
  };
};

export const providerMatchesMaintenanceRequest = (provider, request) => {
  if (!provider || provider.status !== "active") return false;
  const branch = resolveMaintenanceRequestBranch(request);
  if (!branch || !provider.branchCoverage?.includes(branch)) return false;
  const category = getAssignableProviderCategoryCandidates(request.request_type);
  if (category.keys.length === 0) return true;
  const providerKeys = Array.isArray(provider.serviceCategoryKeys)
    ? provider.serviceCategoryKeys
    : (provider.serviceCategories || []).map(toCategoryKey);
  return providerKeys.some((key) => category.keys.includes(key));
};

export const buildProviderDirectoryFilter = (
  request,
  category = getCategoryCandidates(request?.request_type),
) => {
  const branch = resolveMaintenanceRequestBranch(request);
  return {
    status: "active",
    ...(branch ? { branchCoverage: branch } : {}),
    ...(category.keys.length || category.labels.length
      ? {
          $or: [
            ...(category.keys.length ? [{ serviceCategoryKeys: { $in: category.keys } }] : []),
            ...(category.labels.length ? [{ serviceCategories: { $in: category.labels } }] : []),
          ],
        }
      : {}),
  };
};

export const buildGenericProviderDirectoryFilter = (request) => {
  const category = getGenericMaintenanceFallbackCandidates(request?.request_type);
  if (category.keys.length === 0 && category.labels.length === 0) return null;
  return buildProviderDirectoryFilter(request, category);
};

export const serializeAssignedProvider = (request, { includeInternal = true } = {}) => {
  if (!includeInternal) return null;
  const name = request.assignedProviderName || request.assigned_to || null;
  if (!name) return null;

  return {
    id: request.assignedProviderId ? String(request.assignedProviderId) : null,
    name,
    contactNumber: request.assignedProviderContact || null,
    category: request.assignedProviderCategory || null,
    notes: request.assignedProviderNotes || null,
    source: request.assignedProviderSource || (request.assignedProviderId ? "directory" : "manual"),
    assignedAt: request.assigned_at ?? null,
    assignedBy: request.assignedBy ?? null,
    assignedByName: request.assignedByName ?? null,
    assignedByRole: request.assignedByRole ?? null,
  };
};

export const deriveAttachmentName = (uri, index = 0) => {
  if (!uri) return `Attachment ${index + 1}`;

  try {
    const parsedUrl = new URL(uri, "https://placeholder.local");
    const candidate = parsedUrl.pathname.split("/").filter(Boolean).pop();
    const decoded = candidate ? decodeURIComponent(candidate) : "";
    return toOptionalText(decoded) || `Attachment ${index + 1}`;
  } catch {
    const candidate = String(uri).split(/[/?#]/).filter(Boolean).pop();
    return toOptionalText(candidate) || `Attachment ${index + 1}`;
  }
};

export const isRemoteUri = (uri) => {
  try {
    const { protocol } = new URL(uri);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

export const extractAttachmentName = (entry, uri, index) =>
  (typeof entry === "object" && entry
    ? toOptionalText(entry?.name) ||
      toOptionalText(entry?.filename) ||
      toOptionalText(entry?.fileName) ||
      toOptionalText(entry?.originalName) ||
      toOptionalText(entry?.originalFilename) ||
      toOptionalText(entry?.label) ||
      toOptionalText(entry?.title)
    : null) || deriveAttachmentName(uri || "", index);

export const getAttachmentMetadataText = (entry, key) =>
  typeof entry === "object" && entry ? toOptionalText(entry?.[key]) : null;

export const buildAttachmentMetadata = ({
  entry,
  context = null,
  visibility = null,
  branchId = null,
  uploadedBy = null,
  senderRole = null,
  relatedId = null,
} = {}) => {
  const metadata = {};
  const resolvedContext =
    context ||
    getAttachmentMetadataText(entry, "context") ||
    getAttachmentMetadataText(entry, "attachmentContext");
  const resolvedVisibility =
    visibility ||
    getAttachmentMetadataText(entry, "visibility");
  const resolvedBranchId =
    branchId ||
    getAttachmentMetadataText(entry, "branchId") ||
    getAttachmentMetadataText(entry, "branch") ||
    getAttachmentMetadataText(entry, "branch_id");
  const resolvedUploadedBy =
    uploadedBy ||
    getAttachmentMetadataText(entry, "uploadedBy") ||
    getAttachmentMetadataText(entry, "uploaded_by");
  const resolvedSenderRole =
    senderRole ||
    getAttachmentMetadataText(entry, "senderRole") ||
    getAttachmentMetadataText(entry, "sender_role");
  const resolvedRelatedId =
    relatedId ||
    getAttachmentMetadataText(entry, "relatedId") ||
    getAttachmentMetadataText(entry, "related_id") ||
    getAttachmentMetadataText(entry, "maintenanceRequestId") ||
    getAttachmentMetadataText(entry, "requestId");

  if (resolvedContext) metadata.context = resolvedContext;
  if (resolvedVisibility) metadata.visibility = resolvedVisibility;
  if (resolvedBranchId) {
    metadata.branchId = resolvedBranchId;
    metadata.branch = resolvedBranchId;
  }
  if (resolvedUploadedBy) metadata.uploadedBy = resolvedUploadedBy;
  if (resolvedSenderRole) metadata.senderRole = resolvedSenderRole;
  if (resolvedRelatedId) metadata.relatedId = resolvedRelatedId;

  return metadata;
};

export const normalizeAttachmentEntry = (entry, index = 0, metadataOptions = {}) => {
  const uri = getAttachmentUri(entry);
  if (!uri || !isRemoteUri(uri)) return null;

  const name = extractAttachmentName(entry, uri, index);
  const originalName =
    typeof entry === "object" && entry
      ? toOptionalText(entry?.originalName) ||
        toOptionalText(entry?.originalFilename) ||
        toOptionalText(entry?.filename) ||
        toOptionalText(entry?.fileName) ||
        toOptionalText(entry?.name) ||
        name
      : name;
  const type = inferAttachmentType({
    name,
    uri,
    fallbackType:
      typeof entry === "object" && entry
        ? entry?.type || entry?.mimeType || entry?.mime || entry?.contentType
        : null,
  });
  const normalized = {
    id:
      (typeof entry === "object" && entry
        ? toOptionalText(entry?.id) || toOptionalText(entry?.attachmentId)
        : null) || crypto.randomUUID(),
    name,
    uri,
    type,
    url: uri,
    filename: name,
    originalName,
    mimeType: type,
    fileType: getAttachmentFileType(type, name, uri),
  };
  const size = getAttachmentSize(entry);
  if (size !== null) normalized.size = size;
  if (typeof entry === "object" && entry?.storagePath) {
    normalized.storagePath = entry.storagePath;
  }
  if (typeof entry === "object" && entry?.provider) {
    normalized.provider = entry.provider;
  }

  return {
    ...normalized,
    ...buildAttachmentMetadata({ entry, ...metadataOptions }),
  };
};

export const shouldHideAttachmentFromTenantOutput = (entry) => {
  if (!entry || typeof entry !== "object") return false;
  if (entry.isRemoved) return true;
  return entry.visibility === "admin_only";
};

export const sanitizeAttachmentForOutput = (entry, index = 0, { includeInternal = true } = {}) => {
  if (!includeInternal && shouldHideAttachmentFromTenantOutput(entry)) {
    return null;
  }

  const rawUri = getAttachmentUri(entry);
  if (!rawUri && typeof entry !== "object") return null;

  const safeUri = rawUri && isRemoteUri(rawUri) ? rawUri : null;
  const name = extractAttachmentName(entry, safeUri || rawUri, index);
  if (!name) return null;
  const type = inferAttachmentType({
    name,
    uri: safeUri || "",
    fallbackType:
      typeof entry === "object" && entry
        ? entry?.type || entry?.mimeType || entry?.mime || entry?.contentType
        : null,
  });
  const originalName =
    typeof entry === "object" && entry
      ? toOptionalText(entry?.originalName) ||
        toOptionalText(entry?.originalFilename) ||
        toOptionalText(entry?.filename) ||
        toOptionalText(entry?.fileName) ||
        toOptionalText(entry?.name) ||
        name
      : name;
  const output = {
    id:
      (typeof entry === "object" && entry
        ? entry?.id || entry?.attachmentId || entry?.storagePath
        : null) || safeUri || `${name}-${index}`,
    name,
    uri: safeUri,
    type,
    url: safeUri,
    downloadUrl: safeUri,
    filename: name,
    originalName,
    mimeType: type,
    fileType: getAttachmentFileType(type, name, safeUri || rawUri),
  };
  const size = getAttachmentSize(entry);
  if (size !== null) output.size = size;
  if (typeof entry === "object" && entry?.storagePath) {
    output.storagePath = entry.storagePath;
  }
  if (typeof entry === "object" && entry?.provider) {
    output.provider = entry.provider;
  }
  if (typeof entry === "object") {
    output.uploadedAt = entry?.uploadedAt || entry?.createdAt || entry?.created_at || null;
    output.createdAt = entry?.createdAt || entry?.created_at || entry?.uploadedAt || null;
  }
  if (typeof entry === "object" && entry?.isRemoved) {
    output.isRemoved = true;
    output.removedAt = entry.removedAt || null;
    output.removedBy = entry.removedBy || null;
    output.removedByRole = entry.removedByRole || null;
    output.removedByName = entry.removedByName || null;
    output.removedReason = entry.removedReason || null;
    output.removedScope = entry.removedScope || null;
  }

  return {
    ...output,
    ...buildAttachmentMetadata({ entry }),
  };
};

export const normalizeAttachments = (attachments, metadataOptions = {}) => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((entry, index) => normalizeAttachmentEntry(entry, index, metadataOptions))
    .filter(Boolean);
};

export const hasSupportedProgressAttachmentType = (attachment) => {
  const type = toOptionalText(attachment?.type)?.toLowerCase();
  if (type && SUPPORTED_PROGRESS_ATTACHMENT_MIME_TYPES.has(type)) return true;

  const source = `${attachment?.name || ""} ${attachment?.uri || ""}`.toLowerCase();
  return SUPPORTED_PROGRESS_ATTACHMENT_EXTENSION_PATTERN.test(source);
};

export const validateIncomingAttachments = (
  rawAttachments,
  {
    fieldPrefix = "work_log_attachments",
    noun = "attachments",
  } = {},
) => {
  if (rawAttachments === undefined) return [];
  if (!Array.isArray(rawAttachments)) {
    return [
      {
        field: fieldPrefix,
        message: `${noun} must be uploaded files.`,
      },
    ];
  }

  const errors = [];
  if (rawAttachments.length > MAX_MAINTENANCE_ATTACHMENTS) {
    errors.push({
      field: fieldPrefix,
      message: `A maximum of ${MAX_MAINTENANCE_ATTACHMENTS} ${noun.toLowerCase()} is allowed.`,
    });
  }
  rawAttachments.forEach((entry, index) => {
    const uri = getAttachmentUri(entry);
    const normalized = normalizeAttachmentEntry(entry, index);
    if (!uri || !isRemoteUri(uri) || !normalized) {
      errors.push({
        field: `${fieldPrefix}.${index}.uri`,
        message: "Attachment URL is required.",
      });
      return;
    }

    if (!hasSupportedProgressAttachmentType(normalized)) {
      errors.push({
        field: `${fieldPrefix}.${index}.type`,
        message: "This file type is not supported. Please upload a JPEG, PNG, WebP, HEIC, HEIF, or PDF file.",
      });
    }

    const size = getAttachmentSize(entry);
    if (size > MAX_MAINTENANCE_ATTACHMENT_BYTES) {
      errors.push({
        field: `${fieldPrefix}.${index}.size`,
        message: "Each attachment must be 5 MB or smaller.",
      });
    }
  });

  return errors;
};

export const validateIncomingWorkLogAttachments = (rawAttachments) =>
  validateIncomingAttachments(rawAttachments, {
    fieldPrefix: "work_log_attachments",
    noun: "Progress attachments",
  });

export const getReplyAttachmentsFromBody = (body = {}) => {
  const candidates = [
    body.attachments,
    body.replyAttachments,
    body.reply_attachments,
    body.attachmentUrls,
    body.attachment_urls,
  ];

  return candidates.find((value) => value !== undefined);
};

export const sanitizeAttachmentsForOutput = (attachments, options = {}) => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((entry, index) => sanitizeAttachmentForOutput(entry, index, options))
    .filter(Boolean);
};

export const PUBLIC_CONVERSATION_TYPES = new Set([
  "admin_reply",
  "admin_update",
  "tenant_reply",
  "tenant_summary",
  "summary",
]);

export const INTERNAL_CONVERSATION_TYPES = new Set([
  "status_change",
  "status_changed",
  "status_update",
  "workflow_action",
  "viewed",
  "processing",
  "draft_saved",
  "internal_note",
  "internal_log",
  "admin_log",
  "audit",
  "history",
]);

export const getConversationEntryType = (entry = {}) =>
  String(entry.type || entry.kind || entry.event || entry.action || "")
    .trim()
    .toLowerCase();

export const getConversationEntryMessage = (entry = {}) =>
  toOptionalText(entry.message || entry.summary || entry.tenantSummary || entry.body || entry.text) ||
  "";

export const isTenantVisibleConversationEntry = (entry = {}) => {
  if (!entry || typeof entry !== "object") return false;
  if (entry.visibleToTenant === false || entry.isTenantVisible === false) return false;
  if (entry.internal === true || entry.adminOnly === true || entry.isInternal === true) return false;

  const visibility = String(entry.visibility || entry.audience || "").trim().toLowerCase();
  if (["internal", "admin", "admin_only", "admin-only", "private", "workflow"].includes(visibility)) {
    return false;
  }

  const type = getConversationEntryType(entry);
  if (INTERNAL_CONVERSATION_TYPES.has(type)) return false;
  if (type && !PUBLIC_CONVERSATION_TYPES.has(type)) return false;

  const senderSide = String(entry.sender_side || entry.senderSide || "").trim().toLowerCase();
  const senderRole = String(
    entry.sender_role || entry.senderRole || entry.actor_role || entry.actorRole || entry.role || "",
  )
    .trim()
    .toLowerCase();
  const attachments = sanitizeAttachmentsForOutput(entry.attachments, { includeInternal: false });
  const hasTenantContent = Boolean(getConversationEntryMessage(entry) || attachments.length);

  return Boolean(
    hasTenantContent &&
      (["admin", "tenant"].includes(senderSide) ||
        senderRole.includes("admin") ||
        senderRole.includes("owner") ||
        ["tenant", "applicant"].includes(senderRole) ||
        PUBLIC_CONVERSATION_TYPES.has(type)),
  );
};

export const serializeUploadedMaintenanceAttachment = (attachment = {}) => {
  const url =
    toOptionalText(attachment.url) ||
    toOptionalText(attachment.downloadUrl) ||
    toOptionalText(attachment.uri);
  const visibility =
    attachment.visibility === "admin_only" ? "admin_only" : "tenant_visible";

  return {
    id: attachment.id || attachment.storagePath || url,
    name: attachment.name || attachment.originalName || attachment.filename || "Attachment",
    url,
    uri: url,
    downloadUrl: url,
    type: attachment.type || attachment.mimeType || "application/octet-stream",
    mimeType: attachment.mimeType || attachment.type || "application/octet-stream",
    size: attachment.size ?? null,
    visibility,
    uploadedBy: attachment.uploadedBy || null,
    uploadedAt: attachment.uploadedAt || new Date().toISOString(),
    storagePath: attachment.storagePath || null,
    context: attachment.context || null,
    relatedId: attachment.relatedId || null,
    branchId: attachment.branchId || attachment.branch || null,
    branch: attachment.branch || attachment.branchId || null,
    provider: attachment.provider || null,
  };
};

export const buildRequestIdentifierQuery = (requestId) => {
  const identifier = String(requestId || "").trim();
  if (!identifier) {
    return { request_id: "__missing__" };
  }

  const queryOr = [
    { request_id: identifier },
    { ticketNumber: identifier },
    { ticket_number: identifier },
  ];

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    queryOr.push({ _id: identifier });
  }

  return { $or: queryOr };
};

export const getDbUser = async (firebaseUid) => {
  const user = await User.findOne({ firebaseUid }).select(USER_SELECT_FIELDS).lean();
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return user;
};

export const getAuthenticatedDbUser = async (req) => {
  if (req?.mobileTenant?._id) {
    const mobileUser = await User.findById(req.mobileTenant._id)
      .select(USER_SELECT_FIELDS)
      .lean();
    if (mobileUser) return mobileUser;
  }

  return getDbUser(req?.user?.uid);
};

export const ensureTenantAccess = (request, dbUser) => {
  if (request.user_id !== dbUser.user_id) {
    throw new AppError("Access denied", 403, "FORBIDDEN");
  }
};

export const ensureAdminAccess = (request, req) => {
  if (req.isOwner) return;

  if (!req.branchFilter || request.branch !== req.branchFilter) {
    throw new AppError("Access denied", 403, "FORBIDDEN");
  }
};

export const serializeTenantSummary = (user, request) => {
  if (!user) {
    return {
      user_id: request.user_id,
      full_name: request.user_id ? DELETED_ACCOUNT_LABEL : "Unknown Tenant",
      branch: request.branch || null,
      email: null,
      phone: null,
    };
  }

  return {
    user_id: user.user_id,
    full_name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown Tenant",
    branch: user.branch || request.branch || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role || null,
  };
};

export const INTERNAL_STATUS_EVENTS = new Set([
  "admin_proof_uploaded",
  "attachment_removed_tenant",
  "attachment_removed_request",
  "archived",
  "restored",
  "branch_assigned_manually",
  "service_provider_assigned",
  "service_provider_changed",
  "service_provider_unassigned",
]);

export const sanitizeStatusHistoryForOutput = (statusHistory, { includeInternal = true } = {}) =>
  Array.isArray(statusHistory)
    ? statusHistory
        .filter((entry) => includeInternal || !INTERNAL_STATUS_EVENTS.has(entry?.event))
        .map((entry) => includeInternal
          ? { ...entry }
          : {
              event: entry?.event || null,
              status: entry?.status || entry?.status_to || null,
              status_from: entry?.status_from || null,
              status_to: entry?.status_to || null,
              timestamp: entry?.timestamp || entry?.created_at || entry?.createdAt || null,
              actor_role: ["tenant", "applicant"].includes(entry?.actor_role)
                ? "tenant"
                : "management",
              note: ["tenant", "applicant"].includes(entry?.actor_role)
                ? entry?.note ?? null
                : null,
            })
    : [];

export const serializeMaintenanceRequest = (
  request,
  tenant = null,
  { includeInternal = true } = {},
) => {
  const rawWorkLog = Array.isArray(request.work_log) ? request.work_log : [];
  const workLog = includeInternal
    ? rawWorkLog.map((entry) => ({
        ...entry,
        attachments: sanitizeAttachmentsForOutput(entry?.attachments, { includeInternal }),
      }))
    : [];

  const resolutionProofAttachments = rawWorkLog.flatMap((entry) => {
    const entryAtts = Array.isArray(entry?.attachments) ? entry.attachments : [];
    return entryAtts.filter((att) => {
      if (!att || typeof att !== "object") return false;
      if (att.isRemoved) return false;
      if (att.removedScope === "tenant_only" || att.removedScope === "request") return false;
      if (att.visibility === "admin_only") return false;
      return true;
    });
  });
  const sanitizedResolutionProofAttachments = sanitizeAttachmentsForOutput(
    resolutionProofAttachments,
    { includeInternal: false },
  );
  const resolutionProof = {
    note: request.resolution_note || request.notes || null,
    resolvedAt: request.resolved_at || request.completedAt || request.closed_at || null,
    resolvedBy: includeInternal ? (request.resolvedBy || null) : undefined,
    resolvedByName: request.resolvedByName || null,
    attachments: sanitizedResolutionProofAttachments,
  };

  const publicReplies = Array.isArray(request.publicReplies) && request.publicReplies.length
    ? request.publicReplies
    : Array.isArray(request.tenantReplies) && request.tenantReplies.length
      ? request.tenantReplies
      : Array.isArray(request.conversation)
        ? request.conversation
        : [];
  const serializedPublicReplies = publicReplies
    .filter((entry) => includeInternal || isTenantVisibleConversationEntry(entry))
    .map((entry) => ({
      ...entry,
      type: entry.type || (entry.sender_side === "tenant" ? "tenant_reply" : "admin_reply"),
      kind: entry.kind || entry.type || (entry.sender_side === "tenant" ? "tenant_reply" : "admin_reply"),
      visibility: "tenant",
      visibleToTenant: true,
      isTenantVisible: true,
      senderName: entry.sender_name || entry.senderName || entry.actor_name || null,
      senderRole: entry.sender_role || entry.senderRole || entry.actor_role || null,
      actor_name: entry.sender_name || entry.senderName || entry.actor_name || null,
      actor_role: entry.sender_role || entry.senderRole || entry.actor_role || null,
      createdAt: entry.createdAt || entry.created_at || entry.timestamp || null,
      sentAt: entry.createdAt || entry.created_at || entry.timestamp || null,
      attachments: sanitizeAttachmentsForOutput(entry?.attachments, { includeInternal: false }),
    }));

  const ticketNumber =
    request.ticketNumber ||
    `MNT-${new Date(request.created_at || Date.now()).getFullYear()}-${String(
      request.request_id || request._id || "0000",
    )
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-4)
      .toUpperCase()}`;

  const tenantActiveRes = tenant?.activeReservation || null;
  const tenantActiveRoom = tenant?.activeRoom || null;

  const occupancyContext = {
    unitNumber:
      request.occupancyContext?.unitNumber ||
      (request.roomId && typeof request.roomId === "object"
        ? request.roomId.roomNumber || request.roomId.name
        : null) ||
      (request.reservationId && typeof request.reservationId === "object"
        ? request.reservationId.roomNumber
        : null) ||
      tenantActiveRoom?.roomNumber ||
      tenantActiveRoom?.name ||
      tenantActiveRes?.roomNumber ||
      null,
    bedNumber:
      request.occupancyContext?.bedNumber ||
      (request.reservationId && typeof request.reservationId === "object"
        ? request.reservationId.bedNumber || request.reservationId.bed
        : null) ||
      tenantActiveRes?.bedNumber ||
      tenantActiveRes?.bed ||
      null,
    floor:
      request.occupancyContext?.floor ??
      (request.roomId && typeof request.roomId === "object"
        ? request.roomId.floor
        : null) ??
      tenantActiveRoom?.floor ??
      null,
  };

  const tenantVisibleLabel =
    request.providerDetails?.tenantVisibleLabel ||
    (request.providerDetails?.providerType === "IN_HOUSE"
      ? "LilyCrest Facilities Team"
      : request.providerDetails?.providerType === "EXTERNAL"
        ? (request.assignedProviderCategory
            ? `Authorized ${request.assignedProviderCategory} Specialist`
            : "Authorized External Specialist")
        : (request.assigned_to || request.assignedProviderName
            ? "LilyCrest Facilities Team"
            : null));

  const providerDetails = includeInternal
    ? {
        providerType: request.providerDetails?.providerType || (request.assignedProviderId ? "EXTERNAL" : request.assigned_to ? "IN_HOUSE" : null),
        tenantVisibleLabel,
        internalProviderId: request.providerDetails?.internalProviderId || (request.assignedProviderId ? String(request.assignedProviderId) : null),
        privateContact: request.providerDetails?.privateContact || request.assignedProviderContact || null,
        quotedCost: Number(request.providerDetails?.quotedCost || 0),
        currency: request.providerDetails?.currency || "PHP",
        snapshotJson: request.providerDetails?.snapshotJson || null,
      }
    : {
        providerType: request.providerDetails?.providerType || null,
        tenantVisibleLabel,
      };

  const scheduledDate =
    request.scheduledDate ||
    request.schedule?.scheduledDate ||
    null;

  const schedule = {
    scheduledDate,
    notes: request.schedule?.notes || null,
  };

  const rescheduleRequest = request.rescheduleRequest?.status
    ? {
        requestedAt: request.rescheduleRequest.requestedAt || null,
        proposedDate: request.rescheduleRequest.proposedDate || null,
        reason: request.rescheduleRequest.reason || null,
        status: request.rescheduleRequest.status || "pending",
        respondedAt: request.rescheduleRequest.respondedAt || null,
        respondedBy: request.rescheduleRequest.respondedBy || null,
        responseNote: request.rescheduleRequest.responseNote || null,
      }
    : null;

  const completionReport = includeInternal
    ? (request.completionReport?.summary || request.completionReport?.reportId
        ? {
            reportId: request.completionReport?.reportId || null,
            isDraft: request.completionReport?.isDraft ?? true,
            summary: request.completionReport?.summary || null,
            workDone: request.completionReport?.workDone || null,
            partsReplaced: request.completionReport?.partsReplaced || null,
            preventiveAdvice: request.completionReport?.preventiveAdvice || null,
            finalizedBy: request.completionReport?.finalizedBy || null,
            finalizedByName: request.completionReport?.finalizedByName || null,
            finalizedAt: request.completionReport?.finalizedAt || null,
            generatedAt: request.completionReport?.generatedAt || request.completionReport?.finalizedAt || null,
            reportType: request.completionReport?.reportType || "admin",
            reportUrl: request.completionReport?.reportUrl || null,
          }
        : null)
    : (!request.completionReport?.isDraft && (request.completionReport?.summary || request.completionReport?.reportId)
        ? {
            reportId: request.completionReport?.reportId || null,
            isDraft: false,
            summary: request.completionReport?.summary || null,
            workDone: request.completionReport?.workDone || null,
            partsReplaced: request.completionReport?.partsReplaced || null,
            preventiveAdvice: request.completionReport?.preventiveAdvice || null,
            finalizedByName: request.completionReport?.finalizedByName || "Lilycrest Management",
            finalizedAt: request.completionReport?.finalizedAt || null,
            generatedAt: request.completionReport?.generatedAt || request.completionReport?.finalizedAt || null,
            reportType: request.completionReport?.reportType || "tenant",
            reportUrl: request.completionReport?.reportUrl || null,
          }
        : null);

  const reopenCount =
    typeof request.reopenCount === "number"
      ? request.reopenCount
      : Array.isArray(request.reopen_history)
        ? request.reopen_history.length
        : 0;

  const resolutionConfirmation = request.resolutionConfirmation?.confirmedAt
    ? {
        confirmedAt: request.resolutionConfirmation.confirmedAt,
        tenantFeedback: request.resolutionConfirmation.tenantFeedback || null,
        rating: request.resolutionConfirmation.rating || null,
        action: request.resolutionConfirmation.action || "confirm",
      }
    : request.resolutionConfirmation?.action === "rejected_back_to_in_progress"
      ? {
          confirmedAt: null,
          tenantFeedback: request.resolutionConfirmation.tenantFeedback || null,
          rating: null,
          action: "rejected_back_to_in_progress",
        }
      : null;
  const normalizedStatus = String(request.status || "").toLowerCase();
  const tenantActions = {
    canEdit: TENANT_EDITABLE_MAINTENANCE_STATUSES.includes(normalizedStatus),
    canCancel: TENANT_CANCELLABLE_MAINTENANCE_STATUSES.includes(normalizedStatus),
    canReopen: REOPENABLE_MAINTENANCE_STATUSES.includes(normalizedStatus),
    canConfirmResolution:
      normalizedStatus === "resolved" && !request.resolutionConfirmation?.confirmedAt,
    canRequestReschedule:
      TENANT_RESCHEDULABLE_MAINTENANCE_STATUSES.includes(normalizedStatus) &&
      request.rescheduleRequest?.status !== "pending",
    canReply: !["cancelled", "closed"].includes(normalizedStatus),
    canSubmitSimilar: true,
  };
  const lastAdminReadTime = request.lastAdminReadAt ? new Date(request.lastAdminReadAt).getTime() : 0;
  const isNewForAdmin = !request.lastAdminReadAt && ["pending", "pending_review", "viewed"].includes(request.status);
  
  const conversationList = Array.isArray(request.conversation) ? request.conversation : [];
  const hasUnreadTenantReply = conversationList.some((msg) => {
    if (msg.sender_side !== "tenant" && msg.sender_role !== "tenant") return false;
    const msgTime = new Date(msg.created_at).getTime();
    return msgTime > lastAdminReadTime;
  });

  const reschedObj = rescheduleRequest || request.rescheduleRequest || request.reschedule_request;
  const hasUnreadReschedule = Boolean(
    reschedObj?.status === "pending" &&
    (!lastAdminReadTime || (reschedObj.requestedAt && new Date(reschedObj.requestedAt).getTime() > lastAdminReadTime))
  );

  const hasUnreadReopen = Boolean(
    (request.isReopened || request.status === "reopened") &&
    (!lastAdminReadTime || (request.reopened_at && new Date(request.reopened_at).getTime() > lastAdminReadTime))
  );

  // Compute composite lastActivityAt
  const createdTime = request.created_at ? new Date(request.created_at).getTime() : 0;
  const updatedTime = request.updated_at ? new Date(request.updated_at).getTime() : 0;
  const reopenedTime = request.reopened_at ? new Date(request.reopened_at).getTime() : 0;
  const reschedTime = reschedObj?.requestedAt ? new Date(reschedObj.requestedAt).getTime() : 0;
  let lastMsgTime = 0;
  if (conversationList.length > 0) {
    const lastMsg = conversationList[conversationList.length - 1];
    if (lastMsg?.created_at) {
      lastMsgTime = new Date(lastMsg.created_at).getTime();
    }
  }
  const lastActivityTimestamp = Math.max(createdTime, updatedTime, reopenedTime, reschedTime, lastMsgTime);
  const lastActivityAt = lastActivityTimestamp > 0 ? new Date(lastActivityTimestamp).toISOString() : (request.created_at || new Date().toISOString());

  const lastTenantReadTime = request.lastTenantReadAt
    ? new Date(request.lastTenantReadAt).getTime()
    : new Date(request.created_at || Date.now()).getTime();
  const isUpdatedForTenant = Boolean(
    request.updated_at &&
    new Date(request.updated_at).getTime() > lastTenantReadTime &&
    request.status !== "pending"
  );

  return {
    id: request.request_id,
    _id: request._id,
    request_id: request.request_id,
    ticketNumber,
    ticket_number: ticketNumber,
    user_id: request.user_id,
    occupancyContext,
    occupancy_context: occupancyContext,
    request_type: request.request_type,
    description: request.description,
    urgency: request.urgency,
    status: request.status,
    tenantActions,
    tenant_actions: tenantActions,
    providerDetails,
    provider_details: providerDetails,
    isReopened: Boolean(request.isReopened),
    reviewedAt: request.reviewedAt || null,
    completedAt: request.completedAt || null,
    lastAdminReadAt: includeInternal ? (request.lastAdminReadAt || null) : undefined,
    lastTenantReadAt: request.lastTenantReadAt || null,
    isNewForAdmin: includeInternal ? isNewForAdmin : undefined,
    hasUnreadTenantReply: includeInternal ? hasUnreadTenantReply : undefined,
    hasUnreadReschedule: includeInternal ? hasUnreadReschedule : undefined,
    hasUnreadReopen: includeInternal ? hasUnreadReopen : undefined,
    lastActivityAt,
    isUpdatedForTenant,
    reviewedBy: includeInternal ? (request.reviewedBy || null) : undefined,
    resolvedBy: includeInternal ? (request.resolvedBy || null) : undefined,
    tenantVisibleProviderLabel: tenantVisibleLabel,
    scheduledDate,
    scheduled_date: scheduledDate,
    schedule,
    rescheduleRequest,
    reschedule_request: rescheduleRequest,
    completionReport,
    completion_report: completionReport,
    reopenCount,
    reopen_count: reopenCount,
    resolutionConfirmation,
    resolutionProof,
    resolution_proof: resolutionProof,
    proofAttachments: sanitizedResolutionProofAttachments,
    proof_attachments: sanitizedResolutionProofAttachments,
    assigned_to: includeInternal ? request.assigned_to ?? null : null,
    notes: includeInternal ? request.notes ?? null : null,
    attachments: sanitizeAttachmentsForOutput(request.attachments, { includeInternal }),
    reopen_note: request.reopen_note ?? null,
    reopen_history: Array.isArray(request.reopen_history) ? request.reopen_history : [],
    statusHistory: sanitizeStatusHistoryForOutput(request.statusHistory, { includeInternal }),
    slaState: getSlaState(request),
    assignment: {
      assignedTo: includeInternal ? request.assigned_to ?? null : null,
      assignedAt: request.assigned_at ?? null,
      startedAt: request.work_started_at ?? null,
      resolvedAt: request.resolved_at ?? null,
      provider: serializeAssignedProvider(request, { includeInternal }),
    },
    assignedProvider: serializeAssignedProvider(request, { includeInternal }),
    assignedProviderId: includeInternal && request.assignedProviderId
      ? String(request.assignedProviderId)
      : null,
    assignedProviderName: includeInternal ? request.assignedProviderName ?? null : null,
    assignedProviderContact: includeInternal ? request.assignedProviderContact ?? null : null,
    assignedProviderCategory: includeInternal ? request.assignedProviderCategory ?? null : null,
    assignedProviderNotes: includeInternal ? request.assignedProviderNotes ?? null : null,
    assignedProviderSource: includeInternal ? request.assignedProviderSource ?? null : null,
    assignedBy: includeInternal ? request.assignedBy ?? null : null,
    assignedByName: includeInternal ? request.assignedByName ?? null : null,
    assignedByRole: includeInternal ? request.assignedByRole ?? null : null,
    providerRating: includeInternal && request.providerRating?.rating
      ? {
          rating: request.providerRating.rating,
          feedback: request.providerRating.feedback || null,
          tags: Array.isArray(request.providerRating.tags) ? request.providerRating.tags : [],
          ratedAt: request.providerRating.ratedAt || null,
          ratedBy: request.providerRating.ratedBy || null,
          ratedByName: request.providerRating.ratedByName || null,
          ratedByRole: request.providerRating.ratedByRole || null,
        }
      : null,
    workLog,
    work_log: workLog,
    conversation: includeInternal && Array.isArray(request.conversation)
      ? request.conversation.map((entry) => ({
          ...entry,
          attachments: sanitizeAttachmentsForOutput(entry?.attachments, { includeInternal }),
        }))
      : serializedPublicReplies,
    publicReplies: serializedPublicReplies,
    tenantReplies: serializedPublicReplies,
    thread: serializedPublicReplies,
    internalLogs: includeInternal
      ? [
          ...(Array.isArray(request.work_log) ? request.work_log : []).map((entry) => ({
            ...entry,
            visibility: "internal",
            visibleToTenant: false,
            isTenantVisible: false,
          })),
          ...(Array.isArray(request.statusHistory) ? request.statusHistory : []).map((entry) => ({
            ...entry,
            visibility: "internal",
            visibleToTenant: false,
            isTenantVisible: false,
          })),
        ]
      : [],
    resolutionNote: includeInternal ? request.resolution_note ?? null : null,
    created_at: request.created_at,
    updated_at: request.updated_at,
    cancelled_at: request.cancelled_at ?? null,
    reopened_at: request.reopened_at ?? null,
    resolved_at: request.resolved_at ?? null,
    closed_at: request.closed_at ?? null,
    estimated_resolution: getResolutionEstimate(request.urgency),
    estimatedCost: Number(request.estimatedCost || request.costBreakdown?.totalCost || 0),
    actualCost: Number(request.actualCost || request.costBreakdown?.totalCost || 0),
    costBreakdown: {
      laborCost: Number(request.costBreakdown?.laborCost || 0),
      materialsCost: Number(request.costBreakdown?.materialsCost || 0),
      totalCost: Number(request.costBreakdown?.totalCost || request.actualCost || request.estimatedCost || 0),
      isTenantChargeable: Boolean(request.costBreakdown?.isTenantChargeable),
      chargeReason: request.costBreakdown?.chargeReason || null,
      billId: request.costBreakdown?.billId ? String(request.costBreakdown.billId) : null,
    },
    tenant,
    branch: request.branch || null,
    room:
      request.roomId && typeof request.roomId === "object"
        ? request.roomId
        : tenantActiveRoom || null,
    roomId: request.roomId || tenantActiveRoom?._id || null,
    reservationId: request.reservationId || tenantActiveRes?._id || null,
    isArchived: Boolean(request.isArchived),
    archivedAt: request.archivedAt ?? null,
    archivedBy: request.archivedBy ?? null,
    restoredAt: request.restoredAt ?? null,
    restoredBy: request.restoredBy ?? null,

    title: `${formatMaintenanceTypeLabel(request.request_type)} Request`,
    category: request.request_type,
    date: request.created_at,
    assignedTo: includeInternal ? request.assigned_to ?? null : null,
    completionNote: includeInternal ? request.resolution_note ?? request.notes ?? null : null,
  };
};

export const REPORT_TYPE_LABELS = Object.freeze({
  admin: "Admin Report",
  tenant: "Tenant Summary",
});

export const TENANT_REPORT_SAFE_STATUS_EVENTS = new Set([
  "submitted",
  "status_changed",
  "reopened",
]);

export const REPORT_INTERNAL_STATUS_EVENTS = new Set([
  ...INTERNAL_STATUS_EVENTS,
  "assignment_updated",
  "note_updated",
]);

export const formatReportDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
};

export const formatReportListValue = (value, fallback = "Not recorded") =>
  toOptionalText(value) || fallback;

export const formatReportRole = (role) =>
  toOptionalText(role)?.replace(/_/g, " ") || "unknown role";

export const formatReportActor = ({ name, role } = {}) => {
  const actorName = toOptionalText(name) || "Unknown";
  const actorRole = formatReportRole(role);
  return `${actorName} (${actorRole})`;
};

export const formatReportVisibility = (visibility) =>
  visibility === "tenant" ? "Visible to Tenant" : "Admin Only";

export const formatReportStatus = (status) =>
  status ? formatMaintenanceStatusLabel(status) : "Not recorded";

export const formatReportSlaState = (request) => {
  const state = getSlaState(request);
  const label = String(state?.label || "not_recorded").replace(/_/g, " ");
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getReportStatusTitle = (entry = {}) => {
  switch (entry.event) {
    case "submitted":
      return "Request created";
    case "status_changed":
      if (entry.status === "completed" || entry.status === "resolved") return "Request completed";
      if (entry.status === "cancelled") return "Request cancelled";
      if (entry.status === "closed") return "Request closed";
      return "Status updated";
    case "assignment_updated":
      return "Assigned service provider updated";
    case "note_updated":
      return "Admin note updated";
    case "reopened":
      return "Request reopened";
    case "archived":
      return "Request archived";
    case "restored":
      return "Request restored";
    case "branch_assigned_manually":
      return "Branch assigned manually";
    case "admin_proof_uploaded":
      return "Admin-only proof uploaded";
    case "attachment_removed_tenant":
      return "Attachment removed from tenant view";
    case "attachment_removed_request":
      return "Attachment removed from request display";
    case "service_provider_assigned":
      return "Service provider assigned";
    case "service_provider_changed":
      return "Service provider changed";
    case "service_provider_unassigned":
      return "Service provider unassigned";
    default:
      return entry.event ? entry.event.replace(/_/g, " ") : "Maintenance updated";
  }
};

export const isReportAttachmentRemoved = (attachment = {}) =>
  Boolean(attachment?.isRemoved || attachment?.removedAt || attachment?.removedScope);

export const isTenantVisibleReportAttachment = (attachment = {}) =>
  !isReportAttachmentRemoved(attachment) && attachment?.visibility !== "admin_only";

export const getReportAttachmentName = (attachment = {}, index = 0) =>
  toOptionalText(
    attachment.name ||
      attachment.originalName ||
      attachment.filename ||
      attachment.fileName ||
      attachment.displayName,
  ) ||
  deriveAttachmentName(getAttachmentUri(attachment), index);

export const buildReportAttachmentSummaries = (
  attachments,
  { tenantSafe = false, includeRemoved = false } = {},
) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ attachment }) => {
      if (tenantSafe) return isTenantVisibleReportAttachment(attachment);
      if (!includeRemoved && isReportAttachmentRemoved(attachment)) return false;
      return true;
    })
    .map(({ attachment, index }) => ({
      name: getReportAttachmentName(attachment, index),
      type: attachment?.mimeType || attachment?.type || "file",
      visibility: attachment?.visibility === "admin_only" ? "admin" : "tenant",
      removed: isReportAttachmentRemoved(attachment),
      removalReason: attachment?.removedReason || null,
      removedScope: attachment?.removedScope || null,
    }));

export const buildReportTimelineItem = ({
  title,
  timestamp,
  actorName,
  actorRole,
  visibility = "admin",
  note = null,
  attachments = [],
  attachmentName = null,
  removalReason = null,
  status = null,
  branch = null,
  providerName = null,
  previousProviderName = null,
}) => ({
  title,
  timestamp,
  actorName,
  actorRole,
  visibility,
  note,
  attachments,
  attachmentName,
  removalReason,
  status,
  branch,
  providerName,
  previousProviderName,
});

export const buildMaintenanceReportTimeline = (request, { reportType = "admin" } = {}) => {
  const tenantSafe = reportType === "tenant";
  const items = [];

  items.push(buildReportTimelineItem({
    title: "Request created",
    timestamp: request.created_at,
    actorName: request.tenant?.full_name || request.user_id,
    actorRole: "tenant",
    visibility: "tenant",
    note: request.description,
    attachments: buildReportAttachmentSummaries(request.attachments, { tenantSafe }),
    status: request.status,
  }));

  if (!tenantSafe) {
    (request.attachments || [])
      .filter(isReportAttachmentRemoved)
      .forEach((attachment, index) => {
        items.push(buildReportTimelineItem({
          title:
            attachment.removedScope === "tenant_only"
              ? "Attachment removed from tenant view"
              : "Attachment removed from request display",
          timestamp: attachment.removedAt || request.updated_at,
          actorName: attachment.removedByName || attachment.removedBy,
          actorRole: attachment.removedByRole,
          visibility: "admin",
          attachmentName: getReportAttachmentName(attachment, index),
          removalReason: attachment.removedReason || "No reason recorded",
        }));
      });
  }

  (request.statusHistory || []).forEach((entry) => {
    const event = entry.event || "status";
    const isTenantSafeEvent = TENANT_REPORT_SAFE_STATUS_EVENTS.has(event);
    if (tenantSafe && (!isTenantSafeEvent || REPORT_INTERNAL_STATUS_EVENTS.has(event))) {
      return;
    }

    items.push(buildReportTimelineItem({
      title: getReportStatusTitle(entry),
      timestamp: entry.timestamp,
      actorName: entry.actor_name,
      actorRole: entry.actor_role,
      visibility: tenantSafe ? "tenant" : REPORT_INTERNAL_STATUS_EVENTS.has(event) ? "admin" : "tenant",
      note:
        tenantSafe && !["tenant", "applicant"].includes(entry.actor_role)
          ? null
          : entry.note,
      attachmentName: tenantSafe ? null : entry.attachmentName,
      removalReason: tenantSafe ? null : entry.removedReason,
      status: entry.status,
      branch: tenantSafe ? null : entry.branch,
      providerName: tenantSafe ? null : entry.providerName,
      previousProviderName: tenantSafe ? null : entry.previousProviderName,
    }));
  });

  (request.reopen_history || []).forEach((entry) => {
    const cycleNum = entry.previousData?.iteration || 1;
    items.push(buildReportTimelineItem({
      title: `Request reopened (Follow-Up Service #${cycleNum})`,
      timestamp: entry.reopened_at || entry.timestamp,
      actorName: entry.actor_name || request.tenant?.full_name || request.user_id,
      actorRole: entry.actor_role || "tenant",
      visibility: "tenant",
      note: entry.note,
      status: request.status,
      previousData: entry.previousData || null,
    }));
  });

  (request.conversation || []).forEach((entry) => {
    const attachments = buildReportAttachmentSummaries(entry.attachments, { tenantSafe });
    items.push(buildReportTimelineItem({
      title: entry.message ? "Message sent to tenant" : "Attachment sent to tenant",
      timestamp: entry.created_at,
      actorName: entry.sender_name,
      actorRole: entry.sender_role,
      visibility: "tenant",
      note: entry.message,
      attachments,
    }));

    if (!tenantSafe) {
      (entry.attachments || [])
        .filter(isReportAttachmentRemoved)
        .forEach((attachment, index) => {
          items.push(buildReportTimelineItem({
            title:
              attachment.removedScope === "tenant_only"
                ? "Attachment removed from tenant view"
                : "Attachment removed from request display",
            timestamp: attachment.removedAt || entry.created_at,
            actorName: attachment.removedByName || attachment.removedBy,
            actorRole: attachment.removedByRole,
            visibility: "admin",
            attachmentName: getReportAttachmentName(attachment, index),
            removalReason: attachment.removedReason || "No reason recorded",
          }));
        });
    }
  });

  if (!tenantSafe) {
    (request.work_log || []).forEach((entry) => {
      const attachments = buildReportAttachmentSummaries(entry.attachments);
      items.push(buildReportTimelineItem({
        title: attachments.length > 0 ? "Admin-only proof uploaded" : "Admin note added",
        timestamp: entry.logged_at,
        actorName: entry.actor_name,
        actorRole: entry.actor_role,
        visibility: "admin",
        note: entry.note,
        attachments,
      }));

      (entry.attachments || [])
        .filter(isReportAttachmentRemoved)
        .forEach((attachment, index) => {
          items.push(buildReportTimelineItem({
            title: "Attachment removed from request display",
            timestamp: attachment.removedAt || entry.logged_at,
            actorName: attachment.removedByName || attachment.removedBy,
            actorRole: attachment.removedByRole,
            visibility: "admin",
            attachmentName: getReportAttachmentName(attachment, index),
            removalReason: attachment.removedReason || "No reason recorded",
          }));
        });
    });
  }

  return items
    .filter((item) => item.timestamp)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
};

export const formatReportAttachmentList = (attachments = []) => {
  if (!attachments.length) return "None recorded";
  return attachments
    .map((attachment) => {
      const suffix = attachment.removed
        ? ` (removed${attachment.removalReason ? `: ${attachment.removalReason}` : ""})`
        : "";
      return `- ${attachment.name}${suffix}`;
    })
    .join("\n");
};

export const formatReportTimeline = (timeline = []) => {
  if (!timeline.length) return "- No timeline entries recorded.";
  return timeline
    .map((item) => {
      const lines = [
        `- ${formatReportDate(item.timestamp)} | ${item.title} | ${formatReportVisibility(item.visibility)}`,
        `  Actor: ${formatReportActor({ name: item.actorName, role: item.actorRole })}`,
      ];
      if (item.status) lines.push(`  Status: ${formatReportStatus(item.status)}`);
      if (item.note) lines.push(`  Note: ${item.note}`);
      if (item.attachmentName) lines.push(`  Attachment: ${item.attachmentName}`);
      if (item.attachments?.length) {
        lines.push(`  Attachments: ${item.attachments.map((attachment) => attachment.name).join(", ")}`);
      }
      if (item.removalReason) lines.push(`  Removal reason: ${item.removalReason}`);
      if (item.branch) lines.push(`  Branch: ${ROOM_BRANCH_LABELS[item.branch] || item.branch}`);
      if (item.providerName) lines.push(`  Provider: ${item.providerName}`);
      if (item.previousProviderName) lines.push(`  Previous provider: ${item.previousProviderName}`);
      return lines.join("\n");
    })
    .join("\n");
};

export const buildAdminMaintenanceReport = ({ request, tenant, timeline, title }) => {
  const initialAttachments = buildReportAttachmentSummaries(request.attachments);
  const proofAttachments = (request.work_log || [])
    .flatMap((entry) => buildReportAttachmentSummaries(entry.attachments))
    .filter((attachment) => attachment.visibility === "admin" || attachment.name);
  const providerName = request.assignedProviderName || request.assigned_to || null;
  const providerLines = providerName
    ? [
        `- Provider: ${providerName}`,
        `- Source: ${formatReportListValue(request.assignedProviderSource, "Not recorded")}`,
        `- Category: ${formatReportListValue(request.assignedProviderCategory, "Not recorded")}`,
        `- Contact: ${formatReportListValue(request.assignedProviderContact, "Not recorded")}`,
        `- Notes: ${formatReportListValue(request.assignedProviderNotes, "None recorded")}`,
      ]
    : ["- Not assigned"];

  return [
    `# ${title}`,
    "",
    "## Request Information",
    `- Request ID: ${request.request_id}`,
    `- Tenant name: ${tenant?.full_name || "Unknown Tenant"}`,
    `- User ID: ${request.user_id}`,
    `- Branch: ${ROOM_BRANCH_LABELS[request.branch] || request.branch || "Branch missing"}`,
    `- Request Type: ${getMaintenanceCategoryLabel(request)}`,
    `- Urgency: ${formatReportListValue(request.urgency)}`,
    `- Current Status: ${formatReportStatus(request.status)}`,
    `- SLA Health: ${formatReportSlaState(request)}`,
    `- Created At: ${formatReportDate(request.created_at)}`,
    `- Updated At: ${formatReportDate(request.updated_at)}`,
    "",
    "## Issue Details",
    request.description || "No issue description recorded.",
    "",
    "Initial tenant attachments:",
    formatReportAttachmentList(initialAttachments),
    "",
    "## Service Provider",
    ...providerLines,
    "",
    "## Maintenance Timeline Summary",
    formatReportTimeline(timeline),
    "",
    "## Admin-only Proof",
    formatReportAttachmentList(proofAttachments),
    "",
    "## Final Status / Resolution",
    `- Current Status: ${formatReportStatus(request.status)}`,
    `- Resolution Note: ${formatReportListValue(request.resolution_note, "None recorded")}`,
    `- Completion Date: ${formatReportDate(request.resolved_at || request.closed_at)}`,
    `- Reopen History: ${
      request.reopen_history?.length
        ? request.reopen_history
            .map((entry) => `${formatReportDate(entry.reopened_at)} - ${entry.note || "No note recorded"}`)
            .join("; ")
        : "None recorded"
    }`,
  ].join("\n");
};

export const buildTenantMaintenanceSummary = ({ request, timeline, title }) => {
  const typeLabel = getMaintenanceCategoryLabel(request);
  const statusLabel = formatReportStatus(request.status);
  const tenantAttachments = [
    ...buildReportAttachmentSummaries(request.attachments, { tenantSafe: true }),
    ...(request.conversation || []).flatMap((entry) =>
      buildReportAttachmentSummaries(entry.attachments, { tenantSafe: true }),
    ),
  ];
  const tenantUpdates = timeline
    .filter((item) => item.visibility === "tenant")
    .filter((item) => item.title !== "Request created" || item.note)
    .map((item) => {
      const parts = [`${formatReportDate(item.timestamp)} - ${item.title}`];
      if (item.status) parts.push(`Status: ${formatReportStatus(item.status)}`);
      if (item.note) parts.push(item.note);
      if (item.attachments?.length) {
        parts.push(`Attachments: ${item.attachments.map((attachment) => attachment.name).join(", ")}`);
      }
      return `- ${parts.join(". ")}`;
    });

  const providerStatus = request.assignedProviderName || request.assigned_to
    ? "A service provider has been assigned."
    : "No service provider assignment has been shared yet.";
  const completionLine = ["resolved", "completed", "closed"].includes(normalizeMaintenanceStatus(request.status))
    ? `The request was marked ${statusLabel.toLowerCase()} on ${formatReportDate(request.resolved_at || request.closed_at)}.`
    : "Our team will provide updates when the next step is confirmed.";

  return [
    `# ${title}`,
    "",
    `Your maintenance request for ${typeLabel} is currently ${statusLabel}.`,
    `The request was submitted on ${formatReportDate(request.created_at)}.`,
    providerStatus,
    completionLine,
    "",
    "## Request Details",
    `- Request ID: ${request.request_id}`,
    `- Branch: ${ROOM_BRANCH_LABELS[request.branch] || request.branch || "Branch pending"}`,
    `- Request Type: ${typeLabel}`,
    `- Current Status: ${statusLabel}`,
    "",
    "## Tenant-visible Updates",
    tenantUpdates.length ? tenantUpdates.join("\n") : "- No tenant-visible updates have been recorded yet.",
    "",
    "## Tenant-visible Attachments",
    formatReportAttachmentList(tenantAttachments),
  ].join("\n");
};

export const buildMaintenanceReportAiContext = ({ request, tenant, timeline, reportType }) => {
  const tenantSafe = reportType === "tenant";
  return {
    request: {
      requestId: request.request_id,
      tenantName: tenantSafe ? undefined : tenant?.full_name,
      userId: tenantSafe ? undefined : request.user_id,
      branch: ROOM_BRANCH_LABELS[request.branch] || request.branch || null,
      requestType: getMaintenanceCategoryLabel(request),
      urgency: request.urgency,
      status: formatReportStatus(request.status),
      createdAt: formatReportDate(request.created_at),
      updatedAt: formatReportDate(request.updated_at),
      description: request.description,
      hasAssignedProvider: Boolean(request.assignedProviderName || request.assigned_to),
      providerName: tenantSafe ? undefined : request.assignedProviderName || request.assigned_to || null,
      providerContact: tenantSafe ? undefined : request.assignedProviderContact || null,
      providerNotes: tenantSafe ? undefined : request.assignedProviderNotes || null,
      internalNotes: tenantSafe ? [] : [request.notes, request.resolution_note].filter(Boolean),
    },
    timeline: timeline.map((item) => ({
      timestamp: formatReportDate(item.timestamp),
      title: item.title,
      visibility: formatReportVisibility(item.visibility),
      actorRole: item.actorRole || null,
      note: item.note || null,
      attachments: item.attachments?.map((attachment) => attachment.name) || [],
      removalReason: tenantSafe ? null : item.removalReason || null,
      providerName: tenantSafe ? null : item.providerName || null,
    })),
  };
};

export const buildMaintenanceReportPayload = async ({
  request,
  tenant,
  adminUser,
  reportType,
}) => {
  const safeReportType = reportType === "tenant" ? "tenant" : "admin";
  const title =
    safeReportType === "tenant"
      ? `Maintenance Tenant Summary - ${request.request_id}`
      : `Maintenance Admin Report - ${request.request_id}`;
  const timeline = buildMaintenanceReportTimeline(request, { reportType: safeReportType });
  const standardSummary =
    safeReportType === "tenant"
      ? buildTenantMaintenanceSummary({ request, tenant, timeline, title })
      : buildAdminMaintenanceReport({ request, tenant, timeline, title });
  const generated = await generateMaintenanceReportText({
    reportType: safeReportType,
    title,
    standardSummary,
    context: buildMaintenanceReportAiContext({ request, tenant, timeline, reportType: safeReportType }),
  });

  return {
    reportType: safeReportType,
    title,
    summary: generated.summary,
    generatedAt: new Date().toISOString(),
    generatedBy:
      `${adminUser?.firstName || ""} ${adminUser?.lastName || ""}`.trim() ||
      adminUser?.email ||
      adminUser?.user_id ||
      null,
    provider: generated.provider,
    unavailable: generated.unavailable,
    message: generated.message,
  };
};

export const loadTenantMap = async (requests) => {
  const userIds = [...new Set(requests.map((entry) => entry.user_id).filter(Boolean))];
  if (userIds.length === 0) return new Map();

  const users = await User.find({ user_id: { $in: userIds } })
    .select(USER_SELECT_FIELDS)
    .lean();

  const userObjectIds = users.map((u) => u._id).filter(Boolean);
  let activeReservations = [];
  try {
    activeReservations = await Reservation.find({
      userId: { $in: userObjectIds },
      isArchived: { $ne: true },
    })
      .sort({ moveInDate: -1, createdAt: -1 })
      .populate("roomId", "name roomNumber floor branch")
      .lean();
  } catch {
    // non-fatal
  }

  const resMap = new Map();
  for (const res of activeReservations) {
    if (res.userId && !resMap.has(String(res.userId))) {
      resMap.set(String(res.userId), res);
    }
  }

  return new Map(
    users.map((user) => {
      const activeRes = resMap.get(String(user._id));
      return [
        user.user_id,
        {
          ...user,
          activeReservation: activeRes || null,
          activeRoom: activeRes?.roomId || null,
        },
      ];
    }),
  );
};

export const findAccessibleRequest = async (
  requestId,
  { includeArchived = false } = {},
) => {
  const request = await MaintenanceRequest.findOne(
    buildRequestIdentifierQuery(requestId),
  );

  if (!request || (!includeArchived && request.isArchived)) {
    throw new AppError("Maintenance request not found", 404, "REQUEST_NOT_FOUND");
  }

  return request;
};

export const resolveAdminBranchFilter = (req) => {
  const requestedBranch = toOptionalText(req.query.branch);
  if (req.isOwner) {
    return requestedBranch || null;
  }

  return req.branchFilter || null;
};

export const parseReportBoolean = (value) =>
  ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

export const parseReportDateRange = ({ dateFrom, dateTo } = {}) => {
  const today = new Date();
  const fallbackFrom = new Date(today);
  fallbackFrom.setDate(fallbackFrom.getDate() - 30);

  const startText = toOptionalText(dateFrom);
  const endText = toOptionalText(dateTo);
  const start = startText ? new Date(`${startText}T00:00:00`) : fallbackFrom;
  const end = endText ? new Date(`${endText}T23:59:59.999`) : today;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new AppError("Invalid report date range", 400, "INVALID_DATE_RANGE");
  }

  return {
    from: start,
    to: end,
    fromText: start.toISOString().slice(0, 10),
    toText: end.toISOString().slice(0, 10),
  };
};

export const buildMaintenanceReportQuery = (req) => {
  const dateRange = parseReportDateRange({
    dateFrom: req.query.date_from || req.query.dateFrom,
    dateTo: req.query.date_to || req.query.dateTo,
  });
  const branch = resolveAdminBranchFilter(req);
  const status = normalizeMaintenanceStatus(req.query.status);
  const requestType = normalizeMaintenanceType(req.query.request_type || req.query.category);
  const urgency = normalizeMaintenanceUrgency(req.query.urgency);

  if (status && !isValidMaintenanceStatus(status)) {
    throw new AppError("Invalid maintenance status filter", 400, "INVALID_STATUS");
  }
  if (requestType && !MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
    throw new AppError("Invalid maintenance request type filter", 400, "INVALID_REQUEST_TYPE");
  }
  if (urgency && !MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
    throw new AppError("Invalid maintenance urgency filter", 400, "INVALID_URGENCY");
  }

  const query = {
    isArchived: false,
    created_at: {
      $gte: dateRange.from,
      $lte: dateRange.to,
    },
  };
  if (branch) query.branch = branch;
  if (status) query.status = status;
  if (requestType) query.request_type = requestType;
  if (urgency) query.urgency = urgency;

  return { query, dateRange };
};

export const buildAdminGeneratedBy = (adminUser) =>
  `${adminUser?.firstName || ""} ${adminUser?.lastName || ""}`.trim() ||
  adminUser?.email ||
  adminUser?.user_id ||
  null;

/**
 * Finds potential duplicate or overlapping maintenance requests for the same room / unit.
 */
export const findOverlappingRoomRequests = async (request, { hoursWindow = 48 } = {}) => {
  if (!request?.roomId) return [];
  const MaintenanceRequest = (await import("../../models/MaintenanceRequest.js")).default;
  const createdAt = request.created_at ? new Date(request.created_at) : new Date();
  const windowStart = new Date(createdAt.getTime() - hoursWindow * 60 * 60 * 1000);
  const windowEnd = new Date(createdAt.getTime() + hoursWindow * 60 * 60 * 1000);

  const query = {
    roomId: request.roomId,
    _id: { $ne: request._id },
    request_id: { $ne: request.request_id },
    isArchived: false,
    created_at: { $gte: windowStart, $lte: windowEnd },
    status: { $nin: ["cancelled", "rejected"] },
  };

  return MaintenanceRequest.find(query)
    .sort({ created_at: -1 })
    .limit(5)
    .lean();
};

export {
  resolveMaintenanceRequestBranch,
  resolveMaintenanceRequestStorageBranch,
} from "../../services/attachmentUploadService.js";

