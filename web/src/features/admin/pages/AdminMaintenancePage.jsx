import { useEffect, useMemo, useState } from "react";
import {
 AlertTriangle,
 Archive,
 CheckCircle2,
 ChevronDown,
 ChevronUp,
 ClipboardList,
 Clock3,
 FileDown,
 FileText,
 Image as ImageIcon,
 Lightbulb,
 MessageSquare,
 Paperclip,
 PhoneCall,
 RefreshCcw,
 RotateCcw,
 Search,
 ShieldCheck,
 Sparkles,
 UserRound,
 Wrench,
 XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
 useAdminMaintenanceRequests,
 useArchiveMaintenanceRequest,
 useAssignMaintenanceProvider,
 useGenerateMaintenanceUpdate,
 useMaintenanceRequest,
 useRemoveMaintenanceAttachment,
 useRestoreMaintenanceRequest,
 useSaveMaintenanceProof,
 useSendMaintenanceReply,
 useServiceProviders,
 useSuggestMaintenanceProvider,
 useUpdateMaintenanceRequest,
} from "../../../shared/hooks/queries/useMaintenance";
import { showNotification } from "../../../shared/utils/notification";
import {
 LOCKED_ADMIN_MAINTENANCE_STATUSES,
 MAINTENANCE_REQUEST_TYPES,
 MAINTENANCE_URGENCY_LEVELS,
 formatMaintenanceStatus,
 getAllowedAdminMaintenanceStatuses,
 getMaintenanceTypeMeta,
 getMaintenanceUrgencyMeta,
} from "../../../shared/utils/maintenanceConfig";
import {
 getMaintenanceAttachmentKind,
 getMaintenanceAttachmentLabel,
 getMaintenanceAttachmentName,
 getMaintenanceAttachmentUri,
 isViewableMaintenanceAttachmentUri,
 normalizeMaintenanceAttachments,
} from "../../../shared/utils/maintenanceAttachments";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { BRANCH_OPTIONS, BRANCH_DISPLAY_NAMES } from "../../../shared/utils/constants";
import { maintenanceApi } from "../../../shared/api/apiClient";
import {
 normalizeBranchFilterValue,
 syncBranchSearchParam,
} from "../../../shared/utils/branchFilterQuery.mjs";
import { DrawerSkeleton } from "../../../shared/components/LoadingSkeletons";
import {
 DataTable,
 DetailDrawer,
 PageShell,
 StatusBadge,
 SummaryBar,
} from "../components/shared";

const ITEMS_PER_PAGE = 10;
const MAX_MAINTENANCE_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const SUPPORTED_PROGRESS_ATTACHMENT_TYPES = new Set([
 "image/jpeg",
 "image/png",
 "image/webp",
 "image/heic",
 "image/heif",
 "application/pdf",
]);
const SUPPORTED_PROGRESS_ATTACHMENT_EXTENSIONS = new Set([
 ".jpg",
 ".jpeg",
 ".png",
 ".webp",
 ".heic",
 ".heif",
 ".pdf",
]);
const UPDATE_FIELD_ORDER = [
 "status",
 "notes",
 "assigned_to",
 "work_log_note",
 "attachments",
];
const REPLY_FIELD_ORDER = ["reply_message", "reply_attachments"];
const PROOF_FIELD_ORDER = ["proof_attachments", "proof_note"];
const ARCHIVE_FILTER_OPTIONS = [
 { key: "active", label: "Active" },
 { key: "archived", label: "Archived" },
 { key: "all", label: "All" },
];
const ATTACHMENT_REMOVAL_REASONS = [
 "Wrong file attached",
 "Duplicate attachment",
 "Sensitive information visible",
 "Blurry or unreadable file",
 "Attached to the wrong request",
 "Outdated file",
 "Uploaded by mistake",
 "Other",
];
const PROVIDER_MANUAL_CHOICE = "__manual__";
const PROVIDER_NONE_CHOICE = "";

const fmtDate = (value) => {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "Unknown date";
 return date.toLocaleDateString("en-PH", {
 year: "numeric",
 month: "short",
 day: "numeric",
 });
};

const fmtDateTime = (value) => {
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

const formatSlaState = (slaState) => {
 if (!slaState) return "No SLA";
 if (slaState.label === "delayed") return "Delayed";
 if (slaState.label === "priority") return "Priority";
 if (slaState.label === "closed") return "Closed";
 return "On Track";
};

const getSlaTone = (slaState) => {
 if (!slaState) {
 return { bg: "#E2E8F0", color: "#475569" };
 }
 if (slaState.label === "delayed") {
 return { bg: "#FEE2E2", color: "#DC2626" };
 }
 if (slaState.label === "priority") {
 return { bg: "#FEF3C7", color: "#D97706" };
 }
 if (slaState.label === "closed") {
 return { bg: "#DCFCE7", color: "#166534" };
 }
 return { bg: "#DBEAFE", color: "#2563EB" };
};

const urgencyRank = {
 high: 0,
 normal: 1,
 low: 2,
};

const TERMINAL_STATUSES = new Set([
 "resolved",
 "completed",
 "rejected",
 "cancelled",
 "closed",
]);

const SUMMARY_STATUSES = [
 { key: "pending", label: "Pending" },
 { key: "viewed", label: "Viewed" },
 { key: "in_progress", label: "In Progress" },
 { key: "resolved", label: "Resolved" },
 { key: "completed", label: "Completed" },
 { key: "rejected", label: "Rejected" },
 { key: "cancelled", label: "Cancelled" },
 { key: "closed", label: "Closed" },
];

const MANAGEMENT_SUMMARY_CARDS = [
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

const SLA_FILTER_OPTIONS = [
 { key: "all", label: "All SLA health" },
 { key: "on_track", label: "On Track" },
 { key: "priority", label: "Priority" },
 { key: "delayed", label: "Delayed" },
 { key: "closed", label: "Closed" },
 { key: "no_sla", label: "No SLA" },
];

const isNonTerminal = (status) => !TERMINAL_STATUSES.has(status);

const isWithinDateWindow = ({ value, dateFrom, dateTo }) => {
 if (!value) return false;
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return false;

 const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
 const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

 if (start && date < start) return false;
 if (end && date > end) return false;
 return true;
};

const isCompletedInWindow = ({ request, dateFrom, dateTo }) => {
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

const matchesSummaryCard = ({ request, cardKey, dateFrom, dateTo }) => {
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

const matchesSlaFilter = ({ request, slaFilter }) => {
 if (!slaFilter || slaFilter === "all") return true;
 if (slaFilter === "no_sla") return !request.slaState;
 if (slaFilter === "on_track") {
 return request.slaState?.label === "on_track" || !request.slaState?.label;
 }
 return request.slaState?.label === slaFilter;
};

const getStatusDotClass = (status) => {
 switch (status) {
 case "pending":
 return "bg-amber-300";
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

const getStatusTextClass = (status) => {
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

const ROLE_LABELS = {
 owner: "Dormitory Owner",
 admin: "Admin",
 branch_admin: "Branch Admin",
 maintenance_staff: "Maintenance Staff",
 staff: "Maintenance Staff",
 tenant: "Tenant",
 applicant: "Tenant",
};

const formatBranchLabel = (value) => {
 const branch = String(value || "").trim();
 if (!branch) return "Branch missing";
 return BRANCH_DISPLAY_NAMES[branch] || branch;
};

const getRequestBranch = (request) =>
 request?.branch || request?.tenant?.branch || "";

const getAssignedProviderName = (request) =>
 request?.assignedProvider?.name ||
 request?.assignedProviderName ||
 request?.assigned_to ||
 "";

const getAssignedProviderContact = (request) =>
 request?.assignedProvider?.contactNumber ||
 request?.assignedProviderContact ||
 "";

const getAssignedProviderCategory = (request) =>
 request?.assignedProvider?.category ||
 request?.assignedProviderCategory ||
 (request?.request_type ? getMaintenanceTypeMeta(request.request_type).label : "");

const getProviderBranchCoverageLabel = (provider) =>
 (provider?.branchCoverage || [])
 .map((branch) => BRANCH_DISPLAY_NAMES[branch] || branch)
 .filter(Boolean)
 .join(", ") || "No branch coverage";

const getProviderCategoryLabel = (provider) =>
 (provider?.serviceCategories || []).filter(Boolean).join(", ") || "No service category";

const BranchBadge = ({ branch }) => {
 const label = formatBranchLabel(branch);
 const isMissing = label === "Branch missing";

 return (
 <span
 className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
 isMissing
 ? "border-rose-200 bg-rose-50 text-rose-700"
 : "border-sky-200 bg-sky-50 text-sky-700"
 }`}
 >
 {label}
 </span>
 );
};

const BranchTableText = ({ branch }) => {
 const label = formatBranchLabel(branch);
 const isMissing = label === "Branch missing";

 return (
 <span className={isMissing ? "text-sm font-medium text-amber-700" : "text-sm text-card-foreground"}>
 {label}
 </span>
 );
};

const formatSenderLabel = ({ role, name, fallback = "Staff update" } = {}) => {
 const roleLabel = ROLE_LABELS[String(role || "").toLowerCase()] || "Staff";
 const displayName = String(name || "").trim();
 if (!displayName) return roleLabel || fallback;
 if (displayName.toLowerCase() === roleLabel.toLowerCase()) return displayName;
 return `${roleLabel} - ${displayName}`;
};

const createFilterPayload = ({
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

const AVATAR_PALETTES = [
  { bg: "bg-blue-700",    text: "text-white"    },
  { bg: "bg-emerald-700", text: "text-white"  },
  { bg: "bg-violet-700",  text: "text-white"   },
  { bg: "bg-rose-700",    text: "text-white"     },
  { bg: "bg-amber-700",   text: "text-white"    },
  { bg: "bg-cyan-700",    text: "text-white"     },
];

const getAvatarPalette = (name = "") => {
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
};

const isRemoteUri = (uri) => {
 return isViewableMaintenanceAttachmentUri(uri);
};

const getMaintenanceRequestUploadId = (request) =>
 request?.requestId ||
 request?.request_id ||
 request?.ticketId ||
 request?.maintenanceId ||
 request?.id ||
 request?._id ||
 "";

const getUploadedAttachmentUrl = (attachment = {}) =>
 attachment.url || attachment.downloadUrl || attachment.uri || "";

const buildUploadedAdminAttachment = ({ clientId, file, attachment = {} }) => {
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

const createAttachmentClientId = () =>
 `maintenance-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getAttachmentFileExtension = (file) => {
 const name = String(file?.name || "").toLowerCase();
 const dotIndex = name.lastIndexOf(".");
 return dotIndex >= 0 ? name.slice(dotIndex) : "";
};

const isSupportedProgressAttachmentFile = (file) => {
 const type = String(file?.type || "").toLowerCase();
 if (SUPPORTED_PROGRESS_ATTACHMENT_TYPES.has(type)) return true;

 return (!type || type === "application/octet-stream") &&
 SUPPORTED_PROGRESS_ATTACHMENT_EXTENSIONS.has(getAttachmentFileExtension(file));
};

const validateProgressAttachmentFile = (file) => {
 if (!file) return "No file selected.";
 if (!isSupportedProgressAttachmentFile(file)) {
 return "This file type is not supported. Please upload a JPEG, PNG, WebP, HEIC, HEIF, or PDF file.";
 }
 if (file.size > MAX_MAINTENANCE_ATTACHMENT_SIZE) {
 return "This file is too large. Please upload a file under 5 MB.";
 }
 return "";
};

const isUploadedWorkLogAttachment = (attachment) =>
 attachment?.uploadStatus === "uploaded" ||
 isRemoteUri(getMaintenanceAttachmentUri(attachment));

const isBlockingWorkLogAttachment = (attachment) =>
 ["uploading", "failed", "invalid"].includes(attachment?.uploadStatus) ||
 !isRemoteUri(getMaintenanceAttachmentUri(attachment));

const getWorkLogAttachmentKey = (attachment, index = 0) =>
 attachment?.clientId ||
 getMaintenanceAttachmentUri(attachment) ||
 `${attachment?.name || "attachment"}-${index}`;

const buildFieldClassName = (hasError, baseClassName) =>
 `${baseClassName} ${
 hasError
 ? "border-rose-500 focus:border-rose-500 focus:ring-rose-200"
 : "border-border focus:border-border focus:ring-border"
 }`;

const normalizeApiValidationDetail = (detail, index = 0) => {
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

const getMaintenanceApiValidationDetails = (error) => {
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

const getFirstFormError = (errors) =>
 Object.values(errors || {}).find(Boolean) || "";

const getMaintenanceApiErrorMessage = (error, fallback) =>
 getMaintenanceApiValidationDetails(error)[0]?.message ||
 error?.response?.data?.error?.message ||
 error?.response?.data?.message ||
 error?.message ||
 fallback;

const normalizeApiErrorField = (field) => String(field || "").toLowerCase().replace(/\[(\d+)\]/g, ".$1");

const getFormSummaryMessage = (errors, fallback) =>
 getFirstFormError(errors) || fallback;

const SectionBadge = ({ children, tone = "blue" }) => {
 const toneClass =
 tone === "amber"
 ? "border-amber-200 bg-amber-50 text-amber-700"
 : "border-sky-200 bg-sky-50 text-sky-700";

 return (
 <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${toneClass}`}>
 {children}
 </span>
 );
};

const mapMaintenanceApiErrors = (error, { scope = "progress" } = {}) => {
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

function AttachmentThumbnail({ attachment, index }) {
 const [failed, setFailed] = useState(false);
 const kind = getMaintenanceAttachmentKind(attachment);
 const name = getMaintenanceAttachmentName(attachment, index);
 const uri = getMaintenanceAttachmentUri(attachment);

 if (kind === "image" && !failed && isRemoteUri(uri)) {
 return (
 <img
 src={uri}
 alt={name}
 className="h-12 w-12 rounded-md object-cover"
 onError={() => setFailed(true)}
 />
 );
 }

 const Icon =
 kind === "pdf" ? FileText : kind === "image" ? ImageIcon : Paperclip;

 return (
 <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
 <Icon size={18} />
 </div>
 );
}

const isRemovedAttachment = (attachment) => Boolean(attachment?.isRemoved);

const getActiveAttachments = (attachments = []) =>
 Array.isArray(attachments)
 ? attachments.filter((attachment) => !isRemovedAttachment(attachment))
 : [];

const getAttachmentRemoveTarget = ({
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

const buildTimelineActor = ({
 role,
 name,
 fallback = "Unknown admin",
} = {}) => formatSenderLabel({ role, name, fallback });

const getStatusTimelineTitle = (entry = {}) => {
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

const getTimelineVisibility = (item = {}) =>
 item.visibility === "tenant" ? "Visible to Tenant" : "Admin Only";

const buildMaintenanceTimeline = (request) => {
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
 : ["archived", "restored"].includes(entry.event)
 ? "Updated by"
 : "Updated by",
 timestamp: entry.timestamp,
 visibility:
 ["archived", "restored", "admin_proof_uploaded", "attachment_removed_tenant", "attachment_removed_request", "note_updated", "service_provider_assigned", "service_provider_changed", "service_provider_unassigned"].includes(entry.event)
 ? "admin"
 : "tenant",
 meta: entry.status ? formatMaintenanceStatus(entry.status) : "",
 removedScope: entry.removedScope,
 attachmentName: entry.attachmentName,
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

function TimelineAttachmentList({
 attachments = [],
 targets = [],
 onRemove,
 canRemove = false,
 removed = false,
}) {
 if (!attachments.length) return null;

 return (
 <div className="mt-3 grid gap-3">
 {attachments.map((attachment, attachmentIndex) => {
 const attachmentUri = getMaintenanceAttachmentUri(attachment);
 const isViewable = isRemoteUri(attachmentUri) && !removed;
 const attachmentName = getMaintenanceAttachmentName(attachment, attachmentIndex);
 const key = `${attachment.id || attachmentUri || attachmentName}-${attachmentIndex}`;
 const content = (
 <>
 <AttachmentThumbnail attachment={attachment} index={attachmentIndex} />
 <div className="min-w-0 flex-1">
 <span className="block truncate text-sm font-medium text-card-foreground">
 {attachmentName}
 </span>
 <span className={removed ? "text-xs text-rose-600" : "text-xs text-muted-foreground"}>
 {removed ? "Attachment removed" : getMaintenanceAttachmentLabel(attachment)}
 </span>
 </div>
 </>
 );

 return (
 <div
 key={key}
 className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${removed ? "opacity-70" : ""}`}
 >
 {isViewable ? (
 <a
 href={attachmentUri}
 target="_blank"
 rel="noreferrer"
 className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
 >
 {content}
 </a>
 ) : (
 <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
 )}
 {canRemove && !removed ? (
 <button
 type="button"
 className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
 onClick={() => onRemove?.(targets[attachmentIndex])}
 >
 Remove Attachment
 </button>
 ) : null}
 </div>
 );
 })}
 </div>
 );
}

function MaintenanceTimeline({
 items = [],
 onRemoveAttachment,
 canRemoveAttachments = false,
}) {
 if (!items.length) {
 return (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Clock3 size={16} />
 No timeline entries recorded yet.
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {items.map((item) => (
 <article
 key={item.key}
 className="rounded-lg border border-border bg-card p-3"
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <strong className="block text-sm font-semibold text-card-foreground">
 {item.title}
 </strong>
 <span className="mt-1 block text-xs text-muted-foreground">
 {fmtDateTime(item.timestamp)}
 {item.meta ? ` - ${item.meta}` : ""}
 </span>
 </div>
 <SectionBadge tone={item.visibility === "tenant" ? "blue" : "amber"}>
 {getTimelineVisibility(item)}
 </SectionBadge>
 </div>
 <div className="mt-2 text-xs text-muted-foreground">
 {item.actorPrefix || "Updated by"}: {buildTimelineActor({
 role: item.actorRole,
 name: item.actorName,
 fallback: "Unknown admin",
 })}
 </div>
 {item.message ? (
 <p className="mt-2 text-sm text-muted-foreground">
 {item.type === "attachment_removed" ? `Reason: ${item.message}` : item.message}
 </p>
 ) : null}
 {item.attachmentName ? (
 <p className="mt-2 text-sm text-muted-foreground">File: {item.attachmentName}</p>
 ) : null}
 {item.providerName ? (
 <p className="mt-2 text-sm text-muted-foreground">Provider: {item.providerName}</p>
 ) : null}
 {item.previousProviderName ? (
 <p className="mt-1 text-sm text-muted-foreground">Previous provider: {item.previousProviderName}</p>
 ) : null}
 <TimelineAttachmentList
 attachments={item.attachments}
 targets={item.attachmentTargets}
 onRemove={onRemoveAttachment}
 canRemove={canRemoveAttachments}
 removed={item.removed}
 />
 </article>
 ))}
 </div>
 );
}

function ConfirmationModal({
 open,
 title,
 message,
 confirmLabel,
 confirmTone = "rose",
 isPending = false,
 onCancel,
 onConfirm,
}) {
 if (!open) return null;

 const confirmClassName =
 confirmTone === "emerald"
 ? "bg-emerald-600 text-white hover:bg-emerald-700"
 : "bg-rose-600 text-white hover:bg-rose-700";

 return (
 <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
 <section
 role="dialog"
 aria-modal="true"
 aria-labelledby="maintenance-confirm-title"
 className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
 >
 <h2 id="maintenance-confirm-title" className="text-lg font-semibold text-card-foreground">
 {title}
 </h2>
 <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
 <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
 onClick={onCancel}
 disabled={isPending}
 >
 Cancel
 </button>
 <button
 type="button"
 className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
 onClick={onConfirm}
 disabled={isPending}
 >
 {isPending ? "Working..." : confirmLabel}
 </button>
 </div>
 </section>
 </div>
 );
}

function AttachmentRemovalModal({
 open,
 scope,
 reason,
 customReason,
 error,
 isPending = false,
 onScopeChange,
 onReasonChange,
 onCustomReasonChange,
 onCancel,
 onConfirm,
}) {
 if (!open) return null;

 const hasScope = Boolean(scope);
 const hasReason = reason && (reason !== "Other" || Boolean(customReason.trim()));
 const canSubmit = hasScope && hasReason && !isPending;
 const options = [
 {
 value: "tenant_only",
 title: "Remove for Tenant",
 description:
 "The tenant will no longer be able to view or download this attachment. Admins can still see the removal record in the maintenance timeline.",
 },
 {
 value: "request",
 title: "Remove from Request",
 description:
 "This attachment will be hidden from normal admin and tenant attachment displays. A removal record will still remain in the admin timeline.",
 },
 ];

 return (
 <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
 <section
 role="dialog"
 aria-modal="true"
 aria-labelledby="maintenance-remove-attachment-title"
 className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
 >
 <h2 id="maintenance-remove-attachment-title" className="text-lg font-semibold text-card-foreground">
 Who should no longer see this attachment?
 </h2>

 <div className="mt-4 grid gap-3">
 {options.map((option) => {
 const selected = scope === option.value;
 return (
 <label
 key={option.value}
 className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
 selected
 ? "border-primary bg-primary/5 ring-2 ring-primary/20"
 : "border-border bg-card hover:bg-muted/50"
 }`}
 >
 <input
 type="radio"
 name="attachment-removal-scope"
 value={option.value}
 checked={selected}
 onChange={() => onScopeChange(option.value)}
 className="mt-1 h-4 w-4 accent-primary"
 disabled={isPending}
 />
 <span>
 <span className="block text-sm font-semibold text-card-foreground">{option.title}</span>
 <span className="mt-1 block text-sm leading-5 text-muted-foreground">
 {option.description}
 </span>
 </span>
 </label>
 );
 })}
 </div>

 <label className="mt-5 block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Reason for removal
 </span>
 <select
 value={reason}
 onChange={(event) => onReasonChange(event.target.value)}
 disabled={isPending}
 className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="">Select a reason</option>
 {ATTACHMENT_REMOVAL_REASONS.map((option) => (
 <option key={option} value={option}>
 {option}
 </option>
 ))}
 </select>
 </label>

 {reason === "Other" ? (
 <label className="mt-4 block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Please specify reason
 </span>
 <textarea
 rows="3"
 value={customReason}
 onChange={(event) => onCustomReasonChange(event.target.value)}
 disabled={isPending}
 className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
 placeholder="Enter a clear removal reason."
 />
 </label>
 ) : null}

 {error ? (
 <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {error}
 </div>
 ) : null}

 <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
 onClick={onCancel}
 disabled={isPending}
 >
 Cancel
 </button>
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
 onClick={onConfirm}
 disabled={!canSubmit}
 >
 {isPending ? "Removing..." : "Remove Attachment"}
 </button>
 </div>
 </section>
 </div>
 );
}

function ServiceProviderAssignmentPanel({
 request,
 providers = [],
 isLoadingProviders = false,
 selectedChoice,
 manualProvider,
 saveForFuture,
 fieldErrors = {},
 formMessage = "",
 suggestion = null,
 isAssigning = false,
 isSuggesting = false,
 disabled = false,
 onChoiceChange,
 onManualChange,
 onSaveForFutureChange,
 onAssign,
 onSuggest,
 onUseSuggestion,
}) {
 const currentName = getAssignedProviderName(request);
 const currentContact = getAssignedProviderContact(request);
 const currentCategory = getAssignedProviderCategory(request);
 const currentNotes =
 request?.assignedProvider?.notes ||
 request?.assignedProviderNotes ||
 "";
 const currentProviderId =
 request?.assignedProvider?.id ||
 request?.assignedProviderId ||
 "";
 const currentProviderSource =
 request?.assignedProvider?.source ||
 request?.assignedProviderSource ||
 (currentName ? (currentProviderId ? "directory" : "manual") : "none");
 const selectedProvider = providers.find((provider) => provider.id === selectedChoice);
 const showManualFields = selectedChoice === PROVIDER_MANUAL_CHOICE;
 const requestBranch = formatBranchLabel(getRequestBranch(request));
 const requestCategory = request?.request_type
 ? getMaintenanceTypeMeta(request.request_type).label
 : "Maintenance";
 const manualValuesChanged =
 manualProvider.providerName.trim() !== String(currentName || "").trim() ||
 manualProvider.contactNumber.trim() !== String(currentContact || "").trim() ||
 manualProvider.serviceType.trim() !== String(currentCategory || "").trim() ||
 manualProvider.notes.trim() !== String(currentNotes || "").trim();
 const hasAssignmentChanges =
 selectedChoice === PROVIDER_NONE_CHOICE
 ? Boolean(currentName || currentProviderId)
 : selectedChoice === PROVIDER_MANUAL_CHOICE
 ? currentProviderSource !== "manual" || manualValuesChanged || saveForFuture
 : selectedChoice !== currentProviderId ||
 currentProviderSource !== "directory" ||
 manualProvider.notes.trim() !== String(currentNotes || "").trim();

 return (
 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <PhoneCall size={14} />
 Assigned Service Provider
 <SectionBadge tone="amber">Admin Only</SectionBadge>
 </>
 )}
 >
 <p className="mb-4 text-sm text-muted-foreground">
 Provider details are internal. Tenants only see updates that admins send manually.
 </p>

 <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
 <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Current Assignment
 </div>
 {currentName ? (
 <div className="mt-2 space-y-1 text-card-foreground">
 <div className="font-semibold">{currentName}</div>
 {currentCategory ? <div className="text-xs text-muted-foreground">{currentCategory}</div> : null}
 {currentContact ? (
 <div className="text-xs text-muted-foreground">Contact: {currentContact}</div>
 ) : null}
 </div>
 ) : (
 <div className="mt-2 text-sm text-muted-foreground">Not assigned yet</div>
 )}
 </div>

 {formMessage ? (
 <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {formMessage}
 </div>
 ) : null}

 <div className="mt-4 grid gap-3">
 <label id="maintenance-update-field-assigned_to" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Choose Provider
 </span>
 <select
 value={selectedChoice}
 onChange={(event) => onChoiceChange(event.target.value)}
 disabled={disabled || isAssigning}
 aria-invalid={Boolean(fieldErrors.assigned_to)}
 className={buildFieldClassName(
 Boolean(fieldErrors.assigned_to),
 "mt-2 h-11 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 >
 <option value={PROVIDER_NONE_CHOICE}>Not assigned yet</option>
 {providers.map((provider) => (
 <option key={provider.id} value={provider.id}>
 {provider.providerName}
 </option>
 ))}
 <option value={PROVIDER_MANUAL_CHOICE}>Other / Manual Entry</option>
 </select>
 {fieldErrors.assigned_to ? (
 <p className="mt-1 text-xs text-rose-600">{fieldErrors.assigned_to}</p>
 ) : null}
 </label>

 {isLoadingProviders ? (
 <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
 Loading service providers...
 </div>
 ) : providers.length === 0 ? (
 <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-warning-dark">
 No matching service providers found for this branch and request type. Use Manual Entry.
 </div>
 ) : null}

 {selectedProvider ? (
 <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
 <div className="font-semibold text-card-foreground">{selectedProvider.providerName}</div>
 <div className="mt-1 text-xs text-muted-foreground">
 Category: {getProviderCategoryLabel(selectedProvider)}
 </div>
 <div className="text-xs text-muted-foreground">
 Branches: {getProviderBranchCoverageLabel(selectedProvider)}
 </div>
 <div className="text-xs text-muted-foreground">
 Contact: {selectedProvider.contactNumber}
 </div>
 {selectedProvider.notes ? (
 <div className="mt-2 text-xs text-muted-foreground">{selectedProvider.notes}</div>
 ) : null}
 </div>
 ) : null}

 {showManualFields ? (
 <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Provider Name
 </span>
 <input
 value={manualProvider.providerName}
 onChange={(event) => onManualChange("providerName", event.target.value)}
 disabled={disabled || isAssigning}
 className={buildFieldClassName(
 Boolean(fieldErrors.providerName),
 "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder="Provider or company name"
 />
 {fieldErrors.providerName ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.providerName}</p> : null}
 </label>
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Contact Number
 </span>
 <input
 value={manualProvider.contactNumber}
 onChange={(event) => onManualChange("contactNumber", event.target.value)}
 disabled={disabled || isAssigning}
 className={buildFieldClassName(
 Boolean(fieldErrors.contactNumber),
 "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder="09XXXXXXXXX"
 />
 {fieldErrors.contactNumber ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.contactNumber}</p> : null}
 </label>
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Service Type
 </span>
 <input
 value={manualProvider.serviceType}
 onChange={(event) => onManualChange("serviceType", event.target.value)}
 disabled={disabled || isAssigning}
 className={buildFieldClassName(
 Boolean(fieldErrors.serviceType),
 "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder={requestCategory}
 />
 {fieldErrors.serviceType ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.serviceType}</p> : null}
 </label>
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Notes
 </span>
 <textarea
 rows="3"
 value={manualProvider.notes}
 onChange={(event) => onManualChange("notes", event.target.value)}
 disabled={disabled || isAssigning}
 className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
 placeholder="Optional internal provider notes"
 />
 </label>
 <label className="flex items-start gap-2 text-sm text-muted-foreground">
 <input
 type="checkbox"
 checked={saveForFuture}
 onChange={(event) => onSaveForFutureChange(event.target.checked)}
 disabled={disabled || isAssigning}
 className="mt-1 h-4 w-4 accent-primary"
 />
 <span>Save this provider for future use in {requestBranch} {requestCategory} requests.</span>
 </label>
 </div>
 ) : null}

 {suggestion ? (
 <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
 {suggestion.recommendedProviderName ? (
 <>
 <div className="font-semibold">Suggested: {suggestion.recommendedProviderName}</div>
 <div className="mt-1">{suggestion.reason}</div>
 <button
 type="button"
 className="mt-2 text-xs font-semibold text-sky-900 underline"
 onClick={() => onUseSuggestion(suggestion.recommendedProviderId)}
 disabled={disabled || isAssigning}
 >
 Use suggestion
 </button>
 </>
 ) : (
 suggestion.message || "No matching saved providers found for this branch and request type."
 )}
 </div>
 ) : null}

 <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
 AI suggestions are based on saved maintenance records and provider directory. Please review before confirming.
 </div>

 <div className="flex flex-wrap justify-end gap-2">
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-60"
 onClick={onSuggest}
 disabled={disabled || isSuggesting || isAssigning}
 >
 <Lightbulb size={14} />
 {isSuggesting ? "Suggesting..." : "Suggest Provider"}
 </button>
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60"
 style={{
 backgroundColor: "var(--primary)",
 color: "var(--primary-foreground)",
 }}
 onClick={onAssign}
 disabled={disabled || isAssigning || !hasAssignmentChanges}
 title={!hasAssignmentChanges ? "No assignment changes to save." : undefined}
 >
 {isAssigning ? "Saving..." : "Save Assignment"}
 </button>
 </div>
 </div>
 </DetailDrawer.Section>
 </div>
 );
}

export default function AdminMaintenancePage() {
 const { user } = useAuth();
 const isOwner = user?.role === "owner";
 const [searchParams, setSearchParams] = useSearchParams();

 const [statusFilter, setStatusFilter] = useState("all");
 const [archiveView, setArchiveView] = useState("active");
 const [requestTypeFilter, setRequestTypeFilter] = useState("all");
 const [urgencyFilter, setUrgencyFilter] = useState("all");
 const [slaFilter, setSlaFilter] = useState("all");
 const [dateFrom, setDateFrom] = useState("");
 const [dateTo, setDateTo] = useState("");
 const requestedBranch = searchParams.get("branch");
 const [branchFilter, setBranchFilter] = useState(() =>
 normalizeBranchFilterValue({
 requestedBranch: isOwner ? requestedBranch : null,
 allValue: "all",
 }),
 );
 const [sortMode, setSortMode] = useState("newest");
 const [searchQuery, setSearchQuery] = useState("");
 const [summaryCardKey, setSummaryCardKey] = useState(null);
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const [selectedRequestId, setSelectedRequestId] = useState(null);
 const [draftStatus, setDraftStatus] = useState("viewed");
 const [draftNotes, setDraftNotes] = useState("");
 const [providerChoice, setProviderChoice] = useState(PROVIDER_NONE_CHOICE);
 const [manualProvider, setManualProvider] = useState({
 providerName: "",
 contactNumber: "",
 serviceType: "",
 notes: "",
 });
 const [saveManualProviderForFuture, setSaveManualProviderForFuture] = useState(false);
 const [providerFieldErrors, setProviderFieldErrors] = useState({});
 const [providerFormMessage, setProviderFormMessage] = useState("");
 const [providerSuggestion, setProviderSuggestion] = useState(null);
 const [draftWorkLogNote, setDraftWorkLogNote] = useState("");
 const [draftWorkLogAttachments, setDraftWorkLogAttachments] = useState([]);
 const [uploadingUpdateAttachment, setUploadingUpdateAttachment] = useState(false);
 const [updateFieldErrors, setUpdateFieldErrors] = useState({});
 const [updateFormMessage, setUpdateFormMessage] = useState("");
 const [replyMessage, setReplyMessage] = useState("");
 const [replyAttachments, setReplyAttachments] = useState([]);
 const [uploadingReplyAttachment, setUploadingReplyAttachment] = useState(false);
 const [replyFieldErrors, setReplyFieldErrors] = useState({});
 const [replyFormMessage, setReplyFormMessage] = useState("");
 const [proofNote, setProofNote] = useState("");
 const [proofAttachments, setProofAttachments] = useState([]);
 const [uploadingProofAttachment, setUploadingProofAttachment] = useState(false);
 const [proofFieldErrors, setProofFieldErrors] = useState({});
 const [proofFormMessage, setProofFormMessage] = useState("");
 const [archiveDialogMode, setArchiveDialogMode] = useState(null);
 const [attachmentRemovalDialog, setAttachmentRemovalDialog] = useState({
 open: false,
 target: null,
 scope: "",
 reason: "",
 customReason: "",
 error: "",
 });

 const listFilters = useMemo(
 () =>
 createFilterPayload({
 status: statusFilter,
 requestType: requestTypeFilter,
 urgency: urgencyFilter,
 dateFrom,
 dateTo,
 branch: isOwner ? branchFilter : null,
 archiveView,
 }),
 [
 archiveView,
 branchFilter,
 dateFrom,
 dateTo,
 isOwner,
 requestTypeFilter,
 statusFilter,
 urgencyFilter,
 ],
 );

 const summaryFilters = useMemo(
 () =>
 createFilterPayload({
 requestType: requestTypeFilter,
 urgency: urgencyFilter,
 dateFrom,
 dateTo,
 branch: isOwner ? branchFilter : null,
 archiveView,
 }),
 [archiveView, branchFilter, dateFrom, dateTo, isOwner, requestTypeFilter, urgencyFilter],
 );

 const {
 data: requestsData,
 isLoading,
 isError,
 error,
 } = useAdminMaintenanceRequests(listFilters);
 const { data: summaryData } = useAdminMaintenanceRequests(summaryFilters);
 const {
 data: requestDetailData,
 isLoading: isDetailLoading,
 } = useMaintenanceRequest(selectedRequestId);
 const updateRequestMutation = useUpdateMaintenanceRequest();
 const sendReplyMutation = useSendMaintenanceReply();
 const saveProofMutation = useSaveMaintenanceProof();
 const removeAttachmentMutation = useRemoveMaintenanceAttachment();
 const archiveRequestMutation = useArchiveMaintenanceRequest();
 const restoreRequestMutation = useRestoreMaintenanceRequest();
 const assignProviderMutation = useAssignMaintenanceProvider();
 const generateUpdateMutation = useGenerateMaintenanceUpdate();
 const suggestProviderMutation = useSuggestMaintenanceProvider();

 const requests = requestsData?.requests || [];
 const summaryRequests = summaryData?.requests || requests;
 const selectedRequest = requestDetailData?.request || null;
 const providerFilters = useMemo(() => {
 if (!selectedRequest) return {};
 const branchId = getRequestBranch(selectedRequest);
 const category = selectedRequest.request_type
 ? getMaintenanceTypeMeta(selectedRequest.request_type).label
 : "";
 return {
 branchId,
 category,
 };
 }, [selectedRequest]);
 const {
 data: providerData,
 isLoading: isLoadingProviders,
 } = useServiceProviders(providerFilters, {
 enabled: Boolean(selectedRequest && getRequestBranch(selectedRequest)),
 });
 const serviceProviders = providerData?.providers || [];
 const selectedRequestStatusOptions = useMemo(
 () => getAllowedAdminMaintenanceStatuses(selectedRequest?.status),
 [selectedRequest?.status],
 );
 const isSelectedRequestLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(
 selectedRequest?.status || "",
 );
 const hasDraftChanges = Boolean(selectedRequest) && (
 draftStatus !== (selectedRequest.status || "") ||
 draftNotes.trim() !== String(selectedRequest.notes || "").trim() ||
 Boolean(draftWorkLogNote.trim()) ||
 draftWorkLogAttachments.length > 0
 );
 const hasBlockingWorkLogAttachment = draftWorkLogAttachments.some(
 isBlockingWorkLogAttachment,
 );
 const hasBlockingReplyAttachment = replyAttachments.some(
 isBlockingWorkLogAttachment,
 );
 const hasBlockingProofAttachment = proofAttachments.some(
 isBlockingWorkLogAttachment,
 );
 const timelineItems = useMemo(
 () => buildMaintenanceTimeline(selectedRequest),
 [selectedRequest],
 );

 const summaryItems = useMemo(
 () =>
 MANAGEMENT_SUMMARY_CARDS.map((item) => ({
 ...item,
 value: summaryRequests.filter((request) =>
 matchesSummaryCard({
 request,
 cardKey: item.key,
 dateFrom,
 dateTo,
 }),
 ).length,
 trend: item.description,
 })),
 [dateFrom, dateTo, summaryRequests],
 );

 const activeSummaryIndex = MANAGEMENT_SUMMARY_CARDS.findIndex(
 (item) => item.key === summaryCardKey,
 );

 const sortedRequests = useMemo(() => {
 const nextRequests = [...requests];

 nextRequests.sort((left, right) => {
 if (sortMode === "urgency") {
 const urgencyDelta =
 (urgencyRank[left.urgency] ?? 99) - (urgencyRank[right.urgency] ?? 99);
 if (urgencyDelta !== 0) return urgencyDelta;
 }

 return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
 });

 return nextRequests;
 }, [requests, sortMode]);

 const searchedRequests = useMemo(() => {
 const query = searchQuery.trim().toLowerCase();
 if (!query) return sortedRequests;

 return sortedRequests.filter((request) => {
 const haystack = [
 request.request_id,
 request.description,
 getAssignedProviderName(request),
 request.user_id,
 request.tenant?.user_id,
 request.tenant?.full_name,
 request.tenant?.branch,
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();

 return haystack.includes(query);
 });
 }, [searchQuery, sortedRequests]);

 const filteredRequests = useMemo(
 () =>
 searchedRequests.filter(
 (request) =>
 matchesSlaFilter({ request, slaFilter }) &&
 matchesSummaryCard({
 request,
 cardKey: summaryCardKey,
 dateFrom,
 dateTo,
 }),
 ),
 [dateFrom, dateTo, searchedRequests, slaFilter, summaryCardKey],
 );

 const activeFilterChips = useMemo(() => {
 const chips = [];

 if (statusFilter !== "all") {
 chips.push({
 key: `status-${statusFilter}`,
 label: `Status: ${formatMaintenanceStatus(statusFilter)}`,
 });
 }

 if (archiveView !== "active") {
 const archiveLabel =
 ARCHIVE_FILTER_OPTIONS.find((item) => item.key === archiveView)?.label ||
 archiveView;
 chips.push({
 key: `archive-${archiveView}`,
 label: `View: ${archiveLabel}`,
 });
 }

 if (requestTypeFilter !== "all") {
 chips.push({
 key: `type-${requestTypeFilter}`,
 label: `Type: ${getMaintenanceTypeMeta(requestTypeFilter).label}`,
 });
 }

 if (urgencyFilter !== "all") {
 chips.push({
 key: `urgency-${urgencyFilter}`,
 label: `Urgency: ${getMaintenanceUrgencyMeta(urgencyFilter).label}`,
 });
 }

 if (slaFilter !== "all") {
 const slaLabel =
 SLA_FILTER_OPTIONS.find((item) => item.key === slaFilter)?.label ||
 slaFilter;

 chips.push({
 key: `sla-${slaFilter}`,
 label: `SLA Health: ${slaLabel}`,
 });
 }

 if (dateFrom) {
 chips.push({
 key: `from-${dateFrom}`,
 label: `From: ${fmtDate(dateFrom)}`,
 });
 }

 if (dateTo) {
 chips.push({
 key: `to-${dateTo}`,
 label: `To: ${fmtDate(dateTo)}`,
 });
 }

 if (isOwner && branchFilter !== "all") {
 chips.push({
 key: `branch-${branchFilter}`,
 label: `Branch: ${BRANCH_DISPLAY_NAMES[branchFilter] || branchFilter}`,
 });
 }

 if (sortMode === "urgency") {
 chips.push({
 key: "sort-urgency",
 label: "Sort: Urgency high first",
 });
 }

 if (searchQuery.trim()) {
 chips.push({
 key: "search",
 label: `Search: ${searchQuery.trim()}`,
 });
 }

 if (summaryCardKey) {
 const selectedCard = MANAGEMENT_SUMMARY_CARDS.find(
 (item) => item.key === summaryCardKey,
 );

 if (selectedCard) {
 chips.push({
 key: `summary-${summaryCardKey}`,
 label: `Summary: ${selectedCard.label}`,
 });
 }
 }

 return chips;
 }, [
 archiveView,
 branchFilter,
 dateFrom,
 dateTo,
 isOwner,
 requestTypeFilter,
 searchQuery,
 slaFilter,
 summaryCardKey,
 sortMode,
 statusFilter,
 urgencyFilter,
 ]);

 useEffect(() => {
 setCurrentPage(1);
 }, [
 archiveView,
 branchFilter,
 dateFrom,
 dateTo,
 requestTypeFilter,
 slaFilter,
 sortMode,
 statusFilter,
 urgencyFilter,
 ]);

 useEffect(() => {
 const nextBranch = normalizeBranchFilterValue({
 requestedBranch: isOwner ? requestedBranch : null,
 allValue: "all",
 });

 setBranchFilter((current) => (current === nextBranch ? current : nextBranch));
 }, [isOwner, requestedBranch]);

 useEffect(() => {
 if (!user?.role) return;

 const nextParams = syncBranchSearchParam(searchParams, branchFilter, {
 enabled: isOwner,
 allValue: "all",
 });

 if (nextParams.toString() === searchParams.toString()) return;
 setSearchParams(nextParams, { replace: true });
 }, [branchFilter, isOwner, searchParams, setSearchParams, user?.role]);

 useEffect(() => {
 if (!selectedRequest) return;

 const initialStatus =
 selectedRequest.status ||
 selectedRequestStatusOptions[0] ||
 "viewed";

 setDraftStatus(initialStatus);
 setDraftNotes(selectedRequest.notes || "");
 const assignedProviderId =
 selectedRequest.assignedProvider?.id ||
 selectedRequest.assignedProviderId ||
 "";
 const assignedProviderSource =
 selectedRequest.assignedProvider?.source ||
 selectedRequest.assignedProviderSource ||
 "";
 const hasAssignedProviderName = Boolean(getAssignedProviderName(selectedRequest));
 setProviderChoice(
 assignedProviderSource === "manual" || (!assignedProviderId && hasAssignedProviderName)
 ? PROVIDER_MANUAL_CHOICE
 : assignedProviderId || PROVIDER_NONE_CHOICE,
 );
 setManualProvider({
 providerName: getAssignedProviderName(selectedRequest),
 contactNumber: getAssignedProviderContact(selectedRequest),
 serviceType: getAssignedProviderCategory(selectedRequest),
 notes:
 selectedRequest.assignedProvider?.notes ||
 selectedRequest.assignedProviderNotes ||
 "",
 });
 setSaveManualProviderForFuture(false);
 setProviderFieldErrors({});
 setProviderFormMessage("");
 setProviderSuggestion(null);
 setDraftWorkLogNote("");
 setDraftWorkLogAttachments([]);
 setUpdateFieldErrors({});
 setUpdateFormMessage("");
 setReplyMessage("");
 setReplyAttachments([]);
 setReplyFieldErrors({});
 setReplyFormMessage("");
 setProofNote("");
 setProofAttachments([]);
 setProofFieldErrors({});
 setProofFormMessage("");
 setArchiveDialogMode(null);
 setAttachmentRemovalDialog({
 open: false,
 target: null,
 scope: "",
 reason: "",
 customReason: "",
 error: "",
 });
 }, [selectedRequest, selectedRequestStatusOptions]);

 const clearUpdateFieldError = (field) => {
 setUpdateFieldErrors((current) => {
 if (!current[field]) return current;
 const next = { ...current };
 delete next[field];
 return next;
 });
 if (updateFormMessage) setUpdateFormMessage("");
 };

 const clearReplyFieldError = (field) => {
 setReplyFieldErrors((current) => {
 if (!current[field]) return current;
 const next = { ...current };
 delete next[field];
 return next;
 });
 if (replyFormMessage) setReplyFormMessage("");
 };

 const clearProofFieldError = (field) => {
 setProofFieldErrors((current) => {
 if (!current[field]) return current;
 const next = { ...current };
 delete next[field];
 return next;
 });
 if (proofFormMessage) setProofFormMessage("");
 };

 const scrollToFirstUpdateError = (errors) => {
 const firstField = UPDATE_FIELD_ORDER.find((field) => errors[field]);
 if (!firstField) return;

 window.setTimeout(() => {
 const fieldNode = document.getElementById(`maintenance-update-field-${firstField}`);
 if (!fieldNode) return;
 fieldNode.scrollIntoView({ behavior: "smooth", block: "center" });
 const focusTarget = fieldNode.matches?.("input,select,textarea,button")
 ? fieldNode
 : fieldNode.querySelector("input,select,textarea,button");
 focusTarget?.focus?.({ preventScroll: true });
 }, 0);
 };

 const scrollToFirstReplyError = (errors) => {
 const firstField = REPLY_FIELD_ORDER.find((field) => errors[field]);
 if (!firstField) return;

 window.setTimeout(() => {
 const fieldNode = document.getElementById(`maintenance-reply-field-${firstField}`);
 if (!fieldNode) return;
 fieldNode.scrollIntoView({ behavior: "smooth", block: "center" });
 const focusTarget = fieldNode.matches?.("input,select,textarea,button")
 ? fieldNode
 : fieldNode.querySelector("input,select,textarea,button");
 focusTarget?.focus?.({ preventScroll: true });
 }, 0);
 };

 const scrollToFirstProofError = (errors) => {
 const firstField = PROOF_FIELD_ORDER.find((field) => errors[field]);
 if (!firstField) return;

 window.setTimeout(() => {
 const fieldNode = document.getElementById(`maintenance-proof-field-${firstField}`);
 if (!fieldNode) return;
 fieldNode.scrollIntoView({ behavior: "smooth", block: "center" });
 const focusTarget = fieldNode.matches?.("input,select,textarea,button")
 ? fieldNode
 : fieldNode.querySelector("input,select,textarea,button");
 focusTarget?.focus?.({ preventScroll: true });
 }, 0);
 };

 const validateMaintenanceUpdateForm = () => {
 const errors = {};
 const allowedStatuses = new Set(selectedRequestStatusOptions);
 const normalizedStatus = String(draftStatus || "").trim();
 const assignedTo = getAssignedProviderName(selectedRequest);

 if (!normalizedStatus || !allowedStatuses.has(normalizedStatus)) {
 errors.status = "Please choose a valid status for this request.";
 }

 if (normalizedStatus === "in_progress" && !assignedTo) {
 errors.assigned_to = "Please assign a service provider before marking this request as In Progress.";
 }

 if (
 ["resolved", "completed"].includes(normalizedStatus) &&
 !draftNotes.trim() &&
 !draftWorkLogNote.trim()
 ) {
 errors.notes = "Please add resolution notes or a completion work log before marking this request as Resolved.";
 }

 if (uploadingUpdateAttachment) {
 errors.attachments = "Please wait until the attachment finishes uploading.";
 } else if (
 draftWorkLogAttachments.some((attachment) => attachment.uploadStatus === "failed")
 ) {
 errors.attachments = "Attachment upload failed. Please try again.";
 } else if (
 draftWorkLogAttachments.some((attachment) => attachment.uploadStatus === "invalid")
 ) {
 errors.attachments = "Please remove the invalid attachment before saving.";
 } else if (
 draftWorkLogAttachments.some((attachment) => !isUploadedWorkLogAttachment(attachment))
 ) {
 errors.attachments = "Please remove the invalid attachment before saving.";
 }

 return errors;
 };

 const handleWorkLogAttachmentUpload = async (event) => {
 const files = Array.from(event.target.files || []).filter(Boolean);
 if (files.length === 0) return;

 clearUpdateFieldError("attachments");
 const maintenanceRequestId = getMaintenanceRequestUploadId(selectedRequest);
 if (!maintenanceRequestId) {
 const message = "Failed to upload attachment. Please try again.";
 setUpdateFieldErrors((current) => ({ ...current, attachments: message }));
 showNotification(message, "error");
 event.target.value = "";
 return;
 }
 setUploadingUpdateAttachment(true);

 try {
 for (const file of files) {
 const clientId = createAttachmentClientId();
 const validationMessage = validateProgressAttachmentFile(file);

 if (validationMessage) {
 setDraftWorkLogAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "invalid",
 error: validationMessage,
 },
 ]);
 setUpdateFieldErrors((current) => ({
 ...current,
 attachments: validationMessage,
 }));
 continue;
 }

 setDraftWorkLogAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "uploading",
 },
 ]);

 try {
 const uploadResult = await maintenanceApi.uploadAdminMaintenanceAttachment(
 maintenanceRequestId,
 file,
 { visibility: "admin_only" },
 );
 const uploadedAttachment = uploadResult?.attachment || uploadResult;
 setDraftWorkLogAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? buildUploadedAdminAttachment({ clientId, file, attachment: uploadedAttachment })
 : attachment,
 ),
 );
 showNotification("Upload complete.", "success");
 } catch (uploadError) {
 const message = getMaintenanceApiErrorMessage(
 uploadError,
 "Failed to upload attachment. Please try again.",
 );
 setDraftWorkLogAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? {
 ...attachment,
 uploadStatus: "failed",
 error: message,
 }
 : attachment,
 ),
 );
 setUpdateFieldErrors((current) => ({
 ...current,
 attachments: message,
 }));
 showNotification(message, "error");
 }
 }
 } catch {
 showNotification(
 "Failed to upload attachment. Please try again.",
 "error",
 );
 } finally {
 setUploadingUpdateAttachment(false);
 event.target.value = "";
 }
 };

 const handleRemoveWorkLogAttachment = (attachmentKey) => {
 setDraftWorkLogAttachments((current) => {
 const next = current.filter(
 (attachment, index) =>
 getWorkLogAttachmentKey(attachment, index) !== attachmentKey,
 );
 const stillBlocked = next.some(isBlockingWorkLogAttachment);
 setUpdateFieldErrors((errors) => {
 if (stillBlocked) return errors;
 const nextErrors = { ...errors };
 delete nextErrors.attachments;
 return nextErrors;
 });
 if (!stillBlocked && updateFormMessage) setUpdateFormMessage("");
 return next;
 });
 };

 const handleReplyAttachmentUpload = async (event) => {
 const files = Array.from(event.target.files || []).filter(Boolean);
 if (files.length === 0) return;

 clearReplyFieldError("reply_attachments");
 const maintenanceRequestId = getMaintenanceRequestUploadId(selectedRequest);
 if (!maintenanceRequestId) {
 const message = "Failed to upload attachment. Please try again.";
 setReplyFieldErrors((current) => ({ ...current, reply_attachments: message }));
 showNotification(message, "error");
 event.target.value = "";
 return;
 }
 setUploadingReplyAttachment(true);

 try {
 for (const file of files) {
 const clientId = createAttachmentClientId();
 const validationMessage = validateProgressAttachmentFile(file);

 if (validationMessage) {
 setReplyAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "invalid",
 error: validationMessage,
 },
 ]);
 setReplyFieldErrors((current) => ({
 ...current,
 reply_attachments: validationMessage,
 }));
 continue;
 }

 setReplyAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "uploading",
 },
 ]);

 try {
 const uploadResult = await maintenanceApi.uploadAdminMaintenanceAttachment(
 maintenanceRequestId,
 file,
 { visibility: "tenant_visible" },
 );
 const uploadedAttachment = uploadResult?.attachment || uploadResult;
 setReplyAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? buildUploadedAdminAttachment({ clientId, file, attachment: uploadedAttachment })
 : attachment,
 ),
 );
 showNotification("Upload complete.", "success");
 } catch (uploadError) {
 const message = getMaintenanceApiErrorMessage(
 uploadError,
 "Failed to upload attachment. Please try again.",
 );
 setReplyAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? {
 ...attachment,
 uploadStatus: "failed",
 error: message,
 }
 : attachment,
 ),
 );
 setReplyFieldErrors((current) => ({
 ...current,
 reply_attachments: message,
 }));
 showNotification(message, "error");
 }
 }
 } catch {
 showNotification(
 "Failed to upload attachment. Please try again.",
 "error",
 );
 } finally {
 setUploadingReplyAttachment(false);
 event.target.value = "";
 }
 };

 const handleRemoveReplyAttachment = (attachmentKey) => {
 setReplyAttachments((current) => {
 const next = current.filter(
 (attachment, index) =>
 getWorkLogAttachmentKey(attachment, index) !== attachmentKey,
 );
 const stillBlocked = next.some(isBlockingWorkLogAttachment);
 setReplyFieldErrors((errors) => {
 if (stillBlocked) return errors;
 const nextErrors = { ...errors };
 delete nextErrors.reply_attachments;
 return nextErrors;
 });
 if (!stillBlocked && replyFormMessage) setReplyFormMessage("");
 return next;
 });
 };

 const handleProofAttachmentUpload = async (event) => {
 const files = Array.from(event.target.files || []).filter(Boolean);
 if (files.length === 0) return;

 clearProofFieldError("proof_attachments");
 const maintenanceRequestId = getMaintenanceRequestUploadId(selectedRequest);
 if (!maintenanceRequestId) {
 const message = "Failed to upload attachment. Please try again.";
 setProofFieldErrors((current) => ({ ...current, proof_attachments: message }));
 showNotification(message, "error");
 event.target.value = "";
 return;
 }
 setUploadingProofAttachment(true);

 try {
 for (const file of files) {
 const clientId = createAttachmentClientId();
 const validationMessage = validateProgressAttachmentFile(file);

 if (validationMessage) {
 setProofAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "invalid",
 error: validationMessage,
 },
 ]);
 setProofFieldErrors((current) => ({
 ...current,
 proof_attachments: validationMessage,
 }));
 continue;
 }

 setProofAttachments((current) => [
 ...current,
 {
 clientId,
 name: file.name,
 type: file.type || "application/octet-stream",
 uploadStatus: "uploading",
 },
 ]);

 try {
 const uploadResult = await maintenanceApi.uploadAdminMaintenanceAttachment(
 maintenanceRequestId,
 file,
 { visibility: "admin_only" },
 );
 const uploadedAttachment = uploadResult?.attachment || uploadResult;
 setProofAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? buildUploadedAdminAttachment({ clientId, file, attachment: uploadedAttachment })
 : attachment,
 ),
 );
 showNotification("Upload complete.", "success");
 } catch (uploadError) {
 const message = getMaintenanceApiErrorMessage(
 uploadError,
 "Failed to upload attachment. Please try again.",
 );
 setProofAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? {
 ...attachment,
 uploadStatus: "failed",
 error: message,
 }
 : attachment,
 ),
 );
 setProofFieldErrors((current) => ({
 ...current,
 proof_attachments: message,
 }));
 showNotification(message, "error");
 }
 }
 } finally {
 setUploadingProofAttachment(false);
 event.target.value = "";
 }
 };

 const handleRemoveProofAttachment = (attachmentKey) => {
 setProofAttachments((current) => {
 const next = current.filter(
 (attachment, index) =>
 getWorkLogAttachmentKey(attachment, index) !== attachmentKey,
 );
 const stillBlocked = next.some(isBlockingWorkLogAttachment);
 setProofFieldErrors((errors) => {
 if (stillBlocked) return errors;
 const nextErrors = { ...errors };
 delete nextErrors.proof_attachments;
 return nextErrors;
 });
 if (!stillBlocked && proofFormMessage) setProofFormMessage("");
 return next;
 });
 };

 const validateProofForm = () => {
 const errors = {};
 if (uploadingProofAttachment) {
 errors.proof_attachments = "Please wait until the proof file finishes uploading.";
 } else if (proofAttachments.some((attachment) => attachment.uploadStatus === "failed")) {
 errors.proof_attachments = "Attachment upload failed. Please try again.";
 } else if (proofAttachments.some((attachment) => attachment.uploadStatus === "invalid")) {
 errors.proof_attachments = "Please remove the invalid attachment before saving.";
 } else if (proofAttachments.some((attachment) => !isUploadedWorkLogAttachment(attachment))) {
 errors.proof_attachments = "Please remove the invalid attachment before saving.";
 } else if (proofAttachments.length === 0) {
 errors.proof_attachments = "Please upload a proof attachment before saving.";
 }
 return errors;
 };

 const handleSaveProof = async (event) => {
 event.preventDefault();
 if (!selectedRequest) return;

 const validationErrors = validateProofForm();
 if (Object.keys(validationErrors).length > 0) {
 const summaryMessage = getFormSummaryMessage(
 validationErrors,
 "Please fix the highlighted fields before saving proof.",
 );
 setProofFieldErrors(validationErrors);
 setProofFormMessage(summaryMessage);
 scrollToFirstProofError(validationErrors);
 showNotification(summaryMessage, "error");
 return;
 }

 const attachments = normalizeMaintenanceAttachments(proofAttachments)
 .filter((attachment) => isRemoteUri(getMaintenanceAttachmentUri(attachment)));

 try {
 await saveProofMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {
 note: proofNote,
 attachments,
 },
 });
 showNotification("Admin-only proof saved.", "success");
 setProofNote("");
 setProofAttachments([]);
 setProofFieldErrors({});
 setProofFormMessage("");
 } catch (submitError) {
 const message = getMaintenanceApiErrorMessage(
 submitError,
 "Failed to save proof.",
 );
 setProofFormMessage(message);
 showNotification(message, "error");
 }
 };

 const handleArchiveRequest = async () => {
 if (!selectedRequest) return;
 setArchiveDialogMode("archive");
 };

 const handleRestoreRequest = async () => {
 if (!selectedRequest) return;
 setArchiveDialogMode("restore");
 };

 const handleConfirmArchiveAction = async () => {
 if (!selectedRequest || !archiveDialogMode) return;
 const isRestore = archiveDialogMode === "restore";

 try {
 if (isRestore) {
 await restoreRequestMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {},
 });
 showNotification("Maintenance request restored.", "success");
 setArchiveView("active");
 } else {
 await archiveRequestMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {},
 });
 showNotification("Maintenance request archived.", "success");
 setArchiveView("archived");
 }
 setArchiveDialogMode(null);
 } catch (archiveError) {
 showNotification(
 getMaintenanceApiErrorMessage(
 archiveError,
 isRestore ? "Failed to restore request." : "Failed to archive request.",
 ),
 "error",
 );
 }
 };

 const handleRemoveSavedAttachment = (target) => {
 if (!selectedRequest || !target) return;
 setAttachmentRemovalDialog({
 open: true,
 target,
 scope: "",
 reason: "",
 customReason: "",
 error: "",
 });
 };

 const handleCloseAttachmentRemovalDialog = () => {
 if (removeAttachmentMutation.isPending) return;
 setAttachmentRemovalDialog({
 open: false,
 target: null,
 scope: "",
 reason: "",
 customReason: "",
 error: "",
 });
 };

 const handleSubmitAttachmentRemoval = async () => {
 if (!selectedRequest || !attachmentRemovalDialog.target) return;
 const scope = attachmentRemovalDialog.scope;
 const selectedReason = attachmentRemovalDialog.reason;
 const customReason = attachmentRemovalDialog.customReason.trim();
 const reason = selectedReason === "Other" ? customReason : selectedReason;

 if (!scope) {
 setAttachmentRemovalDialog((current) => ({
 ...current,
 error: "Please choose who should no longer see this attachment.",
 }));
 return;
 }

 if (!reason) {
 setAttachmentRemovalDialog((current) => ({
 ...current,
 error: "Please select a reason for removing this attachment.",
 }));
 return;
 }

 try {
 await removeAttachmentMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {
 ...attachmentRemovalDialog.target,
 scope,
 removedReason: reason,
 },
 });
 showNotification("Attachment removed.", "success");
 setAttachmentRemovalDialog({
 open: false,
 target: null,
 scope: "",
 reason: "",
 customReason: "",
 error: "",
 });
 } catch (removeError) {
 const errorMessage = getMaintenanceApiErrorMessage(
 removeError,
 "Failed to remove attachment.",
 );
 setAttachmentRemovalDialog((current) => ({ ...current, error: errorMessage }));
 showNotification(
 errorMessage,
 "error",
 );
 }
 };

 const handleResetFilters = () => {
 setStatusFilter("all");
 setArchiveView("active");
 setRequestTypeFilter("all");
 setUrgencyFilter("all");
 setSlaFilter("all");
 setDateFrom("");
 setDateTo("");
 setBranchFilter("all");
 setSortMode("newest");
 setSearchQuery("");
 setSummaryCardKey(null);
 setShowAdvancedFilters(false);
 };

 const handleExport = () => {
 exportToCSV(
 filteredRequests.map((request) => ({
 requestId: request.request_id,
 tenantName: request.tenant?.full_name || "Unknown Tenant",
 branch: getRequestBranch(request),
 requestType: getMaintenanceTypeMeta(request.request_type).label,
 urgency: getMaintenanceUrgencyMeta(request.urgency).label,
 status: formatMaintenanceStatus(request.status),
 sla: formatSlaState(request.slaState),
 assignedTo: getAssignedProviderName(request) || "Unassigned",
 createdAt: fmtDateTime(request.created_at),
 updatedAt: fmtDateTime(request.updated_at),
 })),
 [
 { key: "requestId", label: "Request ID" },
 { key: "tenantName", label: "Tenant" },
 { key: "branch", label: "Branch" },
 { key: "requestType", label: "Request Type" },
 { key: "urgency", label: "Urgency" },
 { key: "status", label: "Status" },
 { key: "sla", label: "SLA State" },
 { key: "assignedTo", label: "Assigned Service Provider" },
 { key: "createdAt", label: "Created At" },
 { key: "updatedAt", label: "Updated At" },
 ],
 "maintenance-requests",
 );
 };

 const clearProviderFieldError = (field) => {
 setProviderFieldErrors((current) => {
 if (!current[field]) return current;
 const next = { ...current };
 delete next[field];
 return next;
 });
 if (providerFormMessage) setProviderFormMessage("");
 };

 const handleProviderChoiceChange = (choice) => {
 setProviderChoice(choice);
 setProviderSuggestion(null);
 setProviderFieldErrors({});
 setProviderFormMessage("");
 clearUpdateFieldError("assigned_to");
 if (choice === PROVIDER_MANUAL_CHOICE && !manualProvider.serviceType) {
 setManualProvider((current) => ({
 ...current,
 serviceType: selectedRequest?.request_type
 ? getMaintenanceTypeMeta(selectedRequest.request_type).label
 : current.serviceType,
 }));
 }
 };

 const handleManualProviderChange = (field, value) => {
 setManualProvider((current) => ({ ...current, [field]: value }));
 clearProviderFieldError(field);
 clearProviderFieldError("assigned_to");
 };

 const validateProviderAssignment = () => {
 const errors = {};
 if (providerChoice === PROVIDER_MANUAL_CHOICE) {
 if (!manualProvider.providerName.trim()) {
 errors.providerName = "Provider name is required.";
 }
 if (!manualProvider.contactNumber.trim()) {
 errors.contactNumber = "Contact number is required.";
 }
 if (!manualProvider.serviceType.trim()) {
 errors.serviceType = "Service type is required.";
 }
 return errors;
 }

 if (providerChoice && !serviceProviders.some((provider) => provider.id === providerChoice)) {
 errors.assigned_to = "Please select an available saved service provider.";
 }

 return errors;
 };

 const handleAssignProvider = async () => {
 if (!selectedRequest) return;
 if (
 providerChoice === PROVIDER_NONE_CHOICE &&
 !getAssignedProviderName(selectedRequest) &&
 !selectedRequest.assignedProviderId &&
 !selectedRequest.assignedProvider?.id
 ) {
 showNotification("No service provider is assigned yet.", "info");
 return;
 }
 const validationErrors = validateProviderAssignment();
 if (Object.keys(validationErrors).length > 0) {
 const message = getFormSummaryMessage(
 validationErrors,
 "Please complete the service provider assignment.",
 );
 setProviderFieldErrors(validationErrors);
 setProviderFormMessage(message);
 showNotification(message, "error");
 return;
 }

 const payload =
 providerChoice === PROVIDER_NONE_CHOICE
 ? { providerSource: "none" }
 : providerChoice === PROVIDER_MANUAL_CHOICE
 ? {
 providerSource: "manual",
 providerName: manualProvider.providerName.trim(),
 contactNumber: manualProvider.contactNumber.trim(),
 serviceType: manualProvider.serviceType.trim(),
 notes: manualProvider.notes.trim(),
 saveForFuture: saveManualProviderForFuture,
 }
 : {
 providerSource: "directory",
 providerId: providerChoice,
 notes: manualProvider.notes.trim(),
 };

 try {
 await assignProviderMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload,
 });
 setProviderFieldErrors({});
 setProviderFormMessage("");
 setProviderSuggestion(null);
 showNotification("Service provider assignment saved.", "success");
 } catch (assignmentError) {
 const mappedErrors = mapMaintenanceApiErrors(assignmentError);
 const message = getMaintenanceApiErrorMessage(
 assignmentError,
 "Failed to assign service provider.",
 );
 setProviderFieldErrors(mappedErrors);
 setProviderFormMessage(message);
 showNotification(message, "error");
 }
 };

 const handleSuggestProvider = async () => {
 if (!selectedRequest) return;
 setProviderSuggestion(null);
 try {
 const suggestion = await suggestProviderMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 });
 setProviderSuggestion(suggestion);
 if (suggestion?.recommendedProviderName) {
 showNotification("Service provider suggestion ready.", "success");
 } else {
 showNotification(
 suggestion?.message || "No matching saved providers found for this branch and request type.",
 "info",
 );
 }
 } catch (suggestError) {
 const message = getMaintenanceApiErrorMessage(
 suggestError,
 "Failed to suggest a service provider.",
 );
 setProviderFormMessage(message);
 showNotification(message, "error");
 }
 };

 const handleUseSuggestedProvider = (providerId) => {
 if (!providerId) return;
 setProviderChoice(providerId);
 setProviderFieldErrors({});
 setProviderFormMessage("");
 };

 const handleGenerateUpdate = async () => {
 if (!selectedRequest) return;
 try {
 const result = await generateUpdateMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 });
 if (result?.unavailable) {
 showNotification(result.draft || "AI drafting is currently unavailable.", "info");
 return;
 }
 if (result?.draft) {
 setReplyMessage(result.draft);
 clearReplyFieldError("reply_message");
 showNotification("AI draft generated. Please review before sending.", "success");
 }
 } catch (generateError) {
 const message = getMaintenanceApiErrorMessage(
 generateError,
 "AI drafting is currently unavailable. Please write the update manually.",
 );
 showNotification(message, "error");
 }
 };

 const handleSummaryFilter = (index) => {
 if (index === -1) {
 setSummaryCardKey(null);
 return;
 }
 const item = MANAGEMENT_SUMMARY_CARDS[index];
 if (!item) return;
 setSummaryCardKey(item.key);
 };

 const handleSubmitUpdate = async (event) => {
 event.preventDefault();
 if (!selectedRequest) return;

 const validationErrors = validateMaintenanceUpdateForm();
 if (Object.keys(validationErrors).length > 0) {
 const summaryMessage = getFormSummaryMessage(
 validationErrors,
 "Please fix the highlighted fields before saving.",
 );
 setUpdateFieldErrors(validationErrors);
 setUpdateFormMessage(summaryMessage);
 scrollToFirstUpdateError(validationErrors);
 showNotification(summaryMessage, "error");
 return;
 }

 const workLogAttachments = normalizeMaintenanceAttachments(draftWorkLogAttachments)
 .filter((attachment) => isRemoteUri(getMaintenanceAttachmentUri(attachment)));

 if (draftWorkLogAttachments.length > 0 && workLogAttachments.length !== draftWorkLogAttachments.length) {
 const nextErrors = {
 attachments: "Please remove the invalid attachment before saving.",
 };
 const summaryMessage = getFormSummaryMessage(
 nextErrors,
 "Please fix the highlighted fields before saving.",
 );
 setUpdateFieldErrors(nextErrors);
 setUpdateFormMessage(summaryMessage);
 scrollToFirstUpdateError(nextErrors);
 showNotification(summaryMessage, "error");
 return;
 }

 try {
 await updateRequestMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {
 status: draftStatus,
 notes: draftNotes,
 work_log_note: draftWorkLogNote,
 work_log_attachments: workLogAttachments,
 },
 });
 showNotification("Maintenance request updated.", "success");
 setDraftWorkLogNote("");
 setDraftWorkLogAttachments([]);
 setUpdateFieldErrors({});
 setUpdateFormMessage("");
 } catch (submitError) {
 const mappedErrors = mapMaintenanceApiErrors(submitError);
 const hasMappedErrors = Object.keys(mappedErrors).length > 0;
 const errorSummary = getMaintenanceApiErrorMessage(
 submitError,
 "Failed to update maintenance request.",
 );
 if (hasMappedErrors) {
 setUpdateFieldErrors(mappedErrors);
 setUpdateFormMessage(errorSummary);
 scrollToFirstUpdateError(mappedErrors);
 } else {
 setUpdateFormMessage(errorSummary);
 }
 showNotification(errorSummary, "error");
 }
 };

 const validateReplyForm = () => {
 const errors = {};

 if (uploadingReplyAttachment) {
 errors.reply_attachments = "Please wait until the attachment finishes uploading.";
 } else if (replyAttachments.some((attachment) => attachment.uploadStatus === "failed")) {
 errors.reply_attachments = "Attachment upload failed. Please try again.";
 } else if (replyAttachments.some((attachment) => attachment.uploadStatus === "invalid")) {
 errors.reply_attachments = "Please remove the invalid attachment before sending.";
 } else if (replyAttachments.some((attachment) => !isUploadedWorkLogAttachment(attachment))) {
 errors.reply_attachments = "Please remove the invalid attachment before sending.";
 }

 if (!replyMessage.trim() && replyAttachments.length === 0) {
 errors.reply_message = "Please enter a message or attach a file before sending.";
 }

 return errors;
 };

 const handleSendReply = async (event) => {
 event.preventDefault();
 if (!selectedRequest) return;

 const validationErrors = validateReplyForm();
 if (Object.keys(validationErrors).length > 0) {
 const summaryMessage = getFormSummaryMessage(
 validationErrors,
 "Please fix the highlighted fields before sending.",
 );
 setReplyFieldErrors(validationErrors);
 setReplyFormMessage(summaryMessage);
 scrollToFirstReplyError(validationErrors);
 showNotification(summaryMessage, "error");
 return;
 }

 const uploadedReplyAttachments = normalizeMaintenanceAttachments(replyAttachments)
 .filter((attachment) => isRemoteUri(getMaintenanceAttachmentUri(attachment)));

 if (replyAttachments.length > 0 && uploadedReplyAttachments.length !== replyAttachments.length) {
 const nextErrors = {
 reply_attachments: "Please remove the invalid attachment before sending.",
 };
 const summaryMessage = getFormSummaryMessage(
 nextErrors,
 "Please fix the highlighted fields before sending.",
 );
 setReplyFieldErrors(nextErrors);
 setReplyFormMessage(summaryMessage);
 scrollToFirstReplyError(nextErrors);
 showNotification(summaryMessage, "error");
 return;
 }

 try {
 await sendReplyMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {
 message: replyMessage.trim(),
 attachments: uploadedReplyAttachments,
 },
 });
 showNotification("Update sent to tenant.", "success");
 setReplyMessage("");
 setReplyAttachments([]);
 setReplyFieldErrors({});
 setReplyFormMessage("");
 } catch (submitError) {
 const mappedErrors = mapMaintenanceApiErrors(submitError, { scope: "reply" });
 const hasMappedErrors = Object.keys(mappedErrors).length > 0;
 const errorSummary = getMaintenanceApiErrorMessage(
 submitError,
 "Failed to send update.",
 );
 if (hasMappedErrors) {
 setReplyFieldErrors(mappedErrors);
 setReplyFormMessage(errorSummary);
 scrollToFirstReplyError(mappedErrors);
 } else {
 setReplyFormMessage(errorSummary);
 }
 showNotification(errorSummary, "error");
 }
 };

 const columns = useMemo(
 () => [
 {
 key: "tenant",
 label: "Tenant",
 render: (row) => (
 <div className="flex items-center gap-3">
 <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${getAvatarPalette(row.tenant?.full_name).bg} ${getAvatarPalette(row.tenant?.full_name).text}`}>
 {(row.tenant?.full_name || "T")
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((part) => part[0])
 .join("")
 .toUpperCase()}
 </div>
 <div>
 <div className="text-sm font-semibold text-card-foreground">
 {row.tenant?.full_name || "Unknown Tenant"}
 </div>
 <div className="text-xs text-muted-foreground">
 {row.tenant?.user_id || row.user_id}
 </div>
 </div>
 </div>
 ),
 },
 {
 key: "branch",
 label: "Branch",
 render: (row) => <BranchTableText branch={getRequestBranch(row)} />,
 },
 {
 key: "request_type",
 label: "Type",
 render: (row) => {
 const typeMeta = getMaintenanceTypeMeta(row.request_type);
 const TypeIcon = typeMeta.icon;

 return (
 <div className="flex items-center gap-3">
 <span
 className="flex h-9 w-9 items-center justify-center rounded-lg"
 style={{
 backgroundColor: `${typeMeta.color}1A`,
 color: typeMeta.color,
 }}
 >
 <TypeIcon size={16} />
 </span>
 <div>
 <div className="text-sm font-semibold text-card-foreground">{typeMeta.label}</div>
 <div className="text-xs text-muted-foreground">
 {row.attachments?.length || 0} attachment
 {(row.attachments?.length || 0) === 1 ? "" : "s"}
 </div>
 </div>
 </div>
 );
 },
 },
 {
 key: "description",
 label: "Description",
 render: (row) => (
 <div>
 <div className="max-w-[240px] truncate text-sm text-muted-foreground">
 {row.description}
 </div>
 <div className="text-xs text-muted-foreground">{row.request_id}</div>
 </div>
 ),
 },
 {
 key: "urgency",
 label: "Urgency",
 render: (row) => {
 const urgencyMeta = getMaintenanceUrgencyMeta(row.urgency);
 return (
 <span
 className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
 style={{
 backgroundColor: `${urgencyMeta.color}1A`,
 color: urgencyMeta.color,
 }}
 >
 {urgencyMeta.label}
 </span>
 );
 },
 },
 {
 key: "status",
 label: "Status",
 render: (row) => (
 <div className={`flex items-center gap-2 text-[13px] font-medium ${getStatusTextClass(row.status)}`}>
 <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(row.status)}`} />
 <span>{formatMaintenanceStatus(row.status)}</span>
 </div>
 ),
 },
 {
 key: "sla",
 label: "SLA Health",
 render: (row) => (
 <span
 className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
 style={{
 background: getSlaTone(row.slaState).bg,
 color: getSlaTone(row.slaState).color,
 }}
 >
 {formatSlaState(row.slaState)}
 </span>
 ),
 },
 {
 key: "assigned_to",
 label: "Assigned Service Provider",
 render: (row) => getAssignedProviderName(row) || "Unassigned",
 },
 {
 key: "created_at",
 label: "Date",
 sortable: true,
 render: (row) => fmtDate(row.created_at),
 },
 ],
 [],
 );

 return (
 <div>
 <PageShell>
 <PageShell.Summary>
 <div>
 <div className="mb-4">
 <h1 className="mb-1 text-2xl font-semibold text-foreground">Maintenance</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Manage tenant repair requests, service provider assignments, and tenant updates.
 </p>
 </div>
 <SummaryBar
 items={summaryItems}
 activeIndex={activeSummaryIndex}
 onItemClick={(index) => handleSummaryFilter(index)}
 />
 </div>
 </PageShell.Summary>

 <PageShell.Actions>
 <section className="mt-5 rounded-xl border border-border bg-card px-5 py-5">
 <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
 Find requests quickly
 </h2>

 <div className="mt-4 flex flex-wrap items-end gap-3">
 <label className="relative min-w-[280px] flex-[2_1_420px]">
 <span className="sr-only">Search</span>
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <input
 type="search"
 placeholder="Search tenant, ID, assignment, or description"
 value={searchQuery}
 onChange={(event) => setSearchQuery(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-muted-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 />
 </label>

 <label className="min-w-[180px] flex-1">
 <span className="sr-only">Status</span>
 <select
 value={statusFilter}
 onChange={(event) => setStatusFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="all">All statuses</option>
 {SUMMARY_STATUSES.map((item) => (
 <option key={item.key} value={item.key}>
 {item.label}
 </option>
 ))}
 </select>
 </label>

 <label className="min-w-[160px] flex-1">
 <span className="sr-only">Archive View</span>
 <select
 value={archiveView}
 onChange={(event) => setArchiveView(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 {ARCHIVE_FILTER_OPTIONS.map((option) => (
 <option key={option.key} value={option.key}>
 {option.label}
 </option>
 ))}
 </select>
 </label>

 {isOwner ? (
 <label className="min-w-[170px] flex-1">
 <span className="sr-only">Branch</span>
 <select
 value={branchFilter}
 onChange={(event) => setBranchFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="all">All Branches</option>
 {BRANCH_OPTIONS.map((branch) => (
 <option key={branch.value} value={branch.value}>
 {branch.label}
 </option>
 ))}
 </select>
 </label>
 ) : null}

 <label className="min-w-[180px] flex-1">
 <span className="sr-only">Urgency</span>
 <select
 value={urgencyFilter}
 onChange={(event) => setUrgencyFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="all">All urgency levels</option>
 {MAINTENANCE_URGENCY_LEVELS.map((urgency) => (
 <option key={urgency} value={urgency}>
 {getMaintenanceUrgencyMeta(urgency).label}
 </option>
 ))}
 </select>
 </label>

 <label className="min-w-[180px] flex-1">
 <span className="sr-only">SLA Health</span>
 <select
 value={slaFilter}
 onChange={(event) => setSlaFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 {SLA_FILTER_OPTIONS.map((option) => (
 <option key={option.key} value={option.key}>
 {option.label}
 </option>
 ))}
 </select>
 </label>

 <div className="ml-auto flex flex-wrap items-center gap-2">
 <button
 type="button"
 className="inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-card-foreground hover:bg-muted"
 onClick={() => setShowAdvancedFilters((current) => !current)}
 aria-expanded={showAdvancedFilters}
 >
 {showAdvancedFilters ? (
 <>
 <ChevronUp size={14} />
 Less Filters
 </>
 ) : (
 <>
 <ChevronDown size={14} />
 More Filters
 </>
 )}
 </button>

 <button
 type="button"
 className="inline-flex h-10 min-w-[130px] items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-card-foreground hover:bg-muted"
 onClick={handleExport}
 disabled={filteredRequests.length === 0}
 >
 <FileDown size={14} />
 Export CSV
 </button>

 <button
 type="button"
 className="inline-flex h-10 min-w-[130px] items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-card-foreground"
 onClick={handleResetFilters}
 >
 Reset Filters
 </button>
 </div>

 </div>

 {showAdvancedFilters ? (
 <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
 <label className="xl:col-span-3">
 <span className="sr-only">Request Type</span>
 <select
 value={requestTypeFilter}
 onChange={(event) => setRequestTypeFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="all">All request types</option>
 {MAINTENANCE_REQUEST_TYPES.map((requestType) => (
 <option key={requestType} value={requestType}>
 {getMaintenanceTypeMeta(requestType).label}
 </option>
 ))}
 </select>
 </label>

 <label className="xl:col-span-2">
 <span className="sr-only">Date From</span>
 <input
 type="date"
 value={dateFrom}
 onChange={(event) => setDateFrom(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 />
 </label>

 <label className="xl:col-span-2">
 <span className="sr-only">Date To</span>
 <input
 type="date"
 value={dateTo}
 onChange={(event) => setDateTo(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 />
 </label>

 <label className="xl:col-span-2">
 <span className="sr-only">Sort By</span>
 <select
 value={sortMode}
 onChange={(event) => setSortMode(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="newest">Newest first</option>
 <option value="urgency">Urgency high first</option>
 </select>
 </label>
 </div>
 ) : null}

 <div className="mt-4 text-sm text-muted-foreground">
 Showing {filteredRequests.length} of {summaryRequests.length} requests
 </div>

 {activeFilterChips.length ? (
 <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
 {activeFilterChips.map((chip) => (
 <span
 key={chip.key}
 className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
 >
 {chip.label}
 </span>
 ))}
 </div>
 ) : null}

 <div className="mt-4 border-t border-border pt-4">
 <div className="overflow-hidden rounded-lg border border-border">
 <DataTable
 columns={columns}
 data={filteredRequests}
 loading={isLoading}
 onRowClick={(row) => setSelectedRequestId(row.request_id)}
 pagination={{
 page: currentPage,
 pageSize: ITEMS_PER_PAGE,
 total: filteredRequests.length,
 onPageChange: setCurrentPage,
 }}
 emptyState={
 isError
 ? {
 icon: AlertTriangle,
 title: "Unable to load maintenance requests",
 description:
 error?.message ||
 "The maintenance workspace could not be loaded.",
 }
 : {
 icon: Wrench,
 title: "No maintenance requests found",
 description:
 "Adjust filters or search terms, or wait for new tenant requests.",
 }
 }
 />
 </div>
 </div>
 </section>
 </PageShell.Actions>

 <PageShell.Content>
 <DetailDrawer
 width={1200}
 open={Boolean(selectedRequestId)}
 onClose={() => setSelectedRequestId(null)}
 title="Maintenance Request"
 subtitle={selectedRequest ? `Request #${selectedRequest.request_id}` : ""}
 footer={
 selectedRequest ? (
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 {selectedRequest.isArchived ? (
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
 onClick={handleRestoreRequest}
 disabled={restoreRequestMutation.isPending}
 >
 <RotateCcw size={14} />
 {restoreRequestMutation.isPending ? "Restoring..." : "Restore"}
 </button>
 ) : (
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 px-4 text-sm font-medium text-amber-700 hover:bg-amber-50"
 onClick={handleArchiveRequest}
 disabled={archiveRequestMutation.isPending}
 >
 <Archive size={14} />
 {archiveRequestMutation.isPending ? "Archiving..." : "Archive"}
 </button>
 )}
 </div>
 <div className="flex items-center gap-3">
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium text-muted-foreground hover:bg-muted"
 onClick={() => setSelectedRequestId(null)}
 >
 Close
 </button>
 <button
 type="submit"
 form="maintenance-admin-form"
 className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm hover:opacity-90"
 style={{
   backgroundColor: "var(--primary)",
   color: "var(--primary-foreground)",
 }}
 disabled={
 updateRequestMutation.isPending ||
 uploadingUpdateAttachment ||
 hasBlockingWorkLogAttachment ||
 isSelectedRequestLocked ||
 selectedRequest.isArchived ||
 !hasDraftChanges
 }
 >
 {updateRequestMutation.isPending ? "Saving..." : "Save Admin Note"}
 </button>
 </div>
 </div>
 ) : null
 }
 >
 {isDetailLoading || !selectedRequest ? (
 <div className="px-6 py-6">
 <DrawerSkeleton rows={4} />
 </div>
 ) : (
 <div>
 <div className="grid gap-6 lg:grid-cols-3">
 <div className="space-y-6 lg:col-span-2">
 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <ClipboardList size={14} />
 Request Overview
 </>
 )}
 >
 <DetailDrawer.Row label="Tenant">
 <span className="flex items-center gap-2 text-sm font-medium text-card-foreground">
 <UserRound size={14} className="text-muted-foreground" />
 <span>{selectedRequest.tenant?.full_name || "Unknown Tenant"}</span>
 </span>
 </DetailDrawer.Row>
 <DetailDrawer.Row
 label="User ID"
 value={selectedRequest.tenant?.user_id || selectedRequest.user_id}
 />
 <DetailDrawer.Row
 label="Branch"
 >
 <BranchBadge branch={getRequestBranch(selectedRequest)} />
 </DetailDrawer.Row>
 <DetailDrawer.Row label="Request Type">
 {getMaintenanceTypeMeta(selectedRequest.request_type).label}
 </DetailDrawer.Row>
 <DetailDrawer.Row label="Urgency">
 <span
 className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
 style={{
 backgroundColor: `${getMaintenanceUrgencyMeta(selectedRequest.urgency).color}1A`,
 color: getMaintenanceUrgencyMeta(selectedRequest.urgency).color,
 }}
 >
 {getMaintenanceUrgencyMeta(selectedRequest.urgency).label}
 </span>
 </DetailDrawer.Row>
 <DetailDrawer.Row label="Status">
 <StatusBadge status={selectedRequest.status} />
 </DetailDrawer.Row>
 <DetailDrawer.Row label="Created At" value={fmtDateTime(selectedRequest.created_at)} />
 <DetailDrawer.Row label="Updated At" value={fmtDateTime(selectedRequest.updated_at)} />
 <DetailDrawer.Row label="SLA">
 <span
 style={{
 display: "inline-flex",
 alignItems: "center",
 gap: 6,
 padding: "6px 12px",
 borderRadius: 999,
 background: getSlaTone(selectedRequest.slaState).bg,
 color: getSlaTone(selectedRequest.slaState).color,
 fontSize: 12,
 fontWeight: 700,
 }}
 >
 {formatSlaState(selectedRequest.slaState)}
 </span>
 </DetailDrawer.Row>
 <DetailDrawer.Row
 label="Target Resolution"
 value={
 selectedRequest.slaState?.targetAt
 ? fmtDateTime(selectedRequest.slaState.targetAt)
 : "Not set"
 }
 />
 <DetailDrawer.Row
 label="Assigned At"
 value={
 selectedRequest.assignment?.assignedAt
 ? fmtDateTime(selectedRequest.assignment.assignedAt)
 : "Not assigned"
 }
 />
 <DetailDrawer.Row
 label="Started At"
 value={
 selectedRequest.assignment?.startedAt
 ? fmtDateTime(selectedRequest.assignment.startedAt)
 : "Not started"
 }
 />
 <DetailDrawer.Row
 label="Resolved At"
 value={
 selectedRequest.assignment?.resolvedAt
 ? fmtDateTime(selectedRequest.assignment.resolvedAt)
 : "Not resolved"
 }
 />
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <Clock3 size={14} />
 Maintenance Timeline
 </>
 )}
 >
 {!selectedRequest.isArchived ? (
 <form
 className="mb-5 rounded-lg border border-dashed border-border bg-muted/30 p-4"
 onSubmit={handleSaveProof}
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
 <ShieldCheck size={16} className="text-muted-foreground" />
 Add Admin-only Proof
 </div>
 <p className="mt-1 text-xs text-muted-foreground">
 Upload inspection photos or PDFs that should stay in the admin timeline.
 </p>
 </div>
 <SectionBadge tone="amber">Admin Only</SectionBadge>
 </div>

 {proofFormMessage ? (
 <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {proofFormMessage}
 </div>
 ) : null}

 {isSelectedRequestLocked ? (
 <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 Closed and cancelled requests are locked records. Admin-only proof upload is disabled.
 </div>
 ) : null}

 <label id="maintenance-proof-field-proof_note" className="mt-4 block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Optional Note
 </span>
 <textarea
 rows="3"
 placeholder="Add context for this proof."
 value={proofNote}
 onChange={(event) => {
 setProofNote(event.target.value);
 clearProofFieldError("proof_note");
 }}
 disabled={isSelectedRequestLocked || saveProofMutation.isPending}
 aria-invalid={Boolean(proofFieldErrors.proof_note)}
 className={buildFieldClassName(
 Boolean(proofFieldErrors.proof_note),
 "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
 )}
 />
 {proofFieldErrors.proof_note ? (
 <p className="mt-1 text-xs text-rose-600">{proofFieldErrors.proof_note}</p>
 ) : null}
 </label>

 <label id="maintenance-proof-field-proof_attachments" className="mt-4 block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Proof Attachment
 </span>
 <div
 className={`mt-2 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
 proofFieldErrors.proof_attachments ? "border-rose-500" : "border-transparent"
 }`}
 >
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted">
 <Paperclip size={14} />
 {uploadingProofAttachment ? "Uploading..." : "Upload proof file"}
 <input
 type="file"
 hidden
 multiple
 accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
 onChange={handleProofAttachmentUpload}
 disabled={
 isSelectedRequestLocked ||
 uploadingProofAttachment ||
 saveProofMutation.isPending
 }
 />
 </label>
 <span className="text-xs text-muted-foreground">
 Photo, PDF, or file saved here stays Admin Only.
 </span>
 </div>
 {proofFieldErrors.proof_attachments ? (
 <p className="mt-1 text-xs text-rose-600">{proofFieldErrors.proof_attachments}</p>
 ) : null}

 {proofAttachments.length ? (
 <div className="mt-3 grid gap-2">
 {proofAttachments.map((attachment, index) => {
 const attachmentKey = getWorkLogAttachmentKey(attachment, index);
 const uploadStatus = attachment.uploadStatus || "uploaded";
 const statusMessage =
 uploadStatus === "uploading"
 ? "Uploading attachment..."
 : uploadStatus === "uploaded"
 ? "Attachment uploaded."
 : attachment.error || "Please remove the invalid attachment before saving.";
 return (
 <div
 key={attachmentKey}
 className={`flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 ${
 isBlockingWorkLogAttachment(attachment) ? "border-rose-200" : "border-border"
 }`}
 >
 <div className="min-w-0">
 <div className="truncate text-sm font-medium text-card-foreground">
 {getMaintenanceAttachmentName(attachment, index)}
 </div>
 <div
 className={`text-xs ${
 isBlockingWorkLogAttachment(attachment)
 ? "text-rose-600"
 : uploadStatus === "uploaded"
 ? "text-emerald-600"
 : "text-muted-foreground"
 }`}
 >
 {statusMessage}
 {uploadStatus === "uploaded" ? ` ${getMaintenanceAttachmentLabel(attachment)}` : ""}
 </div>
 </div>
 <button
 type="button"
 className="text-xs font-medium text-rose-600 hover:text-rose-700"
 onClick={() => handleRemoveProofAttachment(attachmentKey)}
 disabled={isSelectedRequestLocked || saveProofMutation.isPending}
 >
 Remove
 </button>
 </div>
 );
 })}
 </div>
 ) : null}
 </label>

 <div className="mt-4 flex justify-end">
 <button
 type="submit"
 className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm hover:opacity-90"
 style={{
 backgroundColor: "var(--primary)",
 color: "var(--primary-foreground)",
 }}
 disabled={
 isSelectedRequestLocked ||
 saveProofMutation.isPending ||
 uploadingProofAttachment ||
 hasBlockingProofAttachment ||
 proofAttachments.length === 0
 }
 >
 {saveProofMutation.isPending ? "Saving..." : "Save Proof"}
 </button>
 </div>
 </form>
 ) : (
 <div className="mb-5 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 Archived requests are read-only until restored.
 </div>
 )}

 <MaintenanceTimeline
 items={timelineItems}
 onRemoveAttachment={handleRemoveSavedAttachment}
 canRemoveAttachments={
 !selectedRequest.isArchived &&
 !removeAttachmentMutation.isPending
 }
 />
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <AlertTriangle size={14} />
 Issue Details
 </>
 )}
 >
 <div className="text-sm text-card-foreground">{selectedRequest.description}</div>
 </DetailDrawer.Section>
 </div>

 </div>

 <div className="space-y-6">
 <ServiceProviderAssignmentPanel
 request={selectedRequest}
 providers={serviceProviders}
 isLoadingProviders={isLoadingProviders}
 selectedChoice={providerChoice}
 manualProvider={manualProvider}
 saveForFuture={saveManualProviderForFuture}
 fieldErrors={{
 ...providerFieldErrors,
 assigned_to: providerFieldErrors.assigned_to || updateFieldErrors.assigned_to,
 }}
 formMessage={providerFormMessage}
 suggestion={providerSuggestion}
 isAssigning={assignProviderMutation.isPending}
 isSuggesting={suggestProviderMutation.isPending}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived}
 onChoiceChange={handleProviderChoiceChange}
 onManualChange={handleManualProviderChange}
 onSaveForFutureChange={setSaveManualProviderForFuture}
 onAssign={handleAssignProvider}
 onSuggest={handleSuggestProvider}
 onUseSuggestion={handleUseSuggestedProvider}
 />

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <MessageSquare size={14} />
 Admin Note
 <SectionBadge tone="amber">Admin Only</SectionBadge>
 </>
 )}
 >
 <p className="mb-4 text-sm text-muted-foreground">
 These updates are for admin tracking and will not be shown to the tenant.
 </p>
 {isSelectedRequestLocked || selectedRequest.isArchived ? (
 <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 Closed, cancelled, and archived requests are read-only here. Admin notes,
 assignments, and status changes are disabled.
 </div>
 ) : null}

 <form
 id="maintenance-admin-form"
 className="mt-4 space-y-4"
 onSubmit={handleSubmitUpdate}
 >
 {updateFormMessage ? (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {updateFormMessage}
 </div>
 ) : null}

 <label id="maintenance-update-field-status" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Status
 </span>
 <select
 value={draftStatus}
 onChange={(event) => {
 setDraftStatus(event.target.value);
 clearUpdateFieldError("status");
 }}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived}
 aria-invalid={Boolean(updateFieldErrors.status)}
 className={buildFieldClassName(
 Boolean(updateFieldErrors.status),
 "mt-2 h-11 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 >
 {selectedRequestStatusOptions.map((status) => (
 <option key={status} value={status}>
 {formatMaintenanceStatus(status)}
 </option>
 ))}
 </select>
 {updateFieldErrors.status ? (
 <p className="mt-1 text-xs text-rose-600">{updateFieldErrors.status}</p>
 ) : null}
 </label>

 <label id="maintenance-update-field-notes" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Resolution Notes
 </span>
 <textarea
 rows="6"
 placeholder="Internal resolution or status note for this request."
 value={draftNotes}
 onChange={(event) => {
 setDraftNotes(event.target.value);
 clearUpdateFieldError("notes");
 }}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived}
 aria-invalid={Boolean(updateFieldErrors.notes)}
 className={buildFieldClassName(
 Boolean(updateFieldErrors.notes),
 "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
 )}
 />
 {updateFieldErrors.notes ? (
 <p className="mt-1 text-xs text-rose-600">{updateFieldErrors.notes}</p>
 ) : null}
 </label>

 <label id="maintenance-update-field-work_log_note" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Admin Note
 </span>
 <textarea
 rows="3"
 placeholder="Optional admin note for the maintenance timeline."
 value={draftWorkLogNote}
 onChange={(event) => {
 setDraftWorkLogNote(event.target.value);
 clearUpdateFieldError("work_log_note");
 }}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived}
 aria-invalid={Boolean(updateFieldErrors.work_log_note)}
 className={buildFieldClassName(
 Boolean(updateFieldErrors.work_log_note),
 "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
 )}
 />
 {updateFieldErrors.work_log_note ? (
 <p className="mt-1 text-xs text-rose-600">{updateFieldErrors.work_log_note}</p>
 ) : null}
 </label>
 </form>
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <MessageSquare size={14} />
 Message to Tenant
 <SectionBadge>Visible to Tenant</SectionBadge>
 </>
 )}
 >
 <p className="mb-4 text-sm text-muted-foreground">
 This message and its attachments will be visible to the tenant.
 </p>
 {isSelectedRequestLocked || selectedRequest.isArchived ? (
 <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 Closed, cancelled, and archived requests are read-only here. Tenant updates are disabled.
 </div>
 ) : null}

 <form className="mt-4 space-y-4" onSubmit={handleSendReply}>
 {replyFormMessage ? (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {replyFormMessage}
 </div>
 ) : null}

 <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-xs text-muted-foreground">
 AI drafted updates are based on the request timeline. Please review before sending.
 </p>
 <button
 type="button"
 className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-60"
 onClick={handleGenerateUpdate}
 disabled={
 isSelectedRequestLocked ||
 selectedRequest.isArchived ||
 sendReplyMutation.isPending ||
 generateUpdateMutation.isPending
 }
 >
 <Sparkles size={14} />
 {generateUpdateMutation.isPending ? "Generating..." : "Generate Update"}
 </button>
 </div>
 </div>

 <label id="maintenance-reply-field-reply_message" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Message
 </span>
 <textarea
 rows="4"
 placeholder="Write a message for the tenant."
 value={replyMessage}
 onChange={(event) => {
 setReplyMessage(event.target.value);
 clearReplyFieldError("reply_message");
 }}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived || sendReplyMutation.isPending}
 aria-invalid={Boolean(replyFieldErrors.reply_message)}
 className={buildFieldClassName(
 Boolean(replyFieldErrors.reply_message),
 "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
 )}
 />
 {replyFieldErrors.reply_message ? (
 <p className="mt-1 text-xs text-rose-600">{replyFieldErrors.reply_message}</p>
 ) : null}
 </label>

 <label id="maintenance-reply-field-reply_attachments" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Attachments for Tenant
 </span>
 <div
 className={`mt-2 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
 replyFieldErrors.reply_attachments ? "border-rose-500" : "border-transparent"
 }`}
 >
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted">
 <Paperclip size={14} />
 {uploadingReplyAttachment ? "Uploading..." : "Upload file for tenant"}
 <input
 type="file"
 hidden
 multiple
 accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
 onChange={handleReplyAttachmentUpload}
 disabled={
 isSelectedRequestLocked ||
 selectedRequest.isArchived ||
 uploadingReplyAttachment ||
 sendReplyMutation.isPending
 }
 />
 </label>
 <span className="text-xs text-muted-foreground">
 Attach photos or PDF files the tenant can open from reply history.
 </span>
 </div>
 {replyFieldErrors.reply_attachments ? (
 <p className="mt-1 text-xs text-rose-600">{replyFieldErrors.reply_attachments}</p>
 ) : null}

 {replyAttachments.length ? (
 <div className="mt-3 grid gap-2">
 {replyAttachments.map((attachment, index) => {
 const attachmentKey = getWorkLogAttachmentKey(attachment, index);
 const uploadStatus = attachment.uploadStatus || "uploaded";
 const statusMessage =
 uploadStatus === "uploading"
 ? "Uploading attachment..."
 : uploadStatus === "uploaded"
 ? "Attachment uploaded."
 : attachment.error || "Please remove the invalid attachment before sending.";
 return (
 <div
 key={attachmentKey}
 className={`flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 ${
 isBlockingWorkLogAttachment(attachment) ? "border-rose-200" : "border-border"
 }`}
 >
 <div className="min-w-0">
 <div className="truncate text-sm font-medium text-card-foreground">
 {getMaintenanceAttachmentName(attachment, index)}
 </div>
 <div
 className={`text-xs ${
 isBlockingWorkLogAttachment(attachment)
 ? "text-rose-600"
 : uploadStatus === "uploaded"
 ? "text-emerald-600"
 : "text-muted-foreground"
 }`}
 >
 {statusMessage}
 {uploadStatus === "uploaded" ? ` ${getMaintenanceAttachmentLabel(attachment)}` : ""}
 </div>
 </div>
 <button
 type="button"
 className="text-xs font-medium text-rose-600 hover:text-rose-700"
 onClick={() => handleRemoveReplyAttachment(attachmentKey)}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived || sendReplyMutation.isPending}
 >
 Remove
 </button>
 </div>
 );
 })}
 </div>
 ) : null}
 </label>

 <div className="flex justify-end">
 <button
 type="submit"
 className="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm hover:opacity-90"
 style={{
 backgroundColor: "var(--primary)",
 color: "var(--primary-foreground)",
 }}
 disabled={
 isSelectedRequestLocked ||
 selectedRequest.isArchived ||
 sendReplyMutation.isPending ||
 uploadingReplyAttachment ||
 hasBlockingReplyAttachment
 }
 >
 {sendReplyMutation.isPending ? "Sending..." : "Send Update"}
 </button>
 </div>
 </form>
 </DetailDrawer.Section>
 </div>
 </div>
 </div>
 </div>
 )}
 </DetailDrawer>
 <ConfirmationModal
 open={Boolean(archiveDialogMode)}
 title={archiveDialogMode === "restore" ? "Restore Request" : "Archive Request"}
 message={
 archiveDialogMode === "restore"
 ? "This request will return to the active maintenance list."
 : "This request will be hidden from the active list but can still be viewed in Archived Requests."
 }
 confirmLabel={archiveDialogMode === "restore" ? "Restore Request" : "Archive Request"}
 confirmTone={archiveDialogMode === "restore" ? "emerald" : "rose"}
 isPending={archiveRequestMutation.isPending || restoreRequestMutation.isPending}
 onCancel={() => setArchiveDialogMode(null)}
 onConfirm={handleConfirmArchiveAction}
 />
 <AttachmentRemovalModal
 open={attachmentRemovalDialog.open}
 scope={attachmentRemovalDialog.scope}
 reason={attachmentRemovalDialog.reason}
 customReason={attachmentRemovalDialog.customReason}
 error={attachmentRemovalDialog.error}
 isPending={removeAttachmentMutation.isPending}
 onCancel={handleCloseAttachmentRemovalDialog}
 onConfirm={handleSubmitAttachmentRemoval}
 onScopeChange={(scope) =>
 setAttachmentRemovalDialog((current) => ({
 ...current,
 scope,
 error: "",
 }))
 }
 onReasonChange={(reason) =>
 setAttachmentRemovalDialog((current) => ({
 ...current,
 reason,
 customReason: reason === "Other" ? current.customReason : "",
 error: "",
 }))
 }
 onCustomReasonChange={(customReason) =>
 setAttachmentRemovalDialog((current) => ({
 ...current,
 customReason,
 error: "",
 }))
 }
 />
 </PageShell.Content>
 </PageShell>
 </div>
 );
}
