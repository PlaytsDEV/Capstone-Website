/**
 * =============================================================================
 * API CLIENT
 * =============================================================================
 *
 * Central API client for making HTTP requests to the backend server.
 *
 * Features:
 * - Automatic token injection from localStorage
 * - Error handling and response parsing
 * - Type-safe API methods for all endpoints
 *
 * Base URL: Configured via REACT_APP_API_URL or defaults to localhost:5000
 */

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

/**
 * Get authentication token from localStorage
 *
 * The token is stored after successful login/registration.
 *
 * @returns {string|null} Firebase ID token or null if not logged in
 */
const getAuthToken = () => {
  try {
    // Retrieve token stored during login
    return localStorage.getItem("authToken");
  } catch (error) {
    console.error("❌ Failed to get auth token:", error);
    return null;
  }
};

/**
 * Make authenticated HTTP request
 *
 * Helper function that adds authentication headers and handles responses.
 *
 * @param {string} url - API endpoint path (e.g., "/auth/login")
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @param {string|null} customToken - Optional custom token to use instead of stored token
 *
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} API error with response details
 */
const authFetch = async (url, options = {}, customToken = null) => {
  try {
    // Get token from parameter or localStorage
    const token = customToken || getAuthToken();

    // Build request headers
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    // Make HTTP request
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    });

    // Check if response is OK (status 200-299)
    if (!response.ok) {
      // Try to parse error response as JSON
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      // Create error object with response details
      const apiError = new Error(
        error.error || error.message || "API request failed",
      );
      apiError.response = { status: response.status, data: error };

      throw apiError;
    }

    // Parse and return successful response
    return response.json();
  } catch (error) {
    // Log error for debugging
    console.error("❌ API Request Error:", error);

    // Re-throw error for caller to handle
    throw error;
  }
};

// ============================================================================
// AUTHENTICATION API
// ============================================================================

/**
 * Authentication API methods
 *
 * Handles user authentication operations including login, registration,
 * email verification, and profile management.
 */
export const authApi = {
  /**
   * Login user with Firebase token
   *
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object>} User data
   */
  login: async (token) => {
    try {
      return authFetch(
        "/auth/login",
        {
          method: "POST",
        },
        token,
      );
    } catch (error) {
      console.error("❌ Login API error:", error);
      throw error;
    }
  },

  /**
   * Register new user
   *
   * @param {Object} userData - User registration data
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object>} Created user data
   */
  register: async (userData, token) => {
    try {
      return authFetch(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(userData),
        },
        token,
      );
    } catch (error) {
      console.error("❌ Register API error:", error);
      throw error;
    }
  },

  /**
   * Verify OTP code (if OTP system is implemented)
   *
   * @param {string} otp - One-time password
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object>} Verification result
   */
  verifyOtp: async (otp, token) => {
    try {
      return authFetch(
        "/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ otp }),
        },
        token,
      );
    } catch (error) {
      console.error("❌ Verify OTP API error:", error);
      throw error;
    }
  },

  /**
   * Resend OTP code (if OTP system is implemented)
   *
   * @param {string} token - Firebase ID token
   * @returns {Promise<Object>} Resend result
   */
  resendOtp: async (token) => {
    try {
      return authFetch(
        "/auth/resend-otp",
        {
          method: "POST",
        },
        token,
      );
    } catch (error) {
      console.error("❌ Resend OTP API error:", error);
      throw error;
    }
  },

  /**
   * Get current user's profile
   *
   * @returns {Promise<Object>} User profile data
   */
  getProfile: async () => {
    try {
      return authFetch("/auth/profile");
    } catch (error) {
      console.error("❌ Get profile API error:", error);
      throw error;
    }
  },

  /**
   * Update user profile
   *
   * @param {Object} userData - Updated user data (firstName, lastName, phone)
   * @returns {Promise<Object>} Updated user data
   */
  updateProfile: async (userData) => {
    try {
      return authFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(userData),
      });
    } catch (error) {
      console.error("❌ Update profile API error:", error);
      throw error;
    }
  },
};

// ============================================================================
// ROOM API
// ============================================================================

/**
 * Room API methods
 *
 * Handles dormitory room operations including listing, creating,
 * updating, and deleting rooms.
 */
export const roomApi = {
  /**
   * Get all rooms with optional filters
   *
   * @param {Object} filters - Filter options (branch, type, available)
   * @returns {Promise<Array>} List of rooms
   */
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      return fetch(`${API_URL}/rooms?${params}`).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch rooms");
        }
        return res.json();
      });
    } catch (error) {
      console.error("❌ Get rooms API error:", error);
      throw error;
    }
  },

  /**
   * Create new room (admin only)
   *
   * @param {Object} roomData - Room data (name, branch, type, capacity, price, etc.)
   * @returns {Promise<Object>} Created room
   */
  create: async (roomData) => {
    try {
      return authFetch("/rooms", {
        method: "POST",
        body: JSON.stringify(roomData),
      });
    } catch (error) {
      console.error("❌ Create room API error:", error);
      throw error;
    }
  },

  /**
   * Update existing room (admin only)
   *
   * @param {string} roomId - Room MongoDB ID
   * @param {Object} roomData - Updated room data
   * @returns {Promise<Object>} Updated room
   */
  update: async (roomId, roomData) => {
    try {
      return authFetch(`/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify(roomData),
      });
    } catch (error) {
      console.error("❌ Update room API error:", error);
      throw error;
    }
  },

  /**
   * Delete room (admin only)
   *
   * @param {string} roomId - Room MongoDB ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  delete: async (roomId) => {
    try {
      return authFetch(`/rooms/${roomId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("❌ Delete room API error:", error);
      throw error;
    }
  },
};

// ============================================================================
// RESERVATION API
// ============================================================================

/**
 * Reservation API methods
 *
 * Handles room reservation and booking operations.
 */
export const reservationApi = {
  /**
   * Get all reservations
   * - Admin: Get all reservations
   * - Tenant: Get own reservations only
   *
   * @returns {Promise<Array>} List of reservations
   */
  getAll: async () => {
    try {
      return authFetch("/reservations");
    } catch (error) {
      console.error("❌ Get reservations API error:", error);
      throw error;
    }
  },

  /**
   * Create new reservation
   *
   * @param {Object} reservationData - Reservation data (roomId, checkInDate, etc.)
   * @returns {Promise<Object>} Created reservation
   */
  create: async (reservationData) => {
    try {
      return authFetch("/reservations", {
        method: "POST",
        body: JSON.stringify(reservationData),
      });
    } catch (error) {
      console.error("❌ Create reservation API error:", error);
      throw error;
    }
  },

  /**
   * Update reservation (admin only)
   *
   * @param {string} reservationId - Reservation MongoDB ID
   * @param {Object} data - Updated reservation data
   * @returns {Promise<Object>} Updated reservation
   */
  update: async (reservationId, data) => {
    try {
      return authFetch(`/reservations/${reservationId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("❌ Update reservation API error:", error);
      throw error;
    }
  },
};

// ============================================================================
// INQUIRY API
// ============================================================================

/**
 * Inquiry API methods
 *
 * Handles customer inquiries and contact form submissions.
 */
export const inquiryApi = {
  /**
   * Get all inquiries (admin only)
   *
   * @returns {Promise<Array>} List of inquiries
   */
  getAll: async () => {
    try {
      return authFetch("/inquiries");
    } catch (error) {
      console.error("❌ Get inquiries API error:", error);
      throw error;
    }
  },

  /**
   * Create new inquiry (public - no authentication required)
   *
   * @param {Object} inquiryData - Inquiry data (name, email, subject, message, etc.)
   * @returns {Promise<Object>} Created inquiry
   */
  create: async (inquiryData) => {
    try {
      return fetch(`${API_URL}/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inquiryData),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to submit inquiry");
        }
        return res.json();
      });
    } catch (error) {
      console.error("❌ Create inquiry API error:", error);
      throw error;
    }
  },

  /**
   * Update inquiry (admin only)
   *
   * @param {string} inquiryId - Inquiry MongoDB ID
   * @param {Object} data - Updated inquiry data (status, response, etc.)
   * @returns {Promise<Object>} Updated inquiry
   */
  update: async (inquiryId, data) => {
    try {
      return authFetch(`/inquiries/${inquiryId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("❌ Update inquiry API error:", error);
      throw error;
    }
  },
};

// ============================================================================
// USER API
// ============================================================================

/**
 * User API methods
 *
 * Handles user management operations (admin only).
 */
export const userApi = {
  /**
   * Get all users (admin only)
   *
   * @returns {Promise<Array>} List of users
   */
  getAll: async () => {
    try {
      return authFetch("/users");
    } catch (error) {
      console.error("❌ Get users API error:", error);
      throw error;
    }
  },

  /**
   * Get user by ID (admin only)
   *
   * @param {string} userId - User MongoDB ID
   * @returns {Promise<Object>} User data
   */
  getById: async (userId) => {
    try {
      return authFetch(`/users/${userId}`);
    } catch (error) {
      console.error("❌ Get user by ID API error:", error);
      throw error;
    }
  },
};

// ============================================================================
// EXPORT DEFAULT API CLIENT
// ============================================================================

/**
 * Default export containing all API modules
 *
 * Usage:
 *   import apiClient from './apiClient';
 *   const rooms = await apiClient.roomApi.getAll();
 */
const apiClient = {
  authApi,
  roomApi,
  reservationApi,
  inquiryApi,
  userApi,
};

export default apiClient;
