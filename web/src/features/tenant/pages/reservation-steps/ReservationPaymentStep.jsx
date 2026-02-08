import React from "react";

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
            <span className="summary-label">Branch</span>
            <span className="summary-value">{reservationData.room.branch}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Type</span>
            <span className="summary-value">{reservationData.room.type}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Monthly Rent</span>
            <span className="summary-value">
              ₱{reservationData.room.price.toLocaleString()}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Lease Duration</span>
            <span className="summary-value">{leaseDuration} months</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Target Move-In Date</span>
            <span className="summary-value">{finalMoveInDate}</span>
          </div>
          <div className="total-section">
            <span>Reservation Fee</span>
            <span className="total-amount">₱2,000</span>
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Final Move-In Date</h3>
        <p className="section-helper">
          Need to adjust your move-in date? We'll verify availability again.
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
            >
              Re-Check
            </button>
          </div>
          <div className="form-helper">
            Availability will be re-verified if you change the date
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
              {proofOfPayment ? proofOfPayment.name : "Upload receipt or screenshot"}
            </div>
          </label>
        </div>
      </div>

      <div className="stage-buttons">
        <button onClick={onPrev} className="btn btn-secondary">
          Back
        </button>
        <button onClick={onNext} className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Processing..." : "Confirm Payment & Reserve"}
        </button>
      </div>
    </div>
  );
};

export default ReservationPaymentStep;
