import React from "react";

const ReservationSummaryStep = ({ reservationData, onNext }) => {
  return (
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Room Summary
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Review the room you're reserving.
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
              {reservationData?.room?.roomNumber ||
                reservationData?.room?.name ||
                reservationData?.room?.title ||
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

      <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={onNext} className="btn btn-primary w-full">
          Continue to Next Step
        </button>
      </div>
    </div>
  );
};

export default ReservationSummaryStep;
