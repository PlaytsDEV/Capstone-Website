import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { inquiryApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import getFriendlyError from "../../../shared/utils/friendlyError";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import "../styles/inquiry-details-modal.css";

/* ── Module-level helpers ── */
const STATUS_LABEL = {
  resolved: "Responded",
  responded: "Responded",
  "in-progress": "In Progress",
  pending: "Pending",
  new: "New Inquiry",
  closed: "Closed",
};

const CANNED_RESPONSES = [
  {
    label: "Room Available",
    text: "Hello! We currently have available rooms at this branch. Would you like to schedule an on-site viewing tour?",
  },
  {
    label: "Schedule Viewing",
    text: "Hi! We would be glad to arrange a dormitory tour for you. Please let us know your preferred date and time.",
  },
  {
    label: "Rates & Inclusions",
    text: "Hi! Our monthly rates include air conditioning, high-speed Wi-Fi, 24/7 security, study lounge, and submetered utilities. Complete details are on our official website.",
  },
  {
    label: "Requirements & Terms",
    text: "Hello! To secure a reservation, we require a valid government/student ID, 1-month advance, and 1-month security deposit.",
  },
  {
    label: "Waitlist Notice",
    text: "Hello! Currently this room type is fully occupied, but we have added your name to our priority waitlist and will notify you as soon as a slot opens.",
  },
];

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatBranchName = (branchStr) => {
  if (!branchStr) return "General Branch";
  return branchStr
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") + " Branch";
};

const formatRoomType = (typeStr) => {
  if (!typeStr) return null;
  const map = {
    quadruple_sharing: "Quadruple Sharing",
    double_sharing: "Double Sharing",
    private_room: "Private Room",
  };
  return map[typeStr] || typeStr.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatChannelLabel = (source) => {
  if (!source) return "Website";
  const map = {
    website: "Website",
    facebook: "Facebook",
    tiktok: "TikTok",
    instagram: "Instagram",
    text_message: "SMS / Text",
    walk_in: "Walk-in",
    building_signage: "Signage",
    referral: "Referral",
    other: "Other",
  };
  return map[source] || source.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const getInquiryCategory = (inquiry) => {
  if (inquiry?.preferredRoomType) {
    return formatRoomType(inquiry.preferredRoomType);
  }
  if (inquiry?.subject) {
    const parts = inquiry.subject.split(/[:—–-]/);
    if (parts[0] && parts[0].trim()) {
      return parts[0].trim();
    }
  }
  return "General";
};

export default function InquiryDetailsModal({ inquiry, onClose, onUpdate }) {
  const [currentInquiry, setCurrentInquiry] = useState(inquiry);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingEmail, setIsRetryingEmail] = useState(false);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const textareaRef = useRef(null);

  // Sync prop changes
  useEffect(() => {
    setCurrentInquiry(inquiry);
  }, [inquiry]);

  const isResolved =
    currentInquiry?.status === "resolved" ||
    currentInquiry?.status === "responded" ||
    Boolean(currentInquiry?.response || currentInquiry?.adminResponse);

  const isEmailUndelivered =
    isResolved && currentInquiry?.emailDeliveryStatus === "failed";

  const isEmailDelivered =
    isResolved && currentInquiry?.emailDeliveryStatus === "sent";

  // Auto-focus textarea when opening pending inquiry
  useEffect(() => {
    if (!isResolved && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isResolved]);

  const handleRequestClose = () => {
    if (response.trim() && !isResolved) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  useBodyScrollLock(!!inquiry);

  // Global Keyboard Shortcuts (Escape to exit/cancel, Ctrl+Enter to send)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleRequestClose();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showDiscardConfirm, response, isResolved]);

  if (!inquiry || !currentInquiry) return null;

  const MAX_CHARS = 1000;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showNotification(`Copied ${fieldName} to clipboard`, "info");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApplyCanned = (cannedText) => {
    setResponse(cannedText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTextareaChange = (e) => {
    const newText = e.target.value;
    if (newText.length <= MAX_CHARS) {
      setResponse(newText);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (response.trim() && !isSubmitting) {
        handleSubmitResponse();
      }
    }
  };

  const handleSubmitResponse = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (!response.trim() || isSubmitting) return;

    const sentText = response.trim();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await inquiryApi.respond(currentInquiry._id, sentText);
      const emailSent = result?.emailSent;

      if (emailSent === false) {
        showNotification(
          `Response saved, but email to ${currentInquiry.email || "recipient"} could not be delivered.`,
          "warning",
        );
      } else {
        showNotification(
          `Official response sent to ${currentInquiry.email || "customer"} successfully!`,
          "success",
        );
      }

      onUpdate?.();
      onClose();
    } catch (err) {
      console.error("[InquiryResponse] Submission error:", err);
      const friendlyMsg = getFriendlyError(
        err,
        "We were unable to send your response at this moment. Please try again in a moment.",
      );
      setError(friendlyMsg);
      showNotification(friendlyMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryEmail = async () => {
    if (isRetryingEmail || !currentInquiry?._id) return;
    setIsRetryingEmail(true);
    setError(null);

    try {
      const result = await inquiryApi.retryEmail(currentInquiry._id);
      if (result?.inquiry) {
        setCurrentInquiry(result.inquiry);
      } else if (result?.emailSent) {
        setCurrentInquiry((prev) => ({
          ...prev,
          emailDeliveryStatus: "sent",
          emailDeliveryError: null,
          emailLastAttemptAt: new Date().toISOString(),
        }));
      } else {
        setCurrentInquiry((prev) => ({
          ...prev,
          emailDeliveryStatus: "failed",
          emailDeliveryError:
            result?.emailError ||
            "Automated email could not be delivered to the recipient address.",
          emailLastAttemptAt: new Date().toISOString(),
        }));
      }

      if (result?.emailSent) {
        showNotification(
          "Official response email dispatched successfully!",
          "success",
        );
      } else {
        showNotification(
          "Email retry did not dispatch. Please verify recipient email or credentials.",
          "warning",
        );
      }

      onUpdate?.();
    } catch (err) {
      console.error("[InquiryRetryEmail] Error:", err);
      const friendlyMsg = getFriendlyError(
        err,
        "Unable to retry email delivery right now. Please try again in a moment.",
      );
      showNotification(friendlyMsg, "error");
    } finally {
      setIsRetryingEmail(false);
    }
  };

  const currentCharCount = response.length;
  const preferredRoom = formatRoomType(currentInquiry.preferredRoomType);
  const targetMoveIn = formatDateOnly(currentInquiry.targetMoveInDate);
  const categoryLabel = getInquiryCategory(currentInquiry);
  const channelLabel = formatChannelLabel(currentInquiry.source);

  const statusBadgeLabel = isEmailUndelivered
    ? "Email Undelivered"
    : (STATUS_LABEL[currentInquiry.status] ?? (currentInquiry.status || "Pending"));

  const statusBadgeClass = isEmailUndelivered
    ? "undelivered"
    : (currentInquiry.status || "pending");

  return createPortal(
    <div className="inquiry-details-modal-overlay" onClick={handleRequestClose}>
      <div
        className="inquiry-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unsaved Changes Confirmation Modal Overlay */}
        {showDiscardConfirm && (
          <div className="inquiry-details-modal-popup-overlay">
            <div className="inquiry-details-modal-popup-card">
              <div className="inquiry-details-modal-discard-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="inquiry-details-modal-popup-title">Discard Draft Response?</h3>
              <p className="inquiry-details-modal-popup-text">
                You have an unsaved response draft. Closing now will discard your typed text.
              </p>
              <div className="inquiry-details-modal-discard-actions">
                <button
                  type="button"
                  className="inquiry-details-modal-btn-secondary"
                  onClick={() => setShowDiscardConfirm(false)}
                  title="Keep editing (Esc)"
                >
                  Keep Editing
                  <span className="inquiry-details-modal-kbd">Esc</span>
                </button>
                <button
                  type="button"
                  className="inquiry-details-modal-btn-danger"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="inquiry-details-modal-header">
          <div className="inquiry-details-modal-header-left">
            <h2 className="inquiry-details-modal-title">Inquiry Details</h2>
            <span className={`inquiry-details-modal-status-badge ${statusBadgeClass}`}>
              {statusBadgeLabel}
            </span>
            <span className="inquiry-details-modal-category-pill" title="Category / Topic">
              {categoryLabel}
            </span>
            <span className="inquiry-details-modal-channel-pill" title="Acquisition Channel">
              {channelLabel}
            </span>
          </div>

          <button
            className="inquiry-details-modal-close"
            onClick={handleRequestClose}
            aria-label="Close modal (Esc)"
            title="Close (Esc)"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="inquiry-details-modal-body">
          {/* Fatal Error Alert (Connection / Server down) */}
          {error && (
            <div className="inquiry-details-modal-alert error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12"/>
                <line x1="12" y1="16" x2="12.01"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Customer Sender Card */}
          <div className="inquiry-details-modal-sender-strip">
            <div className="inquiry-details-modal-avatar">
              {(currentInquiry.name || currentInquiry.fullName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="inquiry-details-modal-sender-info">
              <div className="inquiry-details-modal-sender-top">
                <h3 className="inquiry-details-modal-sender-name">
                  {currentInquiry.name || currentInquiry.fullName || "Unknown Customer"}
                </h3>
                <span className="inquiry-details-modal-branch-tag">
                  {formatBranchName(currentInquiry.branch || currentInquiry.preferredBranch)}
                </span>
              </div>

              <div className="inquiry-details-modal-contact-chips">
                {/* Email Chip */}
                {currentInquiry.email && (
                  <div className="inquiry-details-modal-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <a href={`mailto:${currentInquiry.email}`} className="inquiry-details-modal-chip-link">
                      {currentInquiry.email}
                    </a>
                    <button
                      type="button"
                      className="inquiry-details-modal-copy-btn"
                      onClick={() => handleCopy(currentInquiry.email, "email")}
                      title="Copy Email"
                    >
                      {copiedField === "email" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {/* Phone Chip */}
                {(currentInquiry.phone || currentInquiry.contactNumber) && currentInquiry.phone !== "N/A" && (
                  <div className="inquiry-details-modal-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>{currentInquiry.phone || currentInquiry.contactNumber}</span>
                    <button
                      type="button"
                      className="inquiry-details-modal-copy-btn"
                      onClick={() => handleCopy(currentInquiry.phone || currentInquiry.contactNumber, "phone")}
                      title="Copy Phone"
                    >
                      {copiedField === "phone" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {/* Subject & Date Tag */}
                <div className="inquiry-details-modal-meta-tag">
                  <span>Subject: <strong>{currentInquiry.subject || "General Inquiry"}</strong></span>
                  <span className="inquiry-details-modal-meta-dot">•</span>
                  <span>{formatDateTime(currentInquiry.createdAt)}</span>
                </div>
              </div>

              {/* Lead Preferences Strip (if room preference / move-in date available) */}
              {(preferredRoom || targetMoveIn || currentInquiry.expectedLengthOfStay) && (
                <div className="inquiry-details-modal-preferences-strip">
                  {preferredRoom && (
                    <div className="inquiry-details-modal-pref-pill">
                      <span className="inquiry-details-modal-pref-label">Room Interest:</span>
                      <strong className="inquiry-details-modal-pref-value">{preferredRoom}</strong>
                    </div>
                  )}
                  {targetMoveIn && (
                    <div className="inquiry-details-modal-pref-pill">
                      <span className="inquiry-details-modal-pref-label">Target Move-in:</span>
                      <strong className="inquiry-details-modal-pref-value">{targetMoveIn}</strong>
                    </div>
                  )}
                  {currentInquiry.expectedLengthOfStay && (
                    <div className="inquiry-details-modal-pref-pill">
                      <span className="inquiry-details-modal-pref-label">Length of Stay:</span>
                      <strong className="inquiry-details-modal-pref-value">
                        {currentInquiry.expectedLengthOfStay} {currentInquiry.expectedLengthOfStay === 1 ? "month" : "months"}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer Message Quote Card */}
          <div className="inquiry-details-modal-section">
            <div className="inquiry-details-modal-section-header">
              <span className="inquiry-details-modal-section-title">Customer Message</span>
            </div>
            <div className="inquiry-details-modal-message-bubble">
              <p className="inquiry-details-modal-message-text">
                {currentInquiry.message || "No message content provided."}
              </p>
            </div>
          </div>

          {/* Official Response (if responded) */}
          {(currentInquiry.response || currentInquiry.adminResponse) && (
            <div className="inquiry-details-modal-section">
              <div className="inquiry-details-modal-section-header">
                <span className="inquiry-details-modal-section-title">Official Response</span>
              </div>
              <div
                className={`inquiry-details-modal-previous-response-box ${
                  isEmailUndelivered ? "undelivered-border" : ""
                }`}
              >
                <p className="inquiry-details-modal-message-text">
                  {currentInquiry.response || currentInquiry.adminResponse}
                </p>
                <div className="inquiry-details-modal-responded-meta">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>
                    Recorded on {formatDateTime(currentInquiry.respondedAt || currentInquiry.updatedAt)}
                    {currentInquiry.respondedBy?.firstName ? ` by ${currentInquiry.respondedBy.firstName} ${currentInquiry.respondedBy.lastName || ""}` : ""}
                  </span>
                </div>

                {/* Email Delivery Failure Alert & Retry CTA */}
                {isEmailUndelivered && (
                  <div className="inquiry-details-modal-delivery-alert">
                    <div className="inquiry-details-modal-delivery-alert-left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Automated email was not delivered to <strong>{currentInquiry.email}</strong></span>
                    </div>
                    <button
                      type="button"
                      className="inquiry-details-modal-btn-retry"
                      onClick={handleRetryEmail}
                      disabled={isRetryingEmail || !currentInquiry.email}
                      title="Re-attempt sending automated email"
                    >
                      {isRetryingEmail ? (
                        <>
                          <span className="inquiry-details-modal-spinner" />
                          <span>Retrying...</span>
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                          <span>Retry Email</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Email Delivery Confirmed Tag */}
                {isEmailDelivered && (
                  <div className="inquiry-details-modal-delivery-success-tag">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Automated email delivered to {currentInquiry.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Send Response Section (if not resolved) */}
          {!isResolved && (
            <div className="inquiry-details-modal-section">
              <div className="inquiry-details-modal-section-header">
                <span className="inquiry-details-modal-section-title">Send Response</span>
                <span className="inquiry-details-modal-canned-label">Quick Templates:</span>
              </div>

              {/* Canned Response Chips */}
              <div className="inquiry-details-modal-canned-list">
                {CANNED_RESPONSES.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="inquiry-details-modal-canned-chip"
                    onClick={() => handleApplyCanned(chip.text)}
                    disabled={isSubmitting}
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>

              {/* Reply Text Area */}
              <form
                id="inquiry-response-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitResponse(e);
                }}
              >
                <textarea
                  ref={textareaRef}
                  className="inquiry-details-modal-response-textarea"
                  placeholder="Type your official response to customer here... (Press Ctrl + Enter to send)"
                  value={response}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  maxLength={MAX_CHARS}
                  rows={4}
                  disabled={isSubmitting}
                />
                <div className="inquiry-details-modal-counter-row">
                  <span className="inquiry-details-modal-shortcut-hint">
                    Shortcuts: <code>Ctrl + Enter</code> to send • <code>Esc</code> to exit
                  </span>
                  <span
                    className={`inquiry-details-modal-word-counter ${
                      currentCharCount >= MAX_CHARS ? "limit-reached" : ""
                    }`}
                  >
                    {currentCharCount} / {MAX_CHARS} characters
                  </span>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Fixed Sticky Footer Bar */}
        <div className="inquiry-details-modal-footer">
          <button
            type="button"
            className="inquiry-details-modal-btn-secondary"
            onClick={handleRequestClose}
            title="Exit dialog (Esc)"
          >
            {isResolved ? "Close" : "Cancel"}
            <span className="inquiry-details-modal-kbd">Esc</span>
          </button>

          {!isResolved && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmitResponse(e);
              }}
              className="inquiry-details-modal-btn-primary"
              disabled={!response.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="inquiry-details-modal-spinner" />
                  Sending...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send Email Response
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
