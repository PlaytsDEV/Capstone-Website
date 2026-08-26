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
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Edit3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { getAvailableLeaseOptions } from "./applicationFormConstants";
import { getResolvedMonthlyRate, isPricingDisplayUsable } from "../../utils/pricingDisplayHelpers";
import { showNotification } from "../../../../shared/utils/notification";

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
  onPrev,
  onPayOnline,
  payingOnline,
  paymentAvailable = false,
  applicationReviewReason = "",
  readOnly,
  agreedToFeePolicy = false,
  setAgreedToFeePolicy = () => {},
  paymentCancelled = false,
  paymentApproved = false,
  onUpdateStayPackage,
  roomSelectionLocked = false,
}) => {
  const [isEditingTerm, setIsEditingTerm] = React.useState(false);
  const [isUpdatingTerm, setIsUpdatingTerm] = React.useState(false);

  const room = reservationData?.room || {};
  const roomName = toDisplayString(room.name || room.roomNumber || room.title || room.id, "N/A");
  const reservationFeeAmount = Number.isFinite(Number(reservationData?.reservationFeeAmount))
    ? Number(reservationData.reservationFeeAmount)
    : 2000;

  const pricingDisplay = reservationData?.pricingDisplay;
  const hasResolvedMonthlyRate = isPricingDisplayUsable(pricingDisplay);
  const monthlyRent = getResolvedMonthlyRate(pricingDisplay) || Number(reservationData?.monthlyRent || room?.price || 0);

  const minMonths = room?.longTermLeaseMinMonths ?? 6;
  const leaseOptions = React.useMemo(() => getAvailableLeaseOptions(minMonths), [minMonths]);
  const activeLease = leaseDuration || reservationData?.leaseDuration || room?.leaseDuration || "6";

  const handleSelectTerm = async (termValue) => {
    if (String(termValue) === String(activeLease)) {
      setIsEditingTerm(false);
      return;
    }
    setIsUpdatingTerm(true);
    try {
      if (onUpdateStayPackage) {
        await onUpdateStayPackage({ leaseDuration: termValue });
        showNotification(
          `Lease duration updated to ${termValue === "12" ? "1 Year" : `${termValue} Months`}.`,
          "success"
        );
      }
      setIsEditingTerm(false);
    } catch (err) {
      console.error("Failed to update lease term:", err);
      showNotification("Failed to update lease duration. Please try again.", "error");
    } finally {
      setIsUpdatingTerm(false);
    }
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
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Main Header (Solid Colors, Standalone Icons, Room Designation Pill) */}
      <div className="space-y-2.5 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center px-3 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-full">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Step 4 · Payment
            </span>
          </div>

          {/* Room Designation Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 self-start sm:self-auto flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {roomName} · {formatBranch(room.branch || reservationData?.branch)}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-slate-800 dark:text-slate-200 flex-shrink-0" />
            <span>Reservation Fee Payment</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 max-w-2xl">
            Pay the one-time reservation fee deposit to lock and secure your room.
          </p>
        </div>
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
                    <span className="rf-uc-label">Intended Move-in Date</span>
                  </div>
                  <div className="rf-uc-row-right">
                    <span className="rf-uc-val-primary whitespace-nowrap">{fmtDate(targetMoveInDate)}</span>
                  </div>
                </div>
              )}

              {/* Lease Duration Row */}
              <div className="rf-uc-summary-row">
                <div className="rf-uc-row-left">
                  <Calendar size={15} className="rf-uc-icon" />
                  <span className="rf-uc-label">Duration of Lease</span>
                </div>
                <div className="rf-uc-row-right flex items-center gap-2">
                  <span className="rf-uc-val-primary">
                    {Number(activeLease) === 12
                      ? "1 Year (12 Months)"
                      : `${activeLease} ${Number(activeLease) === 1 ? "Month" : "Months"}`}
                  </span>
                  {!readOnly && !roomSelectionLocked && onUpdateStayPackage && (
                    <button
                      type="button"
                      onClick={() => setIsEditingTerm((prev) => !prev)}
                      className="px-2 py-0.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingTerm ? "Close" : "Edit"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* In-Line Lease Term Selector when editing */}
              {isEditingTerm && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 my-2 space-y-2">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Select New Lease Duration</span>
                    {isUpdatingTerm && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Loader2 className="w-3 h-3 animate-spin" /> Updating...
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {leaseOptions.map((opt) => {
                      const isSelected = String(activeLease) === String(opt.value);
                      const isLongTerm = opt.months >= minMonths;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isUpdatingTerm}
                          onClick={() => handleSelectTerm(opt.value)}
                          className={`p-2 rounded-lg text-xs flex flex-col items-center justify-center transition-all border ${
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 font-bold"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <span>{opt.shortLabel}</span>
                          {isLongTerm && (
                            <span
                              className={`text-[8px] mt-0.5 font-medium ${
                                isSelected ? "text-emerald-300 dark:text-emerald-700" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              Long-Term
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Move-In Requirements Summary Preview */}
              {monthlyRent > 0 && (
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-3.5 border border-slate-200 dark:border-slate-700/80 my-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span>Move-In Balance Preview</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>1 Month Advance Rent:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(monthlyRent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>1 Month Security Deposit:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(monthlyRent)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                      <span>Total Move-In Requirements:</span>
                      <span>{formatCurrency(monthlyRent * 2)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5 leading-relaxed">
                      Paying the {formatCurrency(reservationFeeAmount)} reservation fee below will be credited towards your move-in requirements.
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-xs">
                      <span>Estimated Balance (Due Before Move-In):</span>
                      <span className="text-slate-900 dark:text-slate-100 font-bold">
                        {formatCurrency(Math.max(0, monthlyRent * 2 - reservationFeeAmount))}
                      </span>
                    </div>
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
                    title={
                      !agreedToFeePolicy
                        ? "Please acknowledge the non-refundable fee policy above to proceed"
                        : !paymentAvailable
                        ? "Payment is locked pending application review"
                        : ""
                    }
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

      {onPrev && !readOnly && (
        <div className="flex items-center justify-start pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onPrev}
            className="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Back to Application</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ReservationPaymentStep;


