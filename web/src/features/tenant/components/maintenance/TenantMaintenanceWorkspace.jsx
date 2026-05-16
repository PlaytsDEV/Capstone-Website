import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  useCancelMaintenanceRequest,
  useCreateMaintenanceRequest,
  useMyMaintenanceRequests,
  useReopenMaintenanceRequest,
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
  normalizeMaintenanceAttachments,
} from "../../../../shared/utils/maintenanceAttachments";
import { uploadToFirebaseStorage } from "../../../../shared/utils/firebaseStorageUpload";
import "../../styles/tenant-common.css";

const EMPTY_FORM_DATA = Object.freeze({
  request_type: "other",
  urgency: "normal",
  description: "",
  attachments: [],
});

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

const cloneAttachments = (attachments) => normalizeMaintenanceAttachments(attachments);
const getLatestProgressEntry = (request) => {
  const workLog = Array.isArray(request?.workLog) ? request.workLog : [];
  return workLog.length ? workLog[workLog.length - 1] : null;
};
const getProgressSummary = (entry) => {
  if (!entry) return "";

  const note = typeof entry.note === "string" ? entry.note.trim() : "";
  if (note) return note;

  const attachmentCount = Array.isArray(entry.attachments) ? entry.attachments.length : 0;
  if (attachmentCount > 0) {
    return `Admin added ${attachmentCount} progress ${attachmentCount === 1 ? "photo" : "photos"}.`;
  }

  return "Admin posted a progress update.";
};

function AttachmentLink({ attachment, index, onPreview }) {
  const kind = getMaintenanceAttachmentKind(attachment);
  const label = getMaintenanceAttachmentLabel(attachment);
  const name = getMaintenanceAttachmentName(attachment, index);
  const uri = getMaintenanceAttachmentUri(attachment);
  const Icon = kind === "image" ? ImageIcon : kind === "pdf" ? FileText : Paperclip;

  if (!uri) return null;

  if (kind === "image") {
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
            border: "1px solid #CBD5E1",
            borderRadius: 16,
            overflow: "hidden",
            padding: 0,
            background: "#F8FAFC",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
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
              background: "#E2E8F0",
            }}
          />
        </button>

        <div style={{ display: "grid", gap: 4 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#0F172A",
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
                color: "#2563EB",
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
              style={{ color: "#475569", fontWeight: 500 }}
            >
              Open Original
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
        gap: 10,
        color: "#2563EB",
        fontSize: 13,
        width: "fit-content",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #CBD5E1",
        background: "#F8FAFC",
      }}
    >
      <Icon size={14} />
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ color: "#64748B" }}>{label}</span>
      </div>
    </a>
  );
}

export default function TenantMaintenanceWorkspace({ embedded = false }) {
  const [showForm, setShowForm] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [reopenNote, setReopenNote] = useState("");
  const [formData, setFormData] = useState({ ...EMPTY_FORM_DATA });

  const { data, isLoading } = useMyMaintenanceRequests({ limit: 50 });
  const createMutation = useCreateMaintenanceRequest();
  const updateMutation = useUpdateMyMaintenanceRequest();
  const cancelMutation = useCancelMaintenanceRequest();
  const reopenMutation = useReopenMaintenanceRequest();

  const requests = data?.requests || [];
  const selectedRequest = useMemo(
    () => requests.find((request) => request.request_id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  const isEditing = Boolean(editingRequestId);
  const isSavingForm = createMutation.isPending || updateMutation.isPending;
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

    setUploadingAttachment(true);

    try {
      const uploaded = [];

      for (const file of files) {
        const { downloadUrl: uri } = await uploadToFirebaseStorage(file, { documentType: "maintenance-attachment" });
        uploaded.push({
          name: file.name,
          uri,
          type: file.type || "application/octet-stream",
        });
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

  const handleRemoveAttachment = (uri) => {
    setFormData((current) => ({
      ...current,
      attachments: (current.attachments || []).filter(
        (entry) => getMaintenanceAttachmentUri(entry) !== uri,
      ),
    }));
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
      if (isEditing) {
        await updateMutation.mutateAsync({
          requestId: editingRequestId,
          data: formData,
        });
        showNotification("Maintenance request updated.", "success");
      } else {
        await createMutation.mutateAsync(formData);
        showNotification("Maintenance request submitted.", "success");
      }

      resetComposer();
    } catch (error) {
      showNotification(
        error.message ||
          `Failed to ${isEditing ? "update" : "submit"} maintenance request.`,
        "error",
      );
    }
  };

  const handleCancelRequest = async (request) => {
    if (!window.confirm("Cancel this maintenance request?")) return;

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
      <div className="page-header">
        <div>
          <h1>
            <Wrench size={22} /> Maintenance Requests
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
        <div className="section-card">
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
                {uploadingAttachment ? "Uploading..." : "Upload photo or file"}
              </label>
              <input
                id="maintenance-attachments"
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleAttachmentUpload}
              />

              {formData.attachments?.length ? (
                <div className="maintenance-attachment-list">
                  {formData.attachments.map((attachment, index) => (
                    <div
                      key={`${getMaintenanceAttachmentUri(attachment) || attachment.name}-${index}`}
                      className="maintenance-attachment-row"
                    >
                      <span>{getMaintenanceAttachmentName(attachment, index)}</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          handleRemoveAttachment(getMaintenanceAttachmentUri(attachment))
                        }
                        style={{ padding: "6px 10px" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="maintenance-help-text">
                  Attach JPEG, PNG, WebP, or PDF files for clearer troubleshooting.
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
                disabled={isSavingForm || uploadingAttachment || descriptionTooShort}
              >
                {isSavingForm
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

      {requests.length > 0 ? (
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
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748B",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {item.label}
                </div>
                <strong style={{ fontSize: 22, color: "#0F172A" }}>
                  {item.value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-card">
        <h2>Request History</h2>
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
        ) : (
          <div className="maintenance-list">
            {requests.map((request) => {
              const typeMeta = getMaintenanceTypeMeta(request.request_type);
              const urgencyMeta = getMaintenanceUrgencyMeta(request.urgency);
              const statusMeta = getMaintenanceStatusMeta(request.status);
              const TypeIcon = typeMeta.icon;
              const isPending = request.status === "pending";
              const isReopenable = REOPENABLE_MAINTENANCE_STATUSES.includes(request.status);
              const latestProgressEntry = getLatestProgressEntry(request);
              const latestProgressSummary = getProgressSummary(latestProgressEntry);

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
                        <p style={{ margin: 0, color: "#64748B" }}>
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
                      {formatMaintenanceStatus(request.status)}
                    </span>
                  </div>

                  <p style={{ margin: "14px 0 0", color: "#334155" }}>
                    {request.description}
                  </p>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      color: "#64748B",
                      fontSize: 13,
                    }}
                  >
                    <span>ETA: {urgencyMeta.estimate}</span>
                    <span>SLA: {formatSlaLabel(request.slaState)}</span>
                    <span>Attachments: {request.attachments?.length || 0}</span>
                    {request.reopen_note ? <span>Reopen note saved</span> : null}
                  </div>

                  {request.notes ? (
                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#FEF3C7",
                        color: "#92400E",
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

                  {latestProgressEntry ? (
                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#DBEAFE",
                        color: "#1D4ED8",
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <Wrench size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ width: "100%" }}>
                        <strong style={{ display: "block", marginBottom: 4 }}>
                          Latest Progress Update
                        </strong>
                        <span>{latestProgressSummary}</span>

                        {latestProgressEntry.attachments?.length ? (
                          <div className="maintenance-detail-links" style={{ marginTop: 12 }}>
                            {latestProgressEntry.attachments.map((attachment, index) => (
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
                          onClick={() => handleCancelRequest(request)}
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
                <strong>{selectedRequest.attachments?.length || 0}</strong>
              </div>
            </div>

            <section className="maintenance-detail-section">
              <h3>Description</h3>
              <p>{selectedRequest.description}</p>
            </section>

            {selectedRequest.attachments?.length ? (
              <section className="maintenance-detail-section">
                <h3>Attachments</h3>
                <div className="maintenance-detail-links">
                  {selectedRequest.attachments.map((attachment, index) => (
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

            {selectedRequest.workLog?.length ? (
              <section className="maintenance-detail-section">
                <h3>Work Log</h3>
                <div className="maintenance-timeline">
                  {selectedRequest.workLog.map((entry, index) => (
                    <article key={`${entry.logged_at}-${index}`}>
                      <strong>{fmtDateTime(entry.logged_at)}</strong>
                      <span>{entry.actor_name || "Staff update"}</span>
                      <p>{entry.note}</p>
                      {entry.attachments?.length ? (
                        <div className="maintenance-detail-links" style={{ marginTop: 10 }}>
                          {entry.attachments.map((attachment, attachmentIndex) => (
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

            {REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status) ? (
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
                  onClick={() => handleCancelRequest(selectedRequest)}
                >
                  <Trash2 size={14} />
                  Cancel Request
                </button>
              ) : null}

              {REOPENABLE_MAINTENANCE_STATUSES.includes(selectedRequest.status) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={reopenMutation.isPending}
                  onClick={handleReopenRequest}
                >
                  <RefreshCcw size={14} />
                  {reopenMutation.isPending ? "Reopening..." : "Reopen Request"}
                </button>
              ) : null}
            </div>
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
            background: "rgba(0,0,0,0.85)",
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
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#fff",
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
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              objectFit: "contain",
            }}
          />
          <span style={{ color: "#CBD5E1", fontSize: 13 }}>{previewAttachment.name}</span>
        </div>
      ) : null}
    </div>
  );
>>>>>>> main
}
