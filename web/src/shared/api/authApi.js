/**
 * =============================================================================
 * AUTH API (Legacy - for useAuth hook)
 * =============================================================================
 *
 * NOTE: This file is kept for backwards compatibility with the useAuth hook.
 * For new code, prefer using authApi from apiClient.js which uses fresh tokens.
 */

import { auth } from "../../firebase/config";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

/**
 * Get fresh Firebase ID token for API requests
 */
const getFreshToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(true);
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
};

/**
 * Make authenticated request with fresh token
 */
const authRequest = async (url, options = {}) => {
  const token = await getFreshToken();
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Request failed");
  }

  return response.json();
};

export const authApi = {
  login: () => authRequest("/auth/login", { method: "POST" }),

  register: (userData) =>
    authRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  logout: async () => {
    await auth.signOut();
    return { message: "Logged out successfully" };
  },

  getCurrentUser: () => authRequest("/auth/profile"),
};
