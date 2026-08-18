import React, { useRef, useState, useEffect, useCallback } from "react";
import { formatBranch, formatRoomType, fmtDate } from "../../../../shared/utils/formatDate";
import { formatPaymentMethod } from "../../../../shared/utils/formatPaymentMethod";
import {
  Home,
  Calendar,
  CreditCard,
  Printer,
  CheckCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { getReservationConfirmationState } from "../../utils/reservationConfirmationState";
import { getResolvedMonthlyRate } from "../../utils/pricingDisplayHelpers";
import { generateDepositReceipt, viewDepositReceipt } from "../../../../shared/utils/receiptGenerator";

const REDIRECT_SECONDS = 15;

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

const ReservationConfirmationStep = ({
  reservationData,
  reservationCode,
  finalMoveInDate,
  leaseDuration,
  paymentMethod,
  paymentApproved = false,
  applicantName,
  applicantEmail,
  applicantPhone,
  visitDate,
  visitTime,
  onViewDetails,
  onReturnHome,
  isPaymentReturn = false,
}) => {
  const receiptRef = useRef(null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(!isPaymentReturn);
  const [copiedCode, setCopiedCode] = useState(false);

  const room = reservationData?.room || {};
  const roomName = toDisplayString(room.roomNumber || room.name || room.title, "N/A");
  const reservationFeeAmount = reservationData?.reservationFeeAmount || 2000;
  const effectiveReservation = {
    ...reservationData,
    reservationCode: reservationCode || reservationData?.reservationCode || "",
    paymentMethod: reservationData?.paymentMethod || paymentMethod || "",
  };
  const confirmationState = getReservationConfirmationState(effectiveReservation, {
    reservationCode: effectiveReservation.reservationCode,
    paymentApproved,
  });
  const confirmedReservationCode = confirmationState.hasReservationCode
    ? effectiveReservation.reservationCode
    : "";
  const displayPaymentMethod = effectiveReservation.paymentMethod || paymentMethod || "";

  const handleCopyCode = () => {
    if (!confirmedReservationCode) return;
    navigator.clipboard?.writeText(confirmedReservationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  useEffect(() => {
    if (paused || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onViewDetails?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, countdown, onViewDetails]);

  const pauseRedirect = useCallback(() => setPaused(true), []);

  const profilePayload = {
    firstName: applicantName?.split(" ")[0] || "",
    lastName: applicantName?.split(" ").slice(1).join(" ") || "",
    email: applicantEmail,
    mobileNumber: applicantPhone,
  };

  const handleViewReceipt = () => {
    if (!confirmationState.showReceiptAction) return;
    pauseRedirect();
    viewDepositReceipt(effectiveReservation, profilePayload);
  };

  const handleDownloadReceipt = () => {
    if (!confirmationState.showReceiptAction) return;
    pauseRedirect();
    generateDepositReceipt(effectiveReservation, profilePayload);
  };

  return (
    <div ref={receiptRef} className="w-full max-w-6xl mx-auto space-y-6 rf-confirmation-wrapper">
      {/* Header Badge */}
      <div className="space-y-2.5 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center px-3 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-full">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Step 5 · Confirmation
            </span>
          </div>

          {/* Room Designation Pill Badge */}
          {room && (room.name || room.roomNumber || room.title || room.branch) && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 self-start sm:self-auto flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {roomName} · {formatBranch(room.branch)}
              </span>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Reservation Confirmation</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 max-w-2xl">
            Your room has been reserved and your details are registered in the Lilycrest system.
          </p>
        </div>
      </div>

      <div className="rf-celebration-banner">
        <div className="rf-check-circle">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="var(--text-inverse)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="rf-celebration-title">{confirmationState.title}</h1>
        <p className="rf-celebration-subtitle">{confirmationState.message}</p>
      </div>

      {confirmationState.showReservationCodeCard ? (
        <div className="rf-code-card">
          <div className="rf-code-header-row">
            <div className="rf-code-label">Your Official Reservation Code</div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="rf-code-copy-btn"
              title="Copy reservation code"
            >
              {copiedCode ? (
                <>
                  <Check size={13} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy Code
                </>
              )}
            </button>
          </div>
          <div className="rf-code-value">{confirmedReservationCode}</div>
          <div className="rf-code-hint">Keep this code handy for verification on move-in day.</div>
        </div>
      ) : confirmationState.showFinalizingCodeMessage ? (
        <div className="rf-code-card">
          <div className="rf-code-label">Reservation Code</div>
          <div className="rf-code-hint">
            Your reservation details are being finalized. You will be notified once your reservation code is available.
          </div>
        </div>
      ) : null}

      <div className="rf-summary-grid">
        <div className="rf-summary-card">
          <div className="rf-summary-icon">
            <Home size={22} />
          </div>
          <div className="rf-summary-label">Secured Room</div>
          <div className="rf-summary-value">{roomName}</div>
          <div className="rf-summary-meta">{formatBranch(room.branch)}</div>
        </div>

        <div className="rf-summary-card">
          <div className="rf-summary-icon">
            <Calendar size={22} />
          </div>
          <div className="rf-summary-label">Move-In Schedule</div>
          <div className="rf-summary-value">{fmtDate(finalMoveInDate)}</div>
          <div className="rf-summary-meta">
            {leaseDuration
              ? (Number(leaseDuration) === 12 ? "12-month lease (1 year)" : `${leaseDuration}-month lease`)
              : "Selected lease term"}
          </div>
        </div>

        {confirmationState.showPaymentCard && (
          <div className="rf-summary-card rf-summary-card--payment">
            <div className="rf-summary-icon">
              <CreditCard size={22} />
            </div>
            <div className="rf-summary-label">Reservation Slot Secured</div>
            <div className="rf-summary-value rf-summary-value--paid">
              <CheckCircle size={15} /> ₱{reservationFeeAmount.toLocaleString("en-PH")} (Paid)
            </div>
            <div className="rf-summary-meta">
              Remaining Move-In Balance: ₱{Math.max(0, (Number(getResolvedMonthlyRate(reservationData?.pricingDisplay) || room?.price || 0) * 2) - reservationFeeAmount).toLocaleString("en-PH")}
            </div>
          </div>
        )}
      </div>

      <div className="rf-next-steps-card">
        <div className="rf-next-steps-title">
          <span>What happens next</span>
        </div>
        <div className="rf-steps-list">
          {confirmationState.nextSteps.map(({ step, detail }, idx) => (
            <div key={idx} className="rf-next-step">
              <div className="rf-step-number">{idx + 1}</div>
              <div>
                <div className="rf-step-text">{step}</div>
                <div className="rf-step-detail">{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rf-conf-buttons-row">
        <button
          onClick={() => {
            pauseRedirect();
            onViewDetails?.();
          }}
          className="rf-conf-primary-btn"
        >
          View My Reservation
        </button>
        <button
          onClick={() => {
            pauseRedirect();
            onReturnHome?.();
          }}
          className="rf-conf-secondary-btn"
        >
          Go to Dashboard
        </button>
      </div>

      {confirmationState.showReceiptAction && (
        <div className="rf-print-row" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={handleViewReceipt} className="rf-print-link">
            <Printer size={14} /> View / Print Official Receipt
          </button>
          <button onClick={handleDownloadReceipt} className="rf-print-link">
            <Download size={14} /> Download PDF
          </button>
        </div>
      )}

      {isPaymentReturn && !paused && countdown > 0 && (
        <div className="rf-redirect-row">
          <span className="rf-redirect-text">
            Taking you to your reservation in <strong>{countdown}s</strong>...
          </span>
          <button onClick={pauseRedirect} className="rf-redirect-cancel">
            Stay here
          </button>
        </div>
      )}
    </div>
  );
};

export default ReservationConfirmationStep;
