import React from "react";

const ReservationVisitStep = ({
  targetMoveInDate,
  viewingType,
  setViewingType,
  isOutOfTown,
  setIsOutOfTown,
  currentLocation,
  setCurrentLocation,
  visitApproved,
  onSimulateApproval,
  onPrev,
  onNext,
}) => {
  return (
    <div className="reservation-card bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
      <h2 className="stage-title text-2xl font-semibold text-slate-800">
        Room Verification
      </h2>
      <p className="stage-subtitle text-sm text-gray-500 mt-1">
        Verify your identity and room availability before proceeding.
      </p>

      <div className="info-box">
        <div className="info-box-title">ℹ️ What Happens Here</div>
        <div className="info-text">
          We'll confirm your room is available on your target move-in date (
          {targetMoveInDate}). Select how you'd like to verify yourself.
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Verification Method</h3>
        <div className="radio-group">
          <div className="radio-option">
            <input
              type="radio"
              name="verification"
              id="inperson"
              value="inperson"
              checked={viewingType === "inperson"}
              onChange={(e) => setViewingType(e.target.value)}
            />
            <label htmlFor="inperson" className="radio-label">
              <div className="radio-title">In-Person Visit</div>
              <div className="radio-desc">Schedule a visit to our branch</div>
            </label>
          </div>
          <div className="radio-option">
            <input
              type="radio"
              name="verification"
              id="virtual"
              value="virtual"
              checked={viewingType === "virtual"}
              onChange={(e) => setViewingType(e.target.value)}
            />
            <label htmlFor="virtual" className="radio-label">
              <div className="radio-title">Virtual Verification</div>
              <div className="radio-desc">
                For applicants unable to visit in person
              </div>
            </label>
          </div>
        </div>
      </div>

      {viewingType === "virtual" && (
        <div className="section-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="confirm-outoftown"
              checked={isOutOfTown}
              onChange={(e) => setIsOutOfTown(e.target.checked)}
            />
            <label htmlFor="confirm-outoftown" className="checkbox-label">
              I confirm that I am currently unable to visit in person
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Current Location (Optional)</label>
            <select
              className="form-select"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
            >
              <option value="">Select city/province</option>
              <option>Cebu</option>
              <option>Davao</option>
              <option>Iloilo</option>
              <option>Baguio</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      )}

      {!visitApproved && (
        <button
          onClick={onSimulateApproval}
          className="btn btn-secondary btn-full"
          style={{ marginTop: "16px" }}
        >
          Simulate Verification (Demo)
        </button>
      )}

      {visitApproved && (
        <div
          className="info-box"
          style={{
            background: "rgba(82, 165, 124, 0.06)",
            borderLeftColor: "#52a57c",
          }}
        >
          <div className="info-box-title">✅ Verification Approved</div>
          <div className="info-text">
            Room availability confirmed. You may now proceed to provide your
            details.
          </div>
        </div>
      )}

      <div className="stage-buttons flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={onPrev} className="btn btn-secondary">
          Back
        </button>
        <button
          onClick={onNext}
          className="btn btn-primary"
          disabled={!visitApproved}
        >
          Continue to Details
        </button>
      </div>
    </div>
  );
};

export default ReservationVisitStep;
