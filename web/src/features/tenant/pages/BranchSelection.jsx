/**
 * =============================================================================
 * BRANCH SELECTION PAGE
 * =============================================================================
 *
 * Dedicated page for branch selection after Google registration/login.
 * This is a required step for users who haven't selected their branch yet.
 *
 * Features:
 * - Full-page branch selection interface
 * - Cannot be dismissed (required step)
 * - Validates authentication state
 * - Handles branch update with backend
 * - Redirects after successful selection
 *
 * Error Handling:
 * - Session validation before rendering
 * - Network error handling
 * - User-friendly error messages
 * - Auto-redirect on expired session
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { showNotification } from "../../../shared/utils/notification";

import { useAuth } from "../../../shared/hooks/useAuth";
import { authApi } from "../../../shared/api/apiClient";
import "../../../shared/styles/notification.css";
import "./BranchSelection.css";
import logoImage from "../../../assets/images/branding/logo.png";

function BranchSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const noticeShownRef = useRef(false);

  /**
   * Validate authentication on component mount
   * Redirect to signin if no valid session
   */
  useEffect(() => {
    // TEMPORARY: Remove session lock for branch selection access
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      console.log("⚠️ No authentication found, redirecting to signin");
      showNotification("Please sign in first", "warning");
      navigate("/tenant/signin");
      return;
    }

    // Allow access regardless of session
    if (user && user.email) setUserEmail(user.email);
    // Optionally, still auto-redirect if branch is already selected
    if (user && user.branch && user.branch !== "") {
      const branchDisplayName =
        user.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe";
      showNotification(
        `You're already assigned to ${branchDisplayName} branch`,
        "info",
      );
      setTimeout(() => {
        navigate(`/${user.branch}`);
      }, 1000);
      return;
    }

    // Show branch-selection notice only after page is ready
    if (!noticeShownRef.current && location.state?.notice) {
      noticeShownRef.current = true;
      showNotification(location.state.notice, "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user, navigate, location.state]);

  /**
   * Handle branch selection
   * Validates selection, updates backend, and redirects
   */
  const handleBranchSelect = (branch) => {
    // Only allow selection when not loading
    if (!loading) {
      setSelectedBranch(branch);
      setError(""); // Clear any previous errors
    }
  };

  /**
   * Submit branch selection to backend
   * Updates user's branch and redirects to branch page
   */
  const handleContinue = async () => {
    // Validate branch selection
    if (!selectedBranch) {
      setError("Please select a branch to continue");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use API client to always get a fresh token
      const updatedUser = await authApi.updateBranch(selectedBranch);
      updateUser && updateUser(updatedUser.user);
      const branchName =
        selectedBranch === "gil-puyat" ? "Gil Puyat" : "Guadalupe";
      showNotification(
        `Branch selection confirmed! You've been assigned to ${branchName}`,
        "success",
      );
      setTimeout(() => {
        navigate(`/${selectedBranch}`);
      }, 1500);
    } catch (error) {
      let errorMessage = "Failed to select branch. ";
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorMessage += "Please check your internet connection and try again.";
      } else if (
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("token")
      ) {
        errorMessage += "Your session has expired. Please sign in again.";
        setTimeout(() => {
          navigate("/tenant/signin");
        }, 2000);
      } else {
        errorMessage += error.message || "Please try again.";
      }
      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="branch-selection-page">
      <div className="branch-selection-container">
        {/* Header with Logo */}
        <div className="branch-selection-header">
          <img src={logoImage} alt="Lilycrest Logo" className="branch-logo" />
          <h1>Welcome to Lilycrest!</h1>
          <p>Please select your preferred branch to continue</p>
          {userEmail && <span className="branch-user-email">{userEmail}</span>}
        </div>

        {/* Branch Options */}
        <div className="branch-options-container">
          <div
            className={`branch-card ${selectedBranch === "gil-puyat" ? "selected" : ""}`}
            onClick={() => !loading && handleBranchSelect("gil-puyat")}
          >
            <div className="branch-radio"></div>
            <div className="branch-info">
              <h3 className="branch-name">Gil Puyat Branch</h3>
              <p className="branch-description">
                Makati City - Gil Puyat Avenue
              </p>
            </div>
          </div>

          <div
            className={`branch-card ${selectedBranch === "guadalupe" ? "selected" : ""}`}
            onClick={() => !loading && handleBranchSelect("guadalupe")}
          >
            <div className="branch-radio"></div>
            <div className="branch-info">
              <h3 className="branch-name">Guadalupe Branch</h3>
              <p className="branch-description">Makati City - Guadalupe Area</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && <div className="error-message">{error}</div>}

        {/* Continue Button */}
        <div className="continue-button-container">
          <button
            className="continue-button"
            onClick={handleContinue}
            disabled={!selectedBranch || loading}
          >
            {loading ? (
              <div className="loading-spinner-container">
                <span className="loading-spinner"></span>
                <span>Processing...</span>
              </div>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BranchSelection;
