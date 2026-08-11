import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { inquiryApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
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
};

const CANNED_RESPONSES = [
  {
    label: "Room Available",
    text: "Hello! We currently have available rooms at this branch. Would you like to schedule a viewing?",
  },
  {
    label: "Schedule Viewing",
    text: "Hi! We would be glad to arrange a room tour for you. Please let us know your preferred date and time.",
  },
  {
    label: "Rates & Info",
    text: "Hi! You can view complete room rates, included amenities, and payment options on our official website.",
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

const formatBranchName = (branchStr) => {
  if (!branchStr) return "General Branch";
  return branchStr
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") + " Branch";
};

export default function InquiryDetailsModal({ inquiry, onClose, onUpdate }) {
  const [currentInquiry, setCurrentInquiry] = useState(inquiry);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const timerRef = useRef(null);

  // Sync prop changes
  useEffect(() => {
    setCurrentInquiry(inquiry);
  }, [inquiry]);

  // Cancel pending timer if unmounted
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useBodyScrollLock(!!inquiry);
  useEscapeClose(!!inquiry, onClose);

  if (!inquiry || !currentInquiry) return null;

  const MAX_WORDS = 200;
  const MAX_CHARS = 1000;

  const countWords = (text) => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApplyCanned = (cannedText) => {
    // Directly REPLACE textarea content instead of appending
    setResponse(cannedText);
  };

  const handleTextareaChange = (e) => {
    const newText = e.target.value;
    const wordCount = countWords(newText);

    // Enforce max word limit and char limit, but allow backspace/deletion
    if (newText.length <= MAX_CHARS && wordCount <= MAX_WORDS) {
      setResponse(newText);
    } else if (newText.length < response.length) {
      setResponse(newText);
    }
  };

  const handleSubmitResponse = async (e) => {
    e?.preventDefault();
    const sentText = response.trim();
    if (!sentText) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await inquiryApi.respond(currentInquiry._id, sentText);
      setSuccess(true);

      // Immediately transform local inquiry state to Responded form
      const updatedObj = result?.inquiry || {
        ...currentInquiry,
        status: "responded",
        response: sentText,
        respondedAt: new Date().toISOString(),
      };
      setCurrentInquiry(updatedObj);
      setResponse("");

      if (result?.emailSent === false) {
        const detail = result?.emailError || "Email could not be delivered to customer's Gmail address.";
        setError(`Response saved in system, but automated email failed: ${detail}`);
        showNotification("Response saved, but email could not be delivered.", "warning");
      }

      onUpdate?.();

      // Dismiss success popup overlay after 1.8s; modal remains open in Responded form
      timerRef.current = setTimeout(() => {
        setSuccess(false);
      }, 1800);
    } catch (err) {
      console.error(err);
      setError("Failed to send response. Please try again.");
      showNotification("Failed to send response. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentWordCount = countWords(response);
  const isResolved =
    currentInquiry.status === "resolved" ||
    currentInquiry.status === "responded" ||
    Boolean(currentInquiry.response);

  return createPortal(
    <div className="inquiry-details-modal-overlay" onClick={onClose}>
      <div
        className="inquiry-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Popup Card Overlay */}
        {success && !error && (
          <div className="inquiry-details-modal-popup-overlay">
            <div className="inquiry-details-modal-popup-card">
              <div className="inquiry-details-modal-popup-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="inquiry-details-modal-popup-title">Response Sent!</h3>
              <p className="inquiry-details-modal-popup-text">
                Your response has been saved and emailed to the customer.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="inquiry-details-modal-header">
          <div className="inquiry-details-modal-header-left">
            <h2 className="inquiry-details-modal-title">Inquiry Details</h2>
            <span className={`inquiry-details-modal-status-badge ${currentInquiry.status || "pending"}`}>
              {STATUS_LABEL[currentInquiry.status] ?? currentInquiry.status}
            </span>
            <span className="inquiry-details-modal-category-pill">General</span>
          </div>

          <button
            className="inquiry-details-modal-close"
            onClick={onClose}
            aria-label="Close modal"
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
          {/* Error Alert */}
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

          {/* Compact Customer Strip */}
          <div className="inquiry-details-modal-sender-strip">
            <div className="inquiry-details-modal-avatar">
              {currentInquiry.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="inquiry-details-modal-sender-info">
              <div className="inquiry-details-modal-sender-top">
                <h3 className="inquiry-details-modal-sender-name">{currentInquiry.name}</h3>
                <span className="inquiry-details-modal-branch-tag">
                  {formatBranchName(currentInquiry.branch)}
                </span>
              </div>

              <div className="inquiry-details-modal-contact-chips">
                {/* Email Chip */}
                <div className="inquiry-details-modal-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <a href={`mailto:${currentInquiry.email}`} className="inquiry-details-modal-chip-link">
                    {currentInquiry.email}
                  </a>
                  <button
                    className="inquiry-details-modal-copy-btn"
                    onClick={() => handleCopy(currentInquiry.email, "email")}
                    title="Copy Email"
                  >
                    {copiedField === "email" ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Phone Chip */}
                {currentInquiry.phone && (
                  <div className="inquiry-details-modal-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>{currentInquiry.phone}</span>
                    <button
                      className="inquiry-details-modal-copy-btn"
                      onClick={() => handleCopy(currentInquiry.phone, "phone")}
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

          {/* Previous Response (if responded) */}
          {currentInquiry.response && (
            <div className="inquiry-details-modal-section">
              <div className="inquiry-details-modal-section-header">
                <span className="inquiry-details-modal-section-title">Previous Response</span>
              </div>
              <div className="inquiry-details-modal-previous-response-box">
                <p className="inquiry-details-modal-message-text">{currentInquiry.response}</p>
                <div className="inquiry-details-modal-responded-meta">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>Sent on {formatDateTime(currentInquiry.respondedAt)}</span>
                </div>
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
                    disabled={isSubmitting || success}
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>

              {/* Reply Text Area */}
              <form id="inquiry-response-form" onSubmit={handleSubmitResponse}>
                <textarea
                  className="inquiry-details-modal-response-textarea"
                  placeholder="Type your official response to customer here..."
                  value={response}
                  onChange={handleTextareaChange}
                  rows={4}
                  disabled={isSubmitting || success}
                />
                <div className="inquiry-details-modal-counter-row">
                  <span
                    className={`inquiry-details-modal-word-counter ${
                      currentWordCount >= MAX_WORDS ? "limit-reached" : ""
                    }`}
                  >
                    {currentWordCount} / {MAX_WORDS} words
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
            onClick={onClose}
          >
            {isResolved ? "Close" : "Cancel"}
          </button>

          {!isResolved && (
            <button
              type="submit"
              form="inquiry-response-form"
              className="inquiry-details-modal-btn-primary"
              disabled={!response.trim() || isSubmitting || success}
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
