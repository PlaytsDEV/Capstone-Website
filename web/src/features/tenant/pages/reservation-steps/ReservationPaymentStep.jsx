import React from "react";
import {
  formatBranch,
  formatRoomType,
  fmtDate,
} from "../../../../shared/utils/formatDate";
import {
  AlertCircle,
  CreditCard,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Lock,
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
 * Step 4 - Reservation Fee Payment
 * PayMongo online checkout only (GCash, Maya, Card).
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
  const monthlyRent = Number.isFinite(Number(room.price || room.monthlyRent))
    ? Number(room.price || room.monthlyRent)
    : 0;
  const selectedBedPosition = toDisplayString(reservationData?.selectedBed?.position, "Bed");
  const selectedBedId = toDisplayString(reservationData?.selectedBed?.id);
  const canPay = agreedToFeePolicy && !isLoading && !payingOnline;
  const payButtonLabel = payingOnline
    ? "Redirecting to secure checkout..."
    : `Pay ${formatCurrency(reservationFeeAmount)} Securely`;

  const paymentFacts = [
    {
      icon: ShieldCheck,
      title: "Secure checkout",
      text: "PayMongo handles the payment page.",
    },
    {
      icon: CreditCard,
      title: "GCash, Maya, or card",
      text: "Choose your preferred online method.",
    },
    {
      icon: Receipt,
      title: "Receipt after payment",
      text: "The receipt becomes available once confirmed.",
    },
    {
      icon: RefreshCw,
      title: "Safe to retry",
      text: "Interrupted checkout can be resumed from here.",
    },
  ];

  const handlePayClick = () => {
    if (!canPay) return;
    onPayOnline();
  };

  return (
    <div className="reservation-card rf-payment-stage">
      <div className="main-header">
        <div className="main-header-badge">
          <span>Step 4 - Finalization</span>
        </div>
        <h2 className="main-header-title">Reservation Fee Payment</h2>
        <p className="main-header-subtitle">
          Review your reservation details and pay the one-time reservation fee
          of {formatCurrency(reservationFeeAmount)} to secure your room. Payment will only be available after admin approves your application.
        </p>
      </div>

      {readOnly && (
        <div className="rf-success-banner rf-payment-complete-banner">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <div className="info-box-title">Payment Complete</div>
            <div className="info-text">
              Your reservation fee has been paid and your room is reserved.
            </div>
          </div>
        </div>
      )}

      <div className={readOnly ? "rf-readonly-wrapper" : ""}>
        <section className="content-card rf-payment-summary-card">
          <div className="card-section-title">
            <div className="icon">
              <Receipt size={16} aria-hidden="true" />
            </div>
            Reservation Breakdown
          </div>

          <div className="summary-section rf-payment-summary">
            <div className="summary-row rf-payment-room-row">
              <span className="summary-label">Selected Room</span>
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
              <span className="summary-value rf-payment-rent">
                {formatCurrency(monthlyRent)}
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
                  {selectedBedPosition}
                  {selectedBedId ? ` (${selectedBedId})` : ""}
                </span>
              </div>
            )}
            <div className="total-section rf-payment-total">
              <span>Reservation Fee (One-time)</span>
              <span className="total-amount">
                {formatCurrency(reservationFeeAmount)}
              </span>
            </div>
          </div>
        </section>

        <section className="content-card rf-payment-trust-card">
          <div className="card-section-title">
            <div className="icon">
              <ShieldCheck size={16} aria-hidden="true" />
            </div>
            Secure Online Payment
          </div>

          {!paymentAvailable && !readOnly ? (
            <div className="rf-locked-banner" style={{ margin: '14px 0', padding: '16px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
              <div className="info-box-title" style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                <Lock size={15} /> Payment Locked — Pending Review
              </div>
              <div className="info-text" style={{ color: '#B91C1C', marginTop: '6px', fontSize: '0.9rem' }}>
                Your application is still under review. Payment will become available once
                your application and documents are approved.
                {applicationReviewReason ? ` Latest admin note: ${applicationReviewReason}` : ""}
              </div>
            </div>
          ) : (
            <>
              <div className="rf-payment-info-box">
                <div className="info-box-title">PayMongo secure checkout</div>
                <div className="info-text">
                  You will be redirected to PayMongo to complete the payment. Your
                  reservation is secured only after PayMongo confirms the payment.
                </div>
              </div>
              <div className="rf-payment-facts" aria-label="Payment details">
                {paymentFacts.map(({ icon: Icon, title, text }) => (
                  <div className="rf-payment-fact" key={title}>
                    <span className="rf-payment-fact-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {!readOnly && paymentAvailable && (
        <section className="content-card rf-payment-action-card">
          <label className="rf-fee-policy-check">
            <input
              type="checkbox"
              checked={Boolean(agreedToFeePolicy)}
              onChange={(event) => setAgreedToFeePolicy(event.target.checked)}
              disabled={isLoading || payingOnline}
            />
            <span>
              I understand the reservation fee is non-refundable once paid.
            </span>
          </label>

          <div className="stage-buttons rf-payment-actions">
            <div className="rf-payment-action-copy">
              <strong>Ready to secure your room?</strong>
              <span>
                Confirm the policy, then continue to PayMongo checkout.
              </span>
            </div>
            <button
              onClick={handlePayClick}
              className="btn btn-primary btn-pay-online-reservation"
              disabled={!canPay}
              aria-describedby="reservation-payment-help"
            >
              <span className="rf-pay-btn-icon">
                <CreditCard size={16} aria-hidden="true" />
                {payButtonLabel}
              </span>
            </button>
          </div>

          <div
            className={`rf-payment-state-hint${
              agreedToFeePolicy ? " rf-payment-state-hint--ready" : ""
            }`}
            id="reservation-payment-help"
          >
            {agreedToFeePolicy ? (
              <>
                <RefreshCw size={15} aria-hidden="true" />
                <span>
                  If checkout was interrupted, use this button again. Only
                  completed PayMongo payments will confirm the reservation.
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={15} aria-hidden="true" />
                <span>
                  Please acknowledge the non-refundable fee policy before
                  payment.
                </span>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReservationPaymentStep;
