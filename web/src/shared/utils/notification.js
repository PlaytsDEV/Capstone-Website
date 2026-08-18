/**
 * =============================================================================
 * NOTIFICATION UTILITY
 * =============================================================================
 *
 * Provides toast notifications and confirmation dialogs for user feedback.
 *
 * Functions:
 * - showNotification(): Display toast message (success, error, warning, info)
 * - showConfirmation(): Display confirmation dialog with OK/Cancel buttons
 *
 * Styling:
 * - CSS must be imported: import '../styles/notification.css'
 * - Uses custom CSS classes for animations and styling
 */

import { publishNotification } from "./notificationBus.js";

/**
 * Show notification toast
 *
 * Displays a temporary message at the top of the screen.
 * Automatically dismisses after the specified duration.
 *
 * DUPLICATE PREVENTION:
 * - Removes existing notifications before showing new one
 * - Debounces rapid calls with same message to prevent StrictMode duplicates
 * - Uses unique ID to track notification state
 *
 * @param {string} message - Notification message to display
 * @param {string} type - Notification type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 *
 * @example
 * showNotification('Login successful!', 'success');
 * showNotification('Invalid credentials', 'error', 5000);
 */

let lastNotification = { message: "", timestamp: 0 };
const DEBOUNCE_MS = 200; // Prevent duplicate consecutive notifications

export const showNotification = (
  messageOrOptions,
  type = "info",
  duration = 3000,
  options = {},
) => {
  let message = messageOrOptions;
  let resolvedType = type;
  let resolvedDuration = duration;
  let extraOptions = options;

  if (messageOrOptions && typeof messageOrOptions === "object") {
    message =
      messageOrOptions.message ||
      messageOrOptions.text ||
      messageOrOptions.title ||
      "";
    resolvedType = messageOrOptions.type || "info";
    resolvedDuration = messageOrOptions.duration || 3000;
    const {
      message: _m,
      text: _t,
      title: _ti,
      type: _ty,
      duration: _d,
      ...rest
    } = messageOrOptions;
    extraOptions = { ...rest, ...options };
  }

  if (typeof message !== "string") {
    message = String(message || "");
  }

  // Sanitize message to ensure friendly, simple, professional copy and eliminate technical/system errors
  message = sanitizeToastMessage(message, resolvedType);

  if (!message || !message.trim()) {
    return null;
  }

  // Automatically ensure error and warning toasts have comfortable reading durations
  if (resolvedType === "error" && resolvedDuration === 3000) {
    resolvedDuration = 5000;
  } else if (resolvedType === "warning" && resolvedDuration === 3000) {
    resolvedDuration = 4000;
  }

  const now = Date.now();
  if (
    message === lastNotification.message &&
    now - lastNotification.timestamp < DEBOUNCE_MS
  ) {
    return null;
  }
  lastNotification = { message, timestamp: now };

  return publishNotification({
    message,
    type: resolvedType,
    duration: resolvedDuration,
    ...extraOptions,
  });
};

/**
 * Show confirmation dialog
 *
 * Displays a modal dialog asking the user to confirm or cancel an action.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 *
 * @param {string} message - Confirmation message to display
 * @param {string} confirmText - Confirm button text (default: 'Confirm')
 * @param {string} cancelText - Cancel button text (default: 'Cancel')
 *
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 *
 * @example
 * const confirmed = await showConfirmation('Are you sure?', 'Yes', 'No');
 * if (confirmed) {
 *   // User clicked Yes
 * }
 */
export const showConfirmation = (
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
) => {
  return new Promise((resolve) => {
    try {
      // Remove any existing confirmation dialogs
      const existing = document.getElementById("app-confirmation");
      if (existing) {
        existing.remove();
      }

      // Create confirmation dialog overlay
      const overlay = document.createElement("div");
      overlay.id = "app-confirmation";
      overlay.className = "confirmation-overlay";

      // Build confirmation dialog HTML
      overlay.innerHTML = `
        <div class="confirmation-dialog">
          <div class="confirmation-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 4C12.96 4 4 12.96 4 24C4 35.04 12.96 44 24 44C35.04 44 44 35.04 44 24C44 12.96 35.04 4 24 4ZM24 26C22.9 26 22 25.1 22 24V16C22 14.9 22.9 14 24 14C25.1 14 26 14.9 26 16V24C26 25.1 25.1 26 24 26ZM26 34H22V30H26V34Z" fill="#D4AF37"/>
            </svg>
          </div>
          <div class="confirmation-message">${message}</div>
          <div class="confirmation-buttons">
            <button class="confirmation-btn confirmation-btn-cancel" data-action="cancel">${cancelText}</button>
            <button class="confirmation-btn confirmation-btn-confirm" data-action="confirm">${confirmText}</button>
          </div>
        </div>
      `;

      // Add event listeners for user interaction
      overlay.addEventListener("click", (e) => {
        try {
          // Close on overlay click (outside dialog)
          if (e.target === overlay) {
            overlay.remove();
            resolve(false);
            return;
          }

          // Handle button clicks
          const action = e.target.dataset.action;
          if (action === "confirm") {
            overlay.remove();
            resolve(true);
          } else if (action === "cancel") {
            overlay.remove();
            resolve(false);
          }
        } catch (error) {
          console.error("Error handling confirmation action:", error);
          overlay.remove();
          resolve(false);
        }
      });

      // Add confirmation dialog to document
      document.body.appendChild(overlay);
    } catch (error) {
      // Fallback to browser confirm if custom dialog fails
      console.error("Failed to show confirmation dialog:", error);
      resolve(window.confirm(message));
    }
  });
};

/**
 * Sanitizes notification message strings to remove legacy or accidental "N/A" placeholders
 * and any legacy appended "View in Announcements" suffixes.
 * E.g., "Your reservation N/A has been cancelled." -> "Your reservation has been cancelled."
 */
export const cleanNotificationMessage = (message) => {
  if (!message || typeof message !== "string") return message;
  return message
    .replace(/\bYour reservation N\/A\b/gi, "Your reservation")
    .replace(/\b reservation N\/A\b/gi, " reservation")
    .replace(/\b N\/A\b/gi, "")
    .replace(/\s*•\s*View in Announcements\b/gi, "")
    .replace(/\s*View in Announcements\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Transforms past-participle verb titles (e.g. "Reservation Cancelled") into formal event titles (e.g. "Reservation Cancellation")
 */
export const formatNotificationTitle = (title) => {
  if (!title || typeof title !== "string") return title;
  const exactMap = {
    "Reservation Cancelled": "Reservation Cancellation",
    "Physical Visit Completed": "Physical Visit Summary",
    "Visit Schedule Rejected": "Visit Schedule Update",
    "Visit Schedule Confirmed": "Visit Schedule Confirmation",
    "Physical Visit Scheduled": "Physical Visit Request",
    "Application Submitted": "Application Submission",
    "Approved for Payment": "Application Approval",
    "Revision Requested": "Application Revision Request",
    "Application Rejected": "Application Status Update",
    "Payment Confirmed": "Payment Confirmation",
    "Reservation Confirmed": "Reservation Confirmation",
  };
  if (exactMap[title]) return exactMap[title];

  return title
    .replace(/\bCancelled\b/gi, "Cancellation")
    .replace(/\bCanceled\b/gi, "Cancellation")
    .replace(/\bCompleted\b/gi, "Summary")
    .replace(/\bRejected\b/gi, "Update")
    .replace(/\bConfirmed\b/gi, "Confirmation")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Summarizes an announcement notification message for compact presentation
 * in notifications lists and dropdowns (defaults to standard clean message).
 */
export const summarizeAnnouncementMessage = (message) => {
  if (!message || typeof message !== "string") {
    return "A new announcement is available.";
  }
  const cleaned = cleanNotificationMessage(message);
  if (!cleaned) {
    return "A new announcement is available.";
  }
  return cleaned;
};

/**
 * Automatically sanitizes toast messages to ensure friendly, simple, and professional copy.
 * Strips technical jargon, database errors, and "system error" phrasing while enforcing Lilycrest terminology.
 */
export const sanitizeToastMessage = (rawMessage, type = "info") => {
  if (!rawMessage || typeof rawMessage !== "string") return rawMessage;

  let message = rawMessage.trim();

  // 1. Technical & System Error Replacements
  const serverErrorRegex =
    /\b(system\s*error|internal\s*server\s*error|500\s*internal|server\s*error\s*:\s*500|502\s*bad\s*gateway|503\s*service|504\s*gateway)\b/i;
  const networkErrorRegex =
    /\b(failed\s*to\s*fetch|networkerror|econnrefused|etimedout|network\s*error|axioserror)\b/i;
  const databaseErrorRegex =
    /\b(mongoose|cast\s*to\s*objectid|validationerror\b|duplicate\s*key\s*error|e11000|is not a valid enum value|not a valid enum|validation failed)\b/i;
  const maintenanceNotFoundRegex =
    /\b(maintenance\s*request\s*not\s*found|maintenance\s*ticket\s*not\s*found|request\s*not\s*found)\b/i;
  const notFoundRegex =
    /^(not\s*found\.?|404\s*not\s*found\.?|resource\s*not\s*found\.?|item\s*not\s*found\.?|record\s*not\s*found\.?)$/i;
  const genericErrorRegex =
    /^(an\s*error\s*occurred\.?|something\s*went\s*wrong\.?|error\s*occurred\.?)$/i;

  if (serverErrorRegex.test(message)) {
    return "Unable to complete your request right now. Please check your connection and try again.";
  }

  if (networkErrorRegex.test(message)) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }

  if (databaseErrorRegex.test(message)) {
    return "Unable to process this request. Please verify the details and try again.";
  }

  if (maintenanceNotFoundRegex.test(message)) {
    return "Unable to find the requested maintenance record. Please refresh the page and try again.";
  }

  if (notFoundRegex.test(message)) {
    return "The requested record could not be found. It may have been updated or removed.";
  }

  if (genericErrorRegex.test(message)) {
    return "Unable to complete your request right now. Please try again.";
  }

  // 2. Lilycrest Terminology Invariants
  message = message
    .replace(/\bResidents\b/g, "Tenants")
    .replace(/\bresidents\b/g, "tenants")
    .replace(/\bResident\b/g, "Tenant")
    .replace(/\bresident\b/g, "tenant")
    .replace(/\bCopilot\b/g, "Assistant")
    .replace(/\bcopilot\b/g, "assistant")
    .replace(/\bSuper\s*Admin\b/g, "Owner")
    .replace(/\bsuper\s*admin\b/g, "owner")
    .replace(/\bRental\s*Fee\b/g, "Rent")
    .replace(/\brental\s*fee\b/g, "rent");

  return cleanNotificationMessage(message);
};

