import { auth } from "../../firebase/config";
import { showConfirmation, showNotification } from "./notification";

/**
 * Log out the current user
 * Clears Firebase auth session and local storage
 * @param {boolean} skipConfirmation - Skip confirmation dialog
 */
export const logout = async (skipConfirmation = false) => {
  try {
    // Show confirmation dialog unless skipped
    if (!skipConfirmation) {
      const confirmed = await showConfirmation(
        "Are you sure you want to logout?",
        "Logout",
        "Cancel",
      );

      if (!confirmed) {
        return false; // User cancelled
      }
    }

    await auth.signOut();
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    showNotification("Logged out successfully", "success");

    // Delay redirect to show notification
    setTimeout(() => {
      window.location.href = "/";
    }, 500);

    return true;
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Failed to logout. Please try again.", "error");
    throw error;
  }
};

/**
 * Get the current user from localStorage
 * @returns {Object|null} User object or null if not logged in
 */
export const getCurrentUser = () => {
  const userJson = localStorage.getItem("user");
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
};

/**
 * Check if user is logged in
 * @returns {boolean} True if user is logged in
 */
export const isLoggedIn = () => {
  return !!localStorage.getItem("authToken") && !!getCurrentUser();
};

/**
 * Check if user has admin role
 * @returns {boolean} True if user is admin or superAdmin
 */
export const isAdmin = () => {
  const user = getCurrentUser();
  return user && (user.role === "admin" || user.role === "superAdmin");
};

/**
 * Check if user has super admin role
 * @returns {boolean} True if user is superAdmin
 */
export const isSuperAdmin = () => {
  const user = getCurrentUser();
  return user && user.role === "superAdmin";
};
