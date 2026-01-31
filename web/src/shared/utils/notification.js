/**
 * Show notification toast
 * @param {string} message - Notification message
 * @param {string} type - Notification type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export const showNotification = (message, type = "info", duration = 3000) => {
  // Remove any existing notifications
  const existing = document.getElementById("app-notification");
  if (existing) {
    existing.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "app-notification";
  notification.className = `notification notification-${type}`;

  // Icon based on type
  const icons = {
    success:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="currentColor"/></svg>',
    error:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="currentColor"/></svg>',
    warning:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M1 17H19L10 2L1 17ZM11 14H9V12H11V14ZM11 10H9V6H11V10Z" fill="currentColor"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" fill="currentColor"/></svg>',
  };

  notification.innerHTML = `
    <div class="notification-icon">${icons[type]}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z" fill="currentColor"/>
      </svg>
    </button>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Auto remove after duration
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add("notification-fade-out");
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
};

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Confirm button text (default: 'Confirm')
 * @param {string} cancelText - Cancel button text (default: 'Cancel')
 * @returns {Promise<boolean>} - Returns true if confirmed, false if cancelled
 */
export const showConfirmation = (
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
) => {
  return new Promise((resolve) => {
    // Remove any existing confirmations
    const existing = document.getElementById("app-confirmation");
    if (existing) {
      existing.remove();
    }

    // Create confirmation dialog
    const overlay = document.createElement("div");
    overlay.id = "app-confirmation";
    overlay.className = "confirmation-overlay";

    overlay.innerHTML = `
      <div class="confirmation-dialog">
        <div class="confirmation-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4C12.96 4 4 12.96 4 24C4 35.04 12.96 44 24 44C35.04 44 44 35.04 44 24C44 12.96 35.04 4 24 4ZM24 26C22.9 26 22 25.1 22 24V16C22 14.9 22.9 14 24 14C25.1 14 26 14.9 26 16V24C26 25.1 25.1 26 24 26ZM26 34H22V30H26V34Z" fill="#ff6900"/>
          </svg>
        </div>
        <div class="confirmation-message">${message}</div>
        <div class="confirmation-buttons">
          <button class="confirmation-btn confirmation-btn-cancel" data-action="cancel">${cancelText}</button>
          <button class="confirmation-btn confirmation-btn-confirm" data-action="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    // Add event listeners
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }

      const action = e.target.dataset.action;
      if (action === "confirm") {
        overlay.remove();
        resolve(true);
      } else if (action === "cancel") {
        overlay.remove();
        resolve(false);
      }
    });

    document.body.appendChild(overlay);
  });
};
