import React from "react";
import {
  formatBranch,
  fmtDate,
} from "../../../../shared/utils/formatDate";
import {
  getBedDisplayLabel,
  getBedShortCode,
} from "../../../../shared/utils/bedIdentifier";
import {
  ShieldCheck,
  CreditCard,
  Lock,
  RefreshCw,
  ChevronRight,
  Check,
  Home,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const formatCurrency = (amount) =>
  `PHP ${Number.isFinite(Number(amount)) ? Number(amount).toLocaleString("en-PH") : "0"}`;

const toDisplayString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    return toDisplayString(
      value.displayName ??
        value.name ??
        value.label ??
        value.title ??
        value.roomNumber ??
        value.slug ??
        value.key ??
        value.code ??
        value.value ??
        value.id,
      fallback,
    );
  }
  return fallback;
};

/**
 * Step 4 - Reservation Fee Payment (Streamlined & Responsive)
 * PayMongo online checkout (GCash, Maya, Card).
 */
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
  agreedToFeePolicy = false,
  setAgreedToFeePolicy = () => {},
}) => {
  const room = reservationData?.room || {};
  const roomName = toDisplayString(room.name || room.roomNumber || room.title || room.id, "N/A");
  const reservationFeeAmount = Number.isFinite(Number(reservationData?.reservationFeeAmount))
    ? Number(reservationData.reservationFeeAmount)
    : 2000;
  const monthlyRent = Number(
    reservationData?.monthlyRent ??
      reservationData?.moveInCashOut?.monthlyAdvance ??
      room?.monthlyPrice ??
      room?.price ??
      0,
  );
  const moveInCashOut = reservationData?.moveInCashOut || {
    monthlyAdvance: monthlyRent,
    securityDeposit: monthlyRent,
    grossTotal: monthlyRent * 2,
    reservationFeeDeductible: reservationFeeAmount,
    netAmountDue: Math.max(0, monthlyRent * 2 - reservationFeeAmount),
  };

  const selectedBed = reservationData?.selectedBed;
  const roomNumber = toDisplayString(room.roomNumber || room.name || room.title || room.id, "");
  const bedCode =
    typeof selectedBed === "object" && selectedBed
      ? selectedBed.code || getBedShortCode(roomNumber, selectedBed)
      : typeof selectedBed === "string"
      ? selectedBed
      : "";
  const bedLabel =
    typeof selectedBed === "object" && selectedBed
      ? getBedDisplayLabel(selectedBed, 0, room?.roomType || room?.type)
      : "";

  let bedDisplay = "";
  if (bedLabel && bedCode && !bedLabel.toLowerCase().includes(bedCode.toLowerCase())) {
    bedDisplay = `${bedLabel} (${bedCode})`;
  } else {
    bedDisplay = bedCode || bedLabel || toDisplayString(selectedBed, "");
  }

  const canPay = agreedToFeePolicy && !isLoading && !payingOnline && paymentAvailable && !readOnly;
  const payButtonLabel = payingOnline
    ? "Redirecting to PayMongo..."
    : `Pay ${formatCurrency(reservationFeeAmount)} Securely`;

  const handlePayClick = () => {
    if (!canPay) return;
    onPayOnline();
  };

  return (
    <div className="reservation-card rf-payment-stage">
      {/* Header */}
      <div className="main-header">
        <div className="main-header-badge">
          <span>Step 4 - Finalization</span>
        </div>
        <h2 className="main-header-title">Reservation Fee Payment</h2>
        <p className="main-header-subtitle">
          Pay the one-time reservation fee deposit to lock and secure your room.
        </p>
      </div>

      {/* Payment Complete Banner */}
      {readOnly && (
        <div className="rf-success-banner rf-payment-complete-banner">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <div className="info-box-title">Payment Complete</div>
            <div className="info-text">
              Your reservation fee of {formatCurrency(reservationFeeAmount)} has been paid and your room is reserved.
            </div>
          </div>
        </div>
      )}

      <div className={readOnly ? "rf-readonly-wrapper" : ""}>
        <div className="rf-payment-card-wrap">
          {/* Card 1: Payment Hero & Essential Room Summary */}
          <div className="rf-payment-summary-hero">
            <div className="rf-payment-amount-box">
              <span className="rf-payment-amount-label">One-Time Reservation Deposit</span>
              <div className="rf-payment-amount-value total-amount">
                {formatCurrency(reservationFeeAmount)}
              </div>
              <span className="rf-payment-amount-badge">Deductible Partial Payment</span>
            </div>

            <div className="rf-payment-room-chips summary-section rf-payment-summary">
              <div className="rf-room-chip summary-row rf-payment-room-row">
                <Home size={14} className="rf-chip-icon" />
                <span className="summary-label">Room:</span>
                <span className="summary-value">{roomName}</span>
                {formatBranch(room.branch) && (
                  <span className="rf-chip-sub">({formatBranch(room.branch)})</span>
                )}
              </div>

              {bedDisplay && (
                <div className="rf-room-chip summary-row">
                  <span className="summary-label">Bed:</span>
                  <span className="summary-value">{bedDisplay}</span>
                </div>
              )}

              {targetMoveInDate && (
                <div className="rf-room-chip summary-row">
                  <Calendar size={14} className="rf-chip-icon" />
                  <span className="summary-label">Target Move-In:</span>
                  <span className="summary-value">{fmtDate(targetMoveInDate)}</span>
                </div>
              )}
            </div>

            {/* Reservation Fee Deposit Breakdown */}
            <div className="rf-movein-breakdown rf-payment-breakdown-box">
              <div className="rf-payment-breakdown-title">
                Payment Summary
              </div>
              <div className="rf-payment-breakdown-row">
                <span>Reservation Fee (Due Now):</span>
                <span>{formatCurrency(reservationFeeAmount)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Checkout Action Section */}
          <div className="rf-payment-checkout-section">
            {!paymentAvailable && !readOnly ? (
              <div className="rf-locked-banner rf-payment-locked-box">
                <div className="info-box-title">
                  <Lock size={16} /> Payment Locked — Application Under Review
                </div>
                <div className="info-text">
                  Your application is currently under admin review. Payment will automatically unlock once approved.
                  {applicationReviewReason ? ` Latest note: ${applicationReviewReason}` : ""}
                </div>
              </div>
            ) : (
              !readOnly && (
                <>
                  {/* Accepted Payment Methods */}
                  <div className="rf-payment-methods-bar">
                    <span className="rf-payment-methods-label">Accepted Online Methods:</span>
                    <div className="rf-payment-methods-pills">
                      <span className="rf-pay-pill">GCash</span>
                      <span className="rf-pay-pill">Maya</span>
                      <span className="rf-pay-pill">Cards</span>
                    </div>
                  </div>

                  {/* Non-Refundable Fee Policy Checkbox */}
                  <div
                    className={`rf-fee-policy-check rf-policy-ack-box ${agreedToFeePolicy ? "is-checked" : ""} ${
                      isLoading || payingOnline ? "is-disabled" : ""
                    }`}
                    onClick={() => {
                      if (!isLoading && !payingOnline) {
                        setAgreedToFeePolicy(!agreedToFeePolicy);
                      }
                    }}
                  >
                    <div className="rf-policy-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="agreedToFeePolicy"
                        checked={Boolean(agreedToFeePolicy)}
                        onChange={(e) => setAgreedToFeePolicy(e.target.checked)}
                        disabled={isLoading || payingOnline}
                        className="rf-policy-checkbox"
                      />
                      <div className="rf-policy-custom-check" aria-hidden="true">
                        {agreedToFeePolicy && <Check size={12} strokeWidth={3.5} />}
                      </div>
                    </div>
                    <label htmlFor="agreedToFeePolicy" className="rf-policy-label" onClick={(e) => e.stopPropagation()}>
                      <span>
                        I understand that the <strong>{formatCurrency(reservationFeeAmount)}</strong> reservation fee is non-refundable.
                      </span>
                    </label>
                  </div>

                  {/* Pay Button */}
                  <button
                    onClick={handlePayClick}
                    className={`btn btn-success btn-pay-online-reservation ${payingOnline ? "is-loading" : ""}`}
                    disabled={!canPay}
                    aria-describedby="reservation-payment-help"
                  >
                    {payingOnline ? (
                      <span className="rf-pay-btn-inner rf-pay-btn-icon">
                        <RefreshCw size={18} className="rf-spin" aria-hidden="true" />
                        <span>Redirecting to PayMongo...</span>
                      </span>
                    ) : (
                      <span className="rf-pay-btn-inner rf-pay-btn-icon">
                        <CreditCard size={18} aria-hidden="true" />
                        <span>{payButtonLabel}</span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </span>
                    )}
                  </button>

                  {/* Security Note & State Hint */}
                  <div className="rf-payment-footer-note" id="reservation-payment-help">
                    <div className={`rf-payment-state-hint ${agreedToFeePolicy ? "rf-payment-state-hint--ready" : ""}`}>
                      {agreedToFeePolicy ? (
                        <span className="rf-hint-ready">
                          <CheckCircle2 size={14} /> Policy acknowledged. Click button above to continue.
                        </span>
                      ) : (
                        <span className="rf-hint-pending">
                          <AlertCircle size={14} /> Please acknowledge the non-refundable fee policy above to proceed.
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationPaymentStep;


