/**
 * =============================================================================
 * HTTP CLIENT - Core Authentication & Request Layer
 * =============================================================================
 *
 * Low-level HTTP client with Firebase token management.
 * All domain-specific API modules import from here.
 *
 * =============================================================================
 */

import { auth } from "../../firebase/config";
import { API_BASE_URL } from "./baseUrl";
import { getSessionHeaders } from "./authSession";
import {
  withProtectedRequestPolicy,
  withPublicRequestPolicy,
} from "./requestPolicy";

export const API_URL = API_BASE_URL;

// =============================================================================
// HELPER: Get Fresh Firebase ID Token
// =============================================================================

/**
 * Get a fresh Firebase ID token from the current user.
 * This ensures tokens are always valid and not expired.
 *
 * @param {boolean} forceRefresh - Force refresh even if token is still valid
 * @returns {Promise<string|null>} Fresh ID token or null if not logged in
 */
export const getFreshToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    return await user.getIdToken(forceRefresh);
  } catch (_) {
    console.error("Failed to refresh the authentication token.");
    return null;
  }
};

const parseApiJson = (json, preserveEnvelope = false) => {
  if (json && json.success === true && "data" in json && !preserveEnvelope) {
    return json.data;
  }

  return json;
};

const getFirstApiValidationMessage = (errorPayload) => {
  const details =
    errorPayload?.error?.details ??
    errorPayload?.details ??
    errorPayload?.errors;

  if (Array.isArray(details)) {
    for (const detail of details) {
      if (typeof detail === "string" && detail.trim()) return detail.trim();
      if (detail?.message) return String(detail.message).trim();
      if (detail?.msg) return String(detail.msg).trim();
    }
  }

  if (details && typeof details === "object") {
    for (const value of Object.values(details)) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (Array.isArray(value)) {
        const first = value.find(Boolean);
        if (first) return typeof first === "string" ? first.trim() : String(first?.message || first).trim();
      }
      if (value?.message) return String(value.message).trim();
    }
  }

  return "";
};

// =============================================================================
// CORE: Authenticated Fetch (always uses fresh token)
// =============================================================================

/**
 * Execute a protected request and return the raw Fetch response. Binary
 * downloads and multipart uploads use this path so they receive the same
 * Firebase, device-session, and cookie policy as JSON API requests.
 */
export const protectedFetch = async (url, options = {}) => {
  const { headers: optionHeaders, ...fetchOptions } = options;
  const token = await getFreshToken();
  if (!token) {
    throw new Error(
      "No authorization header provided - user not authenticated",
    );
  }

  const isFormDataBody =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const headers = {
    ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
    Authorization: `Bearer ${token}`,
    ...getSessionHeaders(),
    ...optionHeaders,
  };

  return fetch(
    `${API_URL}${url}`,
    withProtectedRequestPolicy(fetchOptions, headers),
  );
};

/**
 * Make authenticated HTTP request with always-fresh Firebase ID token.
 * This function should be used for all protected API endpoints.
 *
 * @param {string} url - API endpoint path (e.g., "/auth/login")
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} API error with response details
 */
export const authFetch = async (url, options = {}, _isRetry = false) => {
  try {
    const {
      preserveEnvelope = false,
      headers: optionHeaders,
      ...fetchOptions
    } = options;

    const response = await protectedFetch(url, {
      ...fetchOptions,
      headers: optionHeaders,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      if (response.status === 401) {
        if (!_isRetry) {
          const freshToken = await getFreshToken(true);
          if (freshToken) {
            return authFetch(url, options, true);
          }
        }
        // Persistent 401 — token refresh failed or retry still rejected.
        // Sign out and redirect unless already on an auth page.
        const isAuthPage = ["/", "/signin", "/signup", "/reset-password"].some(
          (p) => window.location.pathname === p || window.location.pathname.startsWith(p + "/"),
        );
        if (!isAuthPage) {
          sessionStorage.setItem("lc_session_expired", "1");
          try { await auth.signOut(); } catch { /* ignore */ }
          window.location.replace("/signin");
        }
      }

      let errorMessage =
        response.status === 404
          ? "The requested resource could not be found."
          : "Unable to complete your request right now.";
      const validationMessage = getFirstApiValidationMessage(error);
      if (validationMessage) {
        errorMessage = validationMessage;
      } else if (error && error.error) {
        errorMessage =
          typeof error.error === "string"
            ? error.error
            : error.error.message;
      } else if (error && error.message) {
        errorMessage = error.message;
      }

      if (errorMessage === "Not Found" || errorMessage === "Not Found.") {
        errorMessage = "The requested resource could not be found.";
      }

      const apiError = new Error(errorMessage);
      apiError.response = { status: response.status, data: error };
      throw apiError;
    }

    const json = await response.json();
    return parseApiJson(json, preserveEnvelope);
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};

// =============================================================================
// CORE: Public Fetch (no authentication required)
// =============================================================================

/**
 * Make public HTTP request (no authentication).
 *
 * @param {string} url - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
export const publicFetch = async (url, options = {}) => {
  try {
    const {
      preserveEnvelope = false,
      headers: optionHeaders,
      ...fetchOptions
    } = options;

    const isFormDataBody =
      typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

    const headers = {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...optionHeaders,
    };

    const response = await fetch(
      `${API_URL}${url}`,
      withPublicRequestPolicy(fetchOptions, headers),
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      const validationMessage = getFirstApiValidationMessage(error);
      let fallbackMessage =
        response.status === 404
          ? "The requested resource could not be found."
          : "Unable to complete your request right now.";
      let errorMessage =
        validationMessage || error.error || error.message || fallbackMessage;
      if (errorMessage === "Not Found" || errorMessage === "Not Found.") {
        errorMessage = "The requested resource could not be found.";
      }

      const apiError = new Error(errorMessage);
      apiError.response = { status: response.status, data: error };
      throw apiError;
    }

    const json = await response.json();
    return parseApiJson(json, preserveEnvelope);
  } catch (error) {
    console.error("Public API Request Error:", error);
    throw error;
  }
};

// =============================================================================
// HOOK: useApiClient (for React components that need direct access)
// =============================================================================

/**
 * React hook that provides authenticated API methods.
 * Use this inside React components or custom hooks.
 *
 * @example
 * const { authFetch } = useApiClient();
 * const data = await authFetch("/protected/route");
 */
export function useApiClient() {
  return {
    authFetch,
    publicFetch,
    get: (url) => authFetch(url, { method: "GET" }),
    post: (url, data) =>
      authFetch(url, { method: "POST", body: JSON.stringify(data) }),
    put: (url, data) =>
      authFetch(url, { method: "PUT", body: JSON.stringify(data) }),
    delete: (url) => authFetch(url, { method: "DELETE" }),
  };
}
