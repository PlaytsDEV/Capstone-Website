/**
 * =============================================================================
 * API CLIENT
 * =============================================================================
 *
 * Central API client for making HTTP requests to the backend server.
 *
 * Features:
 * - Automatic fresh Firebase ID token injection for every request
 * - Error handling and response parsing
 * - Public endpoints available without authentication
 *
 * GUIDE:
 * - For authenticated API calls: use the exported API objects (authApi, roomApi, etc.)
 * - For public API calls: use publicFetch or inquiryApi.create
 *
 * Base URL: Configured via REACT_APP_API_URL or defaults to localhost:5000
 */

import { auth } from "../../firebase/config";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

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
const getFreshToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.error("❌ Failed to get fresh token:", error);
    return null;
  }
};

// =============================================================================
// CORE: Authenticated Fetch (always uses fresh token)
// =============================================================================

/**
 * Make authenticated HTTP request with always-fresh Firebase ID token.
 * This function should be used for all protected API endpoints.
 *
 * @param {string} url - API endpoint path (e.g., "/auth/login")
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} API error with response details
 */
const authFetch = async (url, options = {}) => {
  try {
    // Always get a fresh token before each request
    const token = await getFreshToken();

    if (!token) {
      throw new Error(
        "No authorization header provided - user not authenticated",
      );
    }

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      const apiError = new Error(
        error.error || error.message || "API request failed",
      );
      apiError.response = { status: response.status, data: error };

      // Log 401 errors for debugging
      if (response.status === 401) {
        console.warn("🔐 Authentication failed - token may be expired");
      }

      throw apiError;
    }

    return response.json();
  } catch (error) {
    console.error("❌ API Request Error:", error);
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
const publicFetch = async (url, options = {}) => {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      const apiError = new Error(
        error.error || error.message || "API request failed",
      );
      apiError.response = { status: response.status, data: error };
      throw apiError;
    }

    return response.json();
  } catch (error) {
    console.error("❌ Public API Request Error:", error);
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
    // Convenience methods
    get: (url) => authFetch(url, { method: "GET" }),
    post: (url, data) =>
      authFetch(url, { method: "POST", body: JSON.stringify(data) }),
    put: (url, data) =>
      authFetch(url, { method: "PUT", body: JSON.stringify(data) }),
    delete: (url) => authFetch(url, { method: "DELETE" }),
  };
}

// =============================================================================
// AUTH API
// =============================================================================

export const authApi = {
  /**
   * Login user with Firebase token (called after Firebase auth)
   */
  login: () => authFetch("/auth/login", { method: "POST" }),

  /**
   * Register new user
   */
  register: (userData) =>
    authFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  /**
   * Get current user's profile
   */
  getProfile: () => authFetch("/auth/profile"),

  /**
   * Update user profile
   */
  updateProfile: (userData) =>
    authFetch("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  /**
   * Verify OTP code
   */
  verifyOtp: (otp) =>
    authFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),

  /**
   * Update user branch
   */
  updateBranch: (branch) =>
    authFetch("/auth/update-branch", {
      method: "PATCH",
      body: JSON.stringify({ branch }),
    }),
};

export const roomApi = {
  /**
   * Get all rooms (public)
   */
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return publicFetch(`/rooms?${params}`);
  },

  /**
   * Get room by ID (public)
   */
  getById: (roomId) => publicFetch(`/rooms/${roomId}`),

  /**
   * Create new room (admin only)
   */
  create: (roomData) =>
    authFetch("/rooms", {
      method: "POST",
      body: JSON.stringify(roomData),
    }),

  /**
   * Update room (admin only)
   */
  update: (roomId, roomData) =>
    authFetch(`/rooms/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(roomData),
    }),

  /**
   * Delete room (admin only)
   */
  delete: (roomId) => authFetch(`/rooms/${roomId}`, { method: "DELETE" }),
};

// =============================================================================
// RESERVATION API
// =============================================================================

export const reservationApi = {
  /**
   * Get all reservations
   */
  getAll: () => authFetch("/reservations"),

  /**
   * Get reservation by ID
   */
  getById: (reservationId) => authFetch(`/reservations/${reservationId}`),

  /**
   * Create new reservation
   */
  create: (reservationData) =>
    authFetch("/reservations", {
      method: "POST",
      body: JSON.stringify(reservationData),
    }),

  /**
   * Update reservation (admin only)
   */
  update: (reservationId, data) =>
    authFetch(`/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /**
   * Cancel reservation
   */
  cancel: (reservationId) =>
    authFetch(`/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    }),
};

// =============================================================================
// INQUIRY API
// =============================================================================

export const inquiryApi = {
  /**
   * Get all inquiries (admin only)
   */
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/inquiries?${queryString}` : "/inquiries";
    return authFetch(url);
  },

  /**
   * Get inquiry by ID (admin only)
   */
  getById: (inquiryId) => authFetch(`/inquiries/${inquiryId}`),

  /**
   * Get inquiry statistics (admin only)
   */
  getStats: () => authFetch("/inquiries/stats"),

  /**
   * Create new inquiry (public - no auth required)
   */
  create: (inquiryData) =>
    publicFetch("/inquiries", {
      method: "POST",
      body: JSON.stringify(inquiryData),
    }),

  /**
   * Update inquiry (admin only)
   */
  update: (inquiryId, data) =>
    authFetch(`/inquiries/${inquiryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /**
   * Archive inquiry (admin only) - soft delete
   */
  archive: (inquiryId) =>
    authFetch(`/inquiries/${inquiryId}`, { method: "DELETE" }),

  /**
   * Respond to inquiry (admin only)
   */
  respond: (inquiryId, response) =>
    authFetch(`/inquiries/${inquiryId}`, {
      method: "PUT",
      body: JSON.stringify({ response }),
    }),
};

// =============================================================================
// USER API
// =============================================================================

export const userApi = {
  /**
   * Get all users (admin only, filtered by branch)
   */
  getAll: (filters = {}) => {
    const queryString = new URLSearchParams(filters).toString();
    const url = queryString ? `/users?${queryString}` : "/users";
    return authFetch(url);
  },

  /**
   * Get user by ID (admin only)
   */
  getById: (userId) => authFetch(`/users/${userId}`),

  /**
   * Get user statistics (admin only)
   */
  getStats: () => authFetch("/users/stats"),

  /**
   * Update user (admin only)
   */
  update: (userId, userData) =>
    authFetch(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  /**
   * Delete user (super admin only)
   */
  delete: (userId) => authFetch(`/users/${userId}`, { method: "DELETE" }),

  /**
   * Get email by username (public - for login)
   */
  getEmailByUsername: (username) =>
    publicFetch(
      `/users/email-by-username?username=${encodeURIComponent(username)}`,
    ),
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

const apiClient = {
  authApi,
  roomApi,
  reservationApi,
  inquiryApi,
  userApi,
  useApiClient,
};

export default apiClient;
