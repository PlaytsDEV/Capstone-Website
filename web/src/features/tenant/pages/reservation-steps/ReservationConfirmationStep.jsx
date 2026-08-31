import React, { useRef, useState, useEffect, useCallback } from "react";
import { formatBranch, formatRoomType, fmtDate } from "../../../../shared/utils/formatDate";
import { formatPaymentMethod } from "../../../../shared/utils/formatPaymentMethod";
import {
  Home,
  Calendar,
  CreditCard,
  Wallet,
  Printer,
  CheckCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { getReservationConfirmationState } from "../../utils/reservationConfirmationState";
import { getEffectiveMonthlyStayRate } from "../../utils/pricingDisplayHelpers";
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
  const activeLease = leaseDuration || reservationData?.leaseDuration || room?.leaseDuration || "6";
  const pricingInfo = getEffectiveMonthlyStayRate(reservationData, { leaseDuration: activeLease });
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
    <div ref={receiptRef} className="w-full max-w-6xl mx-auto p-6 sm:p-8 lg:p-10 space-y-7 rf-confirmation-wrapper">
      {/* Header Badge & Title */}
      <div className="pt-1 sm:pt-2 space-y-3.5 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
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

      {/* Main 2-Column Responsive Bento Layout (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start">
        {/* Left Column: Status Hero, Official Code Card & Summary Cards */}
        <div className="lg:col-span-7 flex flex-col gap-5 justify-start">
          {/* Celebration Banner */}
          <div className="rf-celebration-banner m-0">
            <div className="rf-check-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="var(--text-inverse, #ffffff)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="rf-celebration-title">{confirmationState.title}</h1>
            <p className="rf-celebration-subtitle">{confirmationState.message}</p>
          </div>

          {/* Official Code Card */}
          {confirmationState.showReservationCodeCard ? (
            <div className="rf-code-card m-0">
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
            <div className="rf-code-card m-0">
              <div className="rf-code-label">Reservation Code</div>
              <div className="rf-code-hint">
                Your reservation details are being finalized. You will be notified once your reservation code is available.
              </div>
            </div>
          ) : null}

          {/* Summary Grid (4 spacious cards) */}
          <div className="rf-summary-grid m-0">
            <div className="rf-summary-card">
              <div className="rf-summary-icon">
                <Home size={20} />
              </div>
              <div className="rf-summary-label">Secured Room</div>
              <div className="rf-summary-value">{roomName}</div>
              <div className="rf-summary-meta">{formatBranch(room.branch)}</div>
            </div>

            <div className="rf-summary-card">
              <div className="rf-summary-icon">
                <Calendar size={20} />
              </div>
              <div className="rf-summary-label">Move-In Schedule</div>
              <div className="rf-summary-value">{fmtDate(finalMoveInDate)}</div>
              <div className="rf-summary-meta">
                {leaseDuration
                  ? (Number(leaseDuration) === 12 ? "12-month lease (1 year)" : `${leaseDuration}-month lease`)
                  : "Selected lease term"}
              </div>
            </div>

            <div className="rf-summary-card">
              <div className="rf-summary-icon">
                <Wallet size={20} />
              </div>
              <div className="rf-summary-label">Monthly Stay Rate</div>
              <div className="rf-summary-value">
                {pricingInfo.formattedMonthlyRate}
              </div>
              <div className="rf-summary-meta">
                {pricingInfo.applianceNote || "Regular monthly rent starts Month 2"}
              </div>
            </div>

            {confirmationState.showPaymentCard && (
              <div className="rf-summary-card rf-summary-card--payment">
                <div className="rf-summary-icon">
                  <CreditCard size={20} />
                </div>
                <div className="rf-summary-label">Reservation Slot Secured</div>
                <div className="rf-summary-value rf-summary-value--paid">
                  <CheckCircle size={14} /> ₱{reservationFeeAmount.toLocaleString("en-PH")} (Paid)
                </div>
                <div className="rf-summary-meta">
                  Slot successfully locked · Non-refundable deposit
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: What Happens Next & Actions Card */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-start">
          {/* What happens next */}
          <div className="rf-next-steps-card m-0">
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

          {/* Quick Actions & Official Receipt Card */}
          <div className="content-card m-0 p-5 sm:p-6 space-y-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
            <div className="card-section-title pb-3 mb-1 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>Reservation Navigation</span>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  pauseRedirect();
                  onViewDetails?.();
                }}
                className="w-full min-h-[48px] h-12 px-5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 cursor-pointer"
              >
                View My Reservation
              </button>
              <button
                type="button"
                onClick={() => {
                  pauseRedirect();
                  onReturnHome?.();
                }}
                className="w-full min-h-[48px] h-12 px-5 rounded-xl font-medium text-xs sm:text-sm text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>

            {confirmationState.showReceiptAction && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleViewReceipt}
                  className="w-full min-h-[42px] h-10 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={14} className="text-slate-500 dark:text-slate-400" />
                  <span>View / Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="w-full min-h-[42px] h-10 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download size={14} className="text-slate-500 dark:text-slate-400" />
                  <span>Download PDF</span>
                </button>
              </div>
            )}

            {isPaymentReturn && !paused && countdown > 0 && (
              <div className="rf-redirect-row mt-2">
                <span className="rf-redirect-text">
                  Taking you to your reservation in <strong>{countdown}s</strong>...
                </span>
                <button type="button" onClick={pauseRedirect} className="rf-redirect-cancel">
                  Stay here
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationStep;
