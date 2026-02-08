import React from "react";

const ReservationSummaryStep = ({
  reservationData,
  targetMoveInDate,
  setTargetMoveInDate,
  leaseDuration,
  setLeaseDuration,
  billingEmail,
  setBillingEmail,
  devBypassValidation,
  setDevBypassValidation,
  onCancel,
  onNext,
}) => {
  return (
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Reservation Summary
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Confirm your intent before proceeding. Review what you're reserving.
      </p>

      <div className="section-group">
        <h3 className="section-header">Room Information</h3>
        <div className="summary-section">
          <div className="summary-row">
            <span className="summary-label">Selected Branch</span>
            <span className="summary-value">
              {reservationData?.room?.branch || "N/A"}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Type</span>
            <span className="summary-value">
              {reservationData?.room?.type || "N/A"}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Room Number</span>
            <span className="summary-value">
              {reservationData?.room?.title ||
                reservationData?.room?.id ||
                "N/A"}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Monthly Rent</span>
            <span className="summary-value">
              ₱{(reservationData?.room?.price || 0).toLocaleString()}
            </span>
          </div>
          {reservationData?.selectedBed && (
            <div className="summary-row">
              <span className="summary-label">Selected Bed</span>
              <span
                className="summary-value"
                style={{ textTransform: "capitalize" }}
              >
                {reservationData.selectedBed.position} Bed (
                {reservationData.selectedBed.id})
              </span>
            </div>
          )}
          {reservationData?.applianceFees > 0 && (
            <div className="summary-row">
              <span className="summary-label">Appliance Fees</span>
              <span className="summary-value">
                ₱{reservationData.applianceFees.toLocaleString()}/month
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Reservation Details</h3>
        <div className="form-group">
          <label className="form-label">Target Move-In Date & Time *</label>
          <input
            type="datetime-local"
            className="form-input"
            value={targetMoveInDate}
            onChange={(e) => setTargetMoveInDate(e.target.value)}
          />
          <div className="form-helper">
            This date and time is initial and can be adjusted later
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Lease Duration *</label>
          <select
            className="form-select"
            value={leaseDuration}
            onChange={(e) => setLeaseDuration(e.target.value)}
          >
            <option value="12">1 year</option>
            <option value="6">6 months</option>
            <option value="5">5 months</option>
            <option value="4">4 months</option>
            <option value="3">3 months</option>
            <option value="2">2 months</option>
            <option value="1">1 month</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Billing Email *</label>
          <input
            type="email"
            className="form-input"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder="statements@example.com"
          />
          <div className="form-helper">
            Used for monthly billing statements
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "#fff3cd",
          borderRadius: "8px",
          border: "1px solid #ffc107",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={devBypassValidation}
            onChange={(e) => setDevBypassValidation(e.target.checked)}
          />
          <span style={{ fontSize: "13px", color: "#856404" }}>
            🔧 DEV MODE: Bypass validation (Testing only)
          </span>
        </label>
      </div>

      <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button onClick={onNext} className="btn btn-primary">
          Confirm & Continue
        </button>
      </div>
    </div>
  );
};

export default ReservationSummaryStep;
