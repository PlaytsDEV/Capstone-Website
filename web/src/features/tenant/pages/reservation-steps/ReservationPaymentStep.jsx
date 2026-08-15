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
  ArrowLeft,
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
  paymentCancelled = false,
  paymentApproved = false,
}) => {
  const room = reservationData?.room || {};
  const roomName = toDisplayString(room.name || room.roomNumber || room.title || room.id, "N/A");
  const reservationFeeAmount = Number.isFinite(Number(reservationData?.reservationFeeAmount))
    ? Number(reservationData.reservationFeeAmount)
    : 2000;

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

      {/* Payment Cancelled Recovery Banner */}
      {paymentCancelled && !readOnly && (
        <div className="rf-payment-cancelled-banner" role="status" aria-live="polite">
          <div className="rf-pcb-icon-wrap">
            <ArrowLeft size={18} aria-hidden="true" />
          </div>
          <div className="rf-pcb-content">
            <strong className="rf-pcb-title">You left before completing payment.</strong>
            <p className="rf-pcb-body">
              No worries — your reservation is still held. You can retry payment below whenever you're ready.
            </p>
          </div>
        </div>
      )}

      {/* Payment Complete Banner */}
      {readOnly && (paymentApproved || reservationData?.paymentStatus === "paid") && (
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
        <div className="rf-unified-checkout-card">
          {/* Top Hero Banner */}
          <div className="rf-uc-hero">
            <div className="rf-uc-hero-badge">STEP 4 • FINALIZATION</div>
            <span className="rf-uc-hero-label">One-Time Reservation Fee</span>
            <div className="rf-uc-hero-amount whitespace-nowrap">
              {formatCurrency(reservationFeeAmount)}
            </div>
            <div className="rf-uc-hero-subbadge">Deductible Partial Payment Deposit</div>
          </div>

          {/* Body Content */}
          <div className="rf-uc-body">
            {/* Room Details Flat Summary List */}
            <div className="rf-uc-summary-list">
              <div className="rf-uc-summary-row">
                <div className="rf-uc-row-left">
                  <Home size={15} className="rf-uc-icon" />
                  <span className="rf-uc-label">Room</span>
                </div>  
                <div className="rf-uc-row-right">
                  <span className="rf-uc-val-primary">{roomName}</span>
                  {formatBranch(room.branch) && (
                    <span className="rf-uc-val-sub">({formatBranch(room.branch)})</span>
                  )}
                </div>
              </div>

              {bedDisplay && (
                <div className="rf-uc-summary-row">
                  <div className="rf-uc-row-left">
                    <span className="rf-uc-label">Bed</span>
                  </div>
                  <div className="rf-uc-row-right">
                    <span className="rf-uc-val-primary">{bedDisplay}</span>
                  </div>
                </div>
              )}

              {targetMoveInDate && (
                <div className="rf-uc-summary-row">
                  <div className="rf-uc-row-left">
                    <Calendar size={15} className="rf-uc-icon" />
                    <span className="rf-uc-label">Target Move-In</span>
                  </div>
                  <div className="rf-uc-row-right">
                    <span className="rf-uc-val-primary whitespace-nowrap">{fmtDate(targetMoveInDate)}</span>
                  </div>
                </div>
              )}

              <div className="rf-uc-summary-row rf-uc-total-row">
                <div className="rf-uc-row-left">
                  <span className="rf-uc-total-label">Reservation Fee (Due Now)</span>
                </div>
                <div className="rf-uc-row-right">
                  <span className="rf-uc-total-amount whitespace-nowrap">{formatCurrency(reservationFeeAmount)}</span>
                </div>
              </div>
            </div>

            {/* Checkout Action Section */}
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
                <div className="rf-uc-actions">
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
                        I understand that the <strong className="whitespace-nowrap">{formatCurrency(reservationFeeAmount)}</strong> reservation fee is non-refundable.
                      </span>
                    </label>
                  </div>

                  {/* Minimalist State Hint (Simple text, no background box, no color callout) */}
                  {!agreedToFeePolicy && (
                    <div className="rf-payment-footer-note" id="reservation-payment-help">
                      <p className="rf-hint-text-minimal">
                        Please check the policy box above to proceed.
                      </p>
                    </div>
                  )}

                  {/* Pay Button */}
                  <button
                    onClick={handlePayClick}
                    className={`btn btn-success btn-pay-online-reservation ${payingOnline ? "is-loading" : ""} ${!canPay ? "is-disabled-btn" : ""}`}
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
                        <span className="whitespace-nowrap">{payButtonLabel}</span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationPaymentStep;


