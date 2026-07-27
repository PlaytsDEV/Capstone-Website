import React from "react";
import {
  formatBranch,
  fmtDate,
} from "../../../../shared/utils/formatDate";
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
  const checkoutAmount = Number(moveInCashOut.netAmountDue || 0);

  const selectedBedPosition = toDisplayString(reservationData?.selectedBed?.position, "");
  const selectedBedId = toDisplayString(reservationData?.selectedBed?.id);
  const bedDisplay = selectedBedPosition
    ? `${selectedBedPosition}${selectedBedId ? ` (${selectedBedId})` : ""}`
    : "";

  const canPay = agreedToFeePolicy && !isLoading && !payingOnline && paymentAvailable && !readOnly;
  const payButtonLabel = payingOnline
    ? "Redirecting to PayMongo..."
    : `Proceed to PayMongo — ${formatCurrency(checkoutAmount)}`;

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
          Pay the approved remaining initial move-in amount securely through PayMongo.
        </p>
      </div>

      {/* Payment Complete Banner */}
      {readOnly && (
        <div className="rf-success-banner rf-payment-complete-banner">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <div className="info-box-title">Payment Complete</div>
            <div className="info-text">
              Your initial payment of {formatCurrency(checkoutAmount)} has been confirmed by PayMongo and your room is reserved.
            </div>
          </div>
        </div>
      )}

      <div className={readOnly ? "rf-readonly-wrapper" : ""}>
        <div className="rf-payment-card-wrap">
          {/* Card 1: Payment Hero & Essential Room Summary */}
          <div className="rf-payment-summary-hero">
            <div className="rf-payment-amount-box">
              <span className="rf-payment-amount-label">Remaining Initial Amount Due</span>
              <div className="rf-payment-amount-value total-amount">
                {formatCurrency(checkoutAmount)}
              </div>
              <span className="rf-payment-amount-badge">Advance and Deposit Balance</span>
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

            {/* Move-In Cash-Out Deductible Breakdown (Section 4 Lease Rule) */}
            {monthlyRent > 0 && (
              <div className="rf-movein-breakdown" style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Move-In Financial Breakdown
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>1st Month Advance Rent:</span>
                  <span>{formatCurrency(moveInCashOut.monthlyAdvance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>1 Month Security Deposit:</span>
                  <span>{formatCurrency(moveInCashOut.securityDeposit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600, borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '4px', marginBottom: '4px' }}>
                  <span>Gross Move-In Total:</span>
                  <span>{formatCurrency(moveInCashOut.grossTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>
                  <span>Less: Reservation Fee Credit:</span>
                  <span>- {formatCurrency(reservationFeeAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#f8fafc', fontWeight: 700, borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: '6px', marginTop: '4px' }}>
                  <span>PayMongo Checkout Amount:</span>
                  <span>{formatCurrency(moveInCashOut.netAmountDue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Checkout Action Section */}
          <div className="rf-payment-checkout-section">
            {!paymentAvailable && !readOnly ? (
              <div className="rf-locked-banner rf-payment-locked-box" style={{ margin: 0, padding: '16px', borderRadius: '12px' }}>
                <div className="info-box-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={16} /> Payment Locked — Application Under Review
                </div>
                <div className="info-text" style={{ marginTop: '6px' }}>
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
                    className={`btn btn-primary btn-pay-online-reservation ${payingOnline ? "is-loading" : ""}`}
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


