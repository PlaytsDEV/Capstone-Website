/**
 * =============================================================================
 * BRANCH SELECTION MODAL
 * =============================================================================
 *
 * Modal for selecting branch when logging in with Google/Social providers.
 * Shown when a user logs in with Gmail but hasn't selected a branch yet.
 *
 * Features:
 * - Clear branch selection UI
 * - Loading state during submission
 * - Error handling
 * - Prevents modal dismissal during processing
 */

import { useState } from "react";
import "./BranchSelectionModal.css";

function BranchSelectionModal({ isOpen, onSelect, userEmail, loading }) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    // Validate branch selection
    if (!selectedBranch) {
      setError("Please select a branch to continue");
      return;
    }

    // Clear any previous errors
    setError("");

    // Call the onSelect callback
    onSelect(selectedBranch);
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setError(""); // Clear error when user makes a selection
  };

  return (
    <div className="branch-modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div
        className="branch-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="branch-modal-header">
          <h2>Select Your Branch</h2>
          <p>Welcome! Please select your preferred branch to continue.</p>
          {userEmail && <span className="user-email">{userEmail}</span>}
        </div>

        <div className="branch-modal-body">
          <div
            className={`branch-option ${selectedBranch === "gil-puyat" ? "selected" : ""} ${loading ? "disabled" : ""}`}
            onClick={() => !loading && handleBranchSelect("gil-puyat")}
          >
            <div className="branch-radio">
              <input
                type="radio"
                name="branch"
                value="gil-puyat"
                checked={selectedBranch === "gil-puyat"}
                onChange={(e) => handleBranchSelect(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="branch-info">
              <h3>Gil Puyat Branch</h3>
              <p>📍 Makati City - Gil Puyat Avenue</p>
              <p className="branch-desc">
                Modern dormitory in the heart of Makati's business district
              </p>
            </div>
          </div>

          <div
            className={`branch-option ${selectedBranch === "guadalupe" ? "selected" : ""} ${loading ? "disabled" : ""}`}
            onClick={() => !loading && handleBranchSelect("guadalupe")}
          >
            <div className="branch-radio">
              <input
                type="radio"
                name="branch"
                value="guadalupe"
                checked={selectedBranch === "guadalupe"}
                onChange={(e) => handleBranchSelect(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="branch-info">
              <h3>Guadalupe Branch</h3>
              <p>📍 Makati City - Guadalupe Area</p>
              <p className="branch-desc">
                Convenient location near transport hubs and shopping centers
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="branch-modal-error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
          </div>
        )}

        <div className="branch-modal-footer">
          <button
            className="branch-confirm-btn"
            onClick={handleSubmit}
            disabled={!selectedBranch || loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              "Continue"
            )}
          </button>

          <p className="branch-modal-note">
            You can change your branch later in your account settings
          </p>
        </div>
      </div>
    </div>
  );
}

export default BranchSelectionModal;
