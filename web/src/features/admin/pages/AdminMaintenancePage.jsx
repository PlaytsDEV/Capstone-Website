import { useEffect, useMemo, useState } from "react";
import {
 AlertTriangle,
 CheckCircle2,
 ChevronDown,
 ChevronUp,
 ClipboardList,
 Clock3,
 FileDown,
 FileText,
 Image as ImageIcon,
 MessageSquare,
 Paperclip,
 RefreshCcw,
 Search,
 UserRound,
 Wrench,
 XCircle,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
 useAdminMaintenanceRequests,
 useMaintenanceRequest,
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
 normalizeMaintenanceAttachments,
} from "../../../shared/utils/maintenanceAttachments";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { BRANCH_OPTIONS, BRANCH_DISPLAY_NAMES } from "../../../shared/utils/constants";
import { uploadToFirebaseStorage } from "../../../shared/utils/firebaseStorageUpload";
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
 "application/pdf",
]);
const REQUIRED_NOTE_STATUSES = new Set([
 "resolved",
 "completed",
 "rejected",
 "waiting_tenant",
 "closed",
]);
const UPDATE_FIELD_ORDER = [
 "status",
 "notes",
 "assigned_to",
 "work_log_note",
 "attachments",
];

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
 !String(request.assigned_to || "").trim() &&
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

const createFilterPayload = ({
 status,
 requestType,
 urgency,
 dateFrom,
 dateTo,
 branch,
}) => {
 const filters = { limit: 200 };

 if (status && status !== "all") filters.status = status;
 if (requestType && requestType !== "all") filters.request_type = requestType;
 if (urgency && urgency !== "all") filters.urgency = urgency;
 if (dateFrom) filters.date_from = dateFrom;
 if (dateTo) filters.date_to = dateTo;
 if (branch && branch !== "all") filters.branch = branch;

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
  if (!uri) return false;
  try {
    const { protocol } = new URL(uri);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

const createAttachmentClientId = () =>
 `maintenance-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const validateProgressAttachmentFile = (file) => {
 if (!file) return "No file selected.";
 if (!SUPPORTED_PROGRESS_ATTACHMENT_TYPES.has(String(file.type || "").toLowerCase())) {
 return "This file type is not supported. Please upload a photo or PDF.";
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

const getMaintenanceApiValidationDetails = (error) => {
 const details = error?.response?.data?.error?.details;
 return Array.isArray(details) ? details : [];
};

const mapMaintenanceApiErrors = (error) => {
 const nextErrors = {};
 for (const detail of getMaintenanceApiValidationDetails(error)) {
 const rawField = String(detail?.field || "").toLowerCase();
 const message =
 detail?.message ||
 "Some required information is missing or invalid.";

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

export default function AdminMaintenancePage() {
 const { user } = useAuth();
 const isOwner = user?.role === "owner";
 const [searchParams, setSearchParams] = useSearchParams();

 const [statusFilter, setStatusFilter] = useState("all");
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
 const [draftAssignedTo, setDraftAssignedTo] = useState("");
 const [draftWorkLogNote, setDraftWorkLogNote] = useState("");
 const [draftWorkLogAttachments, setDraftWorkLogAttachments] = useState([]);
 const [uploadingUpdateAttachment, setUploadingUpdateAttachment] = useState(false);
 const [updateFieldErrors, setUpdateFieldErrors] = useState({});
 const [updateFormMessage, setUpdateFormMessage] = useState("");

 const listFilters = useMemo(
 () =>
 createFilterPayload({
 status: statusFilter,
 requestType: requestTypeFilter,
 urgency: urgencyFilter,
 dateFrom,
 dateTo,
 branch: isOwner ? branchFilter : null,
 }),
 [
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
 }),
 [branchFilter, dateFrom, dateTo, isOwner, requestTypeFilter, urgencyFilter],
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

 const requests = requestsData?.requests || [];
 const summaryRequests = summaryData?.requests || requests;
 const selectedRequest = requestDetailData?.request || null;
 const selectedRequestStatusOptions = useMemo(
 () => getAllowedAdminMaintenanceStatuses(selectedRequest?.status),
 [selectedRequest?.status],
 );
 const isSelectedRequestLocked = LOCKED_ADMIN_MAINTENANCE_STATUSES.includes(
 selectedRequest?.status || "",
 );
 const hasDraftChanges = Boolean(selectedRequest) && (
 draftStatus !== (selectedRequest.status || "") ||
 draftNotes !== (selectedRequest.notes || "") ||
 draftAssignedTo !== (selectedRequest.assigned_to || "") ||
 Boolean(draftWorkLogNote.trim()) ||
 draftWorkLogAttachments.length > 0
 );
 const hasBlockingWorkLogAttachment = draftWorkLogAttachments.some(
 isBlockingWorkLogAttachment,
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
 request.assigned_to,
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
 setDraftAssignedTo(selectedRequest.assigned_to || "");
 setDraftWorkLogNote("");
 setDraftWorkLogAttachments([]);
 setUpdateFieldErrors({});
 setUpdateFormMessage("");
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

 const validateMaintenanceUpdateForm = () => {
 const errors = {};
 const allowedStatuses = new Set(selectedRequestStatusOptions);
 const normalizedStatus = String(draftStatus || "").trim();
 const assignedTo = draftAssignedTo.trim();

 if (!normalizedStatus || !allowedStatuses.has(normalizedStatus)) {
 errors.status = "Please choose a valid status for this request.";
 }

 if (REQUIRED_NOTE_STATUSES.has(normalizedStatus) && !draftNotes.trim()) {
 errors.notes = "Admin response is required for this status update.";
 }

 if (assignedTo && assignedTo.length < 2) {
 errors.assigned_to = "Assigned staff name must be at least 2 characters.";
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
 const { downloadUrl: uri, storagePath, size } = await uploadToFirebaseStorage(
 file,
 { documentType: "maintenance-attachment" },
 );
 setDraftWorkLogAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? {
 clientId,
 name: file.name,
 uri,
 type: file.type || "application/octet-stream",
 size,
 storagePath,
 uploadStatus: "uploaded",
 }
 : attachment,
 ),
 );
 showNotification("Attachment uploaded.", "success");
 } catch (uploadError) {
 const message =
 uploadError.message || "Attachment upload failed. Please try again.";
 setDraftWorkLogAttachments((current) =>
 current.map((attachment) =>
 attachment.clientId === clientId
 ? {
 ...attachment,
 uploadStatus: "failed",
 error: "Attachment upload failed. Please try again.",
 }
 : attachment,
 ),
 );
 setUpdateFieldErrors((current) => ({
 ...current,
 attachments: "Attachment upload failed. Please try again.",
 }));
 showNotification(message, "error");
 }
 }
 } catch (uploadError) {
 showNotification(
 uploadError.message || "Attachment upload failed. Please try again.",
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

 const handleResetFilters = () => {
 setStatusFilter("all");
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
 branch: request.tenant?.branch || request.branch || "",
 requestType: getMaintenanceTypeMeta(request.request_type).label,
 urgency: getMaintenanceUrgencyMeta(request.urgency).label,
 status: formatMaintenanceStatus(request.status),
 sla: formatSlaState(request.slaState),
 assignedTo: request.assigned_to || "Unassigned",
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
 { key: "assignedTo", label: "Assigned To" },
 { key: "createdAt", label: "Created At" },
 { key: "updatedAt", label: "Updated At" },
 ],
 "maintenance-requests",
 );
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
 setUpdateFieldErrors(validationErrors);
 setUpdateFormMessage("Please fix the highlighted fields before saving.");
 scrollToFirstUpdateError(validationErrors);
 return;
 }

 const workLogAttachments = normalizeMaintenanceAttachments(draftWorkLogAttachments)
 .filter((attachment) => isRemoteUri(getMaintenanceAttachmentUri(attachment)));

 if (draftWorkLogAttachments.length > 0 && workLogAttachments.length !== draftWorkLogAttachments.length) {
 const nextErrors = {
 attachments: "Please remove the invalid attachment before saving.",
 };
 setUpdateFieldErrors(nextErrors);
 setUpdateFormMessage("Please fix the highlighted fields before saving.");
 scrollToFirstUpdateError(nextErrors);
 return;
 }

 try {
 await updateRequestMutation.mutateAsync({
 requestId: selectedRequest.request_id,
 payload: {
 status: draftStatus,
 notes: draftNotes,
 assigned_to: draftAssignedTo,
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
 if (hasMappedErrors) {
 setUpdateFieldErrors(mappedErrors);
 setUpdateFormMessage("Some required information is missing or invalid. Please review the highlighted fields.");
 scrollToFirstUpdateError(mappedErrors);
 } else {
 setUpdateFormMessage(
 submitError?.message === "Validation failed"
 ? "Some required information is missing or invalid. Please review the highlighted fields."
 : submitError.message || "Failed to update maintenance request.",
 );
 }
 showNotification(
 submitError?.message === "Validation failed"
 ? "Please fix the highlighted fields before saving."
 : submitError.message || "Failed to update maintenance request.",
 "error",
 );
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
 ...(isOwner
 ? [
 {
 key: "branch",
 label: "Branch",
 render: (row) => row.tenant?.branch || row.branch || "-",
 },
 ]
 : []),
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
 label: "Assigned To",
 render: (row) => row.assigned_to || "Unassigned",
 },
 {
 key: "created_at",
 label: "Date",
 sortable: true,
 render: (row) => fmtDate(row.created_at),
 },
 ],
 [isOwner],
 );

 return (
 <div>
 <PageShell>
 <PageShell.Summary>
 <div>
 <div className="mb-4">
 <h1 className="mb-1 text-2xl font-semibold text-foreground">Maintenance</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Manage tenant repair requests, assign work, and keep the tenant-visible
 pattern responsive up to date
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

 {isOwner ? (
 <label className="xl:col-span-3">
 <span className="sr-only">Branch</span>
 <select
 value={branchFilter}
 onChange={(event) => setBranchFilter(event.target.value)}
 className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-muted-foreground focus:border-border focus:outline-none focus:ring-2 focus:ring-slate-100"
 >
 <option value="all">All branches</option>
 {BRANCH_OPTIONS.map((branch) => (
 <option key={branch.value} value={branch.value}>
 {branch.label}
 </option>
 ))}
 </select>
 </label>
 ) : null}

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
 !hasDraftChanges
 }
 >
 {updateRequestMutation.isPending ? "Saving..." : "Save Update"}
 </button>
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
 value={selectedRequest.tenant?.branch || selectedRequest.branch || "-"}
 />
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
 <AlertTriangle size={14} />
 Issue Details
 </>
 )}
 >
 <div className="text-sm text-card-foreground">{selectedRequest.description}</div>
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <ImageIcon size={14} />
 Attachments
 </>
 )}
 >
 {selectedRequest.attachments?.length ? (
 <div className="grid gap-3 md:grid-cols-2">
 {selectedRequest.attachments.map((attachment, index) => {
 const attachmentUri = getMaintenanceAttachmentUri(attachment);
 const isViewable = isRemoteUri(attachmentUri);
 const attachmentName = getMaintenanceAttachmentName(attachment, index);
 const key = `${attachmentUri || attachmentName}-${index}`;

 if (isViewable) {
 return (
 <a
 key={key}
 href={attachmentUri}
 target="_blank"
 rel="noreferrer"
 className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted"
 >
 <AttachmentThumbnail attachment={attachment} index={index} />
 <div className="min-w-0">
 <span className="block truncate text-sm font-medium text-card-foreground">
 {attachmentName}
 </span>
 <span className="text-xs text-muted-foreground">
 {getMaintenanceAttachmentLabel(attachment)}
 </span>
 </div>
 </a>
 );
 }

 return (
 <div
 key={key}
 className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 opacity-50"
 >
 <AttachmentThumbnail attachment={attachment} index={index} />
 <div className="min-w-0">
 <span className="block truncate text-sm font-medium text-card-foreground">
 {attachmentName}
 </span>
 <span className="text-xs text-destructive">Attachment unavailable</span>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <ImageIcon size={16} />
 No attachments uploaded.
 </div>
 )}
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <RefreshCcw size={14} />
 Reopen History
 </>
 )}
 >
 {selectedRequest.reopen_history?.length ? (
 <div className="space-y-3">
 {selectedRequest.reopen_history.map((entry, index) => (
 <article
 key={`${entry.reopened_at}-${index}`}
 className="rounded-lg border border-border bg-card p-3"
 >
 <strong className="block text-xs font-semibold text-card-foreground">
 {fmtDateTime(entry.reopened_at)}
 </strong>
 <span className="text-xs text-muted-foreground">
 Reopened from {formatMaintenanceStatus(entry.previous_status)}
 </span>
 <p className="mt-2 text-sm text-muted-foreground">
 {entry.note || "No reopen note provided."}
 </p>
 </article>
 ))}
 </div>
 ) : (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <RefreshCcw size={16} />
 This request has not been reopened.
 </div>
 )}
 </DetailDrawer.Section>
 </div>
 </div>

 <div className="space-y-6">
 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <Clock3 size={14} />
 Status Timeline
 </>
 )}
 >
 {selectedRequest.statusHistory?.length ? (
 <div className="space-y-3">
 {selectedRequest.statusHistory.map((entry, index) => (
 <article
 key={`${entry.timestamp}-${entry.status}-${index}`}
 className="rounded-lg border border-border bg-card p-3"
 >
 <strong className="block text-xs font-semibold text-card-foreground">
 {fmtDateTime(entry.timestamp)}
 </strong>
 <span className="text-xs text-muted-foreground">
 {formatMaintenanceStatus(entry.status)}
 {entry.actor_name ? ` - ${entry.actor_name}` : ""}
 </span>
 <p className="mt-2 text-sm text-muted-foreground">
 {entry.note || entry.event || "Status updated."}
 </p>
 </article>
 ))}
 </div>
 ) : (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Clock3 size={16} />
 No timeline entries recorded yet.
 </div>
 )}
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <ClipboardList size={14} />
 Work Log
 </>
 )}
 >
 {selectedRequest.workLog?.length ? (
 <div className="space-y-3">
 {selectedRequest.workLog.map((entry, index) => (
 <article
 key={`${entry.logged_at}-${index}`}
 className="rounded-lg border border-border bg-card p-3"
 >
 <strong className="block text-xs font-semibold text-card-foreground">
 {fmtDateTime(entry.logged_at)}
 </strong>
 <span className="text-xs text-muted-foreground">
 {entry.actor_name || "Staff update"}
 </span>
 <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>
 {entry.attachments?.length ? (
 <div className="mt-3 grid gap-3">
 {entry.attachments.map((attachment, attachmentIndex) => {
 const attachmentUri = getMaintenanceAttachmentUri(attachment);
 const isViewable = isRemoteUri(attachmentUri);
 const attachmentName = getMaintenanceAttachmentName(attachment, attachmentIndex);
 const key = `${attachmentUri || attachmentName}-${attachmentIndex}`;

 if (isViewable) {
 return (
 <a
 key={key}
 href={attachmentUri}
 target="_blank"
 rel="noreferrer"
 className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted"
 >
 <AttachmentThumbnail attachment={attachment} index={attachmentIndex} />
 <div className="min-w-0">
 <span className="block truncate text-sm font-medium text-card-foreground">
 {attachmentName}
 </span>
 <span className="text-xs text-muted-foreground">
 {getMaintenanceAttachmentLabel(attachment)}
 </span>
 </div>
 </a>
 );
 }

 return (
 <div
 key={key}
 className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 opacity-50"
 >
 <AttachmentThumbnail attachment={attachment} index={attachmentIndex} />
 <div className="min-w-0">
 <span className="block truncate text-sm font-medium text-card-foreground">
 {attachmentName}
 </span>
 <span className="text-xs text-destructive">Attachment unavailable</span>
 </div>
 </div>
 );
 })}
 </div>
 ) : null}
 </article>
 ))}
 </div>
 ) : (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <ClipboardList size={16} />
 No work log entries yet.
 </div>
 )}
 </DetailDrawer.Section>
 </div>

 <div className="rounded-xl border border-border bg-card p-5">
 <DetailDrawer.Section
 label={(
 <>
 <MessageSquare size={14} />
 Admin Response
 </>
 )}
 >
 {isSelectedRequestLocked ? (
 <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning-dark">
 Closed and cancelled requests are locked records. Admin notes,
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
 disabled={isSelectedRequestLocked}
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

 <label id="maintenance-update-field-assigned_to" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Assign To
 </span>
 <input
 type="text"
 placeholder="Staff member or team"
 value={draftAssignedTo}
 onChange={(event) => {
 setDraftAssignedTo(event.target.value);
 clearUpdateFieldError("assigned_to");
 }}
 disabled={isSelectedRequestLocked}
 aria-invalid={Boolean(updateFieldErrors.assigned_to)}
 className={buildFieldClassName(
 Boolean(updateFieldErrors.assigned_to),
 "mt-2 h-11 w-full rounded-lg border bg-card px-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2",
 )}
 />
 {updateFieldErrors.assigned_to ? (
 <p className="mt-1 text-xs text-rose-600">{updateFieldErrors.assigned_to}</p>
 ) : null}
 </label>

 <label id="maintenance-update-field-notes" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Admin Response
 </span>
 <textarea
 rows="6"
 placeholder="This note is shown to the tenant in the mobile app."
 value={draftNotes}
 onChange={(event) => {
 setDraftNotes(event.target.value);
 clearUpdateFieldError("notes");
 }}
 disabled={isSelectedRequestLocked}
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
 Work Log Note
 </span>
 <textarea
 rows="3"
 placeholder="Optional progress note that the tenant can reference together with any update attachment."
 value={draftWorkLogNote}
 onChange={(event) => {
 setDraftWorkLogNote(event.target.value);
 clearUpdateFieldError("work_log_note");
 }}
 disabled={isSelectedRequestLocked}
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

 <label id="maintenance-update-field-attachments" className="block">
 <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 Progress Attachments
 </span>
 <div
 className={`mt-2 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
 updateFieldErrors.attachments ? "border-rose-500" : "border-transparent"
 }`}
 >
 <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-muted">
 <Paperclip size={14} />
 {uploadingUpdateAttachment ? "Uploading attachment..." : "Upload photo or PDF"}
 <input
 type="file"
 hidden
 multiple
 accept="image/jpeg,image/png,image/webp,application/pdf"
 onChange={handleWorkLogAttachmentUpload}
 disabled={isSelectedRequestLocked || uploadingUpdateAttachment}
 />
 </label>
 <span className="text-xs text-muted-foreground">
 Send progress files that the tenant can open from the request timeline.
 </span>
 </div>
 {updateFieldErrors.attachments ? (
 <p className="mt-1 text-xs text-rose-600">{updateFieldErrors.attachments}</p>
 ) : null}

 {draftWorkLogAttachments.length ? (
 <div className="mt-3 grid gap-2">
 {draftWorkLogAttachments.map((attachment, index) => {
 const attachmentUri = getMaintenanceAttachmentUri(attachment);
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
 onClick={() => handleRemoveWorkLogAttachment(attachmentKey)}
 disabled={isSelectedRequestLocked}
 >
 Remove
 </button>
 </div>
 );
 })}
 </div>
 ) : null}
 </label>
 </form>
 </DetailDrawer.Section>
 </div>
 </div>
 </div>
 </div>
 )}
 </DetailDrawer>
 </PageShell.Content>
 </PageShell>
 </div>
 );
}
