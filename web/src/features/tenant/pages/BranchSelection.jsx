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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { showNotification } from "../../../shared/utils/notification";
import "../../../shared/styles/notification.css";
import "./BranchSelection.css";
import logoImage from "../../../assets/images/landingpage/logo.png";

function BranchSelection() {
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  /**
   * Validate authentication on component mount
   * Redirect to signin if no valid session
   */
  useEffect(() => {
    const validateSession = () => {
      try {
        const token = localStorage.getItem("authToken");
        const userStr = localStorage.getItem("user");

        // Check if user is authenticated
        if (!token || !userStr) {
          console.log("⚠️ No authentication found, redirecting to signin");
          showNotification("Please sign in first", "warning");
          navigate("/tenant/signin");
          return;
        }

        // Parse user data
        const user = JSON.parse(userStr);
        setUserEmail(user.email);

        // Check if branch is already selected
        if (user.branch && user.branch !== "") {
          console.log("✅ Branch already selected, redirecting...");
          showNotification(
            `Welcome back! Redirecting to ${user.branch}...`,
            "info",
          );
          setTimeout(() => {
            navigate(`/${user.branch}`);
          }, 1000);
        }
      } catch (error) {
        console.error("❌ Session validation error:", error);
        showNotification("Session invalid. Please sign in again.", "error");
        navigate("/tenant/signin");
      }
    };

    validateSession();
  }, [navigate]);

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
      console.log(`📍 Updating branch to: ${selectedBranch}`);

      // Get authentication token
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Update branch in backend
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/auth/update-branch`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ branch: selectedBranch }),
        },
      );

      // Handle response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Branch update failed:", errorData);
        throw new Error(errorData.error || "Failed to update branch");
      }

      const updatedUser = await response.json();
      console.log("✅ Branch updated successfully");

      // Update localStorage with new user data
      localStorage.setItem("user", JSON.stringify(updatedUser.user));

      // Show success message
      const branchName =
        selectedBranch === "gil-puyat" ? "Gil Puyat" : "Guadalupe";
      showNotification(
        `Welcome to ${branchName} branch! Redirecting...`,
        "success",
      );

      // Redirect to branch page
      setTimeout(() => {
        console.log(`🔄 Redirecting to /${selectedBranch}`);
        navigate(`/${selectedBranch}`);
      }, 1500);
    } catch (error) {
      console.error("❌ Branch selection error:", error);

      // Handle specific error cases
      let errorMessage = "Failed to select branch. ";

      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorMessage += "Please check your internet connection and try again.";
      } else if (
        error.message.includes("expired") ||
        error.message.includes("token")
      ) {
        errorMessage += "Your session has expired. Please sign in again.";

        // Clear session and redirect to signin
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");

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
