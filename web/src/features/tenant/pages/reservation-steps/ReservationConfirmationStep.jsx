import React from "react";

const ReservationConfirmationStep = ({
  reservationData,
  reservationCode,
  finalMoveInDate,
  onViewDetails,
  onReturnHome,
}) => {
  return (
    <div className="reservation-card confirmation-card">
      <div className="success-icon">✓</div>
      <h2 className="stage-title">Reservation Confirmed!</h2>
      <p className="stage-subtitle">
        Your dormitory reservation has been successfully secured.
      </p>

      <div className="reservation-code">
        <div className="code-label">Reservation Code</div>
        <div className="code-value">{reservationCode}</div>
      </div>

      <div className="section-group">
        <h3 className="section-header">Reservation Summary</h3>
        <div className="detail-list">
          <div className="detail-item">
            <span className="detail-label">Branch</span>
            <span className="detail-value">{reservationData.room.branch}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Room Type</span>
            <span className="detail-value">{reservationData.room.type}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Monthly Rate</span>
            <span className="detail-value">
              ₱{reservationData.room.price.toLocaleString()}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Final Move-In Date</span>
            <span className="detail-value">{finalMoveInDate}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Payment Status</span>
            <span className="detail-value" style={{ color: "#52a57c" }}>
              ✓ Paid
            </span>
          </div>
        </div>
      </div>

      <div className="section-group">
        <h3 className="section-header">📋 What's Next</h3>
        <div className="info-box">
          <div className="info-box-title">Important Reminders</div>
          <div className="info-text">
            <strong>Move-In Date:</strong> {finalMoveInDate}
            <br />
            <strong>Reservation Valid Until:</strong>{" "}
            {new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toLocaleDateString()}
            <br />
            <br />
            <strong>Required Documents for Check-In:</strong>
            <br />• Valid ID (Government-issued)
            <br />• This reservation code
            <br />• First month's rent payment
            <br />
            <br />
            <strong>Admin Contact:</strong> (02) 123-4567 or
            reservations@lilycrest.com
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={onViewDetails} className="btn btn-primary btn-full">
          View Reservation Details
        </button>
        <button onClick={onReturnHome} className="btn btn-secondary btn-full">
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default ReservationConfirmationStep;
