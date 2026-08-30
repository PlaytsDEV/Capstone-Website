import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  LoaderCircle,
  Split,
  Calendar,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { showNotification } from "../../../../shared/utils/notification.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getStatusBadgeInfo = (status) => {
  switch (status) {
    case "open":
      return { textColor: "text-amber-700 dark:text-amber-400", dotColor: "bg-amber-500" };
    case "under_review":
      return { textColor: "text-sky-700 dark:text-sky-400", dotColor: "bg-sky-500" };
    case "resolved":
    case "closed":
      return { textColor: "text-emerald-700 dark:text-emerald-400", dotColor: "bg-emerald-500" };
    default:
      return { textColor: "text-slate-700 dark:text-slate-300", dotColor: "bg-slate-400" };
  }
};

export default function TerminationReviewModal({ isOpen, reviewCase, onClose, onRefresh }) {
  const [adjudicating, setAdjudicating] = useState(false);
  const [outcome, setOutcome] = useState("payment_plan_approved");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Payment Plan fields
  const [numInstallments, setNumInstallments] = useState(3);
  const [planTotal, setPlanTotal] = useState(0);
  const [firstDueDate, setFirstDueDate] = useState("");

  // Termination fields
  const [vacateDate, setVacateDate] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (reviewCase) {
      const debt = Number(reviewCase.balanceSnapshot || reviewCase.totalOutstandingAtOpen || 0);
      setPlanTotal(debt);

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setFirstDueDate(nextMonth.toISOString().slice(0, 10));

      const vacateDefault = new Date();
      vacateDefault.setDate(vacateDefault.getDate() + 14);
      setVacateDate(vacateDefault.toISOString().slice(0, 10));

      setResolutionNotes("");
      setError("");
      setSuccessMsg("");
    }
  }, [reviewCase]);

  if (!isOpen || !reviewCase || typeof document === "undefined") return null;

  const isResolved =
    reviewCase.status === "resolved" ||
    reviewCase.status === "closed" ||
    Boolean(reviewCase.decision?.outcome);

  const snapshotAmount = Number(reviewCase.balanceSnapshot || reviewCase.totalOutstandingAtOpen || 0);
  const badgeInfo = getStatusBadgeInfo(reviewCase.status);
  const caseNum = reviewCase.caseNumber || String(reviewCase._id).slice(-6).toUpperCase();

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    let noteText = resolutionNotes.trim();
    if (!noteText) {
      if (outcome === "payment_plan_approved") {
        noteText = `Approved structured payment arrangement of ${numInstallments} monthly installment(s).`;
      } else if (outcome === "termination_approved") {
        noteText = `Lease termination and move-out clearance approved effective ${vacateDate || "notice date"}.`;
      } else if (outcome === "case_dismissed") {
        noteText = "Account settled and fully reconciled. Case resolved and closed.";
      } else {
        noteText = "Administrative review decision recorded.";
      }
    } else if (noteText.length < 10) {
      setError("Resolution notes must be at least 10 characters long.");
      return;
    }

    try {
      setAdjudicating(true);

      const payload = {
        outcome,
        outcomeDetail: noteText,
        reviewNotes: noteText,
      };

      if (outcome === "payment_plan_approved") {
        const installments = Number(numInstallments) || 1;
        const total = Number(planTotal) || snapshotAmount;
        payload.paymentPlan = {
          totalAmount: total,
          numberOfInstallments: installments,
          installmentAmount: total / installments,
          firstPaymentDue: firstDueDate || new Date(),
        };
      } else if (outcome === "termination_approved" || outcome === "pre_termination_notice") {
        payload.preTerminationNotice = {
          vacateByDate: vacateDate ? new Date(vacateDate) : null,
          noticeText: noteText,
          deliveredVia: "both",
        };
      }

      await billingApi.updateTerminationDecision(reviewCase._id, payload);

      const msg = "Review decision recorded successfully.";
      setSuccessMsg(msg);
      showNotification(msg, "success");
      onRefresh?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Adjudication error:", err);
      const friendlyErr = err.message || "Unable to record review decision. Please try again.";
      setError(friendlyErr);
      showNotification(friendlyErr, "error");
    } finally {
      setAdjudicating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-card-foreground">
                  Termination Review Case #{caseNum}
                </h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badgeInfo.textColor}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${badgeInfo.dotColor}`} />
                  {reviewCase.status?.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Trigger: <strong>{reviewCase.reason || reviewCase.triggerReason || "Overdue Balance Escalation"}</strong> · {reviewCase.branch || "Branch"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-card-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tenant & Overdue Snapshot Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-[#0A1628]/20 dark:border-[#D4AF37]/40 text-xs font-bold shadow-xs">
                {getInitials(reviewCase.tenantName)}
              </div>
              <div>
                <p className="text-xs font-bold text-card-foreground">{reviewCase.tenantName || "Tenant"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Room: <strong className="text-card-foreground font-semibold">{reviewCase.reservationId?.roomNumber || "Assigned Room"}</strong> · {reviewCase.branch}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Overdue Amount</span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                ₱{snapshotAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Ruling / Decision Section */}
          {isResolved ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-card-foreground flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Decision: {reviewCase.decision?.outcome?.replace(/_/g, " ").toUpperCase() || reviewCase.outcome || "RESOLVED"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Decided on {reviewCase.decision?.decidedAt ? new Date(reviewCase.decision.decidedAt).toLocaleDateString("en-PH") : "Recorded"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                <strong className="text-card-foreground">Terms & Basis:</strong> {reviewCase.decision?.outcomeDetail || "Case closed."}
              </p>
              {reviewCase.paymentPlan && (
                <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-[11px]">
                  <span className="font-bold text-card-foreground block">Payment Plan Schedule:</span>
                  <p className="text-muted-foreground">
                    {reviewCase.paymentPlan.numberOfInstallments} Installment(s) of ₱{Number(reviewCase.paymentPlan.installmentAmount || 0).toFixed(2)} starting {reviewCase.paymentPlan.firstPaymentDue ? new Date(reviewCase.paymentPlan.firstPaymentDue).toLocaleDateString("en-PH") : "TBD"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form id="terminationDecisionForm" onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-card-foreground mb-1.5">
                  Board Decision Outcome <span className="text-rose-500">*</span>
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer"
                >
                  <option value="payment_plan_approved">1. Grant Payment Plan / Extension</option>
                  <option value="termination_approved">2. Approve Lease Termination / Move-Out</option>
                  <option value="case_dismissed">3. Resolve & Close (Debt Settled)</option>
                </select>
              </div>

              {/* Payment Plan Sub-Form */}
              {outcome === "payment_plan_approved" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-card-foreground">
                    <Split size={14} className="text-sky-600" />
                    <span>Payment Arrangement Terms</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
                        Total Amount (₱)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000000}
                        step="0.01"
                        value={planTotal}
                        onChange={(e) => setPlanTotal(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
                        # Installments
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={numInstallments}
                        onChange={(e) => setNumInstallments(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
                        First Due Date
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Estimated monthly installment:</span>
                    <span className="text-card-foreground">
                      <strong className="text-sm font-bold">₱{(Number(planTotal || 0) / (Number(numInstallments) || 1)).toFixed(2)}</strong> / month
                    </span>
                  </div>
                </div>
              )}

              {/* Termination Sub-Form */}
              {outcome === "termination_approved" && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                    <Calendar size={14} />
                    <span>Lease Termination & Deposit Forfeiture Terms</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-card-foreground mb-1.5">
                      Vacate-By Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={vacateDate}
                      onChange={(e) => setVacateDate(e.target.value)}
                      className="w-full sm:w-1/2 h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-[11px] space-y-1 text-muted-foreground">
                    <div className="font-bold text-card-foreground flex items-center gap-1.5">
                      <ShieldAlert size={13} className="text-rose-600 dark:text-rose-400" />
                      <span>Security Deposit Forfeiture Applied</span>
                    </div>
                    <p className="leading-relaxed">
                      As per dormitory policy, approving lease termination due to non-payment or breach will forfeit 100% of the security deposit (₱0.00 cash refund) and apply it directly toward their outstanding balance upon execution.
                    </p>
                  </div>
                </div>
              )}

              {/* Single Resolution Notes Field */}
              <div>
                <label className="block text-xs font-bold text-card-foreground mb-1.5">
                  Resolution Notes & Administrative Remarks
                </label>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record decision details, payment arrangement terms, or settlement notes..."
                  className="w-full rounded-lg border border-border bg-card p-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none leading-relaxed"
                />
              </div>
            </form>
          )}
        </div>

        {/* Unified Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted active:scale-[0.98] transition cursor-pointer"
          >
            {isResolved ? "Close" : "Cancel"}
          </button>
          {!isResolved && (
            <button
              type="submit"
              form="terminationDecisionForm"
              disabled={adjudicating}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A1628] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 cursor-pointer dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {adjudicating ? (
                <>
                  <LoaderCircle size={13} className="animate-spin" /> Recording...
                </>
              ) : (
                "Save Decision"
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
