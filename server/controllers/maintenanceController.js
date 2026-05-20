/**
 * ============================================================================
 * MAINTENANCE REQUEST CONTROLLER
 * ============================================================================
 *
 * Contract-aligned maintenance controllers for tenant and admin workflows.
 * Canonical routes live under /api/m/maintenance/* and are temporarily aliased
 * under /api/maintenance/* for compatibility.
 *
 * ============================================================================
 */

import crypto from "crypto";
import mongoose from "mongoose";
import {
    ADMIN_MAINTENANCE_STATUSES,
    MAINTENANCE_REQUEST_TYPES,
    MAINTENANCE_URGENCY_LEVELS,
    MIN_MAINTENANCE_DESCRIPTION_LENGTH,
    OPEN_MAINTENANCE_STATUSES,
    REOPENABLE_MAINTENANCE_STATUSES,
    canAdminTransitionMaintenanceStatus,
    formatMaintenanceTypeLabel,
    getResolutionEstimate,
    isAdminMutableMaintenanceStatus,
    isValidMaintenanceStatus,
    normalizeMaintenanceStatus,
    normalizeMaintenanceType,
    normalizeMaintenanceUrgency,
} from "../config/maintenance.js";
import { ROOM_BRANCH_LABELS } from "../config/branches.js";
import {
    AppError,
    sendSuccess,
} from "../middleware/errorHandler.js";
import { MaintenanceRequest, ServiceProvider, User } from "../models/index.js";
import { toCategoryKey } from "../models/ServiceProvider.js";
import { buildLegacyDescription } from "../utils/maintenanceMigration.js";
import { notify } from "../utils/notificationService.js";
import { clean } from "../utils/sanitize.js";
import { DELETED_ACCOUNT_LABEL } from "../utils/userReference.js";
import {
  generateMaintenanceUpdateDraft,
  suggestMaintenanceProviderFromDirectory,
} from "../services/maintenanceAiService.js";
import {
  MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE,
  resolveMaintenanceRequestBranch,
  resolveMaintenanceRequestStorageBranch,
  resolveUploadBranch,
  uploadMaintenanceRequestAttachmentFile,
} from "../services/attachmentUploadService.js";

const USER_SELECT_FIELDS =
  "user_id firstName lastName email phone branch role";

const MAINTENANCE_LIMIT_MAX = 200;
const SLA_TARGET_HOURS = Object.freeze({
  low: 120,
  normal: 48,
  high: 24,
});
const DUPLICATE_REQUEST_WINDOW_HOURS = 12;
const CLOSED_MAINTENANCE_STATUSES = new Set([
  "resolved",
  "completed",
  "rejected",
  "cancelled",
  "closed",
]);
const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i;
const PDF_FILE_PATTERN = /\.pdf(?:$|[?#])/i;
const SUPPORTED_PROGRESS_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/*",
  "application/pdf",
]);
const SUPPORTED_PROGRESS_ATTACHMENT_EXTENSION_PATTERN =
  /\.(jpe?g|png|webp|heic|heif|pdf)(?:$|[?#])/i;

const buildMaintenanceRequestId = () =>
  `maint_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const getAttachmentFileType = (type, name, uri) => {
  const source = `${type || ""} ${name || ""} ${uri || ""}`.toLowerCase();
  if (source.includes("image/") || IMAGE_FILE_PATTERN.test(source)) return "image";
  if (source.includes("application/pdf") || PDF_FILE_PATTERN.test(source)) return "pdf";
  return "file";
};

const getAttachmentSize = (entry) => {
  const rawSize =
    typeof entry === "object" && entry
      ? entry.size ?? entry.fileSize
      : null;
  const size = Number(rawSize);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

const parseLimit = (value, fallback = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAINTENANCE_LIMIT_MAX);
};

const toOptionalText = (value) => {
  if (value == null) return null;
  const sanitized = clean(String(value)).trim();
  return sanitized ? sanitized : null;
};

const buildActorSnapshot = (user) => ({
  actor_id: user?.user_id || null,
  actor_name:
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.email ||
    user?.user_id ||
    null,
  actor_role: user?.role || null,
});

const appendStatusHistory = (request, event) => {
  request.statusHistory = [
    ...(Array.isArray(request.statusHistory) ? request.statusHistory : []),
    event,
  ];
};

const appendWorkLogEntry = (request, entry) => {
  request.work_log = [
    ...(Array.isArray(request.work_log) ? request.work_log : []),
    entry,
  ];
};

const appendConversationEntry = (request, entry) => {
  request.conversation = [
    ...(Array.isArray(request.conversation) ? request.conversation : []),
    entry,
  ];
};

const getSlaState = (request) => {
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

const inferAttachmentType = ({ name, uri, fallbackType }) => {
  const explicitType = toOptionalText(fallbackType);
  if (explicitType) return explicitType;

  const source = `${name || ""} ${uri || ""}`.toLowerCase();
  if (PDF_FILE_PATTERN.test(source)) return "application/pdf";
  if (IMAGE_FILE_PATTERN.test(source)) return "image/*";
  return "application/octet-stream";
};

const getAttachmentUri = (entry) => {
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

const normalizeRemovalScope = (value) => {
  const scope = String(value || "").trim().toLowerCase();
  if (["tenant_only", "tenant-only", "tenant"].includes(scope)) return "tenant_only";
  if (["request", "all", "request_only", "request-only"].includes(scope)) return "request";
  return "";
};

const normalizeProviderSource = (value) => {
  const source = String(value || "").trim().toLowerCase();
  if (["directory", "saved", "provider"].includes(source)) return "directory";
  if (["manual", "other"].includes(source)) return "manual";
  if (["none", "unassign", "unassigned", "clear"].includes(source)) return "none";
  return "";
};

const normalizeTextList = (items = []) =>
  [...new Set(
    (Array.isArray(items) ? items : [items])
      .flatMap((item) => String(item || "").split(","))
      .map((item) => toOptionalText(item))
      .filter(Boolean),
  )];

const getMaintenanceCategoryLabel = (request) =>
  formatMaintenanceTypeLabel(request?.request_type || "maintenance");

const getCategoryCandidates = (value) => {
  const raw = toOptionalText(value);
  const normalizedType = normalizeMaintenanceType(raw);
  const label = normalizedType ? formatMaintenanceTypeLabel(normalizedType) : raw;
  const labels = [...new Set([raw, normalizedType, label].filter(Boolean))];
  const keys = [...new Set(labels.map(toCategoryKey).filter(Boolean))];
  return { labels, keys };
};

const providerMatchesMaintenanceRequest = (provider, request) => {
  if (!provider || provider.status !== "active") return false;
  const branch = resolveMaintenanceRequestBranch(request);
  if (!branch || !provider.branchCoverage?.includes(branch)) return false;
  const category = getCategoryCandidates(request.request_type);
  if (category.keys.length === 0) return true;
  const providerKeys = Array.isArray(provider.serviceCategoryKeys)
    ? provider.serviceCategoryKeys
    : (provider.serviceCategories || []).map(toCategoryKey);
  return providerKeys.some((key) => category.keys.includes(key));
};

const buildProviderDirectoryFilter = (request) => {
  const branch = resolveMaintenanceRequestBranch(request);
  const category = getCategoryCandidates(request?.request_type);
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

const serializeAssignedProvider = (request, { includeInternal = true } = {}) => {
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

const deriveAttachmentName = (uri, index = 0) => {
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

const isRemoteUri = (uri) => {
  try {
    const { protocol } = new URL(uri);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

const extractAttachmentName = (entry, uri, index) =>
  (typeof entry === "object" && entry
    ? toOptionalText(entry?.name) ||
      toOptionalText(entry?.filename) ||
      toOptionalText(entry?.fileName) ||
      toOptionalText(entry?.originalName) ||
      toOptionalText(entry?.originalFilename) ||
      toOptionalText(entry?.label) ||
      toOptionalText(entry?.title)
    : null) || deriveAttachmentName(uri || "", index);

/**
 * Used when SAVING new attachments — rejects non-HTTP(S) URIs entirely
 * so local file paths from mobile devices never reach the database.
 */
const getAttachmentMetadataText = (entry, key) =>
  typeof entry === "object" && entry ? toOptionalText(entry?.[key]) : null;

const buildAttachmentMetadata = ({
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

const normalizeAttachmentEntry = (entry, index = 0, metadataOptions = {}) => {
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

/**
 * Used when READING attachments from the DB — preserves every attachment
 * record but nulls out URIs that are not safe HTTP(S) URLs so the frontend
 * can show an "unavailable" state instead of silently hiding the attachment.
 */
const shouldHideAttachmentFromTenantOutput = (entry) => {
  if (!entry || typeof entry !== "object") return false;
  // Both removal scopes hide the file from tenant output. The "request" scope
  // is stronger and is also filtered from normal admin displays in the UI.
  if (entry.isRemoved) return true;
  return entry.visibility === "admin_only";
};

const sanitizeAttachmentForOutput = (entry, index = 0, { includeInternal = true } = {}) => {
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

const normalizeAttachments = (attachments, metadataOptions = {}) => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((entry, index) => normalizeAttachmentEntry(entry, index, metadataOptions))
    .filter(Boolean);
};

const hasSupportedProgressAttachmentType = (attachment) => {
  const type = toOptionalText(attachment?.type)?.toLowerCase();
  if (type && SUPPORTED_PROGRESS_ATTACHMENT_MIME_TYPES.has(type)) return true;

  const source = `${attachment?.name || ""} ${attachment?.uri || ""}`.toLowerCase();
  return SUPPORTED_PROGRESS_ATTACHMENT_EXTENSION_PATTERN.test(source);
};

const validateIncomingAttachments = (
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
  });

  return errors;
};

const validateIncomingWorkLogAttachments = (rawAttachments) =>
  validateIncomingAttachments(rawAttachments, {
    fieldPrefix: "work_log_attachments",
    noun: "Progress attachments",
  });

const getReplyAttachmentsFromBody = (body = {}) => {
  const candidates = [
    body.attachments,
    body.replyAttachments,
    body.reply_attachments,
    body.attachmentUrls,
    body.attachment_urls,
  ];

  return candidates.find((value) => value !== undefined);
};

const sanitizeAttachmentsForOutput = (attachments, options = {}) => {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((entry, index) => sanitizeAttachmentForOutput(entry, index, options))
    .filter(Boolean);
};

const serializeUploadedMaintenanceAttachment = (attachment = {}) => {
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

const buildRequestIdentifierQuery = (requestId) => {
  const identifier = String(requestId || "").trim();
  if (!identifier) {
    return { request_id: "__missing__" };
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return {
      $or: [
        { request_id: identifier },
        { _id: identifier },
      ],
    };
  }

  return { request_id: identifier };
};

const getDbUser = async (firebaseUid) => {
  const user = await User.findOne({ firebaseUid }).select(USER_SELECT_FIELDS).lean();
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return user;
};

const ensureTenantAccess = (request, dbUser) => {
  if (request.user_id !== dbUser.user_id) {
    throw new AppError("Access denied", 403, "FORBIDDEN");
  }
};

const ensureAdminAccess = (request, req) => {
  if (req.isOwner) return;

  if (!req.branchFilter || request.branch !== req.branchFilter) {
    throw new AppError("Access denied", 403, "FORBIDDEN");
  }
};

const serializeTenantSummary = (user, request) => {
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

const INTERNAL_STATUS_EVENTS = new Set([
  "admin_proof_uploaded",
  "attachment_removed_tenant",
  "attachment_removed_request",
  "archived",
  "restored",
  "service_provider_assigned",
  "service_provider_changed",
  "service_provider_unassigned",
]);

const sanitizeStatusHistoryForOutput = (statusHistory, { includeInternal = true } = {}) =>
  Array.isArray(statusHistory)
    ? statusHistory
        .filter((entry) => includeInternal || !INTERNAL_STATUS_EVENTS.has(entry?.event))
        .map((entry) => ({
        ...entry,
        note:
          includeInternal || ["tenant", "applicant"].includes(entry?.actor_role)
            ? entry?.note ?? null
            : null,
      }))
    : [];

const serializeMaintenanceRequest = (
  request,
  tenant = null,
  { includeInternal = true } = {},
) => {
  const workLog = includeInternal && Array.isArray(request.work_log)
    ? request.work_log.map((entry) => ({
        ...entry,
        attachments: sanitizeAttachmentsForOutput(entry?.attachments, { includeInternal }),
      }))
    : [];

  return {
    id: request.request_id,
    _id: request._id,
    request_id: request.request_id,
    user_id: request.user_id,
    request_type: request.request_type,
    description: request.description,
    urgency: request.urgency,
    status: request.status,
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
    workLog,
    conversation: Array.isArray(request.conversation)
      ? request.conversation.map((entry) => ({
          ...entry,
          attachments: sanitizeAttachmentsForOutput(entry?.attachments, { includeInternal }),
        }))
      : [],
    resolutionNote: includeInternal ? request.resolution_note ?? null : null,
    created_at: request.created_at,
    updated_at: request.updated_at,
    cancelled_at: request.cancelled_at ?? null,
    reopened_at: request.reopened_at ?? null,
    resolved_at: request.resolved_at ?? null,
    closed_at: request.closed_at ?? null,
    estimated_resolution: getResolutionEstimate(request.urgency),
    tenant,
    branch: request.branch || null,
    roomId: request.roomId || null,
    reservationId: request.reservationId || null,
    isArchived: Boolean(request.isArchived),
    archivedAt: request.archivedAt ?? null,
    archivedBy: request.archivedBy ?? null,
    restoredAt: request.restoredAt ?? null,
    restoredBy: request.restoredBy ?? null,

    // Compatibility aliases for legacy consumers still in the repo.
    title: `${formatMaintenanceTypeLabel(request.request_type)} Request`,
    category: request.request_type,
    date: request.created_at,
    assignedTo: includeInternal ? request.assigned_to ?? null : null,
    completionNote: includeInternal ? request.resolution_note ?? request.notes ?? null : null,
  };
};

const loadTenantMap = async (requests) => {
  const userIds = [...new Set(requests.map((entry) => entry.user_id).filter(Boolean))];
  if (userIds.length === 0) return new Map();

  const users = await User.find({ user_id: { $in: userIds } })
    .select(USER_SELECT_FIELDS)
    .lean();

  return new Map(users.map((user) => [user.user_id, user]));
};

const findAccessibleRequest = async (
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

const resolveAdminBranchFilter = (req) => {
  const requestedBranch = toOptionalText(req.query.branch);
  if (req.isOwner) {
    return requestedBranch || null;
  }

  return req.branchFilter || null;
};

const ensureMinimumDescriptionLength = (description) =>
  String(description || "").trim().length >= MIN_MAINTENANCE_DESCRIPTION_LENGTH;

const normalizeAdminUpdatePayload = (payload = {}, attachmentMetadata = {}) => {
  const hasAssignedField = Object.prototype.hasOwnProperty.call(payload, "assigned_to");
  const rawWorkLogAttachments =
    payload.work_log_attachments !== undefined
      ? payload.work_log_attachments
      : payload.workLogAttachments;
  const workLogAttachments = normalizeAttachments(
    rawWorkLogAttachments,
    attachmentMetadata,
  );

  return {
    nextStatus: normalizeMaintenanceStatus(payload.status),
    nextNotes: payload.notes !== undefined ? toOptionalText(payload.notes) : undefined,
    nextAssignedTo: hasAssignedField ? toOptionalText(payload.assigned_to) : undefined,
    hasAssignedField,
    workLogNote: toOptionalText(
      payload.work_log_note !== undefined ? payload.work_log_note : payload.workLogNote,
    ),
    workLogAttachmentErrors: validateIncomingWorkLogAttachments(rawWorkLogAttachments),
    workLogAttachments,
  };
};

const resolveArchiveFilter = (value) => {
  const archive = String(value || "active").trim().toLowerCase();
  if (["active", "archived", "all"].includes(archive)) return archive;
  return "active";
};

const getAttachmentBuckets = (request) => {
  const buckets = [
    {
      source: "request",
      label: "request attachments",
      attachments: request.attachments,
    },
  ];

  (request.conversation || []).forEach((entry, entryIndex) => {
    buckets.push({
      source: "conversation",
      label: "tenant conversation",
      entry,
      entryIndex,
      attachments: entry.attachments,
    });
  });

  (request.work_log || []).forEach((entry, entryIndex) => {
    buckets.push({
      source: "work_log",
      label: "admin work log",
      entry,
      entryIndex,
      attachments: entry.attachments,
    });
  });

  return buckets;
};

const findAttachmentTarget = (request, target = {}) => {
  const source = toOptionalText(target.source || target.collection);
  const entryIndex =
    target.entryIndex === undefined || target.entryIndex === null
      ? null
      : Number(target.entryIndex);
  const attachmentIndex =
    target.attachmentIndex === undefined || target.attachmentIndex === null
      ? null
      : Number(target.attachmentIndex);
  const targetId = toOptionalText(target.attachmentId || target.id);
  const targetUri = toOptionalText(target.uri || target.url || target.downloadUrl);

  for (const bucket of getAttachmentBuckets(request)) {
    if (source && bucket.source !== source) continue;
    if (
      bucket.source !== "request" &&
      Number.isInteger(entryIndex) &&
      bucket.entryIndex !== entryIndex
    ) {
      continue;
    }

    const attachments = Array.isArray(bucket.attachments) ? bucket.attachments : [];
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      const attachmentUri = getAttachmentUri(attachment);
      const attachmentId = toOptionalText(
        attachment?.id || attachment?.attachmentId || attachment?.storagePath,
      );
      const indexMatches =
        Number.isInteger(attachmentIndex) && attachmentIndex === index;
      const idMatches = targetId && attachmentId && targetId === attachmentId;
      const uriMatches = targetUri && attachmentUri && targetUri === attachmentUri;

      if (indexMatches || idMatches || uriMatches) {
        return {
          ...bucket,
          attachment,
          attachmentIndex: index,
        };
      }
    }
  }

  return null;
};

const emitMaintenanceUpdated = async (request) => {
  try {
    const { emitToAdmins } = await import("../utils/socket.js");
    emitToAdmins("ticket:updated", {
      requestId: String(request._id),
      status: request.status,
      isArchived: Boolean(request.isArchived),
    });
  } catch {
    // non-fatal; HTTP update already succeeded
  }
};

const applyAdminUpdateToRequest = ({ request, adminUser, payload }) => {
  if (normalizeMaintenanceStatus(request.status) === "closed") {
    throw new AppError(
      "Closed maintenance requests cannot be updated",
      409,
      "REQUEST_CLOSED",
    );
  }

  const {
    nextStatus,
    nextNotes,
    nextAssignedTo,
    hasAssignedField,
    workLogNote,
    workLogAttachmentErrors,
    workLogAttachments,
  } = normalizeAdminUpdatePayload(payload, {
    context: "maintenance_internal_note",
    visibility: "admin_only",
    branchId: request.branch,
    uploadedBy: adminUser?.user_id,
    senderRole: adminUser?.role || "admin",
    relatedId: request.request_id,
  });

  if (workLogAttachmentErrors.length > 0) {
    throw new AppError(
      "Some required information is missing or invalid. Please review the highlighted fields.",
      400,
      "VALIDATION_ERROR",
      workLogAttachmentErrors,
    );
  }

  if (hasAssignedField && nextAssignedTo && nextAssignedTo.length < 2) {
    throw new AppError("Assigned service provider name is too short", 400, "INVALID_ASSIGNEE", [
      {
        field: "assigned_to",
        message: "Assigned service provider must be at least 2 characters.",
      },
    ]);
  }

  if (
    nextStatus === "in_progress" &&
    !nextAssignedTo &&
    !request.assigned_to &&
    !request.assignedProviderName
  ) {
    throw new AppError(
      "Please assign a service provider before marking this request as In Progress.",
      400,
      "ASSIGNEE_REQUIRED",
      [
        {
          field: "assigned_to",
          message: "Please assign a service provider before marking this request as In Progress.",
        },
      ],
    );
  }

  if (!canAdminTransitionMaintenanceStatus(request.status, nextStatus)) {
    throw new AppError(
      `Invalid maintenance status transition: ${request.status} -> ${nextStatus}`,
      409,
      "INVALID_STATUS_TRANSITION",
      [
        {
          field: "status",
          message: "This status change is not available for the current request.",
        },
      ],
    );
  }

  const requiresResolutionNote = ["resolved", "completed"].includes(nextStatus);
  if (requiresResolutionNote && !nextNotes && !workLogNote) {
    throw new AppError(
      "Please add resolution notes or a completion work log before marking this request as Resolved.",
      400,
      "RESOLUTION_NOTE_REQUIRED",
      [
        {
          field: "notes",
          message: "Please add resolution notes or a completion work log before marking this request as Resolved.",
        },
      ],
    );
  }

  const statusChanged = request.status !== nextStatus;
  const isSameStatusUpdate =
    normalizeMaintenanceStatus(request.status) === nextStatus;

  if (
    !nextStatus ||
    (!isAdminMutableMaintenanceStatus(nextStatus) && !isSameStatusUpdate)
  ) {
    throw new AppError(
      `Status must be one of: ${ADMIN_MAINTENANCE_STATUSES.join(", ")}`,
      400,
      "INVALID_ADMIN_STATUS",
      [
        {
          field: "status",
          message: "Please choose a valid status for this request.",
        },
      ],
    );
  }

  let assignmentChanged =
    hasAssignedField && request.assigned_to !== nextAssignedTo;
  const notesChanged = nextNotes !== undefined && request.notes !== nextNotes;
  const eventTimestamp = new Date();

  request.status = nextStatus;

  // Reset SLA breach notification flag on any status change so the job
  // can re-alert if the request becomes delayed again after being actioned.
  if (statusChanged) {
    request.slaBreachNotified = false;
  }

  if (nextNotes !== undefined) {
    request.notes = nextNotes;
  }
  if (hasAssignedField) {
    request.assigned_to = nextAssignedTo;
    request.assigned_at = nextAssignedTo ? eventTimestamp : null;
  }

  if (statusChanged && nextStatus === "in_progress" && !request.work_started_at) {
    request.work_started_at = eventTimestamp;
  }

  if (statusChanged && ["resolved", "completed", "closed"].includes(nextStatus)) {
    request.resolved_at = eventTimestamp;
    request.resolution_note = nextNotes ?? request.notes ?? null;
    if (nextStatus === "closed") {
      request.closed_at = eventTimestamp;
    }
  }

  if (statusChanged && ["pending", "viewed", "in_progress", "waiting_tenant"].includes(nextStatus)) {
    request.cancelled_at = null;
    request.closed_at = null;
    if (!["resolved", "completed"].includes(nextStatus)) {
      request.resolved_at = null;
      request.resolution_note = null;
    }
  }

  if (statusChanged && nextStatus === "rejected") {
    request.resolved_at = eventTimestamp;
    request.resolution_note = nextNotes ?? request.notes ?? null;
  }

  if (statusChanged || assignmentChanged || notesChanged) {
    appendStatusHistory(request, {
      event: statusChanged
        ? "status_changed"
        : assignmentChanged
          ? "assignment_updated"
          : "note_updated",
      status: request.status,
      ...buildActorSnapshot(adminUser),
      note: nextNotes ?? workLogNote ?? null,
      timestamp: eventTimestamp,
    });
  }

  if (workLogNote || workLogAttachments.length > 0) {
    appendWorkLogEntry(request, {
      note: workLogNote || "Progress attachment added.",
      attachments: workLogAttachments,
      ...buildActorSnapshot(adminUser),
      logged_at: eventTimestamp,
    });
  }

  return {
    statusChanged,
    notesChanged,
    hasTenantVisibleUpdate:
      statusChanged,
  };
};

/**
 * GET /api/m/maintenance/me
 * GET /api/maintenance/my-requests (compat)
 */
export const getMyRequests = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const status = normalizeMaintenanceStatus(req.query.status);
    const limit = parseLimit(req.query.limit, 100);

    const query = {
      user_id: dbUser.user_id,
      isArchived: false,
    };

    if (status) {
      if (!isValidMaintenanceStatus(status)) {
        throw new AppError("Invalid maintenance status filter", 400, "INVALID_STATUS");
      }
      query.status = status;
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    sendSuccess(res, {
      count: requests.length,
      requests: requests.map((request) =>
        serializeMaintenanceRequest(
          request,
          serializeTenantSummary(dbUser, request),
          { includeInternal: false },
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/m/maintenance/admin/all
 * GET /api/maintenance/branch (compat)
 */
export const getAdminAll = async (req, res, next) => {
  try {
    const archiveFilter = resolveArchiveFilter(
      req.query.archive || req.query.archived || req.query.view,
    );
    const query = {};
    const limit = parseLimit(req.query.limit, MAINTENANCE_LIMIT_MAX);
    const branch = resolveAdminBranchFilter(req);
    const status = normalizeMaintenanceStatus(req.query.status);
    const requestType = normalizeMaintenanceType(
      req.query.request_type || req.query.category,
    );
    const urgency = normalizeMaintenanceUrgency(req.query.urgency);
    const userId = toOptionalText(req.query.user_id);
    const dateFrom = toOptionalText(req.query.date_from);
    const dateTo = toOptionalText(req.query.date_to);

    if (archiveFilter === "active") query.isArchived = false;
    if (archiveFilter === "archived") query.isArchived = true;
    if (branch) query.branch = branch;
    if (status) {
      if (!isValidMaintenanceStatus(status)) {
        throw new AppError("Invalid maintenance status filter", 400, "INVALID_STATUS");
      }
      query.status = status;
    }
    if (requestType) {
      if (!MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
        throw new AppError("Invalid maintenance request type filter", 400, "INVALID_REQUEST_TYPE");
      }
      query.request_type = requestType;
    }
    if (urgency) {
      if (!MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
        throw new AppError("Invalid maintenance urgency filter", 400, "INVALID_URGENCY");
      }
      query.urgency = urgency;
    }
    if (userId) query.user_id = userId;
    if (dateFrom || dateTo) {
      query.created_at = {};
      if (dateFrom) {
        const parsedFrom = new Date(dateFrom);
        if (Number.isNaN(parsedFrom.getTime())) {
          throw new AppError("Invalid date_from value", 400, "INVALID_DATE_RANGE");
        }
        query.created_at.$gte = parsedFrom;
      }
      if (dateTo) {
        const parsedTo = new Date(dateTo);
        if (Number.isNaN(parsedTo.getTime())) {
          throw new AppError("Invalid date_to value", 400, "INVALID_DATE_RANGE");
        }
        parsedTo.setHours(23, 59, 59, 999);
        query.created_at.$lte = parsedTo;
      }
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    const tenantMap = await loadTenantMap(requests);

    sendSuccess(res, {
      count: requests.length,
      requests: requests.map((request) =>
        serializeMaintenanceRequest(
          request,
          serializeTenantSummary(tenantMap.get(request.user_id), request),
        ),
      ),
    });
  } catch (error) {
    next(error);
  }
};

const buildMaintenanceDocument = ({
  dbUser,
  branch,
  reservationId = null,
  roomId = null,
  requestId = null,
  requestType,
  description,
  urgency,
  attachments,
}) =>
  new MaintenanceRequest({
    request_id: requestId,
    user_id: dbUser.user_id,
    userId: dbUser._id,
    branch,
    request_type: requestType,
    description,
    urgency,
    attachments,
    reservationId,
    roomId,
    statusHistory: [
      {
        event: "submitted",
        status: "pending",
        ...buildActorSnapshot(dbUser),
        note: null,
        timestamp: new Date(),
      },
    ],
  });

/**
 * POST /api/m/maintenance
 * POST /api/maintenance/requests (compat)
 */
export const createRequest = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid })
      .select("_id user_id role branch firstName lastName email phone")
      .lean();

    if (!dbUser) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const requestType = normalizeMaintenanceType(req.body.request_type);
    const description = toOptionalText(req.body.description);
    const urgency = normalizeMaintenanceUrgency(req.body.urgency || "normal") || "normal";

    if (!requestType || !MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
      throw new AppError("Invalid maintenance request type", 400, "INVALID_REQUEST_TYPE");
    }
    if (!description) {
      throw new AppError("Description is required", 400, "MISSING_DESCRIPTION");
    }
    if (!ensureMinimumDescriptionLength(description)) {
      throw new AppError(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters`,
        400,
        "DESCRIPTION_TOO_SHORT",
      );
    }
    if (!MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
      throw new AppError("Invalid maintenance urgency", 400, "INVALID_URGENCY");
    }

    const duplicateCutoff = new Date(
      Date.now() - DUPLICATE_REQUEST_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const existingRequest = await MaintenanceRequest.findOne({
      user_id: dbUser.user_id,
      request_type: requestType,
      description,
      status: { $in: OPEN_MAINTENANCE_STATUSES },
      created_at: { $gte: duplicateCutoff },
      isArchived: false,
    })
      .sort({ created_at: -1 })
      .lean();

    if (existingRequest) {
      return res.status(409).json({
        error: "A similar maintenance request is already open.",
        code: "DUPLICATE_REQUEST",
        request: serializeMaintenanceRequest(
          existingRequest,
          serializeTenantSummary(dbUser, existingRequest),
          { includeInternal: false },
        ),
      });
    }

    const branchResolution = await resolveUploadBranch(req, {
      dbUser,
      context: "maintenance_request",
    });
    const requestId = buildMaintenanceRequestId();
    const attachments = normalizeAttachments(req.body.attachments, {
      context: "maintenance_request",
      visibility: "tenant_admin",
      branchId: branchResolution.branch,
      uploadedBy: dbUser.user_id,
      senderRole: dbUser.role || "tenant",
      relatedId: requestId,
    });

    const request = buildMaintenanceDocument({
      dbUser,
      branch: branchResolution.branch,
      reservationId: branchResolution.reservationId || null,
      roomId: branchResolution.roomId || null,
      requestId,
      requestType,
      description,
      urgency,
      attachments,
    });

    await request.save();

    sendSuccess(
      res,
      {
        request: serializeMaintenanceRequest(
          request.toObject(),
          serializeTenantSummary(dbUser, request),
          { includeInternal: false },
        ),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const createRequestCompat = async (req, res, next) => {
  req.body = {
    request_type: normalizeMaintenanceType(req.body.category || "other"),
    description: buildLegacyDescription(req.body.title, req.body.description),
    urgency: normalizeMaintenanceUrgency(req.body.urgency || "normal") || "normal",
    attachments: req.body.attachments,
  };
  return createRequest(req, res, next);
};

/**
 * GET /api/m/maintenance/:requestId
 * GET /api/maintenance/requests/:requestId (compat)
 */
export const getRequestById = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const isAdminViewer = dbUser.role === "owner" || dbUser.role === "branch_admin";
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: isAdminViewer,
    });

    if (isAdminViewer) {
      if (dbUser.role !== "owner" && request.branch !== dbUser.branch) {
        throw new AppError("Access denied", 403, "FORBIDDEN");
      }
    } else {
      ensureTenantAccess(request, dbUser);
    }

    const tenantUser =
      request.user_id === dbUser.user_id
        ? dbUser
        : await User.findOne({ user_id: request.user_id }).select(USER_SELECT_FIELDS).lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
      request.toObject(),
      serializeTenantSummary(tenantUser, request),
      { includeInternal: isAdminViewer },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/m/maintenance/:requestId
 */
export const updateMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (request.status !== "pending") {
      throw new AppError(
        "Only pending maintenance requests can be edited",
        409,
        "REQUEST_NOT_EDITABLE",
      );
    }

    const requestType =
      req.body.request_type !== undefined
        ? normalizeMaintenanceType(req.body.request_type)
        : request.request_type;
    const description =
      req.body.description !== undefined
        ? toOptionalText(req.body.description)
        : request.description;
    const urgency =
      req.body.urgency !== undefined
        ? normalizeMaintenanceUrgency(req.body.urgency)
        : request.urgency;

    if (!requestType || !MAINTENANCE_REQUEST_TYPES.includes(requestType)) {
      throw new AppError("Invalid maintenance request type", 400, "INVALID_REQUEST_TYPE");
    }
    if (!description) {
      throw new AppError("Description is required", 400, "MISSING_DESCRIPTION");
    }
    if (!ensureMinimumDescriptionLength(description)) {
      throw new AppError(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters`,
        400,
        "DESCRIPTION_TOO_SHORT",
      );
    }
    if (!urgency || !MAINTENANCE_URGENCY_LEVELS.includes(urgency)) {
      throw new AppError("Invalid maintenance urgency", 400, "INVALID_URGENCY");
    }

    request.request_type = requestType;
    request.description = description;
    request.urgency = urgency;

    if (req.body.attachments !== undefined) {
      request.attachments = normalizeAttachments(req.body.attachments, {
        context: "maintenance_request",
        visibility: "tenant_admin",
        branchId: request.branch,
        uploadedBy: dbUser.user_id,
        senderRole: dbUser.role || "tenant",
        relatedId: request.request_id,
      });
    }

    await request.save();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/:requestId/cancel
 */
export const cancelMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (request.status !== "pending") {
      throw new AppError(
        "Only pending maintenance requests can be cancelled",
        409,
        "REQUEST_NOT_CANCELLABLE",
      );
    }

    request.status = "cancelled";
    request.cancelled_at = new Date();
    appendStatusHistory(request, {
      event: "cancelled",
      status: "cancelled",
      ...buildActorSnapshot(dbUser),
      note: null,
      timestamp: request.cancelled_at,
    });
    await request.save();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/:requestId/reopen
 */
export const reopenMyRequest = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (!REOPENABLE_MAINTENANCE_STATUSES.includes(request.status)) {
      throw new AppError(
        "Only resolved or completed maintenance requests can be reopened",
        409,
        "REQUEST_NOT_REOPENABLE",
      );
    }

    const note = toOptionalText(req.body.note || req.body.reopen_note);
    const reopenedAt = new Date();

    request.reopen_note = note;
    request.reopened_at = reopenedAt;
    request.reopen_history = [
      ...(request.reopen_history || []),
      {
        reopened_at: reopenedAt,
        previous_status: request.status,
        note,
      },
    ];
    request.status = "pending";
    request.resolved_at = null;
    request.work_started_at = null;
    request.resolution_note = null;
    appendStatusHistory(request, {
      event: "reopened",
      status: "pending",
      ...buildActorSnapshot(dbUser),
      note,
      timestamp: reopenedAt,
    });

    await request.save();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/status
 * PATCH /api/maintenance/requests/:requestId (compat)
 */
export const updateAdminRequestStatus = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    const { statusChanged, notesChanged, hasTenantVisibleUpdate } = applyAdminUpdateToRequest({
      request,
      adminUser,
      payload: req.body,
    });

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select("_id user_id firstName lastName email phone branch role")
      .lean();

    if (hasTenantVisibleUpdate && tenantUser?._id) {
      await notify.maintenanceUpdated(
        tenantUser._id,
        request.request_type,
        request.status,
        request.request_id,
        {
          statusChanged,
          hasAdminNote: notesChanged,
          hasProgressEntry: Boolean(req.body.work_log_note || req.body.workLogNote),
          hasProgressAttachments: normalizeAttachments(
            req.body.work_log_attachments !== undefined
              ? req.body.work_log_attachments
              : req.body.workLogAttachments,
          ).length > 0,
        },
      );
    }

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });

    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      emitToAdmins("ticket:updated", {
        requestId: String(request._id),
        status: request.status,
      });
    } catch (socketErr) {
      // non-fatal
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/assign-provider
 * Assign, change, or clear the external service provider for a request.
 */
export const assignAdminMaintenanceProvider = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (request.isArchived) {
      throw new AppError(
        "Archived maintenance requests cannot be updated.",
        409,
        "REQUEST_ARCHIVED",
      );
    }

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot be updated.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const actor = buildActorSnapshot(adminUser);
    const providerSource = normalizeProviderSource(
      req.body?.providerSource || req.body?.source,
    );
    if (!providerSource) {
      throw new AppError(
        "Please choose a service provider assignment option.",
        400,
        "INVALID_PROVIDER_SOURCE",
        [{ field: "providerSource", message: "Please choose a service provider assignment option." }],
      );
    }

    const previousProviderName = request.assignedProviderName || request.assigned_to || null;
    const eventTimestamp = new Date();
    let nextProvider = null;
    let event = "service_provider_assigned";

    if (providerSource === "none") {
      if (!previousProviderName) {
        const tenantUser = await User.findOne({ user_id: request.user_id })
          .select(USER_SELECT_FIELDS)
          .lean();

        sendSuccess(res, {
          message: "No service provider is assigned yet.",
          request: serializeMaintenanceRequest(
            request.toObject(),
            serializeTenantSummary(tenantUser, request),
          ),
        });
        return;
      }
      event = "service_provider_unassigned";
      request.assignedProviderId = null;
      request.assignedProviderName = null;
      request.assignedProviderContact = null;
      request.assignedProviderCategory = null;
      request.assignedProviderNotes = null;
      request.assignedProviderSource = null;
      request.assignedBy = actor.actor_id;
      request.assignedByName = actor.actor_name;
      request.assignedByRole = actor.actor_role;
      request.assigned_to = null;
      request.assigned_at = null;
    } else if (providerSource === "directory") {
      const providerId = toOptionalText(req.body?.providerId || req.body?.assignedProviderId);
      if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
        throw new AppError("Please select a saved service provider.", 400, "PROVIDER_REQUIRED", [
          { field: "providerId", message: "Please select a saved service provider." },
        ]);
      }

      const provider = await ServiceProvider.findById(providerId).select("+serviceCategoryKeys");
      if (!provider) {
        throw new AppError("Service provider not found.", 404, "SERVICE_PROVIDER_NOT_FOUND");
      }
      if (!providerMatchesMaintenanceRequest(provider, request)) {
        throw new AppError(
          "This provider is not active for the request branch and type.",
          400,
          "PROVIDER_NOT_AVAILABLE",
          [{ field: "providerId", message: "This provider is not active for the request branch and type." }],
        );
      }

      nextProvider = {
        id: provider._id,
        name: provider.providerName,
        contact: provider.contactNumber,
        category: provider.serviceCategories?.[0] || getMaintenanceCategoryLabel(request),
        notes: toOptionalText(req.body?.notes) || provider.notes || null,
        source: "directory",
      };
    } else if (providerSource === "manual") {
      const providerName = toOptionalText(req.body?.providerName);
      const contactNumber = toOptionalText(req.body?.contactNumber);
      const serviceType = toOptionalText(req.body?.serviceType || req.body?.category);
      const notes = toOptionalText(req.body?.notes);

      const validationErrors = [];
      if (!providerName) validationErrors.push({ field: "providerName", message: "Provider name is required." });
      if (!contactNumber) validationErrors.push({ field: "contactNumber", message: "Contact number is required." });
      if (!serviceType) validationErrors.push({ field: "serviceType", message: "Service type is required." });
      if (validationErrors.length > 0) {
        throw new AppError(
          "Please complete the manual provider details.",
          400,
          "VALIDATION_ERROR",
          validationErrors,
        );
      }

      let savedProvider = null;
      const saveForFuture = Boolean(req.body?.saveForFuture);
      if (saveForFuture) {
        const branch = resolveMaintenanceRequestBranch(request);
        savedProvider = await ServiceProvider.create({
          providerName,
          contactNumber,
          serviceCategories: normalizeTextList([serviceType, getMaintenanceCategoryLabel(request)]),
          branchCoverage: [branch].filter(Boolean),
          notes,
          status: "active",
          createdBy: adminUser.user_id || String(adminUser._id || ""),
          updatedBy: adminUser.user_id || String(adminUser._id || ""),
        });
      }

      nextProvider = {
        id: savedProvider?._id || null,
        name: savedProvider?.providerName || providerName,
        contact: savedProvider?.contactNumber || contactNumber,
        category: serviceType,
        notes,
        source: savedProvider ? "directory" : "manual",
      };
    }

    if (nextProvider) {
      event = previousProviderName
        ? previousProviderName === nextProvider.name
          ? "service_provider_assigned"
          : "service_provider_changed"
        : "service_provider_assigned";
      request.assignedProviderId = nextProvider.id || null;
      request.assignedProviderName = nextProvider.name;
      request.assignedProviderContact = nextProvider.contact;
      request.assignedProviderCategory = nextProvider.category;
      request.assignedProviderNotes = nextProvider.notes;
      request.assignedProviderSource = nextProvider.source;
      request.assignedBy = actor.actor_id;
      request.assignedByName = actor.actor_name;
      request.assignedByRole = actor.actor_role;
      request.assigned_to = nextProvider.name;
      request.assigned_at = eventTimestamp;
    }

    appendStatusHistory(request, {
      event,
      status: request.status,
      ...actor,
      note: toOptionalText(req.body?.notes) || null,
      timestamp: eventTimestamp,
      providerId: request.assignedProviderId || null,
      providerName: request.assignedProviderName || null,
      previousProviderName,
      providerSource: request.assignedProviderSource || null,
    });

    await request.save();
    await emitMaintenanceUpdated(request);

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/generate-update
 */
export const generateAdminMaintenanceUpdate = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const timeline = [
      ...(Array.isArray(request.statusHistory) ? request.statusHistory : []),
      ...(Array.isArray(request.work_log) ? request.work_log : []),
      ...(Array.isArray(request.conversation) ? request.conversation : []),
    ].sort((left, right) => {
      const leftTime = new Date(left.timestamp || left.logged_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.timestamp || right.logged_at || right.created_at || 0).getTime();
      return leftTime - rightTime;
    });

    const result = await generateMaintenanceUpdateDraft({
      request: {
        ...request.toObject(),
        typeLabel: getMaintenanceCategoryLabel(request),
      },
      timeline,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/suggest-provider
 */
export const suggestAdminMaintenanceProvider = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);

    const providers = await ServiceProvider.find(buildProviderDirectoryFilter(request))
      .select("+serviceCategoryKeys")
      .lean();

    if (providers.length === 0) {
      sendSuccess(res, {
        message: "No matching saved providers found for this branch and request type.",
        recommendation: null,
      });
      return;
    }

    const suggestion = await suggestMaintenanceProviderFromDirectory({
      request: {
        ...request.toObject(),
        typeLabel: getMaintenanceCategoryLabel(request),
        branchLabel: ROOM_BRANCH_LABELS[request.branch] || request.branch,
      },
      providers,
    });

    sendSuccess(res, suggestion);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/reply
 * Tenant-facing admin/staff reply with optional attachments.
 */
export const sendAdminReply = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot receive new replies.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const rawAttachments = getReplyAttachmentsFromBody(req.body);
    const attachmentErrors = validateIncomingAttachments(rawAttachments, {
      fieldPrefix: "attachments",
      noun: "Reply attachments",
    });
    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_reply",
      visibility: "tenant_admin",
      branchId: request.branch,
      uploadedBy: adminUser?.user_id,
      senderRole: adminUser?.role || "admin",
      relatedId: request.request_id,
    });
    const message = toOptionalText(
      req.body.message ?? req.body.replyMessage ?? req.body.body ?? req.body.reply,
    );

    if (attachmentErrors.length > 0) {
      throw new AppError(
        attachmentErrors[0]?.message || "Invalid attachment format.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    if (!message && attachments.length === 0) {
      throw new AppError(
        "Please enter a message or attach a file before sending.",
        400,
        "REPLY_REQUIRED",
        [
          {
            field: "message",
            message: "Please enter a message or attach a file before sending.",
          },
        ],
      );
    }

    const eventTimestamp = new Date();
    appendConversationEntry(request, {
      message,
      attachments,
      sender_id: adminUser?.user_id || null,
      sender_name:
        `${adminUser?.firstName || ""} ${adminUser?.lastName || ""}`.trim() ||
        adminUser?.email ||
        adminUser?.user_id ||
        null,
      sender_role: adminUser?.role || null,
      sender_side: "admin",
      created_at: eventTimestamp,
    });
    request.updated_at = eventTimestamp;

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select("_id user_id firstName lastName email phone branch role")
      .lean();

    if (tenantUser?._id) {
      await notify.maintenanceUpdated(
        tenantUser._id,
        request.request_type,
        request.status,
        request.request_id,
        {
          statusChanged: false,
          hasAdminNote: true,
          hasProgressEntry: false,
          hasProgressAttachments: false,
        },
      );
    }

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/attachments
 * Maintenance-specific admin attachment upload. Branch is resolved server-side
 * from the request and its tenant/room/reservation anchors.
 */
export const uploadAdminMaintenanceAttachment = async (req, res, next) => {
  try {
    const requestId = toOptionalText(req.params.requestId || req.body?.maintenanceRequestId);
    if (!requestId) {
      throw new AppError(
        "Maintenance request ID is required.",
        400,
        "REQUEST_ID_REQUIRED",
      );
    }

    const request = await findAccessibleRequest(requestId);
    const branchResolution = await resolveMaintenanceRequestStorageBranch(
      request,
    );
    const branch = branchResolution.branch;
    if (!branch) {
      throw new AppError(
        MAINTENANCE_UPLOAD_BRANCH_ERROR_MESSAGE,
        400,
        "MAINTENANCE_REQUEST_BRANCH_REQUIRED",
      );
    }
    if (!req.isOwner && req.branchFilter !== branch) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }

    const storedBranch = resolveMaintenanceRequestBranch(request);
    if (storedBranch !== branch) {
      request.branch = branch;
      if (!request.roomId && branchResolution.roomId) {
        request.roomId = branchResolution.roomId;
      }
      if (!request.reservationId && branchResolution.reservationId) {
        request.reservationId = branchResolution.reservationId;
      }
      await request.save({ validateModifiedOnly: true });
    }

    const adminUser = await getDbUser(req.user.uid);
    const rawVisibility = toOptionalText(req.body?.visibility || req.body?.type) || "tenant_visible";
    const isInternal = ["admin_only", "admin-only", "internal"].includes(rawVisibility);
    const attachment = await uploadMaintenanceRequestAttachmentFile({
      req,
      file: req.file,
      maintenanceRequest: request,
      visibility: isInternal ? "admin_only" : "tenant_visible",
      context: isInternal ? "maintenance_internal_note" : "maintenance_reply",
      uploadedBy: adminUser?.user_id || String(adminUser?._id || ""),
      senderRole: adminUser?.role || "admin",
    });

    sendSuccess(
      res,
      {
        attachment: serializeUploadedMaintenanceAttachment(attachment),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/admin/:requestId/proof
 * Saves an admin-only proof attachment into the maintenance work log.
 */
export const saveAdminMaintenanceProof = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId);
    ensureAdminAccess(request, req);

    if (request.isArchived) {
      throw new AppError(
        "Archived maintenance requests cannot be updated.",
        409,
        "REQUEST_ARCHIVED",
      );
    }

    const adminUser = await getDbUser(req.user.uid);
    const note = toOptionalText(req.body?.note || req.body?.work_log_note);
    const rawAttachments =
      req.body?.attachments !== undefined
        ? req.body.attachments
        : req.body?.work_log_attachments;
    const attachmentErrors = validateIncomingWorkLogAttachments(rawAttachments);
    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_internal_note",
      visibility: "admin_only",
      branchId: request.branch,
      uploadedBy: adminUser?.user_id,
      senderRole: adminUser?.role || "admin",
      relatedId: request.request_id,
    });

    if (attachmentErrors.length > 0) {
      throw new AppError(
        attachmentErrors[0]?.message || "Invalid attachment format.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    if (attachments.length === 0) {
      throw new AppError(
        "Please upload a proof attachment before saving.",
        400,
        "PROOF_ATTACHMENT_REQUIRED",
      );
    }

    const eventTimestamp = new Date();
    appendWorkLogEntry(request, {
      note: note || "Admin-only proof uploaded.",
      attachments,
      ...buildActorSnapshot(adminUser),
      logged_at: eventTimestamp,
      entry_type: "admin_proof",
      visibility: "admin_only",
    });
    appendStatusHistory(request, {
      event: "admin_proof_uploaded",
      status: request.status,
      ...buildActorSnapshot(adminUser),
      note: note || null,
      timestamp: eventTimestamp,
    });

    await request.save();

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    await emitMaintenanceUpdated(request);

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/archive
 */
export const archiveAdminMaintenanceRequest = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    if (!request.isArchived) {
      const eventTimestamp = new Date();
      request.isArchived = true;
      request.archivedAt = eventTimestamp;
      request.archivedBy = adminUser?.user_id || String(adminUser?._id || "");
      appendStatusHistory(request, {
        event: "archived",
        status: request.status,
        ...buildActorSnapshot(adminUser),
        note: toOptionalText(req.body?.reason) || null,
        timestamp: eventTimestamp,
      });
      await request.save();
      await emitMaintenanceUpdated(request);
    }

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/restore
 */
export const restoreAdminMaintenanceRequest = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);

    if (request.isArchived) {
      const eventTimestamp = new Date();
      request.isArchived = false;
      request.restoredAt = eventTimestamp;
      request.restoredBy = adminUser?.user_id || String(adminUser?._id || "");
      appendStatusHistory(request, {
        event: "restored",
        status: request.status,
        ...buildActorSnapshot(adminUser),
        note: toOptionalText(req.body?.reason) || null,
        timestamp: eventTimestamp,
      });
      await request.save();
      await emitMaintenanceUpdated(request);
    }

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/m/maintenance/admin/:requestId/attachments/remove
 */
export const removeAdminMaintenanceAttachment = async (req, res, next) => {
  try {
    const request = await findAccessibleRequest(req.params.requestId, {
      includeArchived: true,
    });
    ensureAdminAccess(request, req);
    const adminUser = await getDbUser(req.user.uid);
    const scope = normalizeRemovalScope(req.body?.scope || req.body?.removedScope);

    if (request.isArchived) {
      throw new AppError(
        "Archived maintenance requests cannot be updated.",
        409,
        "REQUEST_ARCHIVED",
      );
    }

    if (!scope) {
      throw new AppError(
        "Please choose how to remove this attachment.",
        400,
        "INVALID_REMOVAL_SCOPE",
      );
    }

    const target = findAttachmentTarget(request, req.body || {});
    if (!target?.attachment) {
      throw new AppError(
        "Attachment not found.",
        404,
        "ATTACHMENT_NOT_FOUND",
      );
    }

    const eventTimestamp = new Date();
    const reason = toOptionalText(req.body?.reason || req.body?.removedReason);
    if (!reason || reason.toLowerCase() === "other") {
      throw new AppError(
        "Please provide a reason for removing this attachment.",
        400,
        "REMOVAL_REASON_REQUIRED",
      );
    }

    const actor = buildActorSnapshot(adminUser);
    target.attachment.isRemoved = true;
    target.attachment.removedAt = eventTimestamp;
    target.attachment.removedBy = actor.actor_id;
    target.attachment.removedByRole = actor.actor_role;
    target.attachment.removedByName = actor.actor_name;
    target.attachment.removedReason = reason;
    target.attachment.removedScope = scope;

    appendStatusHistory(request, {
      event:
        scope === "tenant_only"
          ? "attachment_removed_tenant"
          : "attachment_removed_request",
      status: request.status,
      ...actor,
      note: reason || getAttachmentUri(target.attachment) || target.attachment.name || null,
      timestamp: eventTimestamp,
      attachmentName: target.attachment.name || target.attachment.filename || null,
      attachmentId:
        target.attachment.id ||
        target.attachment.attachmentId ||
        target.attachment.storagePath ||
        null,
      removedScope: scope,
      source: target.source,
    });

    request.markModified(target.source === "request" ? "attachments" : target.source);
    if (target.source === "conversation") request.markModified("conversation");
    if (target.source === "work_log") request.markModified("work_log");

    await request.save();
    await emitMaintenanceUpdated(request);

    const tenantUser = await User.findOne({ user_id: request.user_id })
      .select(USER_SELECT_FIELDS)
      .lean();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(tenantUser, request),
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/m/maintenance/:requestId/reply
 * Tenant reply with optional attachments.
 */
export const sendTenantReply = async (req, res, next) => {
  try {
    const dbUser = await getDbUser(req.user.uid);
    const request = await findAccessibleRequest(req.params.requestId);
    ensureTenantAccess(request, dbUser);

    if (["cancelled", "closed"].includes(normalizeMaintenanceStatus(request.status))) {
      throw new AppError(
        "Closed maintenance requests cannot receive new replies.",
        409,
        "REQUEST_CLOSED",
      );
    }

    const rawAttachments = getReplyAttachmentsFromBody(req.body);
    const attachmentErrors = validateIncomingAttachments(rawAttachments, {
      fieldPrefix: "attachments",
      noun: "Reply attachments",
    });
    const attachments = normalizeAttachments(rawAttachments, {
      context: "maintenance_reply",
      visibility: "tenant_admin",
      branchId: request.branch,
      uploadedBy: dbUser?.user_id,
      senderRole: dbUser?.role || "tenant",
      relatedId: request.request_id,
    });
    const message = toOptionalText(
      req.body.message ?? req.body.replyMessage ?? req.body.body ?? req.body.reply,
    );

    if (attachmentErrors.length > 0) {
      throw new AppError(
        attachmentErrors[0]?.message || "Invalid attachment format.",
        400,
        "VALIDATION_ERROR",
        attachmentErrors,
      );
    }

    if (!message && attachments.length === 0) {
      throw new AppError(
        "Please enter a message or attach a file before sending.",
        400,
        "REPLY_REQUIRED",
        [
          {
            field: "message",
            message: "Please enter a message or attach a file before sending.",
          },
        ],
      );
    }

    const eventTimestamp = new Date();
    appendConversationEntry(request, {
      message,
      attachments,
      sender_id: dbUser?.user_id || null,
      sender_name:
        `${dbUser?.firstName || ""} ${dbUser?.lastName || ""}`.trim() ||
        dbUser?.email ||
        dbUser?.user_id ||
        null,
      sender_role: dbUser?.role || "tenant",
      sender_side: "tenant",
      created_at: eventTimestamp,
    });
    request.updated_at = eventTimestamp;

    await request.save();

    sendSuccess(res, {
      request: serializeMaintenanceRequest(
        request.toObject(),
        serializeTenantSummary(dbUser, request),
        { includeInternal: false },
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminRequestStatusCompat = async (req, res, next) => {
  req.body = {
    status: normalizeMaintenanceStatus(req.body.status),
    notes:
      req.body.notes !== undefined
        ? req.body.notes
        : req.body.completionNote,
    assigned_to:
      req.body.assigned_to !== undefined
        ? req.body.assigned_to
        : req.body.assignedTo,
  };

  return updateAdminRequestStatus(req, res, next);
};

/**
 * PATCH /api/m/maintenance/admin/bulk
 * Bulk update maintenance requests (status, assignment, notes).
 */
export const updateAdminBulkRequests = async (req, res, next) => {
  try {
    const adminUser = await getDbUser(req.user.uid);
    const requestIds = Array.isArray(req.body.requestIds)
      ? req.body.requestIds
      : Array.isArray(req.body.requests)
        ? req.body.requests
        : [];
    const payload = {
      status: req.body.status,
      notes: req.body.notes,
      assigned_to: req.body.assigned_to,
      work_log_note: req.body.work_log_note,
      work_log_attachments:
        req.body.work_log_attachments !== undefined
          ? req.body.work_log_attachments
          : req.body.workLogAttachments,
    };

    if (requestIds.length === 0) {
      throw new AppError("No maintenance requests selected", 400, "MISSING_REQUESTS");
    }
    if (requestIds.length > 50) {
      throw new AppError("Bulk updates are limited to 50 requests", 400, "BULK_LIMIT");
    }

    const hasPayload =
      payload.status !== undefined ||
      payload.notes !== undefined ||
      payload.assigned_to !== undefined ||
      payload.work_log_note !== undefined ||
      payload.work_log_attachments !== undefined;
    if (!hasPayload) {
      throw new AppError("No update values provided", 400, "MISSING_UPDATE_VALUES");
    }

    const results = {
      updated: [],
      failed: [],
    };

    for (const requestId of requestIds) {
      try {
        const request = await findAccessibleRequest(requestId);
        ensureAdminAccess(request, req);

        const { statusChanged, notesChanged, hasTenantVisibleUpdate } = applyAdminUpdateToRequest({
          request,
          adminUser,
          payload,
        });

        await request.save();

        if (hasTenantVisibleUpdate) {
          const tenantUser = await User.findOne({ user_id: request.user_id })
            .select("_id")
            .lean();
          if (tenantUser?._id) {
            await notify.maintenanceUpdated(
              tenantUser._id,
              request.request_type,
              request.status,
              request.request_id,
              {
                statusChanged,
                hasAdminNote: notesChanged,
                hasProgressEntry: Boolean(payload.work_log_note || payload.workLogNote),
                hasProgressAttachments: normalizeAttachments(
                  payload.work_log_attachments !== undefined
                    ? payload.work_log_attachments
                    : payload.workLogAttachments,
                ).length > 0,
              },
            );
          }
        }

        results.updated.push(request.request_id);
      } catch (error) {
        results.failed.push({
          requestId,
          error: error?.message || "Update failed",
          code: error?.code || error?.errorCode || "UPDATE_FAILED",
        });
      }
    }

    sendSuccess(res, {
      updatedCount: results.updated.length,
      failedCount: results.failed.length,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maintenance/stats/completion
 */
export const getCompletionStats = async (req, res, next) => {
  try {
    const branch = resolveAdminBranchFilter(req);
    const days = Math.max(1, Number.parseInt(req.query.days, 10) || 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const match = {
      isArchived: false,
      resolved_at: { $gte: startDate },
      status: { $in: ["resolved", "completed"] },
    };
    if (branch) match.branch = branch;

    const stats = await MaintenanceRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$request_type",
          completedCount: { $sum: 1 },
          avgResolutionTimeMs: {
            $avg: { $subtract: ["$resolved_at", "$created_at"] },
          },
        },
      },
      { $sort: { completedCount: -1, _id: 1 } },
    ]);

    sendSuccess(res, {
      branch: branch || "all",
      period: `${days} days`,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maintenance/stats/issue-frequency
 */
export const getIssueFrequency = async (req, res, next) => {
  try {
    const branch = resolveAdminBranchFilter(req);
    const months = Math.max(1, Number.parseInt(req.query.months, 10) || 6);
    const limit = parseLimit(req.query.limit, 12);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const match = {
      isArchived: false,
      created_at: { $gte: startDate },
    };
    if (branch) match.branch = branch;

    const frequency = await MaintenanceRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            month: {
              $dateToString: { format: "%Y-%m", date: "$created_at" },
            },
            request_type: "$request_type",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.month": 1, "_id.request_type": 1 } },
      { $limit: limit },
    ]);

    sendSuccess(res, {
      branch: branch || "all",
      period: `${months} months`,
      frequency,
    });
  } catch (error) {
    next(error);
  }
};

export const getByBranch = getAdminAll;
export const getRequest = getRequestById;
export const updateRequest = updateAdminRequestStatusCompat;

export default {
  getMyRequests,
  getAdminAll,
  getByBranch,
  createRequest,
  createRequestCompat,
  getRequest,
  getRequestById,
  updateMyRequest,
  sendTenantReply,
  cancelMyRequest,
  reopenMyRequest,
  updateRequest,
  updateAdminRequestStatus,
  updateAdminRequestStatusCompat,
  assignAdminMaintenanceProvider,
  generateAdminMaintenanceUpdate,
  suggestAdminMaintenanceProvider,
  sendAdminReply,
  updateAdminBulkRequests,
  getCompletionStats,
  getIssueFrequency,
};
