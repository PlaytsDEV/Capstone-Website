import React from "react";

// Helper function to format branch name
const formatBranch = (branch) => {
  if (!branch) return "N/A";
  // If already formatted (e.g., "Gil Puyat"), return as-is
  if (branch.includes(" ") && !branch.includes("-")) return branch;
  // Otherwise format from slug (e.g., "gil-puyat" -> "Gil Puyat")
  return branch
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format room type
const formatRoomType = (type) => {
  if (!type) return "N/A";
  // If already formatted (e.g., "Private", "Shared", "Quadruple"), return as-is
  if (!type.includes("-")) return type;
  // Otherwise format from slug
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "Not set";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper function to get room name from various possible fields
const getRoomName = (room) => {
  if (!room) return "N/A";
  // Direct name fields
  if (room.name) return room.name;
  if (room.roomNumber) return room.roomNumber;
  // Extract from title (e.g., "Room 101" -> "101")
  if (room.title) {
    const match = room.title.match(/Room\s+(.+)/i);
    return match ? match[1] : room.title;
  }
  // Use id as fallback
  if (room.id) return room.id;
  return "N/A";
};

const ReservationPaymentStep = ({
  reservationData,
  leaseDuration,
  finalMoveInDate,
  setFinalMoveInDate,
  onMoveInDateUpdate,
  paymentMethod,
  setPaymentMethod,
  proofOfPayment,
  setProofOfPayment,
  isLoading,
  onPrev,
  onNext,
}) => {
  const room = reservationData?.room || {};

  return (
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Reservation Fee Payment
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Review your final details and secure your reservation with a ₱2,000 fee.
      </p>

      <div className="section-group">
        <h3 className="section-header">Reservation Details</h3>
        <div className="summary-section">
          <div className="summary-row">
            <span className="summary-label">Room</span>
            <span className="summary-value" style={{ fontWeight: "600" }}>
              {getRoomName(room)}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Branch</span>
            <span className="summary-value">{formatBranch(room.branch)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Type</span>
            <span className="summary-value">{formatRoomType(room.type)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Monthly Rent</span>
            <span
              className="summary-value"
              style={{ color: "#E7710F", fontWeight: "600" }}
            >
              ₱{(room.price || 0).toLocaleString()}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Lease Duration</span>
            <span className="summary-value">{leaseDuration || 12} months</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Target Move-In Date</span>
            <span className="summary-value">{formatDate(finalMoveInDate)}</span>
          </div>
          {reservationData?.selectedBed && (
            <div className="summary-row">
              <span className="summary-label">Selected Bed</span>
              <span className="summary-value">
                {reservationData.selectedBed.position} (
                {reservationData.selectedBed.id})
              </span>
            </div>
          )}
          <div className="total-section">
            <span>Reservation Fee</span>
            <span className="total-amount">₱2,000</span>
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Final Move-In Date</h3>
        <p className="section-helper">
          Need to adjust your move-in date? Click "Re-Check" to verify room
          availability for the new date.
        </p>
        <div className="form-group">
          <label className="form-label">Update Move-In Date (Optional)</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <input
              type="date"
              className="form-input"
              value={finalMoveInDate}
              onChange={(e) => setFinalMoveInDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onMoveInDateUpdate}
              style={{ whiteSpace: "nowrap" }}
              title="Verify if the room is still available on the selected date"
            >
              Re-Check Availability
            </button>
          </div>
          <div
            className="form-helper"
            style={{ marginTop: "8px", fontSize: "12px", color: "#6B7280" }}
          >
            The Re-Check button verifies if your selected room is still
            available on the new move-in date
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Payment Method</h3>
        <div className="form-group">
          <select
            className="form-select"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="bank">Bank Transfer</option>
            <option value="gcash">GCash</option>
            <option value="card">Credit/Debit Card</option>
            <option value="check">Check</option>
          </select>
        </div>

        <div className="info-box">
          <div className="info-box-title">💳 Payment Details</div>
          <div className="info-text">
            <strong>Bank Account:</strong> BDO - 1234-5678-9012
            <br />
            <strong>Account Name:</strong> Dormitory Services Inc.
            <br />
            <strong>Amount:</strong> ₱2,000
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Proof of Payment</h3>
        <div className="form-group">
          <label className="file-upload" htmlFor="payment-file">
            <input
              id="payment-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofOfPayment(e.target.files?.[0] || null)}
            />
            <div className="file-icon">💳</div>
            <div className="file-text">
              {proofOfPayment
                ? proofOfPayment.name
                : "Upload receipt or screenshot"}
            </div>
          </label>
        </div>
      </div>

      <div className="stage-buttons">
        <button onClick={onPrev} className="btn btn-secondary">
          Back
        </button>
        <button
          onClick={onNext}
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : "Confirm Payment & Reserve"}
        </button>
      </div>
    </div>
  );
};

export default ReservationPaymentStep;
