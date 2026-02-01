/**
 * =============================================================================
 * BRANCH SELECTION MODAL
 * =============================================================================
 *
 * Modal for selecting branch when logging in with Google/Social providers.
 * Shown when a user logs in with Gmail but hasn't selected a branch yet.
 */

import { useState } from "react";
import "./BranchSelectionModal.css";

function BranchSelectionModal({ isOpen, onSelect, userEmail, loading }) {
  const [selectedBranch, setSelectedBranch] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedBranch) {
      return;
    }
    onSelect(selectedBranch);
  };

  return (
    <div className="branch-modal-overlay">
      <div className="branch-modal-content">
        <div className="branch-modal-header">
          <h2>Select Your Branch</h2>
          <p>Welcome! Please select your branch to continue.</p>
          <span className="user-email">{userEmail}</span>
        </div>

        <div className="branch-modal-body">
          <div
            className={`branch-option ${selectedBranch === "gil-puyat" ? "selected" : ""}`}
            onClick={() => setSelectedBranch("gil-puyat")}
          >
            <div className="branch-radio">
              <input
                type="radio"
                name="branch"
                value="gil-puyat"
                checked={selectedBranch === "gil-puyat"}
                onChange={(e) => setSelectedBranch(e.target.value)}
              />
            </div>
            <div className="branch-info">
              <h3>Gil Puyat • Makati</h3>
              <p>Dormitory located in Gil Puyat, Makati City</p>
            </div>
          </div>

          <div
            className={`branch-option ${selectedBranch === "guadalupe" ? "selected" : ""}`}
            onClick={() => setSelectedBranch("guadalupe")}
          >
            <div className="branch-radio">
              <input
                type="radio"
                name="branch"
                value="guadalupe"
                checked={selectedBranch === "guadalupe"}
                onChange={(e) => setSelectedBranch(e.target.value)}
              />
            </div>
            <div className="branch-info">
              <h3>Guadalupe • Makati</h3>
              <p>Dormitory located in Guadalupe, Makati City</p>
            </div>
          </div>
        </div>

        <div className="branch-modal-footer">
          <button
            className="branch-confirm-btn"
            onClick={handleSubmit}
            disabled={!selectedBranch || loading}
          >
            {loading ? "Processing..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BranchSelectionModal;
