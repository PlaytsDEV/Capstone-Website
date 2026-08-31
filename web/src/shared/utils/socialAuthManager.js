/**
 * =============================================================================
 * SOCIAL AUTH MANAGER UTILITY
 * =============================================================================
 *
 * Centralized lifecycle manager for Google & Facebook social auth flows:
 * - Real-time popup cancellation detection (window closed / cancelled request)
 * - Immediate abort controller hooks for manual "Cancel" UI buttons
 * - 60-second safety fallback timeout preventing frozen loading states
 * - Standardized cancellation error identification
 */

export const SOCIAL_AUTH_TIMEOUT_MS = 30000;

export const POPUP_CANCEL_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "AUTH_MANUAL_CANCEL",
  "AUTH_POPUP_TIMEOUT",
]);

/**
 * Checks if an error is a user or system popup cancellation.
 * @param {Error|Object} error
 * @returns {boolean}
 */
export function isPopupCancellationError(error) {
  if (!error) return false;
  const code = error.code || error.name || "";
  return POPUP_CANCEL_CODES.has(code);
}

/**
 * Executes a social auth popup request wrapped with cancellation detection,
 * optional manual abort signal, and safety timeout.
 *
 * @param {Object} options
 * @param {Object} options.auth - Firebase auth instance
 * @param {Object} options.provider - Auth provider (GoogleAuthProvider, FacebookAuthProvider)
 * @param {Function} options.signInFn - Function executing the popup sign-in
 * @param {Function} [options.onSuccess] - Callback on successful auth
 * @param {Function} [options.onCancel] - Callback on popup closure or manual abort
 * @param {Function} [options.onError] - Callback on actual auth errors
 * @param {number} [options.timeoutMs=60000] - Safety timeout in ms
 * @param {AbortSignal} [options.abortSignal] - Optional abort signal
 * @returns {Promise<Object|null>} Auth result or null if cancelled
 */
export async function executeSocialAuth({
  auth,
  provider,
  signInFn,
  onSuccess,
  onCancel,
  onError,
  timeoutMs = SOCIAL_AUTH_TIMEOUT_MS,
  abortSignal,
}) {
  let timeoutId = null;
  let isCompleted = false;
  let onAbortHandler = null;

  const cleanup = () => {
    isCompleted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (abortSignal && onAbortHandler) {
      abortSignal.removeEventListener("abort", onAbortHandler);
      onAbortHandler = null;
    }
  };

  try {
    const authPromise = Promise.resolve(signInFn(auth, provider));

    const timeoutPromise = new Promise((_, reject) => {
      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (!isCompleted) {
            const err = new Error("Social sign-in timed out. Please try again.");
            err.code = "AUTH_POPUP_TIMEOUT";
            reject(err);
          }
        }, timeoutMs);
      }
    });

    const abortPromise = new Promise((_, reject) => {
      if (abortSignal) {
        if (abortSignal.aborted) {
          const err = new Error("Sign-in was cancelled.");
          err.code = "AUTH_MANUAL_CANCEL";
          reject(err);
        } else {
          onAbortHandler = () => {
            const err = new Error("Sign-in was cancelled.");
            err.code = "AUTH_MANUAL_CANCEL";
            reject(err);
          };
          abortSignal.addEventListener("abort", onAbortHandler, { once: true });
        }
      }
    });

    const result = await Promise.race([authPromise, timeoutPromise, abortPromise]);
    cleanup();

    if (onSuccess) {
      onSuccess(result);
    }
    return result;

  } catch (error) {
    cleanup();

    if (isPopupCancellationError(error)) {
      const reason =
        error.code === "AUTH_POPUP_TIMEOUT"
          ? "timeout"
          : error.code === "AUTH_MANUAL_CANCEL"
            ? "manual_abort"
            : "popup_closed";

      const cancelInfo = {
        cancelled: true,
        code: error.code || "auth/popup-closed-by-user",
        reason,
      };

      if (onCancel) {
        onCancel(cancelInfo);
      }
      return null;
    }

    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Creates a stateful session manager for a social auth operation.
 * Allows canceling an in-flight request via `session.cancel()`.
 *
 * @param {Object} [config]
 * @param {number} [config.timeoutMs]
 * @returns {Object} session helper
 */
export function createSocialAuthSession({ timeoutMs = SOCIAL_AUTH_TIMEOUT_MS } = {}) {
  let activeController = null;
  let inProgress = false;

  return {
    isActive: () => inProgress,

    cancel: (reason = "manual_abort") => {
      if (activeController && inProgress) {
        activeController.abort();
        inProgress = false;
      }
    },

    start: async ({
      auth,
      provider,
      signInFn,
      onSuccess,
      onCancel,
      onError,
    }) => {
      activeController = new AbortController();
      inProgress = true;

      try {
        const result = await executeSocialAuth({
          auth,
          provider,
          signInFn,
          timeoutMs,
          abortSignal: activeController.signal,
          onSuccess: (res) => {
            inProgress = false;
            if (onSuccess) onSuccess(res);
          },
          onCancel: (info) => {
            inProgress = false;
            if (onCancel) onCancel(info);
          },
          onError: (err) => {
            inProgress = false;
            if (onError) onError(err);
          },
        });
        return result;
      } finally {
        inProgress = false;
        activeController = null;
      }
    },
  };
}

/**
 * Creates a debounced click handler that blocks consecutive invocations within delayMs.
 *
 * @param {Function} callback
 * @param {number} [delayMs=1000]
 * @returns {Function}
 */
export function createDebouncedClick(callback, delayMs = 1000) {
  let lastClickTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastClickTime < delayMs) return;
    lastClickTime = now;
    return callback(...args);
  };
}

