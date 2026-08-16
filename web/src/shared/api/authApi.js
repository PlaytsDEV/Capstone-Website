/**
 * =============================================================================
 * AUTH API SERVICE (Legacy Compatibility)
 * =============================================================================
 *
 * DEPRECATION NOTICE:
 * This file is maintained for backward compatibility with the useAuth hook.
 * For new code, use the authApi from apiClient.js which uses fresh tokens.
 *
 * Migration Guide:
 * - Old: import { authApi } from '../api/authApi'
 * - New: import { authApi } from '../api/apiClient'
 *
 * @deprecated Use apiClient.js authApi instead
 * =============================================================================
 */

import { auth } from "../../firebase/config";
import { API_BASE_URL } from "./baseUrl";
import {
  clearApplicationSession,
  getSessionHeaders,
  markApplicationSession,
} from "./authSession";
import { withProtectedRequestPolicy } from "./requestPolicy";
import { getApiErrorCode } from "./apiError";

/**
 * Get fresh Firebase ID token for API requests.
 * Forces refresh to ensure token validity.
 *
 * @returns {Promise<string|null>} Fresh ID token or null if not authenticated
 * @private
 */
const getFreshToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (_) {
    console.error("Failed to refresh the authentication token.");
    return null;
  }
};

/**
 * Make authenticated request with fresh Firebase token.
 *
 * @param {string} url - API endpoint path (relative to API_BASE_URL)
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} API error with message
 * @private
 */
const authRequest = async (url, options = {}, _isRetry = false) => {
  const token = await getFreshToken();
  const response = await fetch(`${API_BASE_URL}${url}`, withProtectedRequestPolicy(options, {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...getSessionHeaders(),
      ...options.headers,
    }));

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorCode = errorData.code || errorData.error?.code;
    const shouldRetryAuth =
      response.status === 401 &&
      !_isRetry &&
      !["OTP_SESSION_REQUIRED", "OTP_SESSION_INVALID"].includes(errorCode);

    if (shouldRetryAuth) {
      const refreshedToken = await getFreshToken(true);
      if (refreshedToken) {
        return authRequest(url, options, true);
      }
    }

    const errorMessage =
      typeof errorData.error === "string"
        ? errorData.error
        : errorData.error?.message ||
          errorData.message ||
          "Request failed";
    // Create error with .response property so callers can check status codes
    // (e.g., Google sign-up flow checks error.response?.status === 404)
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.response = {
      status: response.status,
      data: {
        ...errorData,
        code: errorCode,
        message: errorMessage,
      },
    };
    throw error;
  }

  return response.json();
};

const verificationRequest = async (path, body) => {
  const token = await getFreshToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Email-Verification-CSRF": "1",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = data.message || data.error?.message || "Email verification request failed";
    const error = new Error(errorMessage);
    error.code = getApiErrorCode(data);
    error.response = { status: response.status, data };
    throw error;
  }
  return data;
};

/**
 * Auth API methods for the useAuth hook.
 * @deprecated Use apiClient.js authApi for new implementations
 */
export const authApi = {
  /**
   * Authenticate user with backend after Firebase sign-in
   * @returns {Promise<Object>} User data from backend
   */
  login: async () => {
    const response = await authRequest("/auth/login", { method: "POST" });
    if (!response?.requiresOtp) markApplicationSession(response?.sessionId);
    return response;
  },

  verifyOtp: async (otp) => {
    const response = await authRequest("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ otp }),
    });
    markApplicationSession(response?.sessionId);
    return response;
  },

  resendOtp: () => authRequest("/auth/resend-otp", { method: "POST" }),
  sendEmailVerification: (continuePath) =>
    authRequest("/auth/email-verification/send", {
      method: "POST",
      body: JSON.stringify({ continuePath }),
    }),
  exchangeEmailVerificationToken: (exchangeToken) =>
    verificationRequest("/auth/email-verification/exchange", { exchangeToken }),
  getEmailVerificationStatus: () =>
    verificationRequest("/auth/email-verification/status"),
  finalizeEmailVerification: () =>
    verificationRequest("/auth/email-verification/finalize"),
  reconcileEmailVerification: () =>
    authRequest("/auth/email-verification/reconcile", { method: "POST" }),
  resendEmailVerification: () =>
    verificationRequest("/auth/email-verification/resend"),
  clearEmailVerificationCapability: () =>
    verificationRequest("/auth/email-verification/clear"),
  finalizePasswordReset: () => authRequest("/auth/finalize-password-reset", { method: "POST" }),
  notifyPasswordChanged: (params = {}) =>
    authRequest("/auth/notify-password-changed", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * Request a backend-generated, Lilycrest-branded password reset email.
   * Always resolves with the same enumeration-safe response regardless of
   * whether the address is registered — see passwordResetController.js.
   * @param {string} email
   * @returns {Promise<{message: string}>}
   */
  requestPasswordReset: (email) =>
    authRequest("/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /**
   * Check if user exists in backend (doesn't create audit log)
   * Used for Google sign-in flow to check before registration
   * @returns {Promise<Object>} User data from backend
   */
  checkUser: () =>
    authRequest("/auth/login?checkOnly=true", { method: "POST" }),

  /**
   * Register new user in backend after Firebase account creation
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user data
   */
  register: (userData) =>
    authRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  /**
   * Sign out user from Firebase and backend
   * @returns {Promise<Object>} Success message
   */
  logout: async () => {
    try {
      // Call backend logout endpoint first to log the logout
      await authRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error(
        "❌ [Logout] Backend logout error:",
        "Request failed",
      );
    }
    // Always sign out from Firebase even if backend fails
    clearApplicationSession();
    await auth.signOut();
    return { message: "Logged out successfully" };
  },

  /**
   * Get current user's profile from backend
   * @returns {Promise<Object>} User profile data
   */
  getCurrentUser: () => authRequest("/auth/profile"),
};
