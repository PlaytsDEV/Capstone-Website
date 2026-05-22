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
 useAssignMaintenanceBranch,
 useArchiveMaintenanceRequest,
 useAssignMaintenanceProvider,
 useGenerateMaintenanceUpdate,
 useGenerateMaintenanceReport,
 useMaintenanceAnalytics,
 useMaintenanceBranchReport,
 useMaintenanceProviderReport,
 useMaintenanceRequest,
 useRemoveMaintenanceAttachment,
 useRestoreMaintenanceRequest,
 useSaveMaintenanceProof,
 useSendMaintenanceTenantSummary,
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
import { exportReportPdf } from "../../../shared/utils/reportPdf";
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
import AnalyticsBarChart from "../components/shared/AnalyticsBarChart";
import AnalyticsDonutChart from "../components/shared/AnalyticsDonutChart";
import AnalyticsLineChart from "../components/shared/AnalyticsLineChart";
import ReportChartPanel from "../components/shared/ReportChartPanel";
import ReportMetricCard from "../components/shared/ReportMetricCard";

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
const REPORT_TYPE_LABELS = {
 admin: "Admin Report",
 tenant: "Tenant Summary",
};
const REPORT_EXPORT_COLUMNS = [
 { key: "lineNumber", label: "Line" },
 { key: "content", label: "Content" },
];
const MAINTENANCE_TABS = [
 { key: "requests", label: "Requests", icon: ClipboardList },
 { key: "analytics", label: "Analytics", icon: Sparkles },
 { key: "branch_reports", label: "Branch Reports", icon: FileText },
 { key: "service_providers", label: "Service Providers", icon: UserRound },
];
const ASSIGNMENT_FILTER_OPTIONS = [
 { key: "all", label: "All assignments" },
 { key: "assigned", label: "Assigned" },
 { key: "unassigned", label: "Unassigned" },
];
const ANALYTICS_SLA_OPTIONS = [
 { key: "all", label: "All SLA health" },
 { key: "overdue", label: "Overdue" },
 { key: "due_soon", label: "Due Soon" },
 { key: "on_track", label: "On Track" },
 { key: "completed", label: "Completed" },
 { key: "closed", label: "Closed" },
];
const VALID_MAINTENANCE_BRANCHES = new Set(BRANCH_OPTIONS.map((branch) => branch.value));
const ASSIGN_BRANCH_OPTIONS = [
 { value: "guadalupe", label: "Guadalupe" },
 { value: "gil-puyat", label: "Gil Puyat" },
];
const PH_MOBILE_ERROR = "Enter a valid 11-digit Philippine mobile number starting with 09.";
const AMOUNT_ERROR = "Enter a valid amount.";
const TEXT_MIN_LENGTHS = {
 issueTitle: 5,
 description: 15,
 adminRemarks: 10,
 replyMessage: 10,
 progressUpdate: 10,
 providerNotes: 10,
 providerName: 3,
 serviceType: 3,
};

const sanitizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");
const sanitizeAmountInput = (value) => {
 const cleaned = String(value || "").replace(/[^\d.]/g, "");
 const [whole = "", ...decimalParts] = cleaned.split(".");
 const decimal = decimalParts.join("").slice(0, 2);
 return decimalParts.length ? `${whole}.${decimal}` : whole;
};
const formatPeso = (min, max = null) => {
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
const validatePhilippineMobile = (value, { required = true } = {}) => {
 const digits = sanitizeDigitsOnly(value);
 if (!digits) return required ? PH_MOBILE_ERROR : "";
 return /^09\d{9}$/.test(digits) ? "" : PH_MOBILE_ERROR;
};
const validateAmount = (value, { required = false } = {}) => {
 const text = String(value ?? "").trim();
 if (!text) return required ? AMOUNT_ERROR : "";
 const amount = Number(text);
 return Number.isFinite(amount) && amount >= 0 ? "" : AMOUNT_ERROR;
};
const validateMinimumText = (value, min, label, { required = true } = {}) => {
 const text = String(value || "").trim();
 if (!text) return required ? `${label} is required.` : "";
 if (text.length < min) return `${label} must be at least ${min} characters.`;
 return "";
};

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

const getReportFilenameBase = (report, selectedRequest) => {
 const requestId = report?.requestId || selectedRequest?.request_id || report?.title || "maintenance";
 const safeRequestId = String(requestId)
 .replace(/[^a-z0-9_-]+/gi, "-")
 .replace(/^-+|-+$/g, "");
 const reportSlug = report?.reportType === "tenant" ? "tenant-summary" : "admin-report";
 return `maintenance-${reportSlug}-${safeRequestId || "request"}`;
};

const getReportSummaryLines = (summary) => String(summary || "").split(/\r?\n/);

const toDateInputValue = (date) => {
 const next = date instanceof Date ? date : new Date(date);
 if (Number.isNaN(next.getTime())) return "";
 const year = next.getFullYear();
 const month = String(next.getMonth() + 1).padStart(2, "0");
 const day = String(next.getDate()).padStart(2, "0");
 return `${year}-${month}-${day}`;
};

const getDefaultMaintenanceReportRange = () => {
 const end = new Date();
 const start = new Date();
 start.setDate(start.getDate() - 30);
 return {
 dateFrom: toDateInputValue(start),
 dateTo: toDateInputValue(end),
 };
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

const normalizeMaintenanceBranch = (value) => {
 const branch = String(value || "").trim().toLowerCase();
 return VALID_MAINTENANCE_BRANCHES.has(branch) ? branch : "";
};

const hasValidRequestBranch = (request) => Boolean(normalizeMaintenanceBranch(request?.branch));

const formatBranchLabel = (value) => {
 const branch = normalizeMaintenanceBranch(value);
 if (!branch) return "Branch missing";
 return BRANCH_DISPLAY_NAMES[branch] || branch;
};

const getRequestBranch = (request) =>
 normalizeMaintenanceBranch(request?.branch);

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

const getProviderRateLabel = (provider) =>
 formatPeso(provider?.minRate ?? provider?.minimumRate, provider?.maxRate ?? provider?.maximumRate);

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

const createReportFilterPayload = (filters = {}, { isOwner = false, userBranch = "" } = {}) => {
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

const REPORT_REQUEST_COLUMNS = [
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

const PROVIDER_REPORT_COLUMNS = [
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
 {item.branch ? (
 <p className="mt-2 text-sm text-muted-foreground">Branch: {formatBranchLabel(item.branch)}</p>
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

function MaintenanceExportDropdown({
 options = [],
 disabled = false,
 align = "right",
 placement = "bottom",
}) {
 const [open, setOpen] = useState(false);
 const visibleOptions = options.filter(Boolean);

 return (
 <div
 className="relative"
 onBlur={(event) => {
 if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
 }}
 >
 <button
 type="button"
 className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
 onClick={() => setOpen((current) => !current)}
 disabled={disabled || visibleOptions.length === 0}
 aria-haspopup="menu"
 aria-expanded={open}
 >
 <FileDown size={14} />
 Export
 <ChevronDown size={14} />
 </button>
 {open ? (
 <div
 role="menu"
 className={`absolute z-[1300] min-w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl ${
 placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
 } ${
 align === "left" ? "left-0" : "left-0 sm:left-auto sm:right-0"
 }`}
 >
 {visibleOptions.map((option) => (
 <button
 key={option.key}
 type="button"
 role="menuitem"
 className="flex w-full items-center px-4 py-2 text-left text-sm text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
 onClick={() => {
 setOpen(false);
 option.onClick?.();
 }}
 disabled={option.disabled}
 >
 {option.label}
 </button>
 ))}
 </div>
 ) : null}
 </div>
 );
}

function ReportExportDropdown({
 reportType,
 disabled = false,
 onExport,
}) {
 const options = [
 { key: "pdf", label: "Download as PDF", onClick: () => onExport("pdf") },
 { key: "csv", label: "Download as CSV", onClick: () => onExport("csv") },
 ...(reportType === "admin"
 ? [{ key: "txt", label: "Download as TXT", onClick: () => onExport("txt") }]
 : []),
 ];

 return <MaintenanceExportDropdown options={options} disabled={disabled} placement="top" />;
}

function ReportPreviewModal({
 open,
 report,
 isCopying = false,
 isSending = false,
 onCopy,
 onExport,
 onSendToTenant,
 onClose,
}) {
 if (!open || !report) return null;
 const label = REPORT_TYPE_LABELS[report.reportType] || "Maintenance Report";
 const isTenant = report.reportType === "tenant";

 return (
 <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
 <section
 role="dialog"
 aria-modal="true"
 aria-labelledby="maintenance-report-preview-title"
 className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl"
 >
 <div className="border-b border-border p-5">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <div className="flex flex-wrap items-center gap-2">
 <h2 id="maintenance-report-preview-title" className="text-lg font-semibold text-card-foreground">
 {report.title || label}
 </h2>
 <SectionBadge tone={isTenant ? "blue" : "amber"}>{label}</SectionBadge>
 </div>
 {report.message ? (
 <p className="mt-2 text-sm text-muted-foreground">{report.message}</p>
 ) : null}
 </div>
 <button
 type="button"
 className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
 onClick={onClose}
 aria-label="Close report preview"
 >
 <XCircle size={16} />
 </button>
 </div>
 </div>

 <div className="min-h-0 flex-1 overflow-y-auto p-5">
 <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6 text-card-foreground">
 {report.summary}
 </pre>
 </div>

 <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
 <ReportExportDropdown
 reportType={report.reportType}
 onExport={onExport}
 disabled={!report.summary}
 />
 {isTenant ? (
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
 style={{
 backgroundColor: "var(--primary)",
 color: "var(--primary-foreground)",
 }}
 onClick={onSendToTenant}
 disabled={isSending}
 >
 <MessageSquare size={14} />
 {isSending ? "Sending..." : "Send to Tenant"}
 </button>
 ) : (
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60"
 style={{
 backgroundColor: "var(--primary)",
 color: "var(--primary-foreground)",
 }}
 onClick={onCopy}
 disabled={isCopying}
 >
 <ClipboardList size={14} />
 {isCopying ? "Copying..." : "Copy Summary"}
 </button>
 )}
 <button
 type="button"
 className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
 onClick={onClose}
 >
 Close
 </button>
 </div>
 </section>
 </div>
 );
}

function MaintenanceReportFilters({
 filters,
 isOwner,
 userBranch,
 providerOptions = [],
 onChange,
 title = "Filters",
}) {
 const branchValue = isOwner ? filters.branch : userBranch;
 return (
 <section className="rounded-xl border border-border bg-card p-5">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
 <p className="mt-1 text-xs text-muted-foreground">
 Refine the reporting view without changing the operational request queue.
 </p>
 </div>
 <label className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
 <input
 type="checkbox"
 checked={Boolean(filters.overdueOnly)}
 onChange={(event) => onChange("overdueOnly", event.target.checked)}
 />
 Overdue only
 </label>
 </div>
 <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Branch</span>
 <select
 value={branchValue || ""}
 onChange={(event) => onChange("branch", event.target.value)}
 disabled={!isOwner}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground disabled:bg-muted"
 >
 {isOwner ? <option value="all">All Branches</option> : null}
 {BRANCH_OPTIONS.map((branch) => (
 <option key={branch.value} value={branch.value}>{branch.label}</option>
 ))}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date From</span>
 <input type="date" value={filters.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Date To</span>
 <input type="date" value={filters.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground" />
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</span>
 <select value={filters.status} onChange={(event) => onChange("status", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 <option value="all">All statuses</option>
 {SUMMARY_STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Request Type</span>
 <select value={filters.requestType} onChange={(event) => onChange("requestType", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 <option value="all">All request types</option>
 {MAINTENANCE_REQUEST_TYPES.map((type) => <option key={type} value={type}>{getMaintenanceTypeMeta(type).label}</option>)}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Urgency</span>
 <select value={filters.urgency} onChange={(event) => onChange("urgency", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 <option value="all">All urgency levels</option>
 {MAINTENANCE_URGENCY_LEVELS.map((urgency) => <option key={urgency} value={urgency}>{getMaintenanceUrgencyMeta(urgency).label}</option>)}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Service Provider</span>
 <select value={filters.provider} onChange={(event) => onChange("provider", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 <option value="all">All providers</option>
 {providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assignment</span>
 <select value={filters.assignmentStatus} onChange={(event) => onChange("assignmentStatus", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 {ASSIGNMENT_FILTER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
 </select>
 </label>
 <label>
 <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">SLA Health</span>
 <select value={filters.slaHealth} onChange={(event) => onChange("slaHealth", event.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
 {ANALYTICS_SLA_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
 </select>
 </label>
 </div>
 </section>
 );
}

function MaintenanceMetricsGrid({ summary = {}, isOwner = false }) {
 const metrics = [
 ["Total Requests", summary.totalRequests ?? 0, "blue"],
 ["Pending Requests", summary.pendingRequests ?? 0, "amber"],
 ["In Progress", summary.inProgressRequests ?? 0, "violet"],
 ["Completed", summary.completedRequests ?? 0, "green"],
 ["Overdue", summary.overdueRequests ?? 0, "rose"],
 ["Cancelled/Rejected", summary.cancelledRejectedRequests ?? 0, "rose"],
 ["Avg Response", summary.averageResponseTimeLabel || "Not enough data", "blue"],
 ["Avg Resolution", summary.averageResolutionTimeLabel || "Not enough data", "green"],
 ["Most Common Issue", summary.mostCommonIssueType || "Not enough data", "violet"],
 ["Assigned", summary.assignedRequests ?? 0, "blue"],
 ["Unassigned", summary.unassignedRequests ?? 0, "amber"],
 ...(isOwner ? [["Top Branch", summary.branchWithMostRequests || "Not enough data", "green"]] : []),
 ];
 return (
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {metrics.map(([label, value, tone]) => (
 <ReportMetricCard key={label} label={label} value={value} tone={tone} />
 ))}
 </div>
 );
}

function MaintenanceAnalyticsCharts({ data, isOwner }) {
 const charts = data?.charts || {};
 const emptyTitle = "No maintenance data";
 const emptyDescription = "No maintenance data found for the selected filters.";
 return (
 <div className="grid gap-4 xl:grid-cols-2">
 <ReportChartPanel title="Requests by Status">
 <AnalyticsDonutChart data={charts.requestsByStatus || []} centerLabel={{ value: data?.summary?.totalRequests || 0, label: "Requests" }} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Requests by Issue Type">
 <AnalyticsBarChart data={charts.requestsByIssueType || []} bars={[{ key: "value", label: "Requests", color: "#0ea5e9" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Requests by Urgency">
 <AnalyticsDonutChart data={charts.requestsByUrgency || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Monthly Maintenance Trend">
 <AnalyticsLineChart data={charts.monthlyTrend || []} lines={[{ key: "total", label: "Total" }, { key: "completed", label: "Completed" }, { key: "overdue", label: "Overdue" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Overdue Requests Overview">
 <AnalyticsDonutChart data={charts.overdueOverview || []} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 {isOwner ? (
 <>
 <ReportChartPanel title="Requests per Branch">
 <AnalyticsBarChart data={charts.requestsPerBranch || []} bars={[{ key: "value", label: "Requests", color: "#6366f1" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Average Resolution Time per Branch">
 <AnalyticsBarChart data={charts.averageResolutionTimePerBranch || []} bars={[{ key: "value", label: "Hours", color: "#10b981" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 <ReportChartPanel title="Overdue Requests by Branch">
 <AnalyticsBarChart data={charts.overdueRequestsByBranch || []} bars={[{ key: "value", label: "Overdue", color: "#ef4444" }]} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
 </ReportChartPanel>
 </>
 ) : null}
 </div>
 );
}

function AssignBranchModal({
 open,
 branch,
 error = "",
 isPending = false,
 onBranchChange,
 onCancel,
 onConfirm,
}) {
 if (!open) return null;
 const canSubmit = Boolean(branch) && !isPending;

 return (
 <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4 py-6">
 <section
 role="dialog"
 aria-modal="true"
 aria-labelledby="maintenance-assign-branch-title"
 className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
 >
 <h2 id="maintenance-assign-branch-title" className="text-lg font-semibold text-card-foreground">
 Assign Branch
 </h2>
 <p className="mt-3 text-sm leading-6 text-muted-foreground">
 This request has no branch assigned. Please select the correct branch so it can be managed properly.
 </p>

 <label className="mt-5 block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Branch
 </span>
 <select
 value={branch}
 onChange={(event) => onBranchChange(event.target.value)}
 disabled={isPending}
 className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="">Select branch</option>
 {ASSIGN_BRANCH_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </label>

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
 className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
 onClick={onConfirm}
 disabled={!canSubmit}
 >
 {isPending ? "Saving..." : "Save Branch"}
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
 assignmentDisabled = false,
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
 const hasRequestBranch = Boolean(getRequestBranch(request));
 const requestCategory = request?.request_type
 ? getMaintenanceTypeMeta(request.request_type).label
 : "Maintenance";
 const manualValuesChanged =
 manualProvider.providerName.trim() !== String(currentName || "").trim() ||
 manualProvider.contactNumber.trim() !== String(currentContact || "").trim() ||
 manualProvider.serviceType.trim() !== String(currentCategory || "").trim() ||
 String(manualProvider.minRate || "").trim() ||
 String(manualProvider.maxRate || "").trim() ||
 manualProvider.notes.trim() !== String(currentNotes || "").trim();
 const hasAssignmentChanges =
 selectedChoice === PROVIDER_NONE_CHOICE
 ? Boolean(currentName || currentProviderId)
 : selectedChoice === PROVIDER_MANUAL_CHOICE
 ? currentProviderSource !== "manual" || manualValuesChanged || saveForFuture
 : selectedChoice !== currentProviderId ||
 currentProviderSource !== "directory" ||
 manualProvider.notes.trim() !== String(currentNotes || "").trim();
 const comparisonRows = Array.isArray(suggestion?.comparison)
 ? suggestion.comparison
 : [];

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
 {hasRequestBranch
 ? "No matching service providers found for this branch and request type. Use Manual Entry."
 : "This request is missing a branch. Repair the branch before choosing a saved provider."}
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
 <div className="text-xs text-muted-foreground">
 Estimated rate: {getProviderRateLabel(selectedProvider)}
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
 id="maintenance-provider-field-providerName"
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
 id="maintenance-provider-field-contactNumber"
 inputMode="numeric"
 maxLength={11}
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
 id="maintenance-provider-field-serviceType"
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
 Estimated Min Rate
 </span>
 <input
 id="maintenance-provider-field-minRate"
 inputMode="decimal"
 value={manualProvider.minRate}
 onChange={(event) => onManualChange("minRate", event.target.value)}
 disabled={disabled || isAssigning}
 className={buildFieldClassName(
 Boolean(fieldErrors.minRate),
 "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder="800"
 />
 {fieldErrors.minRate ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.minRate}</p> : null}
 </label>
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Estimated Max Rate
 </span>
 <input
 id="maintenance-provider-field-maxRate"
 inputMode="decimal"
 value={manualProvider.maxRate}
 onChange={(event) => onManualChange("maxRate", event.target.value)}
 disabled={disabled || isAssigning}
 className={buildFieldClassName(
 Boolean(fieldErrors.maxRate),
 "mt-2 h-10 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder="1500"
 />
 {fieldErrors.maxRate ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.maxRate}</p> : null}
 </label>
 <label>
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Notes
 </span>
 <textarea
 id="maintenance-provider-field-notes"
 rows="3"
 value={manualProvider.notes}
 onChange={(event) => onManualChange("notes", event.target.value)}
 disabled={disabled || isAssigning}
 aria-invalid={Boolean(fieldErrors.notes)}
 className={buildFieldClassName(
 Boolean(fieldErrors.notes),
 "mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2",
 )}
 placeholder="Optional internal provider notes"
 />
 {fieldErrors.notes ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.notes}</p> : null}
 </label>
 <label className="flex items-start gap-2 text-sm text-muted-foreground">
 <input
 type="checkbox"
 checked={saveForFuture}
 onChange={(event) => onSaveForFutureChange(event.target.checked)}
 disabled={disabled || isAssigning || !hasRequestBranch}
 className="mt-1 h-4 w-4 accent-primary"
 />
 <span>
 {hasRequestBranch
 ? `Save this provider for future use in ${requestBranch} ${requestCategory} requests.`
 : "Repair the request branch before saving this provider for future use."}
 </span>
 </label>
 </div>
 ) : null}

 {suggestion ? (
 <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800">
 {suggestion.recommendedProviderName ? (
 <>
 <div className="flex flex-wrap items-center gap-2">
 <div className="font-semibold">Recommended: {suggestion.recommendedProviderName}</div>
 {suggestion.bestOptionBadge ? (
 <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-900">
 {suggestion.bestOptionBadge}
 </span>
 ) : null}
 </div>
 <div className="mt-1 text-xs text-sky-900">
 {suggestion.serviceType ? `${suggestion.serviceType} service` : "Maintenance service"}
 {" - "}
 {suggestion.estimatedRateLabel || "Rate not recorded"}
 </div>
 <div className="mt-2">{suggestion.reason}</div>
 {comparisonRows.length ? (
 <div className="mt-3 overflow-x-auto rounded-lg border border-sky-100 bg-white">
 <table className="min-w-full text-left text-xs">
 <thead className="bg-sky-50 text-sky-900">
 <tr>
 <th className="px-3 py-2 font-semibold">Provider</th>
 <th className="px-3 py-2 font-semibold">Estimated Rate</th>
 <th className="px-3 py-2 font-semibold">Strength</th>
 <th className="px-3 py-2 font-semibold">AI Rating</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-sky-100 text-sky-900">
 {comparisonRows.map((row) => (
 <tr key={row.providerId || row.providerName}>
 <td className="px-3 py-2 font-medium">{row.providerName}</td>
 <td className="px-3 py-2">{row.estimatedRateLabel || "Rate not recorded"}</td>
 <td className="px-3 py-2">{row.strength || "Recommended option"}</td>
 <td className="px-3 py-2">{row.aiRating ?? 0}%</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : null}
 <p className="mt-2 text-xs text-sky-900">
 Rates are estimated and may change depending on the actual repair scope.
 </p>
 <button
 type="button"
 className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-sky-900 px-3 text-xs font-semibold text-white hover:bg-sky-950 disabled:opacity-60"
 onClick={() => onUseSuggestion(suggestion.recommendedProviderId)}
 disabled={disabled || isAssigning}
 >
 Select Provider
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
 disabled={disabled || assignmentDisabled || isAssigning || !hasAssignmentChanges || Object.keys(fieldErrors).some((key) => Boolean(fieldErrors[key]))}
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
 const userBranch = normalizeMaintenanceBranch(user?.branch);
 const [searchParams, setSearchParams] = useSearchParams();
 const requestedTab = searchParams.get("tab");
 const [activeTab, setActiveTab] = useState(
 MAINTENANCE_TABS.some((tab) => tab.key === requestedTab) ? requestedTab : "requests",
 );
 const defaultReportRange = useMemo(() => getDefaultMaintenanceReportRange(), []);

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
 const [analyticsFilters, setAnalyticsFilters] = useState({
 branch: isOwner ? "all" : userBranch,
 dateFrom: defaultReportRange.dateFrom,
 dateTo: defaultReportRange.dateTo,
 status: "all",
 requestType: "all",
 urgency: "all",
 provider: "all",
 assignmentStatus: "all",
 slaHealth: "all",
 overdueOnly: false,
 });
 const [branchReportFilters, setBranchReportFilters] = useState({
 branch: isOwner ? "all" : userBranch,
 dateFrom: defaultReportRange.dateFrom,
 dateTo: defaultReportRange.dateTo,
 status: "all",
 requestType: "all",
 urgency: "all",
 provider: "all",
 assignmentStatus: "all",
 slaHealth: "all",
 overdueOnly: false,
 });
 const [analyticsRequestPage, setAnalyticsRequestPage] = useState(1);
 const [branchReportRequestPage, setBranchReportRequestPage] = useState(1);
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
 const [branchAssignmentDialog, setBranchAssignmentDialog] = useState({
 open: false,
 branch: "",
 error: "",
 });
 const [reportPreview, setReportPreview] = useState(null);
 const [isCopyingReport, setIsCopyingReport] = useState(false);
 const [sendTenantSummaryDialogOpen, setSendTenantSummaryDialogOpen] = useState(false);
 const [updateType, setUpdateType] = useState("status_update");
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

 const analyticsQueryFilters = useMemo(
 () => createReportFilterPayload(analyticsFilters, { isOwner, userBranch }),
 [analyticsFilters, isOwner, userBranch],
 );
 const branchReportQueryFilters = useMemo(
 () => createReportFilterPayload(branchReportFilters, { isOwner, userBranch }),
 [branchReportFilters, isOwner, userBranch],
 );

 const {
 data: requestsData,
 isLoading,
 isError,
 error,
 } = useAdminMaintenanceRequests(listFilters);
 const { data: summaryData } = useAdminMaintenanceRequests(summaryFilters);
 const {
 data: analyticsData,
 isLoading: isAnalyticsLoading,
 isError: isAnalyticsError,
 error: analyticsError,
 } = useMaintenanceAnalytics(analyticsQueryFilters, {
 enabled: activeTab === "analytics",
 });
 const {
 data: branchReportData,
 isLoading: isBranchReportLoading,
 isError: isBranchReportError,
 error: branchReportError,
 } = useMaintenanceBranchReport(branchReportQueryFilters, {
 enabled: activeTab === "branch_reports",
 });
 const {
 data: providerReportData,
 isLoading: isProviderReportLoading,
 isError: isProviderReportError,
 error: providerReportError,
 } = useMaintenanceProviderReport(branchReportQueryFilters, {
 enabled: activeTab === "service_providers",
 });
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
 const assignBranchMutation = useAssignMaintenanceBranch();
 const assignProviderMutation = useAssignMaintenanceProvider();
 const generateUpdateMutation = useGenerateMaintenanceUpdate();
 const generateReportMutation = useGenerateMaintenanceReport();
 const sendTenantSummaryMutation = useSendMaintenanceTenantSummary();
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
 const nextTab = MAINTENANCE_TABS.some((tab) => tab.key === requestedTab)
 ? requestedTab
 : "requests";
 setActiveTab((current) => (current === nextTab ? current : nextTab));
 }, [requestedTab]);

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
 if (isOwner) return;
 setAnalyticsFilters((current) =>
 current.branch === userBranch ? current : { ...current, branch: userBranch },
 );
 setBranchReportFilters((current) =>
 current.branch === userBranch ? current : { ...current, branch: userBranch },
 );
 }, [isOwner, userBranch]);

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
 minRate: "",
 maxRate: "",
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
 setUpdateType("status_update");
 setArchiveDialogMode(null);
 setBranchAssignmentDialog({
 open: false,
 branch: "",
 error: "",
 });
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

 const scrollToFirstProviderError = (errors) => {
 const firstField = ["assigned_to", "providerName", "contactNumber", "serviceType", "minRate", "maxRate", "notes"].find((field) => errors[field]);
 if (!firstField) return;

 window.setTimeout(() => {
 const fieldNode =
 document.getElementById(`maintenance-provider-field-${firstField}`) ||
 document.getElementById(`maintenance-update-field-${firstField}`);
 if (!fieldNode) return;
 fieldNode.scrollIntoView({ behavior: "smooth", block: "center" });
 const focusTarget = fieldNode.matches?.("input,select,textarea,button")
 ? fieldNode
 : fieldNode.querySelector("input,select,textarea,button");
 focusTarget?.focus?.({ preventScroll: true });
 }, 0);
 };

 const setUpdateFieldError = (field, message) => {
 setUpdateFieldErrors((current) => {
 const next = { ...current };
 if (message) next[field] = message;
 else delete next[field];
 return next;
 });
 if (!message && updateFormMessage) setUpdateFormMessage("");
 };

 const setReplyFieldError = (field, message) => {
 setReplyFieldErrors((current) => {
 const next = { ...current };
 if (message) next[field] = message;
 else delete next[field];
 return next;
 });
 if (!message && replyFormMessage) setReplyFormMessage("");
 };

 const setProofFieldError = (field, message) => {
 setProofFieldErrors((current) => {
 const next = { ...current };
 if (message) next[field] = message;
 else delete next[field];
 return next;
 });
 if (!message && proofFormMessage) setProofFormMessage("");
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

 const resolutionNoteError = validateMinimumText(
 draftNotes,
 TEXT_MIN_LENGTHS.adminRemarks,
 "Resolution notes",
 { required: false },
 );
 if (draftNotes.trim() && resolutionNoteError) errors.notes = resolutionNoteError;

 const workLogNoteError = validateMinimumText(
 draftWorkLogNote,
 TEXT_MIN_LENGTHS.progressUpdate,
 updateType === "internal_note" ? "Admin remarks" : "Progress update",
 { required: updateType === "internal_note" },
 );
 if (workLogNoteError) errors.work_log_note = workLogNoteError;

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
 if (!replyMessage.trim()) clearReplyFieldError("reply_message");
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
 const proofNoteError = validateMinimumText(
 proofNote,
 TEXT_MIN_LENGTHS.adminRemarks,
 "Admin remarks",
 { required: false },
 );
 if (proofNoteError) errors.proof_note = proofNoteError;
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

 const handleOpenAssignBranch = () => {
 if (!selectedRequest || !isOwner || hasValidRequestBranch(selectedRequest)) return;
 setBranchAssignmentDialog({
 open: true,
 branch: "",
 error: "",
 });
 };

 const handleCloseAssignBranch = () => {
 if (assignBranchMutation.isPending) return;
 setBranchAssignmentDialog({
 open: false,
 branch: "",
 error: "",
 });
 };

 const handleConfirmAssignBranch = async () => {
 if (!selectedRequest) return;
 const branch = normalizeMaintenanceBranch(branchAssignmentDialog.branch);
 if (!branch) {
 setBranchAssignmentDialog((current) => ({
 ...current,
 error: "Please select Guadalupe or Gil Puyat.",
 }));
 return;
 }

 try {
 await assignBranchMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 branch,
 });
 showNotification("Maintenance request branch assigned.", "success");
 setBranchAssignmentDialog({
 open: false,
 branch: "",
 error: "",
 });
 } catch (assignError) {
 const message = getMaintenanceApiErrorMessage(
 assignError,
 "Failed to assign branch.",
 );
 setBranchAssignmentDialog((current) => ({ ...current, error: message }));
 showNotification(message, "error");
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
 showNotification("CSV downloaded successfully.", "success");
 };

 const handleTabChange = (tabKey) => {
 if (!MAINTENANCE_TABS.some((tab) => tab.key === tabKey)) return;
 setActiveTab(tabKey);
 const nextParams = new URLSearchParams(searchParams);
 if (tabKey === "requests") {
 nextParams.delete("tab");
 } else {
 nextParams.set("tab", tabKey);
 }
 setSearchParams(nextParams, { replace: true });
 };

 const updateAnalyticsFilter = (field, value) => {
 setAnalyticsRequestPage(1);
 setAnalyticsFilters((current) => ({ ...current, [field]: value }));
 };

 const updateBranchReportFilter = (field, value) => {
 setBranchReportRequestPage(1);
 setBranchReportFilters((current) => ({ ...current, [field]: value }));
 };

 const buildReportPdfSections = (report, title = "Maintenance Report") => {
 const summary = report?.summary || {};
 const breakdowns = report?.breakdowns || {};
 const requests = report?.requests || [];
 return [
 {
 title: "Summary",
 rows: [
 `Total requests: ${summary.totalRequests ?? 0}`,
 `Pending requests: ${summary.pendingRequests ?? 0}`,
 `In progress requests: ${summary.inProgressRequests ?? 0}`,
 `Completed requests: ${summary.completedRequests ?? 0}`,
 `Overdue requests: ${summary.overdueRequests ?? 0}`,
 `Average response time: ${summary.averageResponseTimeLabel || "Not enough data"}`,
 `Average resolution time: ${summary.averageResolutionTimeLabel || "Not enough data"}`,
 `Most common issue: ${summary.mostCommonIssueType || "Not enough data"}`,
 ],
 },
 {
 title: "Status Breakdown",
 rows: (breakdowns.status || []).map((item) => `${item.label}: ${item.value}`),
 },
 {
 title: "Issue Type Breakdown",
 rows: (breakdowns.issueType || []).map((item) => `${item.label}: ${item.value}`),
 },
 {
 title: "Filtered Requests",
 rows: requests.map(
 (request) =>
 `${request.requestId} | ${request.tenantName} | ${request.branchLabel} | ${request.requestTypeLabel} | ${request.statusLabel} | ${request.assignedProvider} | ${request.sla?.label || ""}`,
 ),
 },
 ].filter((section) => section.rows.length > 0 || section.title === "Summary");
 };

 const exportReportRequestsCsv = (requests, filename) => {
 exportToCSV(
 (requests || []).map((request) => ({
 ...request,
 slaLabel: request.sla?.label || "",
 })),
 REPORT_REQUEST_COLUMNS,
 filename,
 );
 showNotification("CSV downloaded successfully.", "success");
 };

 const handleExportAnalytics = (format) => {
 if (!analyticsData) return;
 try {
 if (format === "pdf") {
 exportReportPdf({
 title: "Maintenance Analytics",
 subtitle: `${analyticsData.scope?.branchLabel || "All Branches"} - ${analyticsData.filters?.dateFrom || ""} to ${analyticsData.filters?.dateTo || ""}`,
 filename: "maintenance-analytics.pdf",
 sections: buildReportPdfSections(analyticsData, "Maintenance Analytics"),
 });
 showNotification("PDF downloaded successfully.", "success");
 return;
 }
 exportReportRequestsCsv(analyticsData.requests, "maintenance-analytics");
 } catch {
 showNotification("Unable to export report. Please try again.", "error");
 }
 };

 const handleExportBranchReport = (format) => {
 if (!branchReportData) return;
 try {
 if (format === "pdf") {
 exportReportPdf({
 title: branchReportData.title || "Maintenance Branch Report",
 subtitle: `${branchReportData.scope?.branchLabel || "All Branches"} - ${branchReportData.filters?.dateFrom || ""} to ${branchReportData.filters?.dateTo || ""}`,
 filename: "maintenance-branch-report.pdf",
 sections: buildReportPdfSections(branchReportData, "Maintenance Branch Report"),
 });
 showNotification("PDF downloaded successfully.", "success");
 return;
 }
 exportReportRequestsCsv(branchReportData.requests, "maintenance-branch-report");
 } catch {
 showNotification("Unable to export report. Please try again.", "error");
 }
 };

 const handleExportProviderReport = () => {
 if (!providerReportData) return;
 exportToCSV(providerReportData.providers || [], PROVIDER_REPORT_COLUMNS, "maintenance-service-providers");
 showNotification("CSV downloaded successfully.", "success");
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
 const nextValue =
 field === "contactNumber"
 ? sanitizeDigitsOnly(value).slice(0, 11)
 : ["minRate", "maxRate"].includes(field)
 ? sanitizeAmountInput(value)
 : value;
 setManualProvider((current) => ({ ...current, [field]: nextValue }));
 const message =
 field === "providerName"
 ? validateMinimumText(nextValue, TEXT_MIN_LENGTHS.providerName, "Provider name")
 : field === "contactNumber"
 ? validatePhilippineMobile(nextValue)
 : field === "serviceType"
 ? validateMinimumText(nextValue, TEXT_MIN_LENGTHS.serviceType, "Service type")
 : field === "minRate" || field === "maxRate"
 ? validateAmount(nextValue, { required: false })
 : field === "notes"
 ? validateMinimumText(nextValue, TEXT_MIN_LENGTHS.providerNotes, "Provider notes", { required: false })
 : "";
 setProviderFieldErrors((current) => {
 const next = { ...current };
 if (message) next[field] = message;
 else delete next[field];
 return next;
 });
 if (!message && providerFormMessage) setProviderFormMessage("");
 clearProviderFieldError("assigned_to");
 };

 const validateProviderAssignment = () => {
 const errors = {};
 if (providerChoice === PROVIDER_MANUAL_CHOICE) {
 const providerNameError = validateMinimumText(
 manualProvider.providerName,
 TEXT_MIN_LENGTHS.providerName,
 "Provider name",
 );
 const contactError = validatePhilippineMobile(manualProvider.contactNumber);
 const serviceTypeError = validateMinimumText(
 manualProvider.serviceType,
 TEXT_MIN_LENGTHS.serviceType,
 "Service type",
 );
 const notesError = validateMinimumText(
 manualProvider.notes,
 TEXT_MIN_LENGTHS.providerNotes,
 "Provider notes",
 { required: false },
 );
 const minRateError = validateAmount(manualProvider.minRate, { required: false });
 const maxRateError = validateAmount(manualProvider.maxRate, { required: false });
 if (providerNameError) errors.providerName = providerNameError;
 if (contactError) errors.contactNumber = contactError;
 if (serviceTypeError) errors.serviceType = serviceTypeError;
 if (minRateError) errors.minRate = minRateError;
 if (maxRateError) errors.maxRate = maxRateError;
 if (
 !minRateError &&
 !maxRateError &&
 manualProvider.minRate !== "" &&
 manualProvider.maxRate !== "" &&
 Number(manualProvider.maxRate) < Number(manualProvider.minRate)
 ) {
 errors.maxRate = "Maximum rate cannot be lower than minimum rate.";
 }
 if (notesError) errors.notes = notesError;
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
 scrollToFirstProviderError(validationErrors);
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
 minRate: manualProvider.minRate === "" ? undefined : Number(manualProvider.minRate),
 maxRate: manualProvider.maxRate === "" ? undefined : Number(manualProvider.maxRate),
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
 const mappedErrors = mapMaintenanceApiErrors(assignmentError, { scope: "provider" });
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

 const handleGenerateReport = async (reportType, requestIdOverride = null) => {
 const requestId = requestIdOverride || selectedRequest?.request_id;
 if (!requestId) return;
 try {
 const result = await generateReportMutation.mutateAsync({
 requestId,
 reportType,
 });
 setReportPreview({
 ...result,
 requestId,
 });
 setSendTenantSummaryDialogOpen(false);
 if (result?.message) {
 showNotification(result.message, "info");
 } else {
 showNotification(`${REPORT_TYPE_LABELS[reportType] || "Report"} generated.`, "success");
 }
 } catch (reportError) {
 const message = getMaintenanceApiErrorMessage(
 reportError,
 "Failed to generate maintenance report.",
 );
 showNotification(message, "error");
 }
 };

 const handleCopyReport = async () => {
 if (!reportPreview?.summary) return;
 setIsCopyingReport(true);
 try {
 if (!navigator.clipboard?.writeText) {
 throw new Error("Clipboard unavailable");
 }
 await navigator.clipboard.writeText(reportPreview.summary);
 showNotification("Summary copied.", "success");
 } catch {
 showNotification("Copy failed. Please select and copy the summary manually.", "error");
 } finally {
 setIsCopyingReport(false);
 }
 };

 const handleExportReport = (format) => {
 if (!reportPreview?.summary) return;
 const filenameBase = getReportFilenameBase(reportPreview, selectedRequest);
 const lines = getReportSummaryLines(reportPreview.summary);

 if (format === "pdf") {
 exportReportPdf({
 title: reportPreview.title || REPORT_TYPE_LABELS[reportPreview.reportType] || "Maintenance Report",
 subtitle: reportPreview.generatedAt
 ? `${REPORT_TYPE_LABELS[reportPreview.reportType] || "Maintenance Report"} - Generated ${fmtDateTime(reportPreview.generatedAt)}`
 : REPORT_TYPE_LABELS[reportPreview.reportType] || "Maintenance Report",
 filename: `${filenameBase}.pdf`,
 sections: [
 {
 title: "Summary",
 rows: lines,
 },
 ],
 });
 showNotification("PDF downloaded successfully.", "success");
 return;
 }

 if (format === "csv") {
 exportToCSV(
 lines.map((line, index) => ({
 lineNumber: index + 1,
 content: line,
 })),
 REPORT_EXPORT_COLUMNS,
 filenameBase,
 );
 showNotification("CSV downloaded successfully.", "success");
 return;
 }

 if (format === "txt" && reportPreview.reportType === "admin") {
 const blob = new Blob([reportPreview.summary], {
 type: "text/plain;charset=utf-8",
 });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `${filenameBase}.txt`;
 document.body.appendChild(link);
 link.click();
 link.remove();
 URL.revokeObjectURL(url);
 showNotification("TXT downloaded successfully.", "success");
 }
 };

 const handleRequestSendTenantSummary = () => {
 if (reportPreview?.reportType !== "tenant") return;
 setSendTenantSummaryDialogOpen(true);
 };

 const handleConfirmSendTenantSummary = async () => {
 const requestId = reportPreview?.requestId || selectedRequest?.request_id;
 if (!requestId || reportPreview?.reportType !== "tenant") return;

 try {
 const result = await sendTenantSummaryMutation.mutateAsync({ requestId });
 if (result?.report) {
 setReportPreview((current) =>
 current
 ? {
 ...current,
 ...result.report,
 requestId,
 }
 : current,
 );
 }
 setSendTenantSummaryDialogOpen(false);
 showNotification("Tenant summary sent successfully.", "success");
 } catch {
 showNotification("Unable to send tenant summary. Please try again.", "error");
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

 const replyTextError = validateMinimumText(
 replyMessage,
 TEXT_MIN_LENGTHS.replyMessage,
 "Reply to tenant",
 { required: replyAttachments.length === 0 },
 );

 if (replyTextError) {
 errors.reply_message = replyTextError;
 } else if (!replyMessage.trim() && replyAttachments.length === 0) {
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

 const handleUnifiedSubmit = (event) => {
 if (!selectedRequest) return;
 if (updateType === "tenant_reply") return handleSendReply(event);
 if (updateType === "admin_proof") return handleSaveProof(event);
 return handleSubmitUpdate(event);
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

 const analyticsColumns = useMemo(
 () => [
 { key: "requestId", label: "Request ID" },
 { key: "tenantName", label: "Tenant Name" },
 { key: "branchLabel", label: "Branch" },
 { key: "room", label: "Room/Unit", render: (row) => row.room || "Not recorded" },
 { key: "requestTypeLabel", label: "Request Type" },
 { key: "urgencyLabel", label: "Urgency" },
 { key: "statusLabel", label: "Status" },
 { key: "assignedProvider", label: "Assigned Service Provider" },
 { key: "createdAt", label: "Created", render: (row) => fmtDate(row.createdAt) },
 { key: "updatedAt", label: "Last Updated", render: (row) => fmtDate(row.updatedAt) },
 { key: "resolutionAt", label: "Resolution", render: (row) => row.resolutionAt ? fmtDate(row.resolutionAt) : "Not completed" },
 {
 key: "sla",
 label: "SLA",
 render: (row) => (
 <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
 row.sla?.key === "overdue"
 ? "bg-rose-50 text-rose-700"
 : row.sla?.key === "due_soon"
 ? "bg-amber-50 text-amber-700"
 : row.sla?.key === "completed"
 ? "bg-emerald-50 text-emerald-700"
 : "bg-sky-50 text-sky-700"
 }`}>
 {row.sla?.label || "On Track"}
 </span>
 ),
 },
 {
 key: "actions",
 label: "Actions",
 render: (row) => (
 <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
 <button type="button" className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted" onClick={() => setSelectedRequestId(row.requestId)}>View Request</button>
 <button type="button" className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted" onClick={() => { setSelectedRequestId(row.requestId); handleGenerateReport("admin", row.requestId); }}>Admin Report</button>
 <button type="button" className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted" onClick={() => { setSelectedRequestId(row.requestId); handleGenerateReport("tenant", row.requestId); }}>Tenant Summary</button>
 </div>
 ),
 },
 ],
 [handleGenerateReport],
 );

 const providerColumns = useMemo(
 () => [
 { key: "providerName", label: "Provider Name" },
 { key: "contactNumber", label: "Contact Number", render: (row) => row.contactNumber || "Not recorded" },
 { key: "assignedRequests", label: "Assigned" },
 { key: "completedRequests", label: "Completed" },
 { key: "activeRequests", label: "Pending/In Progress" },
 { key: "overdueRequests", label: "Overdue" },
 { key: "averageCompletionTimeLabel", label: "Avg Completion" },
 { key: "lastAssignedRequestDate", label: "Last Assigned", render: (row) => row.lastAssignedRequestDate ? fmtDate(row.lastAssignedRequestDate) : "Not recorded" },
 { key: "relatedRequestTypes", label: "Request Types", render: (row) => row.relatedRequestTypes?.join(", ") || "Not recorded" },
 ],
 [],
 );

 const currentUpdateValidationErrors =
 selectedRequest && updateType === "tenant_reply"
 ? validateReplyForm()
 : selectedRequest && updateType === "admin_proof"
 ? validateProofForm()
 : selectedRequest
 ? validateMaintenanceUpdateForm()
 : {};
 const isCurrentUpdateInvalid = Object.keys(currentUpdateValidationErrors).length > 0;
 const isManualProviderInvalid =
 providerChoice === PROVIDER_MANUAL_CHOICE &&
 Object.keys(validateProviderAssignment()).length > 0;

 return (
 <div>
 <div className="mb-4">
 <h1 className="mb-1 text-2xl font-semibold text-foreground">Maintenance</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Manage tenant repair requests, reporting, service provider performance, and branch maintenance insights.
 </p>
 </div>
 <PageShell tabs={MAINTENANCE_TABS} activeTab={activeTab} onTabChange={handleTabChange}>
 <PageShell.Summary>
 {activeTab === "requests" ? (
 <SummaryBar
 items={summaryItems}
 activeIndex={activeSummaryIndex}
 onItemClick={(index) => handleSummaryFilter(index)}
 />
 ) : null}
 </PageShell.Summary>

 <PageShell.Actions>
 {activeTab === "requests" ? (
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

 <MaintenanceExportDropdown
 options={[
 {
 key: "requests-csv",
 label: "Download List as CSV",
 onClick: handleExport,
 disabled: filteredRequests.length === 0,
 },
 ]}
 disabled={filteredRequests.length === 0}
 />

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
 onRowClick={(row) => {
 setReportPreview(null);
 setSendTenantSummaryDialogOpen(false);
 setSelectedRequestId(row.request_id);
 }}
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
 ) : null}
 </PageShell.Actions>

 <PageShell.Content>
 {activeTab === "analytics" ? (
 <div className="space-y-5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold text-card-foreground">Maintenance Analytics Dashboard</h2>
 <p className="mt-1 text-sm text-muted-foreground">Performance insights based on recorded maintenance data.</p>
 </div>
 <MaintenanceExportDropdown
 options={[
 { key: "analytics-pdf", label: "Download Analytics as PDF", onClick: () => handleExportAnalytics("pdf"), disabled: !analyticsData },
 { key: "analytics-csv", label: "Download Analytics as CSV", onClick: () => handleExportAnalytics("csv"), disabled: !analyticsData },
 ]}
 disabled={!analyticsData}
 />
 </div>
 <MaintenanceReportFilters filters={analyticsFilters} isOwner={isOwner} userBranch={userBranch} providerOptions={analyticsData?.providerOptions || []} onChange={updateAnalyticsFilter} title="Analytics filters" />
 {isAnalyticsError ? (
 <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{analyticsError?.message || "Unable to load maintenance analytics. Please try again."}</div>
 ) : isAnalyticsLoading ? (
 <DrawerSkeleton rows={5} />
 ) : (analyticsData?.requests || []).length === 0 ? (
 <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No maintenance data found for the selected filters.</div>
 ) : (
 <>
 <MaintenanceMetricsGrid summary={analyticsData?.summary} isOwner={isOwner} />
 <MaintenanceAnalyticsCharts data={analyticsData} isOwner={isOwner} />
 <section className="rounded-xl border border-border bg-card p-5">
 <h3 className="mb-3 text-sm font-semibold text-card-foreground">Filtered Maintenance Requests</h3>
 <DataTable
 columns={analyticsColumns}
 data={analyticsData?.requests || []}
 loading={isAnalyticsLoading}
 onRowClick={(row) => setSelectedRequestId(row.requestId)}
 pagination={{ page: analyticsRequestPage, pageSize: ITEMS_PER_PAGE, total: analyticsData?.requests?.length || 0, onPageChange: setAnalyticsRequestPage }}
 emptyState={{ icon: Wrench, title: "No maintenance data found", description: "No maintenance data found for the selected filters." }}
 />
 </section>
 </>
 )}
 </div>
 ) : null}

 {activeTab === "branch_reports" ? (
 <div className="space-y-5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold text-card-foreground">Branch-Level Maintenance Report</h2>
 <p className="mt-1 text-sm text-muted-foreground">Generate official branch reports from selected filters.</p>
 </div>
 <MaintenanceExportDropdown
 options={[
 { key: "branch-pdf", label: "Download as PDF", onClick: () => handleExportBranchReport("pdf"), disabled: !branchReportData },
 { key: "branch-csv", label: "Download as CSV", onClick: () => handleExportBranchReport("csv"), disabled: !branchReportData },
 ]}
 disabled={!branchReportData}
 />
 </div>
 <MaintenanceReportFilters filters={branchReportFilters} isOwner={isOwner} userBranch={userBranch} providerOptions={branchReportData?.providerOptions || analyticsData?.providerOptions || []} onChange={updateBranchReportFilter} title="Report filters" />
 {isBranchReportError ? (
 <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{branchReportError?.message || "Unable to generate branch report. Please try again."}</div>
 ) : isBranchReportLoading ? (
 <DrawerSkeleton rows={5} />
 ) : (
 <section className="rounded-xl border border-border bg-card p-5">
 <div className="mb-5">
 <h3 className="text-base font-semibold text-card-foreground">{branchReportData?.title || "Maintenance Branch Report"}</h3>
 <p className="mt-1 text-xs text-muted-foreground">
 {branchReportData?.scope?.branchLabel || "All Branches"} - {branchReportData?.filters?.dateFrom || ""} to {branchReportData?.filters?.dateTo || ""} - Generated by {branchReportData?.scope?.generatedBy || "Admin"}
 </p>
 </div>
 {(branchReportData?.requests || []).length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No maintenance data found for the selected filters.</div>
 ) : (
 <>
 <MaintenanceMetricsGrid summary={branchReportData?.summary} isOwner={isOwner} />
 <div className="mt-5 grid gap-4 lg:grid-cols-2">
 <ReportChartPanel title="Status Breakdown"><AnalyticsDonutChart data={branchReportData?.breakdowns?.status || []} /></ReportChartPanel>
 <ReportChartPanel title="Issue Type Breakdown"><AnalyticsBarChart data={branchReportData?.breakdowns?.issueType || []} bars={[{ key: "value", label: "Requests" }]} /></ReportChartPanel>
 </div>
 <div className="mt-5">
 <DataTable
 columns={analyticsColumns}
 data={branchReportData?.requests || []}
 loading={isBranchReportLoading}
 onRowClick={(row) => setSelectedRequestId(row.requestId)}
 pagination={{ page: branchReportRequestPage, pageSize: ITEMS_PER_PAGE, total: branchReportData?.requests?.length || 0, onPageChange: setBranchReportRequestPage }}
 emptyState={{ icon: FileText, title: "No report rows", description: "No maintenance data found for the selected filters." }}
 />
 </div>
 </>
 )}
 </section>
 )}
 </div>
 ) : null}

 {activeTab === "service_providers" ? (
 <div className="space-y-5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="text-lg font-semibold text-card-foreground">Service Provider Performance</h2>
 <p className="mt-1 text-sm text-muted-foreground">Assignment, completion, and overdue performance by provider.</p>
 </div>
 <MaintenanceExportDropdown options={[{ key: "providers-csv", label: "Download as CSV", onClick: handleExportProviderReport, disabled: !providerReportData }]} disabled={!providerReportData} />
 </div>
 <MaintenanceReportFilters filters={branchReportFilters} isOwner={isOwner} userBranch={userBranch} providerOptions={providerReportData?.providerOptions || []} onChange={updateBranchReportFilter} title="Provider filters" />
 {isProviderReportError ? (
 <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{providerReportError?.message || "Unable to load service provider data. Please try again."}</div>
 ) : isProviderReportLoading ? (
 <DrawerSkeleton rows={5} />
 ) : (providerReportData?.providers || []).length === 0 ? (
 <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No service provider data available yet.</div>
 ) : (
 <DataTable columns={providerColumns} data={providerReportData?.providers || []} loading={isProviderReportLoading} emptyState={{ icon: UserRound, title: "No service provider data available yet.", description: "Provider assignments will appear here once requests are assigned." }} />
 )}
 </div>
 ) : null}

 {activeTab === "requests" ? (
 <DetailDrawer
 width={1200}
 open={Boolean(selectedRequestId)}
 onClose={() => {
 setSelectedRequestId(null);
 setReportPreview(null);
 setSendTenantSummaryDialogOpen(false);
 }}
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
 onClick={() => {
 setSelectedRequestId(null);
 setReportPreview(null);
 setSendTenantSummaryDialogOpen(false);
 }}
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
 isSelectedRequestLocked ||
 selectedRequest.isArchived ||
 updateRequestMutation.isPending ||
 sendReplyMutation.isPending ||
 saveProofMutation.isPending ||
 isCurrentUpdateInvalid ||
 (updateType === "status_update" && (!hasDraftChanges || uploadingUpdateAttachment || hasBlockingWorkLogAttachment)) ||
 (updateType === "internal_note" && !draftWorkLogNote.trim()) ||
 (updateType === "admin_proof" && (uploadingProofAttachment || hasBlockingProofAttachment)) ||
 (updateType === "tenant_reply" && (uploadingReplyAttachment || hasBlockingReplyAttachment))
 }
 >
 {(updateRequestMutation.isPending || sendReplyMutation.isPending || saveProofMutation.isPending)
 ? "Saving..."
 : updateType === "tenant_reply"
 ? "Send to Tenant"
 : "Save Internal Update"}
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
 <div className="space-y-4">
 {/* ── Top row: Request Details + Service Provider ── */}
 <div className="grid gap-4 md:grid-cols-2">
 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <ClipboardList size={14} />
 Request Details
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
 <DetailDrawer.Row label="Branch">
 <div className="flex flex-wrap items-center gap-2">
 <BranchBadge branch={getRequestBranch(selectedRequest)} />
 {isOwner && !hasValidRequestBranch(selectedRequest) ? (
 <button
 type="button"
 className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50"
 onClick={handleOpenAssignBranch}
 disabled={assignBranchMutation.isPending}
 >
 Assign Branch
 </button>
 ) : null}
 </div>
 </DetailDrawer.Row>
 <DetailDrawer.Row label="Type">
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
 <DetailDrawer.Row label="Submitted" value={fmtDateTime(selectedRequest.created_at)} />
 <DetailDrawer.Row label="Last Updated" value={fmtDateTime(selectedRequest.updated_at)} />
 <DetailDrawer.Row label="SLA">
 <span
 style={{
 display: "inline-flex",
 alignItems: "center",
 gap: 6,
 padding: "4px 10px",
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
 </DetailDrawer.Section>
 {selectedRequest.description ? (
 <div className="mt-3 border-t border-border pt-3">
 <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Description
 </div>
 <p className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
 {selectedRequest.description}
 </p>
 </div>
 ) : null}
 </div>

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
 assignmentDisabled={isManualProviderInvalid}
 onChoiceChange={handleProviderChoiceChange}
 onManualChange={handleManualProviderChange}
 onSaveForFutureChange={setSaveManualProviderForFuture}
 onAssign={handleAssignProvider}
 onSuggest={handleSuggestProvider}
 onUseSuggestion={handleUseSuggestedProvider}
 />
 </div>

 {/* ── Add Maintenance Update (unified) ── */}
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="mb-3 flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <Wrench size={14} className="text-muted-foreground" />
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Add Maintenance Update
 </span>
 </div>
 {updateType === "tenant_reply" ? (
 <SectionBadge>Visible to Tenant</SectionBadge>
 ) : (
 <SectionBadge tone="amber">Admin Only</SectionBadge>
 )}
 </div>

 {isSelectedRequestLocked || selectedRequest.isArchived ? (
 <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 {selectedRequest.isArchived
 ? "Archived requests are read-only until restored."
 : "Closed and cancelled requests are locked. Updates are disabled."}
 </div>
 ) : null}

 <form id="maintenance-admin-form" className="space-y-3" onSubmit={handleUnifiedSubmit}>
 {(updateType === "tenant_reply" ? replyFormMessage :
 updateType === "admin_proof" ? proofFormMessage :
 updateFormMessage) ? (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
 {updateType === "tenant_reply" ? replyFormMessage :
 updateType === "admin_proof" ? proofFormMessage :
 updateFormMessage}
 </div>
 ) : null}

 <label className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Update Type
 </span>
 <select
 value={updateType}
 onChange={(event) => setUpdateType(event.target.value)}
 disabled={isSelectedRequestLocked || selectedRequest.isArchived}
 className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground focus:outline-none focus:ring-2"
 >
 <option value="status_update">Status Update</option>
 <option value="internal_note">Internal Note</option>
 <option value="admin_proof">Admin-only Proof</option>
 <option value="tenant_reply">Tenant Reply</option>
 </select>
 </label>

 {updateType === "status_update" ? (
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
 ) : null}

 {updateType === "status_update" ? (
 <label id="maintenance-update-field-notes" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Resolution Notes
 </span>
 <textarea
 rows="3"
 placeholder="Internal resolution or progress note for this request."
 value={draftNotes}
 onChange={(event) => {
 const value = event.target.value;
 setDraftNotes(value);
 setUpdateFieldError(
 "notes",
 validateMinimumText(value, TEXT_MIN_LENGTHS.adminRemarks, "Resolution notes", { required: false }),
 );
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
 ) : null}

 {(updateType === "status_update" || updateType === "internal_note") ? (
 <label id="maintenance-update-field-work_log_note" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 {updateType === "status_update" ? "Note (optional)" : "Note"}
 </span>
 <textarea
 rows={updateType === "internal_note" ? 4 : 3}
 placeholder={updateType === "internal_note"
 ? "Write an internal note for the admin timeline."
 : "Add an optional note to the admin timeline."}
 value={draftWorkLogNote}
 onChange={(event) => {
 const value = event.target.value;
 setDraftWorkLogNote(value);
 setUpdateFieldError(
 "work_log_note",
 validateMinimumText(
 value,
 TEXT_MIN_LENGTHS.progressUpdate,
 updateType === "internal_note" ? "Admin remarks" : "Progress update",
 { required: updateType === "internal_note" },
 ),
 );
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
 ) : null}

 {updateType === "admin_proof" ? (
 <>
 {isSelectedRequestLocked ? (
 <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-warning-dark">
 Closed and cancelled requests are locked. Admin-only proof upload is disabled.
 </div>
 ) : null}
 <label id="maintenance-proof-field-proof_note" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Note (optional)
 </span>
 <textarea
 rows="2"
 placeholder="Add context for this proof."
 value={proofNote}
 onChange={(event) => {
 const value = event.target.value;
 setProofNote(value);
 setProofFieldError(
 "proof_note",
 validateMinimumText(value, TEXT_MIN_LENGTHS.adminRemarks, "Admin remarks", { required: false }),
 );
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
 <label id="maintenance-proof-field-proof_attachments" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Proof File
 </span>
 <div
 className={`mt-2 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
 proofFieldErrors.proof_attachments ? "border-rose-500" : "border-transparent"
 }`}
 >
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted">
 <Paperclip size={14} />
 {uploadingProofAttachment ? "Uploading..." : "Attach file"}
 <input
 type="file"
 hidden
 multiple
 accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
 onChange={handleProofAttachmentUpload}
 disabled={isSelectedRequestLocked || uploadingProofAttachment || saveProofMutation.isPending}
 />
 </label>
 <span className="text-xs text-muted-foreground">Photo or PDF — stays in admin timeline only.</span>
 </div>
 {proofFieldErrors.proof_attachments ? (
 <p className="mt-1 text-xs text-rose-600">{proofFieldErrors.proof_attachments}</p>
 ) : null}
 {proofAttachments.length ? (
 <div className="mt-2 grid gap-2">
 {proofAttachments.map((attachment, index) => {
 const attachmentKey = getWorkLogAttachmentKey(attachment, index);
 const uploadStatus = attachment.uploadStatus || "uploaded";
 const statusMessage =
 uploadStatus === "uploading" ? "Uploading..." :
 uploadStatus === "uploaded" ? "Uploaded." :
 attachment.error || "Remove and try again.";
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
 <div className={`text-xs ${
 isBlockingWorkLogAttachment(attachment) ? "text-rose-600" :
 uploadStatus === "uploaded" ? "text-emerald-600" : "text-muted-foreground"
 }`}>
 {statusMessage}{uploadStatus === "uploaded" ? ` ${getMaintenanceAttachmentLabel(attachment)}` : ""}
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
 </>
 ) : null}

 {updateType === "tenant_reply" ? (
 <>
 <label id="maintenance-reply-field-reply_message" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Message to Tenant
 </span>
 <textarea
 rows="4"
 placeholder="Write a message for the tenant."
 value={replyMessage}
 onChange={(event) => {
 const value = event.target.value;
 setReplyMessage(value);
 setReplyFieldError(
 "reply_message",
 validateMinimumText(value, TEXT_MIN_LENGTHS.replyMessage, "Reply to tenant", {
 required: replyAttachments.length === 0,
 }),
 );
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
 {uploadingReplyAttachment ? "Uploading..." : "Upload file"}
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
 Photo or PDF — visible to tenant in their request history.
 </span>
 </div>
 {replyFieldErrors.reply_attachments ? (
 <p className="mt-1 text-xs text-rose-600">{replyFieldErrors.reply_attachments}</p>
 ) : null}

 {replyAttachments.length ? (
 <div className="mt-2 grid gap-2">
 {replyAttachments.map((attachment, index) => {
 const attachmentKey = getWorkLogAttachmentKey(attachment, index);
 const uploadStatus = attachment.uploadStatus || "uploaded";
 const statusMessage =
 uploadStatus === "uploading"
 ? "Uploading..."
 : uploadStatus === "uploaded"
 ? "Uploaded."
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

 <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
 <p className="text-xs text-muted-foreground">
 AI drafts are based on the request timeline. Review before sending.
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
 </>
 ) : null}

 <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
 {updateType === "tenant_reply" ? (
 <>
 <MessageSquare size={13} className="shrink-0 text-emerald-600" />
 <span>This update will be sent and shown to the tenant.</span>
 </>
 ) : (
 <>
 <ShieldCheck size={13} className="shrink-0 text-amber-600" />
 <span>This update will only appear in the admin timeline — not visible to the tenant.</span>
 </>
 )}
 </div>
 </form>
 </div>

 {/* ── Maintenance Timeline ── */}
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="mb-3 flex items-center gap-2">
 <Clock3 size={14} className="text-muted-foreground" />
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Maintenance Timeline
 </span>
 </div>

 <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
 <div>
 <div className="text-sm font-semibold text-card-foreground">Generate Report</div>
 <p className="mt-0.5 text-xs text-muted-foreground">
 Preview a report from the request details and timeline. Nothing is sent automatically.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-60"
 onClick={() => handleGenerateReport("admin")}
 disabled={generateReportMutation.isPending}
 >
 <FileText size={12} />
 {generateReportMutation.isPending ? "Generating..." : "Admin Report"}
 </button>
 <button
 type="button"
 className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-60"
 onClick={() => handleGenerateReport("tenant")}
 disabled={generateReportMutation.isPending}
 >
 <MessageSquare size={12} />
 {generateReportMutation.isPending ? "Generating..." : "Tenant Summary"}
 </button>
 </div>
 </div>

 <MaintenanceTimeline
 items={timelineItems}
 onRemoveAttachment={handleRemoveSavedAttachment}
 canRemoveAttachments={
 !selectedRequest.isArchived &&
 !removeAttachmentMutation.isPending
 }
 />
 </div>
 </div>
 )}
 </DetailDrawer>
 ) : null}
 <ReportPreviewModal
 open={Boolean(reportPreview)}
 report={reportPreview}
 isCopying={isCopyingReport}
 isSending={sendTenantSummaryMutation.isPending}
 onCopy={handleCopyReport}
 onExport={handleExportReport}
 onSendToTenant={handleRequestSendTenantSummary}
 onClose={() => {
 setReportPreview(null);
 setSendTenantSummaryDialogOpen(false);
 }}
 />
 <ConfirmationModal
 open={sendTenantSummaryDialogOpen}
 title="Send Tenant Summary?"
 message="This will send the tenant-safe maintenance summary to the tenant. Internal admin notes will not be included."
 confirmLabel="Send Summary"
 confirmTone="emerald"
 isPending={sendTenantSummaryMutation.isPending}
 onCancel={() => setSendTenantSummaryDialogOpen(false)}
 onConfirm={handleConfirmSendTenantSummary}
 />
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
 <AssignBranchModal
 open={branchAssignmentDialog.open}
 branch={branchAssignmentDialog.branch}
 error={branchAssignmentDialog.error}
 isPending={assignBranchMutation.isPending}
 onCancel={handleCloseAssignBranch}
 onConfirm={handleConfirmAssignBranch}
 onBranchChange={(branch) =>
 setBranchAssignmentDialog((current) => ({
 ...current,
 branch,
 error: "",
 }))
 }
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
