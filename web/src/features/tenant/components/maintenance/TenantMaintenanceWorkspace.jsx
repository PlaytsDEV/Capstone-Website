import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  ClipboardList,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  PhoneCall,
  Plus,
  Printer,
  RefreshCcw,
  Star,
  Trash2,
  UploadCloud,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  useCancelMaintenanceRequest,
  useConfirmMaintenanceResolution,
  useCreateMaintenanceRequest,
  useMyMaintenanceRequests,
  useReopenMaintenanceRequest,
  useRequestMaintenanceReschedule,
  useSendTenantMaintenanceReply,
  useUpdateMyMaintenanceRequest,
} from "../../../../shared/hooks/queries/useMaintenance";
import { useAuth } from "../../../../shared/hooks/useAuth";
import Pagination from "../../../../shared/components/Pagination";
import { showNotification } from "../../../../shared/utils/notification";
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  MAX_MAINTENANCE_DESCRIPTION_LENGTH,
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  REOPENABLE_MAINTENANCE_STATUSES,
  RESOLVED_MAINTENANCE_STATUSES,
  formatMaintenanceStatus,
  formatMaintenanceType,
  getMaintenanceStatusMeta,
  getMaintenanceStepIndex,
  getMaintenanceTypeMeta,
  getMaintenanceUrgencyMeta,
} from "../../../../shared/utils/maintenanceConfig";
import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  isViewableMaintenanceAttachmentUri,
  normalizeMaintenanceAttachments,
} from "../../../../shared/utils/maintenanceAttachments";
import {
  uploadMaintenanceAttachment,
  validateFile,
} from "../../../../shared/utils/firebaseStorageUpload";
import { MaintenanceConversationSection } from "../../../../shared/components/MaintenanceConversationSection";
import "../../styles/tenant-common.css";
import "../../../admin/styles/design-tokens.css";

const EMPTY_FORM_DATA = Object.freeze({
  request_type: "maintenance",
  urgency: "normal",
  description: "",
  attachments: [],
});

const RESOLVED_STATUS_SET = new Set(["resolved", "completed", "closed"]);
const REJECTED_STATUS_SET = new Set(["rejected", "cancelled", "canceled"]);

const STATUS_FILTERS = [
  { key: "active", label: "Active Requests" },
  { key: "resolved", label: "Completed / History" },
  { key: "all", label: "All Tickets" },
];

const DETAIL_TABS = [
  { key: "details", label: "Details" },
  { key: "conversation", label: "Conversation" },
  { key: "reopen", label: "Reopen" },
];

const CANONICAL_STEPS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "reviewed",       label: "Under Review"   },
  { key: "in_progress",    label: "In Progress"    },
  { key: "resolved",       label: "Resolved"       },
  { key: "completed",      label: "Completed"      },
];

const URGENCY_OPTIONS = [
  {
    key: "normal",
    label: "Normal Priority",
    eta: "24–48 hrs",
    description: "Standard repair timeline for non-disruptive facility items.",
  },
  {
    key: "urgent",
    label: "Urgent Priority",
    eta: "12–24 hrs",
    description: "Priority triage for essential appliances, power, or leaks.",
  },
  {
    key: "emergency",
    label: "Emergency Priority",
    eta: "Immediate",
    description: "Critical safety hazard, active flooding, or electrical risk.",
  },
];

function getStepIndex(s) {
  const idx = getMaintenanceStepIndex(s);
  return idx >= 0 ? idx : 0;
}

function MaintenanceStepTracker({ status, isReopened = false, reopenCount }) {
  const isReopenedTicket = isReopened === true;
  const currentIndex = isReopenedTicket ? 0 : getStepIndex(status);

  return (
    <div className="maintenance-step-tracker">
      {isReopenedTicket ? (
        <div className="step-tracker-reopened-badge">
          <AlertTriangle size={14} />
          <span>Reopened Ticket (Iteration #{reopenCount || 1}) - Under Active Review</span>
        </div>
      ) : null}
      <div className="step-tracker-track">
        {CANONICAL_STEPS.map((step, idx) => {
          const isCompleted =
            idx < currentIndex ||
            (idx === CANONICAL_STEPS.length - 1 && currentIndex === CANONICAL_STEPS.length - 1);
          const isCurrent =
            idx === currentIndex && currentIndex !== CANONICAL_STEPS.length - 1 && !isReopenedTicket;
          return (
            <div
              key={step.key}
              className={`step-item ${isCompleted ? "completed" : ""} ${isCurrent ? "active" : ""}`}
            >
              <div className="step-dot">
                {isCompleted ? <Check size={12} strokeWidth={3} /> : <span>{idx + 1}</span>}
              </div>
              <span className="step-label">{step.label}</span>
              {idx < CANONICAL_STEPS.length - 1 && <div className="step-line" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletionReportModal({ request, onClose }) {
  const report = request.completionReport || {};
  const occupancy = request.occupancyContext || {};
  const roomLabel = occupancy.unitNumber
    ? `Unit ${occupancy.unitNumber}${occupancy.bedNumber ? ` - Bed ${occupancy.bedNumber}` : ""}${occupancy.floor ? ` (Floor ${occupancy.floor})` : ""}`
    : request.roomName || "Assigned Room";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="maintenance-modal-backdrop" onClick={onClose}>
      <div className="completion-report-modal printable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileCheck size={18} color="#059669" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Official Maintenance Completion Report</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={handlePrint}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: 6, display: "grid", placeItems: "center" }}
              onClick={onClose}
              aria-label="Close Report"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="report-sheet">
          <div className="report-sheet-header">
            <div className="report-brand">
              <span className="brand-name">LilyCrest Residences</span>
              <span className="brand-sub">Facilities & Dormitory Maintenance Management</span>
            </div>
            <div className="report-id-box">
              <span className="id-label">TICKET NUMBER</span>
              <strong className="id-value">{request.ticketNumber || request.request_id || "MNT-2026-####"}</strong>
            </div>
          </div>

          <div className="report-meta-grid">
            <div>
              <span className="meta-label">Location / Room</span>
              <strong className="meta-value">{roomLabel}</strong>
            </div>
            <div>
              <span className="meta-label">Service Category</span>
              <strong className="meta-value">{formatMaintenanceType(request.request_type)}</strong>
            </div>
            <div>
              <span className="meta-label">Assigned Technician</span>
              <strong className="meta-value">
                {request.tenantVisibleProviderLabel || request.providerDetails?.tenantVisibleLabel || "LilyCrest Facilities Team"}
              </strong>
            </div>
            <div>
              <span className="meta-label">Completion Date</span>
              <strong className="meta-value">{fmtDateTime(report.finalizedAt || request.resolved_at || new Date())}</strong>
            </div>
          </div>

          <div className="report-body-section">
            <h4>1. Issue Summary</h4>
            <p>{report.summary || request.description || "Maintenance request completed and verified."}</p>
          </div>

          {report.workDone ? (
            <div className="report-body-section">
              <h4>2. Technical Work Performed</h4>
              <p>{report.workDone}</p>
            </div>
          ) : null}

          {report.partsReplaced && report.partsReplaced !== "None" ? (
            <div className="report-body-section">
              <h4>3. Parts & Materials Replaced</h4>
              <p>{report.partsReplaced}</p>
            </div>
          ) : null}

          {report.preventiveAdvice ? (
            <div className="report-body-section">
              <h4>4. Resident Preventive Care Advice</h4>
              <p>{report.preventiveAdvice}</p>
            </div>
          ) : null}

          <div className="report-sign-footer">
            <div className="sign-block">
              <div className="sign-line" />
              <span className="sign-name">{report.finalizedByName || "Operations & Facilities Supervisor"}</span>
              <span className="sign-title">Authorized Facilities Signature</span>
            </div>
            <div className="verified-stamp">
              <span>✓ VERIFIED & SIGNED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const getAttachmentKey = (attachment, index = 0) =>
  attachment?.clientId ||
  getMaintenanceAttachmentUri(attachment) ||
  `${attachment?.name || "attachment"}-${index}`;

const buildUploadedAttachment = (file, uploadResult = {}) => {
  const uri = uploadResult.downloadUrl || uploadResult.url || uploadResult.uri;
  const uploadedAttachment = uploadResult.attachment || {};
  const type =
    uploadedAttachment.type ||
    uploadResult.type ||
    uploadedAttachment.mimeType ||
    uploadResult.mimeType ||
    file.type ||
    "application/octet-stream";

  return {
    ...uploadedAttachment,
    name: file.name,
    uri,
    url: uri,
    downloadUrl: uri,
    type,
    mimeType: uploadedAttachment.mimeType || uploadResult.mimeType || type,
    size: uploadResult.size ?? file.size,
    storagePath: uploadResult.storagePath,
  };
};

const filterValidFiles = (files) => {
  const validFiles = [];
  const rejected = [];

  files.forEach((file) => {
    const check = validateFile(file);
    if (check.valid) {
      validFiles.push(file);
    } else {
      rejected.push({ file, error: check.error });
    }
  });

  rejected.forEach(({ file, error }) => {
    showNotification(error || `"${file.name}" cannot be uploaded.`, "error");
  });

  return validFiles;
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

const formatSlaLabel = (slaState) => {
  if (!slaState) return "No Target Timeline";
  if (slaState.label === "delayed") return "Delayed";
  if (slaState.label === "priority") return "Priority";
  if (slaState.label === "closed") return "Closed";
  return "On Track";
};

const getStatusIcon = (status) => {
  if (RESOLVED_STATUS_SET.has(status)) return CheckCircle2;
  if (REJECTED_STATUS_SET.has(status)) return X;
  if (["pending", "pending_review", "viewed", "reviewed"].includes(status)) return Clock;
  return RefreshCcw;
};

const getTenantVisibleAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments.filter((attachment) => !attachment?.isRemoved)
    : [];

const getLatestTenantReply = (request) => {
  const conversation = Array.isArray(request?.conversation) ? request.conversation : [];
  return conversation.length ? conversation[conversation.length - 1] : null;
};

const getReplySummary = (entry) => {
  if (!entry) return "";
  const message = typeof entry.message === "string" ? entry.message.trim() : "";
  if (message) return message;
  const attachmentCount = Array.isArray(entry.attachments) ? entry.attachments.length : 0;
  if (attachmentCount > 0) {
    return `Admin sent ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}.`;
  }
  return "Admin sent a reply.";
};

function AttachmentLink({ attachment, index, onPreview }) {
  if (attachment?.isRemoved) return null;

  const kind = getMaintenanceAttachmentKind(attachment);
  const label = getMaintenanceAttachmentLabel(attachment);
  const name = getMaintenanceAttachmentName(attachment, index);
  const uri = getMaintenanceAttachmentUri(attachment);
  const isViewable = isViewableMaintenanceAttachmentUri(uri);
  const Icon = kind === "image" ? ImageIcon : kind === "pdf" ? FileText : Paperclip;

  if (!uri) return null;

  if (kind === "image" && isViewable) {
    return (
      <div className="maintenance-photo-card">
        <button
          type="button"
          className="photo-thumb-btn"
          onClick={() => onPreview?.({ uri, name })}
          title={`Preview ${name}`}
        >
          <img
            src={uri}
            alt={name}
            loading="lazy"
          />
          <div className="photo-thumb-overlay">
            <Eye size={16} />
            <span>Preview</span>
          </div>
        </button>
        <div className="photo-meta">
          <span className="photo-name" title={name}>
            {name}
          </span>
          <div className="photo-actions">
            <button
              type="button"
              className="photo-action-btn"
              onClick={() => onPreview?.({ uri, name })}
            >
              Preview
            </button>
            <span className="action-sep">•</span>
            <a
              href={uri}
              target="_blank"
              rel="noreferrer"
              className="photo-action-link"
            >
              Open
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="maintenance-file-card">
      <div className={`file-icon-badge ${kind === "pdf" ? "is-pdf" : "is-doc"}`}>
        <Icon size={18} />
      </div>
      <div className="file-info">
        <span className="file-name" title={name}>{name}</span>
        <span className="file-kind">{label}</span>
      </div>
      <div className="file-actions">
        <a
          href={uri}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary file-open-btn"
          title="Open attachment in new tab"
        >
          <ExternalLink size={12} />
          <span>Open</span>
        </a>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  danger,
  isProcessing = false,
  onConfirm,
  onCancel,
}) {
  const getConfirmButtonClass = () => {
    if (danger || confirmVariant === "danger") return "btn btn-danger";
    if (confirmVariant === "success") return "btn btn-success";
    return "btn btn-primary";
  };

  return (
    <div
      className="maintenance-modal-backdrop"
      onClick={!isProcessing ? onCancel : undefined}
      style={{ zIndex: 10000 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 12,
          padding: "18px 20px",
          maxWidth: 380,
          width: "90%",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.16)",
          border: "1px solid var(--border)",
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 15.5, color: "var(--foreground)", fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
        <p style={{ margin: "0 0 16px", color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isProcessing}
            style={{ padding: "5px 13px", fontSize: 12, minHeight: 30, borderRadius: 8 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={getConfirmButtonClass()}
            onClick={onConfirm}
            disabled={isProcessing}
            style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            {isProcessing ? <LoaderCircle size={13} className="admin-announcements-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantMaintenanceWorkspace({ embedded = false }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [detailTab, setDetailTab] = useState("details");
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [viewingReportRequest, setViewingReportRequest] = useState(null);
  const [reopenNote, setReopenNote] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingReplyAttachment, setUploadingReplyAttachment] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM_DATA });
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingCancelRequest, setPendingCancelRequest] = useState(null);
  const [pendingDiscardModal, setPendingDiscardModal] = useState(false);
  const [pendingSubmitModal, setPendingSubmitModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set());
  const [collapsedCardIds, setCollapsedCardIds] = useState(() => new Set());
  const [rescheduleModalRequest, setRescheduleModalRequest] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rejectResolutionModalRequest, setRejectResolutionModalRequest] = useState(null);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [verifyModalRequest, setVerifyModalRequest] = useState(null);
  const [verifyRating, setVerifyRating] = useState(5);
  const [verifyHoverRating, setVerifyHoverRating] = useState(0);
  const [verifyFeedback, setVerifyFeedback] = useState("");

  const fileInputRef = useRef(null);

  const { data, isLoading } = useMyMaintenanceRequests({ limit: 50 });
  const createMutation = useCreateMaintenanceRequest();
  const updateMutation = useUpdateMyMaintenanceRequest();
  const cancelMutation = useCancelMaintenanceRequest();
  const reopenMutation = useReopenMaintenanceRequest();
  const confirmResolutionMutation = useConfirmMaintenanceResolution();
  const requestRescheduleMutation = useRequestMaintenanceReschedule();
  const sendReplyMutation = useSendTenantMaintenanceReply();

  const requests = data?.requests || [];
  const selectedRequest = useMemo(
    () => requests.find((request) => request.request_id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  const [seenConvMap, setSeenConvMap] = useState(() => {
    try {
      const map = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("lilycrest_seen_conv_")) {
          map[key] = localStorage.getItem(key);
        }
      }
      return map;
    } catch {
      return {};
    }
  });

  const getUnreadConvCount = (request, isTabActive = false) => {
    if (!request || !Array.isArray(request.conversation) || request.conversation.length === 0) {
      return 0;
    }
    if (isTabActive) {
      return 0;
    }
    const key = `lilycrest_seen_conv_${request.request_id || request._id}_tenant`;
    const rawSeen = seenConvMap[key] || localStorage.getItem(key);
    const seenTime = rawSeen ? new Date(rawSeen).getTime() : 0;

    const unread = request.conversation.filter((msg) => {
      // Messages sent by the tenant themselves are not unread to the tenant
      if (msg.sender_side === "tenant") return false;
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > seenTime;
    });

    return unread.length;
  };

  const markConversationSeen = (requestId) => {
    if (!requestId) return;
    const key = `lilycrest_seen_conv_${requestId}_tenant`;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(key, nowIso);
    } catch {}
    setSeenConvMap((prev) => ({ ...prev, [key]: nowIso }));
  };

  useEffect(() => {
    if (selectedRequestId && detailTab === "conversation") {
      markConversationSeen(selectedRequestId);
    }
  }, [selectedRequestId, detailTab, selectedRequest?.conversation?.length]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    if (statusFilter === "active") {
      return requests.filter((request) => ACTIVE_MAINTENANCE_STATUSES.includes(request.status));
    }
    return requests.filter(
      (request) =>
        RESOLVED_MAINTENANCE_STATUSES.includes(request.status) ||
        RESOLVED_STATUS_SET.has(request.status) ||
        REJECTED_STATUS_SET.has(request.status),
    );
  }, [requests, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const totalItems = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isCardExpanded = (request) => {
    const id = request.request_id || request._id;
    if (collapsedCardIds.has(id)) return false;
    if (expandedCardIds.has(id)) return true;
    return ACTIVE_MAINTENANCE_STATUSES.includes(request.status);
  };

  const toggleCardExpanded = (request) => {
    const id = request.request_id || request._id;
    const currentlyExpanded = isCardExpanded(request);
    if (currentlyExpanded) {
      setCollapsedCardIds((prev) => new Set(prev).add(id));
      setExpandedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setExpandedCardIds((prev) => new Set(prev).add(id));
      setCollapsedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const areAllFilteredExpanded = useMemo(() => {
    if (!paginatedRequests.length) return false;
    return paginatedRequests.every((r) => isCardExpanded(r));
  }, [paginatedRequests, expandedCardIds, collapsedCardIds]);

  const handleExpandAll = () => {
    const allIds = new Set(paginatedRequests.map((r) => r.request_id || r._id));
    setExpandedCardIds(allIds);
    setCollapsedCardIds(new Set());
  };

  const handleCollapseAll = () => {
    const allIds = new Set(paginatedRequests.map((r) => r.request_id || r._id));
    setCollapsedCardIds(allIds);
    setExpandedCardIds(new Set());
  };

  useEffect(() => {
    setReplyMessage("");
    setReplyAttachments([]);
    setDetailTab("details");
  }, [selectedRequestId]);

  const isEditing = Boolean(editingRequestId);
  const isSavingForm = createMutation.isPending || updateMutation.isPending || uploadingAttachment;
  const descriptionLength = formData.description.trim().length;
  const descriptionTooShort =
    descriptionLength > 0 &&
    descriptionLength < MIN_MAINTENANCE_DESCRIPTION_LENGTH;
  const attachmentCount = formData.attachments?.length || 0;
  const hasRequiredAttachment = attachmentCount >= 1;

  const isFormDirty = useMemo(() => {
    if (!showModal) return false;
    return (
      formData.description.trim().length > 0 ||
      (formData.attachments && formData.attachments.length > 0) ||
      formData.request_type !== "maintenance" ||
      formData.urgency !== "normal"
    );
  }, [showModal, formData]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      active: requests.filter((request) =>
        ACTIVE_MAINTENANCE_STATUSES.includes(request.status),
      ).length,
      resolved: requests.filter(
        (request) =>
          RESOLVED_MAINTENANCE_STATUSES.includes(request.status) ||
          RESOLVED_STATUS_SET.has(request.status) ||
          REJECTED_STATUS_SET.has(request.status),
      ).length,
    }),
    [requests],
  );

  const resetComposer = () => {
    setShowModal(false);
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setPendingDiscardModal(false);
    setPendingSubmitModal(false);
  };

  const handleRequestModalClose = () => {
    if (isFormDirty && !isEditing) {
      setPendingDiscardModal(true);
    } else {
      resetComposer();
    }
  };

  const openCreateForm = () => {
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setShowModal(true);
  };

  const openEditForm = (request) => {
    setEditingRequestId(request.request_id);
    setFormData({
      request_type: request.request_type || "maintenance",
      urgency: request.urgency || "normal",
      description: request.description || "",
      attachments: normalizeMaintenanceAttachments(request.attachments),
    });
    setShowModal(true);
    setSelectedRequestId(null);
  };

  const processAttachmentFiles = async (files) => {
    if (files.length === 0) return;

    if ((formData.attachments?.length || 0) + files.length > 5) {
      showNotification("You can upload a maximum of 5 attachments per request.", "error");
      return;
    }

    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;

    setUploadingAttachment(true);

    try {
      const uploaded = [];
      for (const file of validFiles) {
        const uploadResult = await uploadMaintenanceAttachment(file, {
          documentType: "maintenance-attachment",
          context: "maintenance_request",
          visibility: "tenant_admin",
          maintenanceRequestId: editingRequestId,
          requestId: editingRequestId,
          relatedId: editingRequestId,
        });
        uploaded.push(buildUploadedAttachment(file, uploadResult));
      }

      setFormData((current) => ({
        ...current,
        attachments: [...(current.attachments || []), ...uploaded],
      }));
      showNotification("Attachment uploaded successfully.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to upload attachment.", "error");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentUpload = (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    processAttachmentFiles(files);
    event.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter(Boolean);
    processAttachmentFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleRemoveAttachment = (attachmentKey) => {
    setFormData((current) => ({
      ...current,
      attachments: (current.attachments || []).filter(
        (entry, index) => getAttachmentKey(entry, index) !== attachmentKey,
      ),
    }));
  };

  const handleReplyAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    if (files.length === 0 || !selectedRequest) return;

    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setUploadingReplyAttachment(true);

    try {
      const uploaded = [];
      for (const file of validFiles) {
        const uploadResult = await uploadMaintenanceAttachment(file, {
          documentType: "maintenance-reply-attachment",
          context: "maintenance_reply",
          visibility: "tenant_admin",
          maintenanceRequestId: selectedRequest.request_id,
          relatedId: selectedRequest.request_id,
        });
        uploaded.push(buildUploadedAttachment(file, uploadResult));
      }

      setReplyAttachments((current) => [...current, ...uploaded]);
      showNotification("Attachment uploaded successfully.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to upload attachment.", "error");
    } finally {
      setUploadingReplyAttachment(false);
      event.target.value = "";
    }
  };

  const handleRemoveReplyAttachment = (uri) => {
    setReplyAttachments((current) =>
      current.filter((entry) => getMaintenanceAttachmentUri(entry) !== uri),
    );
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    if (!selectedRequest) return;

    const message = replyMessage.trim();
    if (!message && replyAttachments.length === 0) {
      showNotification("Please enter a message or attach a file before sending.", "error");
      return;
    }

    try {
      await sendReplyMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        payload: {
          message,
          attachments: normalizeMaintenanceAttachments(replyAttachments),
        },
      });
      setReplyMessage("");
      setReplyAttachments([]);
    } catch (error) {
      showNotification(error.message || "Failed to send reply.", "error");
    }
  };

  const handleSubmitRequest = (event) => {
    event.preventDefault();

    if (descriptionLength === 0) {
      showNotification("Please provide a description of the maintenance issue.", "error");
      return;
    }

    if (descriptionTooShort) {
      showNotification(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.`,
        "error",
      );
      return;
    }

    if (!hasRequiredAttachment) {
      showNotification(
        "Please attach at least 1 photo or document showing the issue before submitting.",
        "error",
      );
      return;
    }

    setPendingSubmitModal(true);
  };

  const confirmSubmitRequest = async () => {
    try {
      const existingAttachments = normalizeMaintenanceAttachments(formData.attachments);

      if (isEditing) {
        await updateMutation.mutateAsync({
          requestId: editingRequestId,
          data: {
            ...formData,
            attachments: existingAttachments,
          },
        });
        showNotification("Maintenance request updated.", "success");
      } else {
        await createMutation.mutateAsync({
          ...formData,
          attachments: existingAttachments,
        });
        showNotification("Maintenance request submitted successfully.", "success");
      }

      resetComposer();
    } catch (error) {
      showNotification(
        error.message || `Failed to ${isEditing ? "update" : "submit"} maintenance request.`,
        "error",
      );
      setPendingSubmitModal(false);
    }
  };

  const requestCancelConfirmation = (request) => setPendingCancelRequest(request);

  const confirmCancelRequest = async () => {
    const request = pendingCancelRequest;
    if (!request) return;

    try {
      await cancelMutation.mutateAsync(request.request_id);
      if (selectedRequestId === request.request_id) {
        setSelectedRequestId(null);
      }
      showNotification("Maintenance request cancelled.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to cancel maintenance request.",
        "error",
      );
    } finally {
      setPendingCancelRequest(null);
    }
  };

  const handleConfirmResolution = async (request, isResolved, feedbackOrOptions = "") => {
    try {
      const feedback =
        typeof feedbackOrOptions === "object"
          ? feedbackOrOptions?.feedback || ""
          : feedbackOrOptions || "";
      const rating =
        typeof feedbackOrOptions === "object"
          ? feedbackOrOptions?.rating
          : undefined;

      if (isResolved) {
        await confirmResolutionMutation.mutateAsync({
          requestId: request.request_id,
          payload: {
            action: "confirm",
            confirmed: true,
            feedback: feedback?.trim() || undefined,
            rating,
          },
        });
        setVerifyModalRequest(null);
        setVerifyFeedback("");
        setVerifyRating(5);
        showNotification("Thank you! Your rating and resolution review have been recorded.", "success");
      } else {
        await confirmResolutionMutation.mutateAsync({
          requestId: request.request_id,
          payload: {
            action: "reopen",
            confirmed: false,
            feedback: feedback?.trim() || undefined,
          },
        });
        setRejectResolutionModalRequest(null);
        setRejectionFeedback("");
        showNotification("Feedback sent to facilities. The repair has returned to In Progress.", "info");
      }
    } catch (error) {
      showNotification(error.message || "Failed to submit resolution confirmation.", "error");
    }
  };

  const handleRequestReschedule = async () => {
    if (!rescheduleModalRequest) return;
    if (!rescheduleDate || !rescheduleTime) {
      showNotification("Please select a preferred new date and time.", "error");
      return;
    }
    try {
      await requestRescheduleMutation.mutateAsync({
        requestId: rescheduleModalRequest.request_id,
        payload: {
          proposedDate: `${rescheduleDate}T${rescheduleTime}:00`,
          reason: rescheduleReason.trim() || undefined,
        },
      });
      showNotification("Reschedule request submitted to facilities management.", "success");
      setRescheduleModalRequest(null);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
    } catch (err) {
      showNotification(err.message || "Failed to submit reschedule request.", "error");
    }
  };

  const handleReopenRequest = async () => {
    if (!selectedRequest) return;

    try {
      await reopenMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        note: reopenNote.trim(),
      });
      setReopenNote("");
      setSelectedRequestId(null);
      showNotification("Maintenance request reopened and sent to admin queue.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to reopen maintenance request.",
        "error",
      );
    }
  };

  const roomContextLabel = user?.roomNumber
    ? `Unit ${user.roomNumber}${user.bedNumber ? ` - Bed ${user.bedNumber}` : ""}`
    : user?.room
    ? `Room ${user.room}`
    : "Assigned Dormitory Unit";

  return (
    <div className={embedded ? "" : "tenant-page"}>
      {/* Page Header */}
      <div className="page-header maintenance-page-header">
        <div>
          <h1>Maintenance Requests</h1>
          <p>
            Report repair, room, or facilities concerns, track real-time resolution progress, and review completion reports.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} />
          Report an Issue
        </button>
      </div>

      {/* Standalone Display-Only KPI Overview Cards */}
      <div className="maintenance-kpi-grid">
        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Active Requests</span>
            <Clock size={16} strokeWidth={2} style={{ color: "#D97706" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.active}</div>
          <p className="maintenance-kpi-card__sub">Under review or in progress</p>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Completed / History</span>
            <CheckCircle2 size={16} strokeWidth={2} style={{ color: "#059669" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.resolved}</div>
          <p className="maintenance-kpi-card__sub">Resolved and verified</p>
        </div>

        <div className="maintenance-kpi-card">
          <div className="maintenance-kpi-card__top">
            <span className="maintenance-kpi-card__label">Total Filed</span>
            <ClipboardList size={16} strokeWidth={2} style={{ color: "#2563EB" }} />
          </div>
          <div className="maintenance-kpi-card__val">{summary.total}</div>
          <p className="maintenance-kpi-card__sub">Lifetime tickets submitted</p>
        </div>
      </div>

      {/* Request Records Section with Dedicated Filter Bar */}
      <div className="section-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Request Records</h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {filteredRequests.length}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                background: "var(--muted)",
                padding: 3,
                borderRadius: 999,
                border: "1px solid var(--border)",
              }}
            >
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.key);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: statusFilter === filter.key ? "var(--card)" : "transparent",
                    color: statusFilter === filter.key ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: statusFilter === filter.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {requests.length > 0 ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={filteredRequests.length === 0}
                onClick={areAllFilteredExpanded ? handleCollapseAll : handleExpandAll}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 120,
                  gap: 6,
                  opacity: filteredRequests.length === 0 ? 0.5 : 1,
                  cursor: filteredRequests.length === 0 ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
                title={
                  filteredRequests.length === 0
                    ? "No tickets to expand in this view"
                    : areAllFilteredExpanded
                    ? "Collapse all ticket cards"
                    : "Expand all ticket cards"
                }
              >
                <ChevronsUpDown size={14} />
                <span>{areAllFilteredExpanded ? "Collapse All" : "Expand All"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>Loading maintenance requests...</p>
        ) : requests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={28} strokeWidth={1.75} style={{ color: "#64748B", marginBottom: 10 }} />
            <strong>No maintenance requests yet</strong>
            <p>
              Use the "Report an Issue" button above whenever you need assistance with room facilities, plumbing, AC, or utilities.
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={28} strokeWidth={1.75} style={{ color: "#64748B", marginBottom: 10 }} />
            <strong>
              No {statusFilter === "resolved" ? "completed or historical" : statusFilter === "active" ? "active" : "matching"} requests
            </strong>
            <p>Switch filter tabs above to view other tickets in your history.</p>
          </div>
        ) : (
          <>
            <div className="maintenance-list">
              {paginatedRequests.map((request) => {
                const requestId = request.request_id || request._id;
                const typeMeta = getMaintenanceTypeMeta(request.request_type);
                const urgencyMeta = getMaintenanceUrgencyMeta(request.urgency);
                const statusMeta = getMaintenanceStatusMeta(request.status);
                const TypeIcon = typeMeta.icon;
                const StatusIcon = getStatusIcon(request.status);
                const isPending = ["pending", "pending_review", "reviewed"].includes(request.status);
                const isReopenable = REOPENABLE_MAINTENANCE_STATUSES.includes(request.status);
                const isCompleted = ["completed", "resolved"].includes(request.status);
                const isConfirmed = Boolean(request.resolutionConfirmation?.confirmedAt);
                const hasReport = Boolean(request.completionReport && !request.completionReport.isDraft);
                const providerLabel = request.tenantVisibleProviderLabel || request.providerDetails?.tenantVisibleLabel || request.assigned_to;
                const scheduledDate = request.schedule?.scheduledDate ? new Date(request.schedule.scheduledDate) : null;
                const latestReply = getLatestTenantReply(request);
                const latestReplyAttachments = getTenantVisibleAttachments(latestReply?.attachments);
                const latestReplySummary = getReplySummary(latestReply);

                const isExpanded = isCardExpanded(request);

                return (
                  <article
                    key={requestId}
                    className="maintenance-item"
                    style={{
                      flexDirection: "column",
                      alignItems: "stretch",
                      padding: 0,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      background: "var(--card)",
                    }}
                  >
                    {/* Collapsible Card Header Bar */}
                    <div
                      onClick={() => toggleCardExpanded(request)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCardExpanded(request);
                        }
                      }}
                      style={{
                        display: "flex",
                        gap: 14,
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        cursor: "pointer",
                        userSelect: "none",
                        background: "var(--card)",
                        borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                        transition: "background 0.15s ease",
                      }}
                      aria-expanded={isExpanded}
                      title={isExpanded ? "Click to collapse" : "Click to expand details"}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: 1 }}>
                        <TypeIcon size={18} strokeWidth={2} style={{ color: typeMeta.color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{typeMeta.label}</h3>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", background: "var(--muted)", padding: "2px 8px", borderRadius: 4 }}>
                              {request.ticketNumber || `#${request.request_id?.slice(0, 8)}`}
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 0", color: "var(--muted-foreground)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fmtDate(request.created_at)} • {urgencyMeta.label} Priority
                            {!isExpanded && request.description ? (
                              <span style={{ marginLeft: 8, color: "var(--foreground)", opacity: 0.8 }}>
                                — {request.description}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          <StatusIcon size={12} />
                          {formatMaintenanceStatus(request.status)}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardExpanded(request);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: "6px 8px",
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--muted-foreground)",
                          }}
                          aria-label={isExpanded ? "Collapse card" : "Expand card"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Card Body */}
                    {isExpanded ? (
                      <div style={{ padding: "16px 20px 20px" }}>
                        {/* Reported Issue Description Callout */}
                        <div className="maintenance-description-callout">
                          <span className="maintenance-description-callout__label">Reported Issue</span>
                          <p className="maintenance-description-callout__text">
                            {request.description || "No description provided."}
                          </p>
                          {request.attachments?.length ? (
                            <div className="maintenance-detail-links" style={{ marginTop: 10 }}>
                              {request.attachments.map((attachment, idx) => (
                                <AttachmentLink
                                  key={getAttachmentKey(attachment, idx)}
                                  attachment={attachment}
                                  index={idx}
                                  onPreview={setPreviewAttachment}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {/* Step Tracker */}
                        <MaintenanceStepTracker
                          status={request.status}
                          isReopened={request.isReopened === true}
                          reopenCount={request.reopenCount}
                        />

                        {/* Provider & Schedule Badges + Reschedule Request */}
                        {(providerLabel || scheduledDate || request.rescheduleRequest?.status === "pending") ? (
                          <div className="maintenance-logistics-strip">
                            <div className="maintenance-logistics-strip__items">
                              {providerLabel ? (
                                <div className="maintenance-logistics-chip maintenance-logistics-chip--assigned">
                                  <User size={13} />
                                  <span>Assigned: {providerLabel}</span>
                                </div>
                              ) : null}
                              {scheduledDate ? (
                                <div className="maintenance-logistics-chip maintenance-logistics-chip--scheduled">
                                  <Calendar size={13} />
                                  <span>Scheduled: {fmtDateTime(scheduledDate)}</span>
                                </div>
                              ) : null}
                              {request.rescheduleRequest?.status === "pending" ? (
                                <div className="maintenance-logistics-chip maintenance-logistics-chip--reschedule-pending">
                                  <Clock size={13} />
                                  <span>Reschedule Requested for {fmtDateTime(request.rescheduleRequest.proposedDate)} (Awaiting Staff Confirmation)</span>
                                </div>
                              ) : null}
                            </div>

                            {scheduledDate && request.rescheduleRequest?.status !== "pending" && !["resolved", "completed", "closed", "cancelled"].includes(request.status) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleModalRequest(request);
                                  setRescheduleDate("");
                                  setRescheduleTime("");
                                  setRescheduleReason("");
                                }}
                                className="btn btn-secondary maintenance-reschedule-btn"
                              >
                                <Calendar size={13} /> Request Reschedule
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Official Completion Report CTA */}
                        {hasReport ? (
                          <div
                            style={{
                              marginTop: 14,
                              borderRadius: 12,
                              padding: "12px 14px",
                              background: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FileCheck size={16} color="#16A34A" />
                              <div>
                                <strong style={{ color: "#166534", fontSize: 13, display: "block" }}>Official Completion Report Available</strong>
                                <span style={{ color: "#15803D", fontSize: 12 }}>Signed & verified by Facilities Supervisor</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: 12, padding: "6px 12px" }}
                              onClick={() => setViewingReportRequest(request)}
                            >
                              View Official Report
                            </button>
                          </div>
                        ) : null}

                        {/* Resolution Prompt */}
                        {request.status === "resolved" && !isConfirmed ? (
                          <div className="resolution-confirmation-banner">
                            <div>
                              <h4>Was your maintenance issue resolved?</h4>
                              <p>Our facilities team has marked this repair as resolved. Please inspect the completed repair and submit your resident rating.</p>
                            </div>
                            <div className="resolution-banner-actions">
                              <button
                                type="button"
                                className="btn-success"
                                disabled={confirmResolutionMutation.isPending}
                                onClick={() => {
                                  setVerifyModalRequest(request);
                                  setVerifyRating(5);
                                  setVerifyHoverRating(0);
                                  setVerifyFeedback("");
                                }}
                              >
                                <Check size={14} /> Review &amp; Verify Resolution
                              </button>
                              <button
                                type="button"
                                className="btn-outline-danger"
                                disabled={confirmResolutionMutation.isPending}
                                onClick={() => {
                                  setRejectResolutionModalRequest(request);
                                  setRejectionFeedback("");
                                }}
                              >
                                <X size={14} /> No, Still an Issue
                              </button>
                            </div>
                          </div>
                        ) : isConfirmed ? (
                          <div
                            style={{
                              marginTop: 12,
                              borderRadius: 12,
                              padding: "12px 16px",
                              background: "var(--card-bg, #ffffff)",
                              border: "1px solid var(--border, #E2E8F0)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--foreground, #0F172A)", fontSize: 12, fontWeight: 700 }}>
                                <CheckCircle2 size={15} className="text-emerald-600" />
                                <span>Resolution verified by resident on {fmtDate(request.resolutionConfirmation?.confirmedAt)}</span>
                              </div>
                              {request.resolutionConfirmation?.rating ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--foreground, #0F172A)", fontSize: 12, fontWeight: 700 }}>
                                  <div style={{ display: "flex", gap: 2 }}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        size={13}
                                        style={{
                                          fill: s <= request.resolutionConfirmation.rating ? "#F59E0B" : "none",
                                          stroke: s <= request.resolutionConfirmation.rating ? "#F59E0B" : "#CBD5E1",
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <span>{request.resolutionConfirmation.rating} / 5</span>
                                </div>
                              ) : null}
                            </div>

                            {request.resolutionConfirmation?.tenantFeedback ? (
                              <p style={{ margin: "2px 0 0", color: "var(--muted-foreground, #64748B)", fontSize: 12, fontStyle: "italic" }}>
                                "{request.resolutionConfirmation.tenantFeedback}"
                              </p>
                            ) : null}

                            <div style={{ marginTop: 2, paddingTop: 6, borderTop: "1px solid var(--border, #E2E8F0)", fontSize: 11, color: "var(--muted-foreground, #64748B)" }}>
                              Observation window active: Ticket will automatically finalize as Completed after 7 days of inactivity.
                            </div>
                          </div>
                        ) : null}

                        {request.notes ? (
                          <div
                            style={{
                            marginTop: 14,
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "var(--warning-light)",
                            color: "var(--warning-dark)",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <strong style={{ display: "block", marginBottom: 4 }}>
                              Admin Response
                            </strong>
                            <span>{request.notes}</span>
                          </div>
                        </div>
                      ) : null}

                      {latestReply ? (
                        <div
                          style={{
                            marginTop: 14,
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "var(--info-light)",
                            color: "var(--info-dark)",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <MessageSquare size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ width: "100%" }}>
                            <strong style={{ display: "block", marginBottom: 4 }}>
                              Latest Admin Reply
                            </strong>
                            <span>{latestReplySummary}</span>

                            {latestReplyAttachments.length ? (
                              <div className="maintenance-detail-links" style={{ marginTop: 12 }}>
                                {latestReplyAttachments.map((attachment, index) => (
                                  <AttachmentLink
                                    key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                                    attachment={attachment}
                                    index={index}
                                    onPreview={setPreviewAttachment}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div
                        className="form-actions maintenance-detail-actions"
                        style={{ justifyContent: "space-between", marginTop: 12 }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setSelectedRequestId(request.request_id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>

                        {isReopenable ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setSelectedRequestId(request.request_id);
                              setDetailTab("reopen");
                              setReopenNote(request.reopen_note || "");
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                          >
                            <RefreshCcw size={13} />
                            <span>Reopen</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {totalItems > 0 ? (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onLimitChange={(newLimit) => {
                  setItemsPerPage(newLimit);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[5, 10, 20]}
                itemLabel="tickets"
              />
            </div>
          ) : null}
        </>
      )}
    </div>

      {/* Submit / Edit Maintenance Request Modal */}
      {showModal ? (
        <div className="maintenance-modal-backdrop" onClick={handleRequestModalClose}>
          <div className="maintenance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="maintenance-modal__header">
              <div>
                <h2>{isEditing ? "Edit Maintenance Request" : "Submit Maintenance Request"}</h2>
                <p>Provide details of the issue for fast triage and technician dispatch.</p>
              </div>
              <button type="button" aria-label="Close form" onClick={handleRequestModalClose}>
                <X size={16} />
              </button>
            </div>

            <div className="room-context-pill">
              <User size={14} />
              <span>Reporting for: <strong>{roomContextLabel}</strong> (Auto-populated from tenancy)</span>
            </div>

            <form className="maintenance-form" onSubmit={handleSubmitRequest}>
              {/* Category Picker */}
              <div className="form-group">
                <label>Select Category *</label>
                <div className="category-picker-grid">
                  {MAINTENANCE_REQUEST_TYPES.map((catKey) => {
                    const meta = getMaintenanceTypeMeta(catKey);
                    const Icon = meta.icon;
                    const isSelected = formData.request_type === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        className={`category-picker-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => setFormData((c) => ({ ...c, request_type: catKey }))}
                      >
                        <Icon size={18} color={isSelected ? "#2563EB" : meta.color} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Urgency Selector Cards */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Urgency Level *</label>
                <div className="urgency-picker-grid">
                  {URGENCY_OPTIONS.map((urgency) => {
                    const isSelected = formData.urgency === urgency.key;
                    return (
                      <div
                        key={urgency.key}
                        className={`urgency-card ${isSelected ? "selected" : ""} ${urgency.key === "emergency" ? "urgency-card--emergency" : ""}`}
                        onClick={() => setFormData((c) => ({ ...c, urgency: urgency.key }))}
                      >
                        <div className="urgency-card__header">
                          <span className="urgency-card__title">{urgency.label}</span>
                          <span className="urgency-card__eta">{urgency.eta}</span>
                        </div>
                        <p className="urgency-card__desc">{urgency.description}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Emergency Notice Banner */}
                {formData.urgency === "emergency" ? (
                  <div className="emergency-notice-banner">
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h5>Emergency Protocol Notice</h5>
                      <p>
                        For active flooding, major power sparks, gas smell, or fire hazards, please notify the 24/7 Front Desk immediately after submitting this ticket.
                      </p>
                      <span className="hotline-pill">
                        <PhoneCall size={12} /> Front Desk Hotline: (02) 8123-4567 / (0917) 123-4567
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Description Field with Live Counter */}
              <div className={`form-group${descriptionTooShort ? " has-error" : ""}`} style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="maintenance-description">Issue Description *</label>
                  <span className={`character-counter ${descriptionLength >= MIN_MAINTENANCE_DESCRIPTION_LENGTH && descriptionLength <= (MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000) ? "valid" : descriptionLength > 0 ? "invalid" : ""}`}>
                    {descriptionLength} / {MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000} characters (min {MIN_MAINTENANCE_DESCRIPTION_LENGTH})
                  </span>
                </div>
                <textarea
                  id="maintenance-description"
                  className="form-control"
                  rows="4"
                  maxLength={MAX_MAINTENANCE_DESCRIPTION_LENGTH || 1000}
                  placeholder="Describe the issue in detail (symptoms, location, when it started, and specific unit fixture affected)..."
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
                <p className="maintenance-help-text">
                  Minimum {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters. Clear descriptions help technicians arrive with the correct spare parts on the first visit.
                </p>
                {descriptionTooShort ? (
                  <p className="maintenance-field-error">
                    Description must be at least {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.
                  </p>
                ) : null}
              </div>

              {/* Attachments Dropzone & List */}
              <div className="form-group" style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <label style={{ margin: 0 }}>Photo / Document Attachments *</label>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        attachmentCount >= 5
                          ? "#D97706"
                          : attachmentCount > 0
                          ? "#2563EB"
                          : "#DC2626",
                    }}
                  >
                    {attachmentCount} / 5 {attachmentCount === 0 ? "(At least 1 required)" : ""}
                  </span>
                </div>
                <div
                  className={`maintenance-dropzone ${isDragOver ? "dragover" : ""}`}
                  onDragOver={attachmentCount < 5 ? handleDragOver : (e) => e.preventDefault()}
                  onDragLeave={attachmentCount < 5 ? handleDragLeave : undefined}
                  onDrop={attachmentCount < 5 ? handleDrop : (e) => e.preventDefault()}
                  onClick={() =>
                    !uploadingAttachment &&
                    attachmentCount < 5 &&
                    fileInputRef.current?.click()
                  }
                  style={
                    uploadingAttachment
                      ? { opacity: 0.85, cursor: "wait" }
                      : attachmentCount >= 5
                      ? {
                          opacity: 0.85,
                          cursor: "default",
                          background: "var(--muted)",
                          borderStyle: "solid",
                        }
                      : attachmentCount > 0
                      ? {
                          padding: "1rem 1.25rem",
                          borderColor: "var(--border-strong, #CBD5E1)",
                        }
                      : {}
                  }
                >
                  {uploadingAttachment ? (
                    <>
                      <LoaderCircle size={22} className="admin-announcements-spin" style={{ color: "#2563EB" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "#2563EB" }}>
                        Uploading attachments...
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Please wait while files are being uploaded
                      </span>
                    </>
                  ) : attachmentCount >= 5 ? (
                    <>
                      <CheckCircle2 size={20} strokeWidth={2} style={{ color: "#059669" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "var(--foreground)" }}>
                        Maximum 5 attachments reached
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Remove an attachment below if you want to upload a different file
                      </span>
                    </>
                  ) : attachmentCount > 0 ? (
                    <>
                      <UploadCloud size={20} style={{ color: "#2563EB" }} />
                      <span className="maintenance-dropzone__title" style={{ color: "var(--foreground)" }}>
                        Add more photos or documents ({5 - attachmentCount} remaining)
                      </span>
                      <span className="maintenance-dropzone__sub">
                        Drag & drop or click to browse additional files (JPG, PNG, WEBP, PDF up to 10MB)
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={22} color={isDragOver ? "#2563EB" : "var(--muted-foreground)"} />
                      <span className="maintenance-dropzone__title">
                        Drag & drop photos here, or click to browse
                      </span>
                      <span className="maintenance-dropzone__sub">
                        At least 1 photo or document is required (JPG, PNG, WEBP, PDF up to 10MB)
                      </span>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  id="maintenance-attachments"
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  onChange={handleAttachmentUpload}
                  disabled={uploadingAttachment || isSavingForm}
                />

                {uploadingAttachment ? (
                  <div
                    className="maintenance-attachment-row"
                    style={{
                      marginTop: 10,
                      border: "1px dashed #2563EB",
                      background: "rgba(37, 99, 235, 0.05)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                    }}
                  >
                    <LoaderCircle size={15} className="admin-announcements-spin" style={{ color: "#2563EB" }} />
                    <span style={{ color: "#2563EB", fontSize: 13, fontWeight: 600 }}>
                      Uploading attachment, please wait...
                    </span>
                  </div>
                ) : null}

                {formData.attachments?.length ? (
                  <div className="maintenance-attachment-list" style={{ marginTop: 10 }}>
                    {formData.attachments.map((attachment, index) => {
                      const attachmentKey = getAttachmentKey(attachment, index);
                      return (
                        <div key={attachmentKey} className="maintenance-attachment-row">
                          <span>{getMaintenanceAttachmentName(attachment, index)}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRemoveAttachment(attachmentKey)}
                            disabled={uploadingAttachment || isSavingForm}
                            style={{ padding: "6px 10px" }}
                            aria-label="Remove attachment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* Form Action Buttons */}
              <div className="form-actions" style={{ marginTop: 18, justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRequestModalClose}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={
                    uploadingAttachment ||
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    descriptionTooShort ||
                    descriptionLength === 0 ||
                    !hasRequiredAttachment
                  }
                  style={{ padding: "5px 14px", fontSize: 12, minHeight: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <LoaderCircle size={14} className="admin-announcements-spin" />
                  ) : null}
                  {createMutation.isPending || updateMutation.isPending
                    ? isEditing
                      ? "Saving Changes..."
                      : "Submitting..."
                    : isEditing
                    ? "Save Changes"
                    : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Ticket Details & Conversation Modal */}
      {selectedRequest ? (
        <div
          className="maintenance-modal-backdrop"
          onClick={() => {
            setSelectedRequestId(null);
            setReopenNote("");
          }}
        >
          <div
            className="maintenance-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const typeMeta = getMaintenanceTypeMeta(selectedRequest.request_type);
              const TypeIcon = typeMeta.icon || Wrench;
              const providerLabel =
                selectedRequest.tenantVisibleProviderLabel ||
                selectedRequest.providerDetails?.tenantVisibleLabel ||
                selectedRequest.assigned_to ||
                "Pending Assignment";
              const urgencyMeta = getMaintenanceUrgencyMeta(selectedRequest.urgency);

              return (
                <>
                  <div className="maintenance-modal__header">
                    <div className="maintenance-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div className="maintenance-type-badge-lg">
                          <TypeIcon size={18} strokeWidth={2.2} style={{ color: typeMeta.color || "var(--foreground)" }} />
                          <span>{typeMeta.label}</span>
                        </div>
                        <span className="maintenance-ticket-badge">
                          {selectedRequest.ticketNumber || `#${selectedRequest.request_id?.slice(0, 8)}`}
                        </span>
                      </div>
                      <p className="maintenance-submitted-meta">
                        <Clock size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                        <span>Submitted on {fmtDateTime(selectedRequest.created_at)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="maintenance-modal-close-btn"
                      aria-label="Close maintenance details"
                      onClick={() => {
                        setSelectedRequestId(null);
                        setReopenNote("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      borderBottom: "1px solid var(--border)",
                      marginBottom: 18,
                    }}
                  >
                    {DETAIL_TABS.filter(
                      (tab) =>
                        tab.key !== "reopen" ||
                        REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status),
                    ).map((tab) => {
                      const isConversation = tab.key === "conversation";
                      const unreadCount = isConversation
                        ? getUnreadConvCount(selectedRequest, detailTab === "conversation")
                        : 0;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setDetailTab(tab.key);
                            if (tab.key === "conversation") {
                              markConversationSeen(selectedRequest.request_id);
                            }
                          }}
                          style={{
                            padding: "10px 16px",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 600,
                            color: detailTab === tab.key ? "var(--color-primary, #0A1628)" : "var(--muted-foreground)",
                            borderBottom: detailTab === tab.key ? "2px solid var(--color-primary, #0A1628)" : "2px solid transparent",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{tab.label}</span>
                          {isConversation && unreadCount > 0 ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: detailTab === tab.key ? "var(--primary-light, #EFF6FF)" : "#DBEAFE",
                                color: detailTab === tab.key ? "var(--primary-dark, #1E3A8A)" : "#1E40AF",
                                border: "1px solid #93C5FD",
                              }}
                            >
                              {unreadCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === "details" ? (
                    <>
                      <MaintenanceStepTracker
                        status={selectedRequest.status}
                        isReopened={selectedRequest.isReopened === true}
                        reopenCount={selectedRequest.reopenCount}
                      />

                      <div className="maintenance-detail-grid">
                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Status</span>
                          <div className="grid-card-content">
                            <span className={`maintenance-status-chip status-${selectedRequest.status}`}>
                              <span className="status-dot" />
                              <span>{formatMaintenanceStatus(selectedRequest.status)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Urgency</span>
                          <div className="grid-card-content">
                            <span className={`maintenance-urgency-chip urgency-${selectedRequest.urgency || "normal"}`}>
                              <span>{urgencyMeta.label}</span>
                            </span>
                          </div>
                        </div>

                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Target Timeline</span>
                          <div className="grid-card-content">
                            <span className={`maintenance-sla-chip sla-${selectedRequest.slaState?.label || "on_track"}`}>
                              <span>{formatSlaLabel(selectedRequest.slaState)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Target ETA</span>
                          <div className="grid-card-content">
                            <strong className="grid-card-value">
                              <Clock size={13} style={{ marginRight: 5, color: "var(--muted-foreground)" }} />
                              <span>{urgencyMeta.estimate}</span>
                            </strong>
                          </div>
                        </div>

                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Assigned Provider</span>
                          <div className="grid-card-content">
                            <strong className="grid-card-value" title={providerLabel}>
                              <User size={13} style={{ marginRight: 5, color: "var(--muted-foreground)" }} />
                              <span>{providerLabel}</span>
                            </strong>
                          </div>
                        </div>

                        <div className="maintenance-grid-card">
                          <span className="grid-card-label">Last Updated</span>
                          <div className="grid-card-content">
                            <strong className="grid-card-value">
                              <Calendar size={13} style={{ marginRight: 5, color: "var(--muted-foreground)" }} />
                              <span>{fmtDateTime(selectedRequest.updated_at)}</span>
                            </strong>
                          </div>
                        </div>
                      </div>

                      {selectedRequest.schedule?.scheduledDate ? (
                        <div
                          style={{
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "#CFFAFE",
                            border: "1px solid #A5F3FC",
                            color: "#0E7490",
                            marginBottom: 16,
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <Calendar size={18} />
                          <div>
                            <strong style={{ display: "block", fontSize: 13 }}>
                              Scheduled Service Appointment
                            </strong>
                            <span style={{ fontSize: 12 }}>
                              {fmtDateTime(selectedRequest.schedule.scheduledDate)}
                              {selectedRequest.schedule.notes ? ` • Note: ${selectedRequest.schedule.notes}` : ""}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {selectedRequest.completionReport && !selectedRequest.completionReport.isDraft ? (
                        <div
                          style={{
                            borderRadius: 12,
                            padding: "12px 14px",
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            marginBottom: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong style={{ display: "block", color: "#166534", fontSize: 13 }}>
                              Official Completion Report Ready
                            </strong>
                            <span style={{ color: "#15803D", fontSize: 12 }}>
                              Verified by {selectedRequest.completionReport.finalizedByName || "Facilities Team"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: "6px 12px" }}
                            onClick={() => setViewingReportRequest(selectedRequest)}
                          >
                            View Report
                          </button>
                        </div>
                      ) : null}

                      <section className="maintenance-detail-section">
                        <div className="detail-section-header">
                          <ClipboardList size={16} />
                          <h3>Description</h3>
                        </div>
                        <div className="maintenance-description-card">
                          <p>{selectedRequest.description || "No description provided."}</p>
                        </div>
                      </section>

                      {getTenantVisibleAttachments(selectedRequest.attachments).length ? (
                        <section className="maintenance-detail-section">
                          <div className="detail-section-header">
                            <Paperclip size={16} />
                            <h3>Attachments ({getTenantVisibleAttachments(selectedRequest.attachments).length})</h3>
                          </div>
                          <div className="maintenance-attachments-grid">
                            {getTenantVisibleAttachments(selectedRequest.attachments).map((attachment, index) => (
                              <AttachmentLink
                                key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                                attachment={attachment}
                                index={index}
                                onPreview={setPreviewAttachment}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {selectedRequest.notes ? (
                        <div className="maintenance-detail-callout">
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <h3>Admin Response</h3>
                            <p>{selectedRequest.notes}</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="form-actions maintenance-detail-actions">
                        {["pending", "pending_review", "reviewed"].includes(selectedRequest.status) ? (
                          <button
                            type="button"
                            className="btn btn-secondary maintenance-action-btn"
                            onClick={() => openEditForm(selectedRequest)}
                            title="Edit issue description or update attachments"
                          >
                            <Pencil size={14} />
                            <span>Edit Request</span>
                          </button>
                        ) : null}

                        {["pending", "pending_review", "reviewed"].includes(selectedRequest.status) ? (
                          <button
                            type="button"
                            className="btn btn-secondary maintenance-danger-button maintenance-action-btn"
                            disabled={cancelMutation.isPending}
                            onClick={() => requestCancelConfirmation(selectedRequest)}
                            title="Cancel this maintenance ticket"
                          >
                            <Trash2 size={14} />
                            <span>Cancel Request</span>
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </>
              );
            })()}

            {detailTab === "conversation" ? (
              <MaintenanceConversationSection
                conversation={selectedRequest.conversation || []}
                currentSide="tenant"
                isActiveTicket={ACTIVE_MAINTENANCE_STATUSES.includes(selectedRequest.status)}
                ticketStatus={formatMaintenanceStatus(selectedRequest.status)}
                onSendReply={async ({ message, attachments }) => {
                  await sendReplyMutation.mutateAsync({
                    requestId: selectedRequest.request_id,
                    payload: { message, attachments },
                  });
                }}
                isSending={sendReplyMutation.isPending}
                onPreviewAttachment={setPreviewAttachment}
                requestId={selectedRequest.request_id}
              />
            ) : null}

            {detailTab === "reopen" && REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status) ? (
              <section className="maintenance-detail-section">
                <h3>Reopen Request</h3>
                <p>
                  If the issue remains unresolved or has reoccurred, specify what is missing and send it back to the active queue.
                </p>
                <textarea
                  className="form-control"
                  rows="3"
                  style={{ marginTop: 12 }}
                  placeholder="Explain why the issue remains or what still needs repair..."
                  value={reopenNote}
                  onChange={(event) => setReopenNote(event.target.value)}
                />
                <div className="form-actions maintenance-detail-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={reopenMutation.isPending || !reopenNote.trim()}
                    onClick={handleReopenRequest}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCcw size={14} />
                    {reopenMutation.isPending ? "Reopening..." : "Reopen Request"}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Completion Report Printable Modal */}
      {viewingReportRequest ? (
        <CompletionReportModal
          request={viewingReportRequest}
          onClose={() => setViewingReportRequest(null)}
        />
      ) : null}

      {/* Photo Preview Lightbox Modal */}
      {previewAttachment ? (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewAttachment(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#FFFFFF",
            }}
            aria-label="Close photo preview"
          >
            <X size={20} />
          </button>
          <img
            src={previewAttachment.uri}
            alt={previewAttachment.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: 12,
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
              objectFit: "contain",
            }}
          />
          <span style={{ color: "#CBD5E1", fontSize: 13, fontWeight: 600 }}>{previewAttachment.name}</span>
        </div>
      ) : null}

      {/* Submit Confirmation Dialog */}
      {pendingSubmitModal ? (
        <ConfirmDialog
          title={isEditing ? "Save Changes to Request?" : "Submit Maintenance Request?"}
          message={
            isEditing
              ? "Are you sure you want to save the updated details for this maintenance request?"
              : "Are you sure you want to submit this maintenance request to the dormitory management team? Please confirm all details and attachments are accurate before proceeding."
          }
          cancelLabel="Keep Editing"
          confirmLabel={
            createMutation.isPending || updateMutation.isPending
              ? isEditing
                ? "Saving..."
                : "Submitting..."
              : isEditing
              ? "Save Changes"
              : "Confirm & Submit"
          }
          confirmVariant="success"
          isProcessing={createMutation.isPending || updateMutation.isPending}
          onConfirm={confirmSubmitRequest}
          onCancel={() =>
            !createMutation.isPending &&
            !updateMutation.isPending &&
            setPendingSubmitModal(false)
          }
        />
      ) : null}

      {/* Cancel Confirmation Dialog */}
      {pendingCancelRequest ? (
        <ConfirmDialog
          title="Cancel Maintenance Request?"
          message="This request will be marked as cancelled and removed from your active queue. This action cannot be undone."
          cancelLabel="Keep Request"
          confirmLabel={cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
          danger
          onConfirm={confirmCancelRequest}
          onCancel={() => setPendingCancelRequest(null)}
        />
      ) : null}

      {/* Discard Unsaved Changes Dialog */}
      {pendingDiscardModal ? (
        <ConfirmDialog
          title="Discard Unsaved Changes?"
          message="You have unsaved changes in this maintenance request. Closing will discard your entries."
          cancelLabel="Keep Editing"
          confirmLabel="Discard Changes"
          danger
          onConfirm={resetComposer}
          onCancel={() => setPendingDiscardModal(false)}
        />
      ) : null}

      {/* Reschedule Request Modal */}
      {rescheduleModalRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 14,
              padding: 20,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} color="#0284C7" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  Request Schedule Adjustment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalRequest(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
              If you will not be available in your room during the scheduled repair, specify your preferred date and time for our facilities team.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                  Preferred Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                  Preferred Time *
                </label>
                <input
                  type="time"
                  className="form-control"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                Reason for Reschedule
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. In class until 3 PM, roommate studying"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>

            <div className="maintenance-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRescheduleModalRequest(null)}
                disabled={requestRescheduleMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRequestReschedule}
                disabled={!rescheduleDate || !rescheduleTime || requestRescheduleMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {requestRescheduleMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <Check size={14} />}
                <span>{requestRescheduleMutation.isPending ? "Submitting..." : "Submit Reschedule"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reject Resolution Feedback Modal */}
      {rejectResolutionModalRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 14,
              padding: 20,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  Report Unresolved Issue
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectResolutionModalRequest(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
              Please let our facilities team know what still needs attention so the technician can perform the necessary follow-up work.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                Feedback Note *
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Describe why the issue is not fixed (e.g. pipe still dripping, fixture still loose)..."
                value={rejectionFeedback}
                onChange={(e) => setRejectionFeedback(e.target.value)}
              />
            </div>

            <div className="maintenance-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectResolutionModalRequest(null)}
                disabled={confirmResolutionMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleConfirmResolution(rejectResolutionModalRequest, false, rejectionFeedback)}
                disabled={!rejectionFeedback.trim() || confirmResolutionMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#DC2626", borderColor: "#DC2626" }}
              >
                {confirmResolutionMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <RefreshCcw size={14} />}
                <span>{confirmResolutionMutation.isPending ? "Sending..." : "Return to In Progress"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Verify Resolution & Star Rating Modal */}
      {verifyModalRequest ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                  Rate &amp; Verify Resolution
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalRequest(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: "var(--secondary-light, #F8FAFC)", padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: "var(--foreground)" }}>
                {formatMaintenanceType(verifyModalRequest.request_type)} Request (#{verifyModalRequest.ticket_number || verifyModalRequest.request_id})
              </div>
              <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
                {verifyModalRequest.description}
              </div>
            </div>

            {/* Star Rating Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--foreground)" }}>
                How satisfied are you with the repair? *
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (verifyHoverRating || verifyRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setVerifyRating(star)}
                        onMouseEnter={() => setVerifyHoverRating(star)}
                        onMouseLeave={() => setVerifyHoverRating(0)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 4,
                          cursor: "pointer",
                          transition: "transform 0.1s ease",
                        }}
                        title={`${star} star${star > 1 ? "s" : ""}`}
                      >
                        <Star
                          size={24}
                          style={{
                            fill: active ? "#F59E0B" : "none",
                            stroke: active ? "#F59E0B" : "#94A3B8",
                            transition: "fill 0.15s ease, stroke 0.15s ease",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
                  {verifyRating === 5 && "5 / 5 — Excellent"}
                  {verifyRating === 4 && "4 / 5 — Very Good"}
                  {verifyRating === 3 && "3 / 5 — Good"}
                  {verifyRating === 2 && "2 / 5 — Fair"}
                  {verifyRating === 1 && "1 / 5 — Poor"}
                </span>
              </div>
            </div>

            {/* Feedback Comments */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}>
                Resident Feedback <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>(Optional)</span>
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Share your experience (e.g. technician punctuality, work quality, cleanliness)..."
                value={verifyFeedback}
                onChange={(e) => setVerifyFeedback(e.target.value)}
              />
            </div>

            {/* 7-Day Auto-Completion Policy Notice */}
            <div
              style={{
                background: "var(--info-light, #EFF6FF)",
                border: "1px solid var(--info-border, #BFDBFE)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 16,
                fontSize: 11,
                color: "var(--info-dark, #1E40AF)",
                lineHeight: 1.4,
              }}
            >
              <strong>7-Day Observation Period:</strong> Submitting will record your verification in the Resolved stage. The ticket will automatically close as Completed after 7 days of inactivity.
            </div>

            <div className="maintenance-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVerifyModalRequest(null)}
                disabled={confirmResolutionMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  handleConfirmResolution(verifyModalRequest, true, {
                    rating: verifyRating,
                    feedback: verifyFeedback,
                  })
                }
                disabled={confirmResolutionMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#16A34A", borderColor: "#16A34A" }}
              >
                {confirmResolutionMutation.isPending ? <LoaderCircle size={14} className="admin-announcements-spin" /> : <Check size={14} />}
                <span>{confirmResolutionMutation.isPending ? "Submitting..." : "Submit Review & Verify"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}