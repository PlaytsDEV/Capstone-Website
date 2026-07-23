import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCcw,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  BRANCH_OPTIONS,
  BRANCH_DISPLAY_NAMES,
} from "../../../../shared/utils/constants";
import {
  formatMaintenanceStatus,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../shared/utils/maintenanceConfig";

export {
  formatMaintenanceStatus,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
};
import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  isViewableMaintenanceAttachmentUri,
} from "../../../../shared/utils/maintenanceAttachments";

export {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  isViewableMaintenanceAttachmentUri,
};

export const ITEMS_PER_PAGE = 10;
export const MAX_MAINTENANCE_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const SUPPORTED_PROGRESS_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
export const SUPPORTED_PROGRESS_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
]);
export const UPDATE_FIELD_ORDER = [
  "status",
  "notes",
  "assigned_to",
  "work_log_note",
  "attachments",
];
export const REPLY_FIELD_ORDER = ["reply_message", "reply_attachments"];
export const PROOF_FIELD_ORDER = ["proof_attachments", "proof_note"];
export const ARCHIVE_FILTER_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];
export const ATTACHMENT_REMOVAL_REASONS = [
  "Wrong file attached",
  "Duplicate attachment",
  "Sensitive information visible",
  "Blurry or unreadable file",
  "Attached to the wrong request",
  "Outdated file",
  "Uploaded by mistake",
  "Other",
];
export const PROVIDER_MANUAL_CHOICE = "__manual__";
export const PROVIDER_NONE_CHOICE = "";
export const REPORT_TYPE_LABELS = {
  admin: "Admin Report",
  tenant: "Tenant Summary",
};
export const REPORT_EXPORT_COLUMNS = [
  { key: "lineNumber", label: "Line" },
  { key: "content", label: "Content" },
];
export const MAINTENANCE_TABS = [
  { key: "requests", label: "Requests", icon: ClipboardList },
];
export const ASSIGNMENT_FILTER_OPTIONS = [
  { key: "all", label: "All assignments" },
  { key: "assigned", label: "Assigned" },
  { key: "unassigned", label: "Unassigned" },
];
export const ANALYTICS_SLA_OPTIONS = [
  { key: "all", label: "All SLA health" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due Soon" },
  { key: "on_track", label: "On Track" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Closed" },
];
export const VALID_MAINTENANCE_BRANCHES = new Set(BRANCH_OPTIONS.map((b) => b.value));
export const ASSIGN_BRANCH_OPTIONS = [
  { value: "guadalupe", label: "Guadalupe" },
  { value: "gil-puyat", label: "Gil Puyat" },
];
export const PH_MOBILE_ERROR = "Enter a valid 11-digit Philippine mobile number starting with 09.";
export const AMOUNT_ERROR = "Enter a valid amount.";
export const TEXT_MIN_LENGTHS = {
  issueTitle: 5,
  description: 15,
  adminRemarks: 10,
  replyMessage: 10,
  progressUpdate: 10,
  providerNotes: 10,
  providerName: 3,
  serviceType: 3,
};

export const sanitizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");
export const sanitizeAmountInput = (value) => {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length ? `${whole}.${decimal}` : whole;
};

export const formatPeso = (min, max = null) => {
  const format = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    return `PHP ${amount.toLocaleString("en-PH", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };
  const minLabel = format(min);
  const maxLabel = format(max);
  if (minLabel && maxLabel && Number(min) !== Number(max)) return `${minLabel} - ${maxLabel}`;
  return minLabel || maxLabel || "Rate not recorded";
};

export const validatePhilippineMobile = (value, { required = true } = {}) => {
  const digits = sanitizeDigitsOnly(value);
  if (!digits) return required ? PH_MOBILE_ERROR : "";
  return /^09\d{9}$/.test(digits) ? "" : PH_MOBILE_ERROR;
};

export const validateAmount = (value, { required = false } = {}) => {
  const text = String(value ?? "").trim();
  if (!text) return required ? AMOUNT_ERROR : "";
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? "" : AMOUNT_ERROR;
};

export const validateMinimumText = (value, min, label, { required = true } = {}) => {
  const text = String(value || "").trim();
  if (!text) return required ? `${label} is required.` : "";
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  return "";
};

export const fmtDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const fmtDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getReportFilenameBase = (report, selectedRequest) => {
  const requestId = report?.requestId || selectedRequest?.request_id || report?.title || "maintenance";
  const safeRequestId = String(requestId)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const reportSlug = report?.reportType === "tenant" ? "tenant-summary" : "admin-report";
  return `maintenance-${reportSlug}-${safeRequestId || "request"}`;
};

export const getReportSummaryLines = (summary) => String(summary || "").split(/\r?\n/);

export const toDateInputValue = (date) => {
  const next = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(next.getTime())) return "";
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDefaultMaintenanceReportRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(end),
  };
};

export const formatSlaState = (slaState) => {
  if (!slaState) return "No SLA";
  if (slaState.label === "delayed") return "Delayed";
  if (slaState.label === "priority") return "Priority";
  if (slaState.label === "closed") return "Closed";
  return "On Track";
};

export const getSlaTone = (slaState) => {
  if (!slaState) return { bg: "#E2E8F0", color: "#475569" };
  if (slaState.label === "delayed") return { bg: "#FEE2E2", color: "#DC2626" };
  if (slaState.label === "priority") return { bg: "#FEF3C7", color: "#D97706" };
  if (slaState.label === "closed") return { bg: "#DCFCE7", color: "#166534" };
  return { bg: "#DBEAFE", color: "#2563EB" };
};

export const urgencyRank = {
  high: 0,
  normal: 1,
  low: 2,
};

export const TERMINAL_STATUSES = new Set([
  "resolved",
  "completed",
  "rejected",
  "cancelled",
  "closed",
]);

export const SUMMARY_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "viewed", label: "Viewed" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "closed", label: "Closed" },
];

export const MANAGEMENT_SUMMARY_CARDS = [
  {
    key: "open_queue",
    label: "Open Queue",
    icon: ClipboardList,
    color: "orange",
    description: "Pending and viewed requests",
  },
  {
    key: "in_progress",
    label: "In Progress",
    icon: RefreshCcw,
    color: "blue",
    description: "Requests actively handled",
  },
  {
    key: "overdue",
    label: "SLA Overdue",
    icon: AlertTriangle,
    color: "red",
    description: "SLA delayed and not terminal",
  },
  {
    key: "due_soon",
    label: "SLA Due Soon",
    icon: Clock3,
    color: "purple",
    description: "SLA priority and non-terminal",
  },
  {
    key: "completed_today",
    label: "Resolved in Period",
    icon: CheckCircle2,
    color: "green",
    description: "Resolved or completed in date range",
  },
  {
    key: "unassigned_high",
    label: "Unassigned High",
    icon: UserRound,
    color: "orange",
    description: "High urgency with no assignee",
  },
  {
    key: "exceptions",
    label: "Exceptions",
    icon: XCircle,
    color: "red",
    description: "Rejected or cancelled requests",
  },
];

export const SLA_FILTER_OPTIONS = [
  { key: "all", label: "All SLA health" },
  { key: "on_track", label: "On Track" },
  { key: "priority", label: "Priority" },
  { key: "delayed", label: "Delayed" },
  { key: "closed", label: "Closed" },
  { key: "no_sla", label: "No SLA" },
];

export const isNonTerminal = (status) => !TERMINAL_STATUSES.has(status);

export const isWithinDateWindow = ({ value, dateFrom, dateTo }) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

export const isCompletedInWindow = ({ request, dateFrom, dateTo }) => {
  if (!(request.status === "resolved" || request.status === "completed")) {
    return false;
  }

  const completedAt =
    request.assignment?.resolvedAt || request.resolved_at || request.updated_at;
  if (!completedAt) return false;

  if (dateFrom || dateTo) {
    return isWithinDateWindow({ value: completedAt, dateFrom, dateTo });
  }

  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return false;
  const today = new Date();
  return (
    completedDate.getFullYear() === today.getFullYear() &&
    completedDate.getMonth() === today.getMonth() &&
    completedDate.getDate() === today.getDate()
  );
};

export const matchesSummaryCard = ({ request, cardKey, dateFrom, dateTo }) => {
  if (!cardKey) return true;

  switch (cardKey) {
    case "open_queue":
      return request.status === "pending" || request.status === "viewed";
    case "in_progress":
      return request.status === "in_progress";
    case "overdue":
      return request.slaState?.label === "delayed" && isNonTerminal(request.status);
    case "due_soon":
      return request.slaState?.label === "priority" && isNonTerminal(request.status);
    case "completed_today":
      return isCompletedInWindow({ request, dateFrom, dateTo });
    case "unassigned_high":
      return (
        request.urgency === "high" &&
        !getAssignedProviderName(request) &&
        isNonTerminal(request.status)
      );
    case "exceptions":
      return request.status === "rejected" || request.status === "cancelled";
    default:
      return true;
  }
};

export const matchesSlaFilter = ({ request, slaFilter }) => {
  if (!slaFilter || slaFilter === "all") return true;
  if (slaFilter === "no_sla") return !request.slaState;
  if (slaFilter === "on_track") {
    return request.slaState?.label === "on_track" || !request.slaState?.label;
  }
  return request.slaState?.label === slaFilter;
};

export const getStatusDotClass = (status) => {
  switch (status) {
    case "pending":
    case "viewed":
      return "bg-amber-300";
    case "in_progress":
      return "bg-blue-500";
    case "resolved":
    case "completed":
      return "bg-emerald-500";
    case "rejected":
      return "bg-rose-500";
    case "cancelled":
      return "bg-slate-400";
    default:
      return "bg-slate-400";
  }
};

export const getStatusTextClass = (status) => {
  switch (status) {
    case "pending":
    case "viewed":
      return "text-warning-dark";
    case "in_progress":
      return "text-blue-600";
    case "resolved":
    case "completed":
      return "text-emerald-600";
    case "rejected":
      return "text-error-dark";
    case "cancelled":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
};

export const ROLE_LABELS = {
  owner: "Dormitory Owner",
  admin: "Admin",
  branch_admin: "Branch Admin",
  maintenance_staff: "Maintenance Staff",
  staff: "Maintenance Staff",
  tenant: "Tenant",
  applicant: "Tenant",
};

export const normalizeMaintenanceBranch = (value) => {
  const branch = String(value || "").trim().toLowerCase();
  return VALID_MAINTENANCE_BRANCHES.has(branch) ? branch : "";
};

export const hasValidRequestBranch = (request) => Boolean(normalizeMaintenanceBranch(request?.branch));

export const formatBranchLabel = (value) => {
  const branch = normalizeMaintenanceBranch(value);
  if (!branch) return "Branch missing";
  return BRANCH_DISPLAY_NAMES[branch] || branch;
};

export const getRequestBranch = (request) => normalizeMaintenanceBranch(request?.branch);

export const getAssignedProviderName = (request) =>
  request?.assignedProvider?.name ||
  request?.assignedProviderName ||
  request?.assigned_to ||
  "";

export const getAssignedProviderContact = (request) =>
  request?.assignedProvider?.contactNumber ||
  request?.assignedProviderContact ||
  "";

export const getAssignedProviderCategory = (request) =>
  request?.assignedProvider?.category ||
  request?.assignedProviderCategory ||
  (request?.request_type ? getMaintenanceTypeMeta(request.request_type).label : "");

export const getProviderBranchCoverageLabel = (provider) =>
  (provider?.branchCoverage || [])
    .map((branch) => BRANCH_DISPLAY_NAMES[branch] || branch)
    .filter(Boolean)
    .join(", ") || "No branch coverage";

export const getProviderCategoryLabel = (provider) =>
  (provider?.serviceCategories || []).filter(Boolean).join(", ") || "No service category";

export const getProviderRateLabel = (provider) =>
  formatPeso(provider?.minRate ?? provider?.minimumRate, provider?.maxRate ?? provider?.maximumRate);

export const formatSenderLabel = ({ role, name, fallback = "Staff update" } = {}) => {
  const roleLabel = ROLE_LABELS[String(role || "").toLowerCase()] || "Staff";
  const displayName = String(name || "").trim();
  if (!displayName) return roleLabel || fallback;
  if (displayName.toLowerCase() === roleLabel.toLowerCase()) return displayName;
  return `${roleLabel} - ${displayName}`;
};

export const createFilterPayload = ({
  status,
  requestType,
  urgency,
  dateFrom,
  dateTo,
  branch,
  archiveView,
}) => {
  const filters = { limit: 200 };

  if (status && status !== "all") filters.status = status;
  if (requestType && requestType !== "all") filters.request_type = requestType;
  if (urgency && urgency !== "all") filters.urgency = urgency;
  if (dateFrom) filters.date_from = dateFrom;
  if (dateTo) filters.date_to = dateTo;
  if (branch && branch !== "all") filters.branch = branch;
  if (archiveView && archiveView !== "active") filters.archive = archiveView;

  return filters;
};

export const createReportFilterPayload = (filters = {}, { isOwner = false, userBranch = "" } = {}) => {
  const branch = isOwner ? filters.branch : userBranch;
  return {
    limit: 200,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    ...(branch && branch !== "all" ? { branch } : {}),
    ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.requestType && filters.requestType !== "all" ? { request_type: filters.requestType } : {}),
    ...(filters.urgency && filters.urgency !== "all" ? { urgency: filters.urgency } : {}),
    ...(filters.provider && filters.provider !== "all" ? { provider: filters.provider } : {}),
    ...(filters.assignmentStatus && filters.assignmentStatus !== "all"
      ? { assignment_status: filters.assignmentStatus }
      : {}),
    ...(filters.slaHealth && filters.slaHealth !== "all" ? { sla_health: filters.slaHealth } : {}),
    ...(filters.overdueOnly ? { overdue_only: "true" } : {}),
  };
};

export const REPORT_REQUEST_COLUMNS = [
  { key: "requestId", label: "Request ID" },
  { key: "tenantName", label: "Tenant Name" },
  { key: "branchLabel", label: "Branch" },
  { key: "room", label: "Room/Unit" },
  { key: "requestTypeLabel", label: "Request Type" },
  { key: "urgencyLabel", label: "Urgency" },
  { key: "statusLabel", label: "Status" },
  { key: "assignedProvider", label: "Assigned Service Provider" },
  { key: "createdAt", label: "Created Date" },
  { key: "updatedAt", label: "Last Updated" },
  { key: "resolutionAt", label: "Resolution Date" },
  { key: "slaLabel", label: "SLA Status" },
];

export const PROVIDER_REPORT_COLUMNS = [
  { key: "providerName", label: "Provider Name" },
  { key: "contactNumber", label: "Contact Number" },
  { key: "assignedRequests", label: "Assigned Requests" },
  { key: "completedRequests", label: "Completed Requests" },
  { key: "activeRequests", label: "Pending/In Progress" },
  { key: "overdueRequests", label: "Overdue Assigned" },
  { key: "averageCompletionTimeLabel", label: "Average Completion Time" },
  { key: "lastAssignedRequestDate", label: "Last Assigned Request" },
  { key: "relatedRequestTypes", label: "Related Request Types", formatter: (value) => (Array.isArray(value) ? value.join("; ") : value) },
];

export const AVATAR_PALETTES = [
  { bg: "bg-blue-700", text: "text-white" },
  { bg: "bg-emerald-700", text: "text-white" },
  { bg: "bg-violet-700", text: "text-white" },
  { bg: "bg-rose-700", text: "text-white" },
  { bg: "bg-amber-700", text: "text-white" },
  { bg: "bg-cyan-700", text: "text-white" },
];

export const getAvatarPalette = (name = "") => {
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
};

export const isRemoteUri = (uri) => isViewableMaintenanceAttachmentUri(uri);

export const getMaintenanceRequestUploadId = (request) =>
  request?.requestId ||
  request?.request_id ||
  request?.ticketId ||
  request?.maintenanceId ||
  request?.id ||
  request?._id ||
  "";

export const getUploadedAttachmentUrl = (attachment = {}) =>
  attachment.url || attachment.downloadUrl || attachment.uri || "";

export const buildUploadedAdminAttachment = ({ clientId, file, attachment = {} }) => {
  const uri = getUploadedAttachmentUrl(attachment);
  const type = attachment.type || attachment.mimeType || file.type || "application/octet-stream";

  return {
    ...attachment,
    clientId,
    name: attachment.name || file.name,
    uri,
    url: uri,
    downloadUrl: uri,
    type,
    mimeType: attachment.mimeType || type,
    size: attachment.size ?? file.size,
    storagePath: attachment.storagePath,
    uploadStatus: "uploaded",
  };
};

export const createAttachmentClientId = () =>
  `maintenance-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const getAttachmentFileExtension = (file) => {
  const name = String(file?.name || "").toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex) : "";
};

export const isSupportedProgressAttachmentFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  if (SUPPORTED_PROGRESS_ATTACHMENT_TYPES.has(type)) return true;

  return (
    (!type || type === "application/octet-stream") &&
    SUPPORTED_PROGRESS_ATTACHMENT_EXTENSIONS.has(getAttachmentFileExtension(file))
  );
};

export const validateProgressAttachmentFile = (file) => {
  if (!file) return "No file selected.";
  if (!isSupportedProgressAttachmentFile(file)) {
    return "This file type is not supported. Please upload a JPEG, PNG, WebP, HEIC, HEIF, or PDF file.";
  }
  if (file.size > MAX_MAINTENANCE_ATTACHMENT_SIZE) {
    return "This file is too large. Please upload a file under 5 MB.";
  }
  return "";
};

export const isUploadedWorkLogAttachment = (attachment) =>
  attachment?.uploadStatus === "uploaded" ||
  isRemoteUri(getMaintenanceAttachmentUri(attachment));

export const isBlockingWorkLogAttachment = (attachment) =>
  ["uploading", "failed", "invalid"].includes(attachment?.uploadStatus) ||
  !isRemoteUri(getMaintenanceAttachmentUri(attachment));

export const getWorkLogAttachmentKey = (attachment, index = 0) =>
  attachment?.clientId ||
  getMaintenanceAttachmentUri(attachment) ||
  `${attachment?.name || "attachment"}-${index}`;

export const buildFieldClassName = (hasError, baseClassName) =>
  `${baseClassName} ${
    hasError
      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-200"
      : "border-border focus:border-border focus:ring-border"
  }`;

export const normalizeApiValidationDetail = (detail, index = 0) => {
  if (typeof detail === "string") {
    return { field: `field_${index}`, message: detail };
  }

  if (!detail || typeof detail !== "object") return null;

  return {
    field: String(detail.field || detail.path || detail.param || `field_${index}`),
    message: String(
      detail.message ||
        detail.msg ||
        detail.detail ||
        "Some required information is missing or invalid.",
    ),
  };
};

export const getMaintenanceApiValidationDetails = (error) => {
  const payload = error?.response?.data || {};
  const rawDetails =
    payload?.error?.details ||
    payload?.details ||
    payload?.errors ||
    payload?.detail;

  if (Array.isArray(rawDetails)) {
    return rawDetails
      .map((detail, index) => normalizeApiValidationDetail(detail, index))
      .filter(Boolean);
  }

  if (rawDetails && typeof rawDetails === "object") {
    return Object.entries(rawDetails)
      .flatMap(([field, value]) => {
        const values = Array.isArray(value) ? value : [value];
        return values.map((entry) =>
          normalizeApiValidationDetail(
            typeof entry === "object" && entry
              ? { field, ...entry }
              : { field, message: entry },
          ),
        );
      })
      .filter(Boolean);
  }

  if (typeof rawDetails === "string" && rawDetails.trim()) {
    return [{ field: "form", message: rawDetails.trim() }];
  }

  return [];
};

export const getFirstFormError = (errors) =>
  Object.values(errors || {}).find(Boolean) || "";

export const getMaintenanceApiErrorMessage = (error, fallback) =>
  getMaintenanceApiValidationDetails(error)[0]?.message ||
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export const normalizeApiErrorField = (field) => String(field || "").toLowerCase().replace(/\[(\d+)\]/g, ".$1");

export const getFormSummaryMessage = (errors, fallback) =>
  getFirstFormError(errors) || fallback;

export const mapMaintenanceApiErrors = (error, { scope = "progress" } = {}) => {
  const nextErrors = {};
  for (const detail of getMaintenanceApiValidationDetails(error)) {
    const rawField = normalizeApiErrorField(detail?.field);
    const message =
      detail?.message ||
      "Some required information is missing or invalid.";

    if (scope === "reply") {
      if (rawField.includes("attachment") || rawField.includes("file") || rawField.includes("url")) {
        nextErrors.reply_attachments = message;
      } else if (rawField.includes("reply") || rawField.includes("message") || rawField.includes("body")) {
        nextErrors.reply_message = message;
      }
      continue;
    }

    if (scope === "provider") {
      if (rawField.includes("providername") || rawField.includes("provider_name")) {
        nextErrors.providerName = message;
      } else if (rawField.includes("contact") || rawField.includes("phone")) {
        nextErrors.contactNumber = message;
      } else if (rawField.includes("servicetype") || rawField.includes("category")) {
        nextErrors.serviceType = message;
      } else if (rawField.includes("note")) {
        nextErrors.notes = message;
      } else if (rawField.includes("provider") || rawField.includes("assigned")) {
        nextErrors.assigned_to = message;
      }
      continue;
    }

    if (rawField.includes("work_log") || rawField.includes("attachment")) {
      nextErrors.attachments = message;
    } else if (rawField.includes("assigned")) {
      nextErrors.assigned_to = message;
    } else if (rawField.includes("note") || rawField.includes("response")) {
      nextErrors.notes = message;
    } else if (rawField.includes("status")) {
      nextErrors.status = message;
    }
  }
  return nextErrors;
};

export const isRemovedAttachment = (attachment) => Boolean(attachment?.isRemoved);

export const getActiveAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments.filter((attachment) => !isRemovedAttachment(attachment))
    : [];

export const getAttachmentRemoveTarget = ({
  source,
  entryIndex = null,
  attachment,
  attachmentIndex,
}) => ({
  source,
  entryIndex,
  attachmentIndex,
  attachmentId: attachment?.id || attachment?.attachmentId || attachment?.storagePath || null,
  uri: getMaintenanceAttachmentUri(attachment),
});

export const buildTimelineActor = ({
  role,
  name,
  fallback = "Unknown admin",
} = {}) => formatSenderLabel({ role, name, fallback });

export const getStatusTimelineTitle = (entry = {}) => {
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

export const getTimelineVisibility = (item = {}) =>
  item.visibility === "tenant" ? "Visible to Tenant" : "Admin Only";

export const buildMaintenanceTimeline = (request) => {
  if (!request) return [];
  const items = [];

  items.push({
    key: "created",
    type: "created",
    title: "Request created",
    message: request.description,
    actorName: request.tenant?.full_name || request.user_id,
    actorRole: "tenant",
    actorPrefix: "Submitted by",
    timestamp: request.created_at,
    visibility: "tenant",
    attachments: getActiveAttachments(request.attachments),
    attachmentTargets: getActiveAttachments(request.attachments).map((attachment) => {
      const originalIndex = (request.attachments || []).indexOf(attachment);
      return getAttachmentRemoveTarget({
        source: "request",
        attachment,
        attachmentIndex: originalIndex,
      });
    }),
  });

  (request.attachments || []).filter(isRemovedAttachment).forEach((attachment, attachmentIndex) => {
    items.push({
      key: `request-removed-${attachmentIndex}`,
      type: "attachment_removed",
      title:
        attachment.removedScope === "tenant_only"
          ? "Attachment removed from tenant view"
          : "Attachment removed from request display",
      message: attachment.removedReason,
      actorName: attachment.removedByName || attachment.removedBy,
      actorRole: attachment.removedByRole,
      actorPrefix: "Removed by",
      timestamp: attachment.removedAt || request.updated_at,
      visibility: "admin",
      attachmentName: getMaintenanceAttachmentName(attachment, attachmentIndex),
      attachments: [],
      removed: true,
    });
  });

  (request.statusHistory || []).forEach((entry, index) => {
    if (["admin_proof_uploaded", "attachment_removed_tenant", "attachment_removed_request"].includes(entry.event)) {
      return;
    }
    items.push({
      key: `status-${entry.timestamp || index}-${index}`,
      type: entry.event || "status",
      title: getStatusTimelineTitle(entry),
      message: entry.note,
      actorName: entry.actor_name,
      actorRole: entry.actor_role,
      actorPrefix:
        entry.event === "admin_proof_uploaded"
          ? "Uploaded by"
          : entry.event?.startsWith("attachment_removed")
          ? "Removed by"
          : entry.event === "branch_assigned_manually"
          ? "Assigned by"
          : ["archived", "restored"].includes(entry.event)
          ? "Updated by"
          : "Updated by",
      timestamp: entry.timestamp,
      visibility:
        ["archived", "restored", "branch_assigned_manually", "admin_proof_uploaded", "attachment_removed_tenant", "attachment_removed_request", "note_updated", "service_provider_assigned", "service_provider_changed", "service_provider_unassigned"].includes(entry.event)
          ? "admin"
          : "tenant",
      meta: entry.status ? formatMaintenanceStatus(entry.status) : "",
      removedScope: entry.removedScope,
      attachmentName: entry.attachmentName,
      branch: entry.branch,
      providerName: entry.providerName,
      previousProviderName: entry.previousProviderName,
    });
  });

  const statusReopenTimestamps = new Set(
    (request.statusHistory || [])
      .filter((entry) => entry.event === "reopened" && entry.timestamp)
      .map((entry) => new Date(entry.timestamp).getTime()),
  );
  (request.reopen_history || []).forEach((entry, index) => {
    const reopenedAt = entry.reopened_at || entry.timestamp;
    const reopenedTime = reopenedAt ? new Date(reopenedAt).getTime() : null;
    if (reopenedTime && statusReopenTimestamps.has(reopenedTime)) return;
    items.push({
      key: `reopen-${reopenedAt || index}-${index}`,
      type: "reopened",
      title: "Request reopened",
      message: entry.note,
      actorName: entry.actor_name || request.tenant?.full_name || request.user_id,
      actorRole: entry.actor_role || "tenant",
      actorPrefix: "Reopened by",
      timestamp: reopenedAt,
      visibility: "tenant",
      meta: entry.previous_status
        ? `From ${formatMaintenanceStatus(entry.previous_status)}`
        : "",
    });
  });

  (request.conversation || []).forEach((entry, entryIndex) => {
    const activeAttachments = getActiveAttachments(entry.attachments);
    const removedAttachments = (entry.attachments || []).filter(isRemovedAttachment);
    items.push({
      key: `conversation-${entry.created_at || entryIndex}-${entryIndex}`,
      type: "conversation",
      title: entry.message ? "Message sent to tenant" : "Attachment sent to tenant",
      message: entry.message,
      actorName: entry.sender_name,
      actorRole: entry.sender_role,
      actorPrefix: "Sent by",
      timestamp: entry.created_at,
      visibility: "tenant",
      attachments: activeAttachments,
      attachmentTargets: activeAttachments.map((attachment) => {
        const originalIndex = (entry.attachments || []).indexOf(attachment);
        return getAttachmentRemoveTarget({
          source: "conversation",
          entryIndex,
          attachment,
          attachmentIndex: originalIndex,
        });
      }),
    });

    removedAttachments.forEach((attachment, attachmentIndex) => {
      items.push({
        key: `conversation-removed-${entryIndex}-${attachmentIndex}`,
        type: "attachment_removed",
        title:
          attachment.removedScope === "tenant_only"
            ? "Attachment removed from tenant view"
            : "Attachment removed from request display",
        message: attachment.removedReason,
        actorName: attachment.removedByName || attachment.removedBy,
        actorRole: attachment.removedByRole,
        actorPrefix: "Removed by",
        timestamp: attachment.removedAt || entry.created_at,
        visibility: "admin",
        attachmentName: getMaintenanceAttachmentName(attachment, attachmentIndex),
        attachments: [],
        removed: true,
      });
    });
  });

  (request.workLog || []).forEach((entry, entryIndex) => {
    const activeAttachments = getActiveAttachments(entry.attachments);
    const title =
      entry.entry_type === "admin_proof" || activeAttachments.length > 0
        ? "Admin-only proof uploaded"
        : "Admin note added";
    items.push({
      key: `worklog-${entry.logged_at || entryIndex}-${entryIndex}`,
      type: entry.entry_type || "work_log",
      title,
      message: entry.note,
      actorName: entry.actor_name,
      actorRole: entry.actor_role,
      actorPrefix:
        entry.entry_type === "admin_proof" || activeAttachments.length > 0
          ? "Uploaded by"
          : "Updated by",
      timestamp: entry.logged_at,
      visibility: "admin",
      attachments: activeAttachments,
      attachmentTargets: activeAttachments.map((attachment) => {
        const originalIndex = (entry.attachments || []).indexOf(attachment);
        return getAttachmentRemoveTarget({
          source: "work_log",
          entryIndex,
          attachment,
          attachmentIndex: originalIndex,
        });
      }),
    });

    (entry.attachments || []).filter(isRemovedAttachment).forEach((attachment, attachmentIndex) => {
      items.push({
        key: `worklog-removed-${entryIndex}-${attachmentIndex}`,
        type: "attachment_removed",
        title: "Attachment removed from request display",
        message: attachment.removedReason,
        actorName: attachment.removedByName || attachment.removedBy,
        actorRole: attachment.removedByRole,
        actorPrefix: "Removed by",
        timestamp: attachment.removedAt || entry.logged_at,
        visibility: "admin",
        attachmentName: getMaintenanceAttachmentName(attachment, attachmentIndex),
        attachments: [],
        removed: true,
      });
    });
  });

  return items
    .filter((item) => item.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
};

export const REPORT_NA = "Not available";
export const cleanReportLine = (line) =>
  String(line || "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();

export const parseReportSummarySections = (summary, reportType = "admin") => {
  const sections = [];
  let current = { title: "Summary", rows: [] };

  getReportSummaryLines(summary).forEach((rawLine) => {
    const line = cleanReportLine(rawLine);
    if (!line) return;
    const isHeading = /^#{1,6}\s/.test(rawLine) || /^[A-Z][A-Za-z\s/]+:$/.test(line);
    if (isHeading && current.rows.length) {
      sections.push(current);
      current = { title: line.replace(/:$/, ""), rows: [] };
    } else if (isHeading) {
      current.title = line.replace(/:$/, "");
    } else {
      current.rows.push(line);
    }
  });

  if (current.rows.length) sections.push(current);

  const safeSections = sections.filter((section) => {
    if (reportType !== "tenant") return true;
    return !/internal|admin only|debug|backend|private staff|assignment note/i.test(section.title);
  });

  return safeSections.length ? safeSections : [{ title: "Summary", rows: [REPORT_NA] }];
};

export const getRequestReportMeta = (request) => {
  const branch = getRequestBranch(request);
  return {
    requestId: request?.request_id || REPORT_NA,
    tenantName: request?.tenant?.full_name || request?.tenantName || REPORT_NA,
    userId: request?.tenant?.user_id || request?.user_id || REPORT_NA,
    branch: branch ? formatBranchLabel(branch) : REPORT_NA,
    room: request?.roomName || request?.room || request?.roomNumber || request?.unit || REPORT_NA,
    requestType: request?.request_type ? getMaintenanceTypeMeta(request.request_type).label : REPORT_NA,
    urgency: request?.urgency ? getMaintenanceUrgencyMeta(request.urgency).label : REPORT_NA,
    status: request?.status ? formatMaintenanceStatus(request.status) : REPORT_NA,
    createdAt: request?.created_at ? fmtDateTime(request.created_at) : REPORT_NA,
    updatedAt: request?.updated_at ? fmtDateTime(request.updated_at) : REPORT_NA,
    description: request?.description || REPORT_NA,
  };
};

export const getReportTimelineRows = (request, reportType = "admin") =>
  buildMaintenanceTimeline(request)
    .filter((item) => reportType !== "tenant" || item.visibility === "tenant")
    .map((item) => {
      const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
      return [
        fmtDateTime(item.timestamp),
        item.actorName || REPORT_NA,
        item.title || REPORT_NA,
        item.message || item.meta || REPORT_NA,
        attachmentCount ? `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(" | ");
    });

export const getReportAttachmentsRows = (request, reportType = "admin") => {
  const attachments = getActiveAttachments(request?.attachments || []);
  if (!attachments.length) return [REPORT_NA];
  return attachments.map((attachment, index) =>
    `${index + 1}. ${getMaintenanceAttachmentName(attachment, index)} (${getMaintenanceAttachmentLabel(attachment)})`,
  );
};

export const getReportProviderRows = (request, reportType = "admin") => {
  const providerName = getAssignedProviderName(request);
  if (!providerName) return ["Assigned provider: Not assigned"];
  const rows = [
    `Assigned provider: ${providerName}`,
    `Service type: ${getAssignedProviderCategory(request) || REPORT_NA}`,
  ];
  if (reportType !== "tenant") {
    rows.push(`Contact: ${getAssignedProviderContact(request) || REPORT_NA}`);
    if (request?.assignedProviderNotes) rows.push(`Internal notes: ${request.assignedProviderNotes}`);
  }
  return rows;
};

export const getStructuredReportSections = (report, request) => {
  const reportType = report?.reportType || "admin";
  const summarySections = parseReportSummarySections(report?.summary, reportType);
  const timelineRows = getReportTimelineRows(request, reportType);
  const sections = [
    {
      title: "Issue Details",
      rows: [
        getRequestReportMeta(request).description,
        ...getReportAttachmentsRows(request, reportType).map((row) => `Attachment: ${row}`),
      ],
    },
    {
      title: "Service Provider Details",
      rows: getReportProviderRows(request, reportType),
    },
    {
      title: reportType === "tenant" ? "Tenant Visible Timeline" : "Maintenance Timeline / Status History",
      rows: timelineRows.length ? timelineRows : [REPORT_NA],
    },
    ...summarySections,
  ];

  if (reportType === "admin") {
    const internalRows = buildMaintenanceTimeline(request)
      .filter((item) => item.visibility !== "tenant")
      .map((item) => `${fmtDateTime(item.timestamp)} | ${item.title || REPORT_NA} | ${item.message || REPORT_NA}`);
    sections.push({
      title: "Admin Internal Updates",
      description: "Admin Only - confidential internal maintenance notes and staff activity.",
      rows: internalRows.length ? internalRows : [REPORT_NA],
    });
  }

  return sections;
};

export const formatMaintenanceCsvRows = (requests = []) =>
  requests.map((req) => ({
    "Request ID": req.request_id || req.requestId || "",
    Tenant: req.tenant?.full_name || req.tenantName || "",
    Branch: req.branch || "",
    Type: getMaintenanceTypeMeta(req.request_type || req.requestType).label,
    Urgency: getMaintenanceUrgencyMeta(req.urgency).label,
    Status: formatMaintenanceStatus(req.status),
    Submitted: req.created_at || req.createdAt || "",
  }));

export const exportCsvFile = (rows, filename = "download") => {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          const val = row[key] ?? "";
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

