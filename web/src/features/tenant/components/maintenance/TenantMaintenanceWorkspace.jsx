import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  useCancelMaintenanceRequest,
  useCreateMaintenanceRequest,
  useMyMaintenanceRequests,
  useReopenMaintenanceRequest,
  useSendTenantMaintenanceReply,
  useUpdateMyMaintenanceRequest,
} from "../../../../shared/hooks/queries/useMaintenance";
import { showNotification } from "../../../../shared/utils/notification";
import {
  ACTIVE_MAINTENANCE_STATUSES,
  MAINTENANCE_REQUEST_TYPES,
  MAINTENANCE_URGENCY_LEVELS,
  MIN_MAINTENANCE_DESCRIPTION_LENGTH,
  REOPENABLE_MAINTENANCE_STATUSES,
  formatMaintenanceStatus,
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
  request_type: "other",
  urgency: "normal",
  description: "",
  attachments: [],
});

// Statuses considered "done" for the purposes of the status badge icon.
const RESOLVED_STATUS_SET = new Set(["resolved", "completed", "closed"]);
const REJECTED_STATUS_SET = new Set(["rejected", "cancelled", "canceled"]);

const STATUS_FILTERS = [
  { key: "active", label: "Active" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const DETAIL_TABS = [
  { key: "details", label: "Details" },
  { key: "conversation", label: "Conversation" },
  { key: "reopen", label: "Reopen" },
];

const createAttachmentClientId = () =>
  `maintenance-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isLocalPendingAttachment = (attachment) =>
  attachment?.uploadStatus === "pending" &&
  typeof File !== "undefined" &&
  attachment?.file instanceof File;

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

// Runs validateFile() across a FileList/array and returns { validFiles, rejected }.
// Any rejected file surfaces a notification immediately so failures are caught
// before an upload call is ever made (previously only new-request attachments
// got this check; reply + edit-mode uploads went straight to the network).
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

// Small non-color cue alongside each status badge so status isn't communicated
// by background/text color alone.
const getStatusIcon = (status) => {
  if (RESOLVED_STATUS_SET.has(status)) return CheckCircle2;
  if (REJECTED_STATUS_SET.has(status)) return X;
  if (status === "pending") return Clock;
  return RefreshCcw;
};

const cloneAttachments = (attachments) => normalizeMaintenanceAttachments(attachments);
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
      <div
        style={{
          display: "grid",
          gap: 8,
          minWidth: 160,
          maxWidth: 220,
        }}
      >
        <button
          type="button"
          onClick={() => onPreview?.({ uri, name })}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            padding: 0,
            background: "var(--muted)",
            cursor: "pointer",
            boxShadow: "0 8px 24px color-mix(in srgb, var(--foreground) 12%, transparent)",
          }}
        >
          <img
            src={uri}
            alt={name}
            style={{
              display: "block",
              width: "100%",
              height: 148,
              objectFit: "cover",
              background: "var(--border)",
            }}
          />
        </button>

        <div style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground)",
              wordBreak: "break-word",
            }}
          >
            {name}
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
            <button
              type="button"
              onClick={() => onPreview?.({ uri, name })}
              style={{
                border: "none",
                background: "none",
                color: "var(--info)",
                padding: 0,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Preview Photo
            </button>
            <a
              href={uri}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
            >
              Open Original
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isViewable) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: "var(--muted-foreground)",
          fontSize: 13,
          width: "fit-content",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <Icon size={14} />
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span style={{ color: "var(--neutral)" }}>Attachment unavailable</span>
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
        gap: 10,
        color: "var(--info)",
        fontSize: 13,
        width: "fit-content",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--muted)",
      }}
    >
      <Icon size={14} />
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      </div>
    </a>
  );
}

// Lightweight in-app confirm dialog, styled to match the maintenance modal
// rather than falling back to the browser's window.confirm().
function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }) {
  return (
    <div
      className="maintenance-modal-backdrop"
      onClick={onCancel}
      style={{ zIndex: 10000 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: "90%",
          boxShadow: "0 24px 64px color-mix(in srgb, var(--foreground) 20%, transparent)",
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
  const [showForm, setShowForm] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [detailTab, setDetailTab] = useState("details");
  const [previewAttachment, setPreviewAttachment] = useState(null);
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

  // Jump the composer into view whenever it opens for editing, since the
  // "Edit" button lives inside a card further down the page.
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
    setFormData({ ...EMPTY_FORM_DATA });
    setShowForm(false);
    setEditingRequestId(null);
  };

  const openCreateForm = () => {
    setEditingRequestId(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setShowForm(true);
  };

  const openEditForm = (request) => {
    setSelectedRequestId(null);
    setEditingRequestId(request.request_id);
    setFormData({
      request_type: request.request_type || "other",
      urgency: request.urgency || "normal",
      description: request.description || "",
      attachments: cloneAttachments(request.attachments),
    });
    setShowForm(true);
  };

  const handleAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter(Boolean);
    if (files.length === 0) return;

    if (!isEditing) {
      const validFiles = filterValidFiles(files);
      const staged = validFiles.map((file) => ({
        clientId: createAttachmentClientId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        file,
        uploadStatus: "pending",
      }));

      if (staged.length > 0) {
        setFormData((current) => ({
          ...current,
          attachments: [...(current.attachments || []), ...staged],
        }));
        showNotification(
          `${staged.length} attachment${staged.length === 1 ? "" : "s"} ready to upload when you submit.`,
          "success",
        );
      }

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
      showNotification("Attachment uploaded.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to upload attachment.",
        "error",
      );
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
      showNotification("Attachment uploaded.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to upload attachment.",
        "error",
      );
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
      showNotification("Reply sent.", "success");
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

    let createdRequestId = "";

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
        const created = await createMutation.mutateAsync({
          ...formData,
          attachments: existingAttachments,
        });
        const createdRequest = created?.request || created;
        const requestId = createdRequest?.request_id || createdRequest?._id;
        createdRequestId = requestId || "";
        const pendingAttachments = (formData.attachments || []).filter(isLocalPendingAttachment);

        if (pendingAttachments.length > 0) {
          if (!requestId) {
            throw new Error("Request was created, but attachment upload could not continue. Please reopen the request and try again.");
          }

          setUploadingAttachment(true);
          const uploadedAttachments = [];

          try {
            for (const pendingAttachment of pendingAttachments) {
              const uploadResult = await uploadMaintenanceAttachment(pendingAttachment.file, {
                documentType: "maintenance-attachment",
                context: "maintenance_request",
                visibility: "tenant_admin",
                maintenanceRequestId: requestId,
                requestId,
                relatedId: requestId,
              });
              uploadedAttachments.push(buildUploadedAttachment(pendingAttachment.file, uploadResult));
            }
          } finally {
            setUploadingAttachment(false);
          }

          await updateMutation.mutateAsync({
            requestId,
            data: {
              request_type: createdRequest?.request_type || formData.request_type,
              urgency: createdRequest?.urgency || formData.urgency,
              description: createdRequest?.description || formData.description,
              attachments: [
                ...normalizeMaintenanceAttachments(createdRequest?.attachments || existingAttachments),
                ...normalizeMaintenanceAttachments(uploadedAttachments),
              ],
            },
          });
        }

        showNotification("Maintenance request submitted.", "success");
      }

      resetComposer();
    } catch (error) {
      setUploadingAttachment(false);
      if (!isEditing && createdRequestId) {
        resetComposer();
        setSelectedRequestId(createdRequestId);
        showNotification(
          error.message ||
            "Request submitted, but one or more attachments failed to upload. Open the pending request to retry.",
          "error",
        );
        return;
      }

      showNotification(
        error.message ||
          `Failed to ${isEditing ? "update" : "submit"} maintenance request.`,
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

  const handleReopenRequest = async () => {
    if (!selectedRequest) return;

    try {
      await reopenMutation.mutateAsync({
        requestId: selectedRequest.request_id,
        note: reopenNote.trim(),
      });
      setReopenNote("");
      setSelectedRequestId(null);
      showNotification("Maintenance request reopened.", "success");
    } catch (error) {
      showNotification(
        error.message || "Failed to reopen maintenance request.",
        "error",
      );
    }
  };

  return (
    <div className={embedded ? "" : "tenant-page"}>
      <div className="page-header maintenance-page-header">
        <div>
          <h1>
            Maintenance Requests
          </h1>
          <p>
            Report repair, room, or bed concerns, check request progress, and
            review admin responses from one place.
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
          {showForm ? "Close Form" : "New Request"}
        </button>
      </div>

      {showForm ? (
        <div className="section-card" ref={formSectionRef}>
          <h2>{isEditing ? "Edit Maintenance Request" : "Submit Maintenance Request"}</h2>
          <form className="maintenance-form" onSubmit={handleSubmitRequest}>
            <div className="form-group">
              <label htmlFor="maintenance-type">Request Type</label>
              <select
                id="maintenance-type"
                className="form-control"
                value={formData.request_type}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    request_type: event.target.value,
                  }))
                }
                required
              >
                {MAINTENANCE_REQUEST_TYPES.map((requestType) => (
                  <option key={requestType} value={requestType}>
                    {getMaintenanceTypeMeta(requestType).label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="maintenance-urgency">Urgency</label>
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
                      {meta.label} - {meta.description}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className={`form-group${descriptionTooShort ? " has-error" : ""}`}>
              <label htmlFor="maintenance-description">Description</label>
              <textarea
                id="maintenance-description"
                className="form-control"
                rows="5"
                placeholder="Describe the problem in detail."
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
                Include location, symptoms, and when the issue started.
              </p>
              {descriptionTooShort ? (
                <p className="maintenance-field-error">
                  Description must be at least {MIN_MAINTENANCE_DESCRIPTION_LENGTH} characters.
                </p>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="maintenance-attachments">Attachments</label>
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
                {uploadingAttachment
                  ? "Uploading..."
                  : isEditing
                    ? "Upload photo or file"
                    : "Attach photo or file"}
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
                <div className="maintenance-attachment-list">
                  {formData.attachments.map((attachment, index) => {
                    const attachmentKey = getAttachmentKey(attachment, index);
                    const isPending = attachment.uploadStatus === "pending";

                    return (
                    <div
                      key={attachmentKey}
                      className="maintenance-attachment-row"
                    >
                      <span>
                        {getMaintenanceAttachmentName(attachment, index)}
                        {isPending ? " - uploads on submit" : ""}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          handleRemoveAttachment(attachmentKey)
                        }
                        style={{ padding: "6px 10px" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="maintenance-help-text">
                  Attach JPEG, PNG, WebP, HEIC, HEIF, or PDF files for clearer troubleshooting.
                  New request files upload after the request is created.
                </p>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetComposer}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingForm || descriptionTooShort}
              >
                {uploadingAttachment
                  ? "Uploading files..."
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
            { label: "Total Requests", value: summary.total },
            { label: "Active", value: summary.active },
            { label: "Resolved", value: summary.resolved },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
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
            marginBottom: 4,
          }}
        >
          <h2 style={{ margin: 0 }}>Request History</h2>
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
                        ? "1px solid var(--info)"
                        : "1px solid var(--border)",
                    background:
                      statusFilter === filter.key ? "var(--info-light)" : "transparent",
                    color: statusFilter === filter.key ? "var(--info-dark)" : "var(--muted-foreground)",
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
                Use the new request button when you need help with repairs,
                utilities, or room concerns.
              </p>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="maintenance-empty-state">
            <ClipboardList size={30} />
            <div>
              <strong>No {statusFilter === "resolved" ? "resolved" : "active"} requests</strong>
              <p>Switch filters above to see the rest of your request history.</p>
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
              const isPending = request.status === "pending";
              const isReopenable = REOPENABLE_MAINTENANCE_STATUSES.includes(request.status);
              const visibleRequestAttachments = getTenantVisibleAttachments(request.attachments);
              const latestReply = getLatestTenantReply(request);
              const latestReplyAttachments = getTenantVisibleAttachments(latestReply?.attachments);
              const latestReplySummary = getReplySummary(latestReply);

              return (
                <article
                  key={request.request_id}
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
                        <h3 style={{ margin: "0 0 4px" }}>{typeMeta.label}</h3>
                        <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
                          {fmtDate(request.created_at)} - {urgencyMeta.label}
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

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      color: "var(--muted-foreground)",
                      fontSize: 13,
                    }}
                  >
                    <span>ETA: {urgencyMeta.estimate}</span>
                    <span>SLA: {formatSlaLabel(request.slaState)}</span>
                    <span>Attachments: {visibleRequestAttachments.length}</span>
                    {request.reopen_note ? <span>Reopen note saved</span> : null}
                  </div>

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
                <h3>{getMaintenanceTypeMeta(selectedRequest.request_type).label}</h3>
                <p>
                  Request ID: {selectedRequest.request_id} - Submitted on{" "}
                  {fmtDateTime(selectedRequest.created_at)}
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

            {/* Tab bar: keeps the modal from becoming one long scroll of
                overview + description + attachments + conversation + status
                history + reopen form all stacked together. */}
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
                    color: detailTab === tab.key ? "var(--info)" : "var(--muted-foreground)",
                    borderBottom: detailTab === tab.key ? "2px solid var(--info)" : "2px solid transparent",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === "details" ? (
              <>
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
                    <span>Last Updated</span>
                    <strong>{fmtDateTime(selectedRequest.updated_at)}</strong>
                  </div>
                  <div>
                    <span>Attachments</span>
                    <strong>{getTenantVisibleAttachments(selectedRequest.attachments).length}</strong>
                  </div>
                </div>

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

                {selectedRequest.statusHistory?.length ? (
                  <section className="maintenance-detail-section">
                    <h3>Status Timeline</h3>
                    <div className="maintenance-timeline">
                      {selectedRequest.statusHistory.map((entry, index) => (
                        <article key={`${entry.timestamp}-${index}`}>
                          <strong>{fmtDateTime(entry.timestamp)}</strong>
                          <span>
                            {formatMaintenanceStatus(entry.status)}
                            {entry.actor_name ? ` - ${entry.actor_name}` : ""}
                          </span>
                          <p>{entry.note || entry.event || "Status updated."}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className="form-actions maintenance-detail-actions">
                  {selectedRequest.status === "pending" ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditForm(selectedRequest)}
                    >
                      <Pencil size={14} />
                      Edit Request
                    </button>
                  ) : null}

                  {selectedRequest.status === "pending" ? (
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
                      <div className="form-actions" style={{ justifyContent: "space-between" }}>
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
                        <div className="maintenance-attachment-list">
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
                  If the issue is still unresolved, add a short note and send it
                  back to the queue.
                </p>
                <textarea
                  className="form-control"
                  rows="3"
                  style={{ marginTop: 12 }}
                  placeholder="Optional note for the admin team"
                  value={reopenNote}
                  onChange={(event) => setReopenNote(event.target.value)}
                />
                <div className="form-actions maintenance-detail-actions">
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

      {previewAttachment ? (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "color-mix(in srgb, var(--foreground) 12%, transparent)",
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
              background: "color-mix(in srgb, var(--foreground) 12%, transparent)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "var(--card)",
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
              boxShadow: "0 24px 64px color-mix(in srgb, var(--foreground) 12%, transparent)",
              objectFit: "contain",
            }}
          />
          <span style={{ color: "var(--border)", fontSize: 13 }}>{previewAttachment.name}</span>
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