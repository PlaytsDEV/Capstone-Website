import React from "react";
import {
  formatBranch,
  formatRoomType,
  fmtDate,
} from "../../../../shared/utils/formatDate";
import { CreditCard, FileText, Lock } from "lucide-react";

const ReservationPaymentStep = ({
  reservationData,
  leaseDuration,
  targetMoveInDate,
  isLoading,
  onPayOnline,
  payingOnline,
  paymentAvailable = false,
  applicationReviewReason = "",
  readOnly,
}) => {
  const room = reservationData?.room || {};
  const roomName = room.name || room.roomNumber || room.title || room.id || "N/A";
  const reservationFeeAmount = Number(reservationData?.reservationFeeAmount || 2000);

  return (
    <div className="reservation-card">
      <div className="main-header">
        <div className="main-header-badge"><span>Step 4 · Finalization</span></div>
        <h2 className="main-header-title">Reservation Fee Payment</h2>
        <p className="main-header-subtitle">
          Review your reservation breakdown. Payment will only be available after
          admin approves your application and uploaded documents.
        </p>
      </div>

      {readOnly && (
        <div className="rf-success-banner">
          <div className="info-box-title">Payment Complete</div>
          <div className="info-text">
            Your reservation fee has been paid and your room is reserved.
          </div>
        </div>
      )}

      <div className={readOnly ? "rf-readonly-wrapper" : ""}>
        <div className="content-card">
          <div className="card-section-title">
            <FileText size={15} style={{ marginRight: 6, flexShrink: 0 }} />
            Reservation Breakdown
          </div>

          <div className="summary-section">
            <div className="summary-row">
              <span className="summary-label">Room</span>
              <span className="summary-value">{roomName}</span>
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
              <span className="summary-value" style={{ color: "var(--rf-accent)" }}>
                ₱{(room.price || 0).toLocaleString()}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Lease Duration</span>
              <span className="summary-value">{leaseDuration || 12} months</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Target Move-In Date</span>
              <span className="summary-value">{fmtDate(targetMoveInDate)}</span>
            </div>
            {reservationData?.selectedBed && (
              <div className="summary-row">
                <span className="summary-label">Selected Bed</span>
                <span className="summary-value">
                  {reservationData.selectedBed.position} ({reservationData.selectedBed.id})
                </span>
              </div>
            )}
            <div className="total-section">
              <span>Reservation Fee (One-time)</span>
              <span className="total-amount">₱{reservationFeeAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="card-section-title">
            <CreditCard size={15} style={{ marginRight: 6, flexShrink: 0 }} />
            Secure Online Payment
          </div>
          {!paymentAvailable && !readOnly ? (
            <div className="rf-locked-banner">
              <div className="info-box-title">
                <span className="rf-pay-btn-icon"><Lock size={15} /> Payment Locked — Pending Review</span>
              </div>
              <div className="info-text">
                Your application is still under review. Payment will become available once
                your application and documents are approved.
                {applicationReviewReason ? ` Latest admin note: ${applicationReviewReason}` : ""}
              </div>
            </div>
          ) : (
            <div className="rf-payment-info-box">
              <div className="info-box-title">
                <span className="rf-pay-btn-icon"><CreditCard size={15} /> Pay via GCash, Maya, or Card</span>
              </div>
              <div className="info-text">
                You&apos;ll be redirected to PayMongo&apos;s secure checkout to pay
                ₱{reservationFeeAmount.toLocaleString()}. Your reservation will be
                automatically confirmed once payment is received. A receipt will be
                available after payment.
              </div>
            </div>
          )}
        </div>
      </div>

      {!readOnly && paymentAvailable && (
        <div className="stage-buttons" style={{ justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onPayOnline}
            className="btn btn-primary btn-pay-online-reservation"
            disabled={isLoading || payingOnline}
          >
            {payingOnline ? (
              "Redirecting to PayMongo…"
            ) : (
              <span className="rf-pay-btn-icon">
                <CreditCard size={16} /> Pay ₱{reservationFeeAmount.toLocaleString()} Online
              </span>
            )}
          </button>
          <span className="rf-pay-hint">
            Didn&apos;t finish paying? Clicking the button will resume your active checkout session.
          </span>
        </div>
      )}
    </div>
  );
};

export default ReservationPaymentStep;
