import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileCheck,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  useCancelMaintenanceRequest,
  useConfirmMaintenanceResolution,
  useCreateMaintenanceRequest,
  useMyMaintenanceRequests,
  useReopenMaintenanceRequest,
  useSendTenantMaintenanceReply,
  useUpdateMyMaintenanceRequest,
} from "../../../../shared/hooks/queries/useMaintenance";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { showNotification } from "../../../../shared/utils/notification";
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  REOPENABLE_MAINTENANCE_STATUSES,
  formatMaintenanceStatus,
  formatMaintenanceType,
  getMaintenanceStatusMeta,
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
import "../../styles/tenant-common.css";
import "../../../admin/styles/design-tokens.css";

const EMPTY_FORM_DATA = Object.freeze({
  request_type: "maintenance",
  urgency: "normal",
  description: "",
  attachments: [],
});

// Statuses considered "done" for the purposes of the status badge icon.
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
  { key: "provider_assigned", label: "Provider Assigned" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const getStepIndex = (st) => {
  const s = String(st || "").toLowerCase();
  if (["pending", "pending_review", "submitted", "viewed"].includes(s)) return 0;
  if (s === "provider_assigned") return 1;
  if (s === "scheduled") return 2;
  if (["in_progress", "waiting_tenant"].includes(s)) return 3;
  if (["completed", "resolved", "closed"].includes(s)) return 4;
  return 0;
};

function MaintenanceStepTracker({ status, reopenCount }) {
  const isReopened = status === "reopened";
  const currentIndex = isReopened ? 0 : getStepIndex(status);

  return (
    <div className="maintenance-step-tracker">
      {isReopened ? (
        <div className="step-tracker-reopened-badge">
          <AlertTriangle size={14} />
          <span>Reopened Ticket (Iteration #{reopenCount || 1}) - Under Active Review</span>
        </div>
      ) : null}
      <div className="step-tracker-track">
        {CANONICAL_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex || (idx === 4 && currentIndex === 4);
          const isCurrent = idx === currentIndex && currentIndex !== 4 && !isReopened;
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
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13, padding: "6px 12px" }} onClick={handlePrint}>
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: 6, display: "grid", placeItems: "center" }}
              onClick={onClose}
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
  if (!slaState) return "No SLA";
  if (slaState.label === "delayed") return "Delayed";
  if (slaState.label === "priority") return "Priority";
  if (slaState.label === "closed") return "Closed";
  return "On Track";
};

const getStatusIcon = (status) => {
  if (RESOLVED_STATUS_SET.has(status)) return CheckCircle2;
  if (REJECTED_STATUS_SET.has(status)) return X;
  if (status === "pending") return Clock;
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
      <div style={{ display: "grid", gap: 8, minWidth: 160, maxWidth: 220 }}>
        <button
          type="button"
          onClick={() => onPreview?.({ uri, name })}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            padding: 0,
            background: "var(--muted)",
            cursor: "pointer",
          }}
        >
          <img
            src={uri}
            alt={name}
            style={{
              display: "block",
              width: "100%",
              height: 120,
              objectFit: "cover",
            }}
          />
        </button>
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", wordBreak: "break-word" }}>
            {name}
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
            <button
              type="button"
              onClick={() => onPreview?.({ uri, name })}
              style={{
                border: "none",
                background: "none",
                color: "#2563EB",
                padding: 0,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Preview
            </button>
            <a href={uri} target="_blank" rel="noreferrer" style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
              Open
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={uri}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "#2563EB",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--muted)",
      }}
    >
      <Icon size={14} />
      <span>{name} ({label})</span>
    </a>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <div className="maintenance-modal-backdrop" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: "90%",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", color: "var(--muted-foreground)" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Never mind
          </button>
          <button
            type="button"
            className={danger ? "btn btn-secondary maintenance-danger-button" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantMaintenanceWorkspace({ embedded = false }) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
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
  const [statusFilter, setStatusFilter] = useState("active");
  const [pendingCancelRequest, setPendingCancelRequest] = useState(null);

  const formSectionRef = useRef(null);

  const { data, isLoading } = useMyMaintenanceRequests({ limit: 50 });
  const createMutation = useCreateMaintenanceRequest();
  const updateMutation = useUpdateMyMaintenanceRequest();
  const cancelMutation = useCancelMaintenanceRequest();
  const reopenMutation = useReopenMaintenanceRequest();
  const confirmResolutionMutation = useConfirmMaintenanceResolution();
  const sendReplyMutation = useSendTenantMaintenanceReply();

  const requests = data?.requests || [];
  const selectedRequest = useMemo(
    () => requests.find((request) => request.request_id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    if (statusFilter === "active") {
      return requests.filter((request) => ACTIVE_MAINTENANCE_STATUSES.includes(request.status));
    }
    return requests.filter((request) =>
      ["resolved", "completed", "rejected", "closed"].includes(request.status),
    );
  }, [requests, statusFilter]);

  useEffect(() => {
    setReplyMessage("");
    setReplyAttachments([]);
    setDetailTab("details");
  }, [selectedRequestId]);

  useEffect(() => {
    if (showForm && formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm, editingRequestId]);

  const isEditing = Boolean(editingRequestId);
  const isSavingForm = createMutation.isPending || updateMutation.isPending || uploadingAttachment;
  const descriptionLength = formData.description.trim().length;
  const descriptionTooShort =
    descriptionLength > 0 &&
    descriptionLength < MIN_MAINTENANCE_DESCRIPTION_LENGTH;

  const summary = useMemo(
    () => ({
      total: requests.length,
      active: requests.filter((request) =>
        ACTIVE_MAINTENANCE_STATUSES.includes(request.status),
      ).length,
      resolved: requests.filter((request) =>
        ["resolved", "completed", "rejected", "closed"].includes(request.status),
      ).length,
    }),
    [requests],
  );

  const resetComposer = () => {
    setShowForm(false);
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
  };

  const openCreateForm = () => {
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setShowForm(true);
  };

  const openEditForm = (request) => {
    setEditingRequestId(request.request_id);
    setFormData({
      request_type: request.request_type || "maintenance",
      urgency: request.urgency || "normal",
      description: request.description || "",
      attachments: normalizeMaintenanceAttachments(request.attachments),
    });
    setShowForm(true);
    setSelectedRequestId(null);
  };

  const handleAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    if (files.length === 0) return;

    if ((formData.attachments?.length || 0) + files.length > 5) {
      showNotification("You can upload a maximum of 5 attachments per request.", "error");
      event.target.value = "";
      return;
    }

    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

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
      event.target.value = "";
    }
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
      showNotification("Reply sent to admin.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to send reply.", "error");
    }
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();

    if (descriptionTooShort) {
      showNotification(
        `Description must be at least ${MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.`,
        "error",
      );
      return;
    }

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

  const handleConfirmResolution = async (request, isResolved) => {
    try {
      if (isResolved) {
        await confirmResolutionMutation.mutateAsync({
          requestId: request.request_id,
          payload: { action: "confirm", confirmed: true },
        });
        showNotification("Thank you! Issue resolution confirmed.", "success");
      } else {
        setSelectedRequestId(request.request_id);
        setDetailTab("reopen");
      }
    } catch (error) {
      showNotification(error.message || "Failed to submit resolution confirmation.", "error");
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
    : "Assigned Room";

  return (
    <div className={embedded ? "" : "tenant-page"}>
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
          onClick={() => {
            if (showForm) {
              resetComposer();
              return;
            }
            openCreateForm();
          }}
        >
          <Plus size={16} />
          {showForm ? "Close Form" : "Report an Issue"}
        </button>
      </div>

      {showForm ? (
        <div className="section-card" ref={formSectionRef}>
          <h2>{isEditing ? "Edit Maintenance Request" : "Submit Maintenance Request"}</h2>

          <div className="room-context-pill">
            <User size={14} />
            <span>Reporting for: <strong>{roomContextLabel}</strong></span>
          </div>

          <form className="maintenance-form" onSubmit={handleSubmitRequest}>
            <div className="form-group">
              <label>Select Category</label>
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
                      <Icon size={20} color={isSelected ? "#2563EB" : meta.color} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label htmlFor="maintenance-urgency">Urgency Level</label>
              <select
                id="maintenance-urgency"
                className="form-control"
                value={formData.urgency}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    urgency: event.target.value,
                  }))
                }
                required
              >
                {MAINTENANCE_URGENCY_LEVELS.map((urgency) => {
                  const meta = getMaintenanceUrgencyMeta(urgency);
                  return (
                    <option key={urgency} value={urgency}>
                      {meta.label} - {meta.description} (ETA: {meta.estimate})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className={`form-group${descriptionTooShort ? " has-error" : ""}`} style={{ marginTop: 16 }}>
              <label htmlFor="maintenance-description">Issue Description</label>
              <textarea
                id="maintenance-description"
                className="form-control"
                rows="4"
                placeholder="Describe the issue in detail (symptoms, location, when it started)..."
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                required
              />
              <p className="maintenance-help-text">
                Minimum {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters. Clear descriptions help technicians arrive with the correct tools.
              </p>
              {descriptionTooShort ? (
                <p className="maintenance-field-error">
                  Description must be at least {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.
                </p>
              ) : null}
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label htmlFor="maintenance-attachments">Photo / Proof Attachments (Max 5)</label>
              <label
                htmlFor="maintenance-attachments"
                className="btn btn-secondary"
                style={{
                  width: "fit-content",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {uploadingAttachment ? (
                  <LoaderCircle size={16} className="admin-announcements-spin" />
                ) : (
                  <Paperclip size={16} />
                )}
                {uploadingAttachment ? "Uploading..." : "Attach Photos or Files"}
              </label>
              <input
                id="maintenance-attachments"
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                onChange={handleAttachmentUpload}
                disabled={isSavingForm}
              />

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
                          style={{ padding: "6px 10px" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="form-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={resetComposer}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingForm || descriptionTooShort}
              >
                {uploadingAttachment
                  ? "Uploading..."
                  : isSavingForm
                  ? isEditing
                    ? "Saving..."
                    : "Submitting..."
                  : isEditing
                  ? "Save Changes"
                  : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="section-card" style={{ marginBottom: 20 }}>
        <h2>Overview</h2>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {[
            { label: "Active Requests", value: summary.active },
            { label: "Completed / History", value: summary.resolved },
            { label: "Total Filed", value: summary.total },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 16px",
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {item.label}
              </div>
              <strong style={{ fontSize: 22, color: "var(--foreground)" }}>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="section-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0 }}>Request Records</h2>
          {requests.length > 0 ? (
            <div style={{ display: "inline-flex", gap: 6 }}>
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border:
                      statusFilter === filter.key
                        ? "1px solid #2563EB"
                        : "1px solid var(--border)",
                    background:
                      statusFilter === filter.key ? "#EFF6FF" : "transparent",
                    color: statusFilter === filter.key ? "#1D4ED8" : "var(--muted-foreground)",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <p>Loading maintenance requests...</p>
        ) : requests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={30} />
            <div>
              <strong>No maintenance requests yet</strong>
              <p>
                Use the "Report an Issue" button whenever you need assistance with room facilities, plumbing, AC, or utilities.
              </p>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={30} />
            <div>
              <strong>No {statusFilter === "resolved" ? "completed" : "active"} requests</strong>
              <p>Switch filter tabs above to view other tickets in your history.</p>
            </div>
          </div>
        ) : (
          <div className="maintenance-list">
            {filteredRequests.map((request) => {
              const typeMeta = getMaintenanceTypeMeta(request.request_type);
              const urgencyMeta = getMaintenanceUrgencyMeta(request.urgency);
              const statusMeta = getMaintenanceStatusMeta(request.status);
              const TypeIcon = typeMeta.icon;
              const StatusIcon = getStatusIcon(request.status);
              const isPending = request.status === "pending" || request.status === "pending_review";
              const isReopenable = REOPENABLE_MAINTENANCE_STATUSES.includes(request.status);
              const isCompleted = ["completed", "resolved"].includes(request.status);
              const isConfirmed = Boolean(request.resolutionConfirmation?.confirmedAt);
              const hasReport = Boolean(request.completionReport && !request.completionReport.isDraft);
              const providerLabel = request.tenantVisibleProviderLabel || request.providerDetails?.tenantVisibleLabel || request.assigned_to;
              const scheduledDate = request.schedule?.scheduledDate ? new Date(request.schedule.scheduledDate) : null;
              const visibleRequestAttachments = getTenantVisibleAttachments(request.attachments);
              const latestReply = getLatestTenantReply(request);
              const latestReplyAttachments = getTenantVisibleAttachments(latestReply?.attachments);
              const latestReplySummary = getReplySummary(latestReply);

              return (
                <article
                  key={request.request_id || request._id}
                  className="maintenance-item"
                  style={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: `${typeMeta.color}1A`,
                          color: typeMeta.color,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <TypeIcon size={18} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0 }}>{typeMeta.label}</h3>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: 4 }}>
                            {request.ticketNumber || `#${request.request_id?.slice(0, 8)}`}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)" }}>
                          {fmtDate(request.created_at)} • {urgencyMeta.label} Priority
                        </p>
                      </div>
                    </div>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
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
                  </div>

                  <p style={{ margin: "14px 0 0", color: "var(--foreground)" }}>
                    {request.description}
                  </p>

                  {/* Step Tracker */}
                  <div style={{ marginTop: 14 }}>
                    <MaintenanceStepTracker status={request.status} reopenCount={request.reopenCount} />
                  </div>

                  {/* Provider & Schedule Badges */}
                  {(providerLabel || scheduledDate) ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                      {providerLabel ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#EFF6FF", color: "#1E40AF", fontSize: 12, fontWeight: 600 }}>
                          <User size={13} />
                          <span>Assigned: {providerLabel}</span>
                        </div>
                      ) : null}
                      {scheduledDate ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#CFFAFE", color: "#0E7490", fontSize: 12, fontWeight: 600 }}>
                          <Calendar size={13} />
                          <span>Scheduled: {fmtDateTime(scheduledDate)}</span>
                        </div>
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
                  {isCompleted ? (
                    isConfirmed ? (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, color: "#15803D", fontSize: 12, fontWeight: 600 }}>
                        <CheckCircle2 size={14} />
                        <span>Resolution verified by resident on {fmtDate(request.resolutionConfirmation?.confirmedAt)}</span>
                      </div>
                    ) : (
                      <div className="resolution-confirmation-banner">
                        <div>
                          <h4>Was your maintenance issue resolved?</h4>
                          <p>Please verify that the technician completed the repair satisfactorily.</p>
                        </div>
                        <div className="resolution-banner-actions">
                          <button
                            type="button"
                            className="btn-success"
                            disabled={confirmResolutionMutation.isPending}
                            onClick={() => handleConfirmResolution(request, true)}
                          >
                            <Check size={14} /> Yes, Resolved
                          </button>
                          <button
                            type="button"
                            className="btn-outline-danger"
                            disabled={confirmResolutionMutation.isPending}
                            onClick={() => handleConfirmResolution(request, false)}
                          >
                            <X size={14} /> No, Issue Remains
                          </button>
                        </div>
                      </div>
                    )
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
                    style={{ justifyContent: "space-between", marginTop: 16 }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedRequestId(request.request_id)}
                    >
                      View Details
                    </button>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {isPending ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEditForm(request)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      ) : null}

                      {isPending ? (
                        <button
                          type="button"
                          className="btn btn-secondary maintenance-danger-button"
                          disabled={cancelMutation.isPending}
                          onClick={() => requestCancelConfirmation(request)}
                        >
                          <Trash2 size={14} />
                          Cancel
                        </button>
                      ) : null}

                      {isReopenable ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setSelectedRequestId(request.request_id);
                            setDetailTab("reopen");
                            setReopenNote(request.reopen_note || "");
                          }}
                        >
                          <RefreshCcw size={14} />
                          Reopen
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

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
            <div className="maintenance-modal__header">
              <div className="maintenance-info">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{getMaintenanceTypeMeta(selectedRequest.request_type).label}</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: 4 }}>
                    {selectedRequest.ticketNumber || `#${selectedRequest.request_id?.slice(0, 8)}`}
                  </span>
                </div>
                <p>
                  Submitted on {fmtDateTime(selectedRequest.created_at)}
                </p>
              </div>
              <button
                type="button"
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
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key)}
                  style={{
                    padding: "10px 16px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: detailTab === tab.key ? "#2563EB" : "var(--muted-foreground)",
                    borderBottom: detailTab === tab.key ? "2px solid #2563EB" : "2px solid transparent",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === "details" ? (
              <>
                <MaintenanceStepTracker
                  status={selectedRequest.status}
                  reopenCount={selectedRequest.reopenCount}
                />

                <div className="maintenance-detail-grid">
                  <div>
                    <span>Status</span>
                    <strong>{formatMaintenanceStatus(selectedRequest.status)}</strong>
                  </div>
                  <div>
                    <span>Urgency</span>
                    <strong>{getMaintenanceUrgencyMeta(selectedRequest.urgency).label}</strong>
                  </div>
                  <div>
                    <span>SLA</span>
                    <strong>{formatSlaLabel(selectedRequest.slaState)}</strong>
                  </div>
                  <div>
                    <span>ETA</span>
                    <strong>{getMaintenanceUrgencyMeta(selectedRequest.urgency).estimate}</strong>
                  </div>
                  <div>
                    <span>Assigned Provider</span>
                    <strong>
                      {selectedRequest.tenantVisibleProviderLabel ||
                        selectedRequest.providerDetails?.tenantVisibleLabel ||
                        selectedRequest.assigned_to ||
                        "Pending Assignment"}
                    </strong>
                  </div>
                  <div>
                    <span>Last Updated</span>
                    <strong>{fmtDateTime(selectedRequest.updated_at)}</strong>
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
                  <h3>Description</h3>
                  <p>{selectedRequest.description}</p>
                </section>

                {getTenantVisibleAttachments(selectedRequest.attachments).length ? (
                  <section className="maintenance-detail-section">
                    <h3>Attachments</h3>
                    <div className="maintenance-detail-links">
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
                  {(selectedRequest.status === "pending" || selectedRequest.status === "pending_review") ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditForm(selectedRequest)}
                    >
                      <Pencil size={14} />
                      Edit Request
                    </button>
                  ) : null}

                  {(selectedRequest.status === "pending" || selectedRequest.status === "pending_review") ? (
                    <button
                      type="button"
                      className="btn btn-secondary maintenance-danger-button"
                      disabled={cancelMutation.isPending}
                      onClick={() => requestCancelConfirmation(selectedRequest)}
                    >
                      <Trash2 size={14} />
                      Cancel Request
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {detailTab === "conversation" ? (
              <>
                {selectedRequest.conversation?.length ? (
                  <section className="maintenance-detail-section">
                    <h3>Reply History</h3>
                    <div className="maintenance-timeline">
                      {selectedRequest.conversation.map((entry, index) => (
                        <article key={`${entry.created_at}-${index}`}>
                          <strong>{fmtDateTime(entry.created_at)}</strong>
                          <span>
                            {entry.sender_side === "tenant" ? "Tenant" : "Dormitory Admin"}
                            {entry.sender_name ? ` - ${entry.sender_name}` : ""}
                          </span>
                          {entry.message ? <p>{entry.message}</p> : null}
                          {getTenantVisibleAttachments(entry.attachments).length ? (
                            <div className="maintenance-detail-links" style={{ marginTop: 10 }}>
                              {getTenantVisibleAttachments(entry.attachments).map((attachment, attachmentIndex) => (
                                <AttachmentLink
                                  key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${attachmentIndex}`}
                                  attachment={attachment}
                                  index={attachmentIndex}
                                  onPreview={setPreviewAttachment}
                                />
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : (
                  <p style={{ color: "var(--muted-foreground)" }}>No replies yet.</p>
                )}

                {ACTIVE_MAINTENANCE_STATUSES.includes(selectedRequest.status) ? (
                  <section className="maintenance-detail-section">
                    <h3>Send Reply</h3>
                    <form className="maintenance-form" onSubmit={handleSendReply}>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Add an update for the admin team."
                        value={replyMessage}
                        onChange={(event) => setReplyMessage(event.target.value)}
                      />
                      <div className="form-actions" style={{ justifyContent: "space-between", marginTop: 10 }}>
                        <label
                          htmlFor="maintenance-reply-attachments"
                          className="btn btn-secondary"
                          style={{ width: "fit-content", display: "inline-flex", gap: 8 }}
                        >
                          <Paperclip size={14} />
                          {uploadingReplyAttachment ? "Uploading..." : "Attach Photo"}
                        </label>
                        <input
                          id="maintenance-reply-attachments"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                          multiple
                          onChange={handleReplyAttachmentUpload}
                          disabled={uploadingReplyAttachment || sendReplyMutation.isPending}
                          style={{ display: "none" }}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={uploadingReplyAttachment || sendReplyMutation.isPending}
                        >
                          <MessageSquare size={14} />
                          {sendReplyMutation.isPending ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                      {replyAttachments.length ? (
                        <div className="maintenance-attachment-list" style={{ marginTop: 10 }}>
                          {replyAttachments.map((attachment, index) => {
                            const uri = getMaintenanceAttachmentUri(attachment);
                            return (
                              <div
                                key={`${uri || attachment.name}-${index}`}
                                className="maintenance-attachment-row"
                              >
                                <span>{getMaintenanceAttachmentName(attachment, index)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReplyAttachment(uri)}
                                  aria-label="Remove attachment"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </form>
                  </section>
                ) : null}
              </>
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
                    disabled={reopenMutation.isPending}
                    onClick={handleReopenRequest}
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

      {viewingReportRequest ? (
        <CompletionReportModal
          request={viewingReportRequest}
          onClose={() => setViewingReportRequest(null)}
        />
      ) : null}

      {previewAttachment ? (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.8)",
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
          <span style={{ color: "#CBD5E1", fontSize: 13 }}>{previewAttachment.name}</span>
        </div>
      ) : null}

      {pendingCancelRequest ? (
        <ConfirmDialog
          title="Cancel this request?"
          message="This maintenance request will be marked as cancelled and removed from your active list. This can't be undone."
          confirmLabel={cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
          danger
          onConfirm={confirmCancelRequest}
          onCancel={() => setPendingCancelRequest(null)}
        />
      ) : null}
    </div>
  );
}