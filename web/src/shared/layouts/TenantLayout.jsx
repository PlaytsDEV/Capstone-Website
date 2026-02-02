import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { showConfirmation, showNotification } from "../utils/notification";
import "./TenantLayout.css";

/**
 * TenantLayout - Layout wrapper for tenant pages
 * Provides consistent header with logout functionality
 *
 * LOGOUT SEQUENCE (strict order):
 * 1. User clicks logout button
 * 2. Confirmation dialog appears
 * 3. User confirms → dialog closes
 * 4. Logout executes ONCE (ref guarded)
 * 5. Auth listener redirects to "/"
 *
 * CANCEL: User remains fully logged in, no state changes
 */
const TenantLayout = ({ children }) => {
  const { user, logout, globalLoading } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  // Ref to ensure logout executes exactly once per confirmation
  const logoutCalledRef = useRef(false);

  /**
   * Handle user logout with confirmation
   *
   * UI COMPONENT RESPONSIBILITY:
   * - Shows confirmation dialog
   * - Triggers logout action (auth logic)
   * - Shows notification based on result
   * - Navigates to branch home or root
   *
   * EXECUTION GUARANTEE:
   * - Confirmation must be explicit (no accidental logouts)
   * - Logout executes exactly once (ref guard)
   * - Loading state provides visual feedback
   */
  const handleLogout = async () => {
    // Prevent duplicate logout calls during loading or if already called
    if (loggingOut || globalLoading || logoutCalledRef.current) return;

    // Reset ref for new confirmation attempt
    logoutCalledRef.current = false;

    const confirmed = await showConfirmation(
      "Are you sure you want to log out?",
      "Log Out",
      "Cancel",
    );

    if (!confirmed) {
      // User cancelled - remain fully logged in
      return;
    }

    // Guard against duplicate execution
    if (logoutCalledRef.current) return;
    logoutCalledRef.current = true;

    try {
      // Execute logout - this sets globalLoading which shows the overlay
      const result = await logout(user?.branch);

      if (result?.success) {
        // Brief delay with loading overlay visible, then show notification and navigate
        setTimeout(() => {
          showNotification("You have been logged out successfully", "success");
          // Small delay after notification appears, then navigate
          setTimeout(() => {
            window.location.href = result.branch || "/";
          }, 300);
        }, 400);
      }
    } catch (error) {
      console.error("Logout error:", error);

      // Show error notification
      showNotification("Logout failed. Please try again.", "error");

      // Reset on error for retry
      logoutCalledRef.current = false;
    }
  };

  return (
    <div className="tenant-layout">
      <header className="tenant-header">
        <h2>Tenant Portal</h2>
        {user && (
          <div className="tenant-header-actions">
            <span className="tenant-user-name">
              {user.firstName || user.email}
            </span>
            <button
              className="tenant-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut || globalLoading}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </header>
      <main className="tenant-content">{children}</main>
    </div>
  );
};

export default TenantLayout;
