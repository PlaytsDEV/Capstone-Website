import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  isViewableMaintenanceAttachmentUri,
  normalizeMaintenanceAttachments,
} from "../utils/maintenanceAttachments";
import { fmtDateTime } from "../utils/dateFormat";
import { showNotification } from "../utils/notification";
import { uploadMaintenanceAttachment } from "../utils/firebaseStorageUpload";
import "./MaintenanceConversationSection.css";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function MaintenanceConversationSection({
  conversation = [],
  currentSide = "tenant", // "tenant" | "admin"
  isActiveTicket = true,
  ticketStatus = "pending",
  onSendReply,
  isSending = false,
  onPreviewAttachment,
  requestId,
}) {
  const [message, setMessage] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to latest message on load or new entry
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.length]);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification(`File "${file.name}" exceeds the 5MB size limit.`, "error");
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) {
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of validFiles) {
        const uploadResult = await uploadMaintenanceAttachment(file, {
          documentType: "maintenance-reply-attachment",
          context: "maintenance_reply",
          visibility: "tenant_admin",
          maintenanceRequestId: requestId,
          relatedId: requestId,
        });

        uploaded.push({
          name: file.name,
          uri: uploadResult.secureUrl || uploadResult.url || uploadResult.downloadUrl || uploadResult.uri,
          url: uploadResult.secureUrl || uploadResult.url || uploadResult.downloadUrl || uploadResult.uri,
          type: file.type || "application/octet-stream",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          context: "maintenance_reply",
          visibility: "tenant_admin",
        });
      }

      setStagedAttachments((prev) => [...prev, ...uploaded]);
      showNotification("Attachment uploaded successfully.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to upload attachment.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveStagedAttachment = (uri) => {
    setStagedAttachments((prev) =>
      prev.filter((entry) => getMaintenanceAttachmentUri(entry) !== uri),
    );
  };

  const handleFormSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSending || isUploading) return;

    const trimmed = message.trim();
    if (!trimmed && stagedAttachments.length === 0) {
      showNotification("Please enter a message or attach a file before sending.", "error");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      showNotification(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`, "error");
      return;
    }

    try {
      await onSendReply({
        message: trimmed,
        attachments: normalizeMaintenanceAttachments(stagedAttachments),
      });
      setMessage("");
      setStagedAttachments([]);
    } catch (error) {
      showNotification(error.message || "Failed to send reply.", "error");
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const messageLength = message.length;
  const isNearLimit = messageLength > MAX_MESSAGE_LENGTH * 0.85;
  const isOverLimit = messageLength > MAX_MESSAGE_LENGTH;

  return (
    <div className="maintenance-conversation-container">
      {/* Message Thread History */}
      {conversation && conversation.length > 0 ? (
        <div className="maintenance-chat-thread" role="log" aria-label="Conversation history">
          {conversation.map((entry, index) => {
            const isMe =
              currentSide === "tenant"
                ? entry.sender_side === "tenant"
                : entry.sender_side === "admin" || entry.sender_side === "staff";

            const isAdminSender = entry.sender_side === "admin" || entry.sender_side === "staff";
            const senderRoleLabel = isAdminSender ? "Dormitory Admin" : "Tenant";
            const senderName = entry.sender_name || (isAdminSender ? "Facilities Staff" : "Tenant");
            const entryAttachments = Array.isArray(entry.attachments)
              ? entry.attachments.filter((a) => !a.isRemoved)
              : [];

            return (
              <div
                key={entry.created_at || entry.timestamp || index}
                className={`maintenance-chat-bubble-wrapper ${isMe ? "is-me" : "is-other"}`}
              >
                <div className="maintenance-chat-meta">
                  <span
                    className={`chat-role-badge ${isAdminSender ? "chat-role-badge--admin" : "chat-role-badge--tenant"}`}
                  >
                    {senderRoleLabel}
                  </span>
                  <span style={{ fontWeight: 600 }}>{senderName}</span>
                  <span>•</span>
                  <span>{fmtDateTime(entry.created_at || entry.timestamp)}</span>
                </div>

                <div className="maintenance-chat-bubble">
                  {entry.message ? <p style={{ margin: 0 }}>{entry.message}</p> : null}

                  {entryAttachments.length > 0 ? (
                    <div className="chat-attachments-grid">
                      {entryAttachments.map((attachment, attIdx) => {
                        const uri = getMaintenanceAttachmentUri(attachment);
                        const name = getMaintenanceAttachmentName(attachment, attIdx);
                        const kind = getMaintenanceAttachmentKind(attachment);
                        const isViewable = isViewableMaintenanceAttachmentUri(uri);

                        const Icon = kind === "image" ? ImageIcon : kind === "pdf" ? FileText : Paperclip;

                        if (isViewable && kind === "image" && onPreviewAttachment) {
                          return (
                            <button
                              key={`${uri || name}-${attIdx}`}
                              type="button"
                              onClick={() => onPreviewAttachment(attachment)}
                              className="chat-attachment-chip"
                              style={{ cursor: "pointer", border: "none", textAlign: "left" }}
                            >
                              <Icon size={13} />
                              <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {name}
                              </span>
                            </button>
                          );
                        }

                        return isViewable ? (
                          <a
                            key={`${uri || name}-${attIdx}`}
                            href={uri}
                            target="_blank"
                            rel="noreferrer"
                            className="chat-attachment-chip"
                          >
                            <Icon size={13} />
                            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {name}
                            </span>
                          </a>
                        ) : (
                          <span key={`${uri || name}-${attIdx}`} className="chat-attachment-chip">
                            <Icon size={13} />
                            <span>{name}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>
      ) : (
        <div className="chat-empty-state">
          <MessageSquare size={28} />
          <h4>No Conversation Entries Yet</h4>
          <p>
            Use this thread to communicate directly with the {currentSide === "tenant" ? "facilities & administration team" : "tenant"}. Share updates, access notes, or photos.
          </p>
        </div>
      )}

      {/* Reply Composer or Closed Notice */}
      {isActiveTicket ? (
        <form className="chat-composer-card" onSubmit={handleFormSubmit}>
          <textarea
            className="chat-composer-textarea"
            rows="3"
            placeholder={
              currentSide === "tenant"
                ? "Add an update, access instructions, or details for the facilities team... (Press Ctrl+Enter to send)"
                : "Type an official reply or instruction for the tenant... (Press Ctrl+Enter to send)"
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || isUploading}
          />

          {/* Staged attachments list */}
          {stagedAttachments.length > 0 ? (
            <div className="chat-staged-attachments">
              {stagedAttachments.map((att, idx) => {
                const uri = getMaintenanceAttachmentUri(att);
                return (
                  <div key={`${uri || att.name}-${idx}`} className="chat-staged-chip">
                    <Paperclip size={12} />
                    <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getMaintenanceAttachmentName(att, idx)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedAttachment(uri)}
                      aria-label="Remove staged attachment"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="chat-composer-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label
                htmlFor={`maintenance-chat-file-${requestId}`}
                className="chat-btn-attach"
                style={{
                  cursor: isUploading || isSending ? "not-allowed" : "pointer",
                  margin: 0,
                }}
              >
                <Paperclip size={13} />
                {isUploading ? "Uploading..." : "Attach File"}
              </label>
              <input
                id={`maintenance-chat-file-${requestId}`}
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                multiple
                onChange={handleFileChange}
                disabled={isUploading || isSending}
                style={{ display: "none" }}
              />

              <span
                className={`chat-char-counter ${
                  isOverLimit ? "is-over-limit" : isNearLimit ? "is-near-limit" : ""
                }`}
              >
                {messageLength}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>

            <button
              type="submit"
              className="chat-btn-send"
              title="Send reply to this conversation thread"
              disabled={isSending || isUploading || (!message.trim() && stagedAttachments.length === 0)}
            >
              {isSending ? (
                <>
                  <LoaderCircle size={13} className="admin-announcements-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Send Reply</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="chat-closed-notice">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            This maintenance request is currently <strong>{ticketStatus}</strong>. Communication is disabled for closed tickets. Reopen the ticket to continue conversation.
          </span>
        </div>
      )}
    </div>
  );
}
