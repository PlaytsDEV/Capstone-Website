import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  User,
  ShieldCheck,
  Loader2,
  ArrowUpRight,
  Split,
  Building,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getStatusBadge = (status) => {
  switch (status) {
    case "open":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "under_review":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300";
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "closed":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
};

export default function TerminationReviewModal({ isOpen, reviewCase, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState("adjudication"); // overview, tenant, adjudication
  const [adjudicating, setAdjudicating] = useState(false);
  const [outcome, setOutcome] = useState("payment_plan_approved");
  const [outcomeDetail, setOutcomeDetail] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  
  // Payment Plan fields
  const [numInstallments, setNumInstallments] = useState(3);
  const [planTotal, setPlanTotal] = useState(0);
  const [firstDueDate, setFirstDueDate] = useState("");

  // Pre-Termination Notice fields
  const [vacateDate, setVacateDate] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  React.useEffect(() => {
    if (reviewCase) {
      setPlanTotal(Number(reviewCase.balanceSnapshot || reviewCase.totalOutstandingAtOpen || 0));
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setFirstDueDate(nextMonth.toISOString().slice(0, 10));

      const vacateDefault = new Date();
      vacateDefault.setDate(vacateDefault.getDate() + 14);
      setVacateDate(vacateDefault.toISOString().slice(0, 10));
      setNoticeText("Formal pre-termination notice: Please vacate premises by the specified date or settle all outstanding balances in full.");
      setError("");
      setSuccessMsg("");
    }
  }, [reviewCase]);

  if (!isOpen || !reviewCase) return null;

  const isResolved = reviewCase.status === "resolved" || reviewCase.status === "closed" || Boolean(reviewCase.decision?.outcome);
  const snapshotAmount = Number(reviewCase.balanceSnapshot || reviewCase.totalOutstandingAtOpen || 0);

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!outcomeDetail.trim()) {
      setError("Please provide a detailed formal explanation of the board decision terms.");
      return;
    }

    try {
      setAdjudicating(true);

      const payload = {
        outcome,
        outcomeDetail: outcomeDetail.trim(),
        reviewNotes: reviewNotes.trim(),
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
      } else if (outcome === "pre_termination_notice") {
        payload.preTerminationNotice = {
          vacateByDate: vacateDate ? new Date(vacateDate) : null,
          noticeText: noticeText.trim(),
          deliveredVia: "both",
        };
      }

      await billingApi.updateTerminationDecision(reviewCase._id, payload);

      setSuccessMsg("Board decision adjudicated and recorded successfully.");
      onRefresh?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Adjudication error:", err);
      setError(err.message || "Failed to record board decision.");
    } finally {
      setAdjudicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-card-foreground">
                  Termination Review Case #{reviewCase.caseNumber || String(reviewCase._id).slice(-6).toUpperCase()}
                </h2>
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(reviewCase.status)}`}>
                  {reviewCase.status?.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Trigger: <strong>{reviewCase.reason || "Notice 3 Exhaustion"}</strong> · {reviewCase.branch || "Branch"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/30 px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("adjudication")}
            className={`border-b-2 px-3 py-2.5 transition ${
              activeTab === "adjudication"
                ? "border-slate-900 text-slate-950 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-muted-foreground hover:text-card-foreground"
            }`}
          >
            Board Decision & Action
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-3 py-2.5 transition ${
              activeTab === "overview"
                ? "border-slate-900 text-slate-950 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-muted-foreground hover:text-card-foreground"
            }`}
          >
            Case Portfolio & Debt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tenant")}
            className={`border-b-2 px-3 py-2.5 transition ${
              activeTab === "tenant"
                ? "border-slate-900 text-slate-950 dark:border-slate-100 dark:text-slate-100"
                : "border-transparent text-muted-foreground hover:text-card-foreground"
            }`}
          >
            Tenant Engagement
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tenant & Financial Snapshot Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                {getInitials(reviewCase.tenantName)}
              </div>
              <div>
                <p className="text-xs font-bold text-card-foreground">{reviewCase.tenantName || "Tenant"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Room: {reviewCase.reservationId?.roomNumber || "Assigned Room"} · {reviewCase.branch}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Frozen Debt Snapshot</span>
              <span className="text-sm font-bold text-red-600">
                ₱{snapshotAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* TAB 1: Adjudication Form */}
          {activeTab === "adjudication" && (
            <div>
              {isResolved ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-card-foreground flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      Board Ruling: {reviewCase.decision?.outcome?.replace(/_/g, " ").toUpperCase() || reviewCase.outcome}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Decided: {reviewCase.decision?.decidedAt ? new Date(reviewCase.decision.decidedAt).toLocaleDateString("en-PH") : "Recorded"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    <strong className="text-card-foreground">Terms & Rationale:</strong> {reviewCase.decision?.outcomeDetail || "Case resolved."}
                  </p>
                  {reviewCase.paymentPlan && (
                    <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-1 text-[11px]">
                      <span className="font-bold text-card-foreground block">Payment Plan Schedule:</span>
                      <p className="text-muted-foreground">
                        {reviewCase.paymentPlan.numberOfInstallments} Installment(s) of ₱{Number(reviewCase.paymentPlan.installmentAmount || 0).toFixed(2)} starting {reviewCase.paymentPlan.firstPaymentDue ? new Date(reviewCase.paymentPlan.firstPaymentDue).toLocaleDateString("en-PH") : "TBD"}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleDecisionSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-card-foreground">
                      Board Decision Outcome <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    >
                      <option value="payment_plan_approved">Approve Structured Payment Plan</option>
                      <option value="deadline_extension">Grant Conditional Deadline Extension</option>
                      <option value="pre_termination_notice">Issue Formal Pre-Termination Notice (Vacate Demand)</option>
                      <option value="termination_approved">Approve Lease Termination & Move-Out Clearance</option>
                      <option value="case_dismissed">Dismiss Case Without Adverse Action</option>
                    </select>
                  </div>

                  {/* Payment Plan Sub-Form */}
                  {outcome === "payment_plan_approved" && (
                    <div className="rounded-xl border border-border bg-muted/10 p-3.5 space-y-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-card-foreground">
                        <Split size={14} className="text-blue-600" /> Payment Arrangement Terms
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                            Total Plan Amount (₱)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            step="0.01"
                            value={planTotal}
                            onChange={(e) => setPlanTotal(e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-bold text-card-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                            # Installments (1 - 24)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={numInstallments}
                            onChange={(e) => setNumInstallments(e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-bold text-card-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                            First Payment Due
                          </label>
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={firstDueDate}
                            onChange={(e) => setFirstDueDate(e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-card-foreground"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Estimated monthly installment: <strong className="text-card-foreground font-bold">₱{(Number(planTotal || 0) / (Number(numInstallments) || 1)).toFixed(2)}</strong> / month.
                      </p>
                    </div>
                  )}

                  {/* Pre-Termination Sub-Form */}
                  {outcome === "pre_termination_notice" && (
                    <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 space-y-3 text-xs dark:border-red-900/40 dark:bg-red-950/20">
                      <div className="flex items-center gap-1.5 font-bold text-red-900 dark:text-red-300">
                        <AlertTriangle size={14} /> Formal Pre-Termination Notice Details
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-card-foreground mb-1">
                          Mandatory Vacate-By Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={vacateDate}
                          onChange={(e) => setVacateDate(e.target.value)}
                          className="w-full h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-card-foreground"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-card-foreground">
                            Pre-Termination Letter Text
                          </label>
                          <span className={`text-[10px] font-medium ${noticeText.length >= 1900 ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                            {noticeText.length} / 2,000 characters
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={2000}
                          value={noticeText}
                          onChange={(e) => setNoticeText(e.target.value)}
                          className="w-full rounded-lg border border-border bg-card p-2 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-card-foreground">
                        Decision Terms & Legal Rationale <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-[10px] font-medium ${outcomeDetail.length >= 2800 ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                        {outcomeDetail.length} / 3,000 characters
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      minLength={10}
                      maxLength={3000}
                      value={outcomeDetail}
                      onChange={(e) => setOutcomeDetail(e.target.value)}
                      placeholder="Explain the specific terms, conditions, and reasons decided by the review board (minimum 10 characters)..."
                      className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-card-foreground">
                        Internal Board Discussion Notes (Confidential)
                      </label>
                      <span className={`text-[10px] font-medium ${reviewNotes.length >= 4800 ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                        {reviewNotes.length} / 5,000 characters
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Record internal board comments, officer votes, or administrative notes..."
                      className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
                    />
                  </div>


                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="submit"
                      disabled={adjudicating}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                    >
                      {adjudicating ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Recording Decision...
                        </>
                      ) : (
                        "Save & Action Decision"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Case Portfolio & Debt */}
          {activeTab === "overview" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-3 space-y-1 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Trigger Source</span>
                  <p className="font-bold text-card-foreground capitalize">{reviewCase.triggerType?.replace(/_/g, " ") || "Notice Exhaustion"}</p>
                  <p className="text-[11px] text-muted-foreground">{reviewCase.triggerReason || "All 3 overdue notices exhausted with no settlement."}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 space-y-1 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Case Opened</span>
                  <p className="font-bold text-card-foreground">
                    {reviewCase.openedAt ? new Date(reviewCase.openedAt).toLocaleDateString("en-PH") : "Recorded"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Opened by {reviewCase.openedBy ? `${reviewCase.openedBy.firstName || ""} ${reviewCase.openedBy.lastName || ""}`.trim() : "System Escalation"}
                  </p>
                </div>
              </div>

              {reviewCase.triggeredByViolationId && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-[11px] space-y-1 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">Linked House Rule Infraction:</span>
                  <p className="text-muted-foreground">
                    Violation Type: <strong>{reviewCase.triggeredByViolationId.violationType}</strong> · Assessed Penalty: ₱{Number(reviewCase.triggeredByViolationId.penaltyApplied || 0).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Tenant Engagement */}
          {activeTab === "tenant" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-card-foreground">Tenant Explanation & Response</span>
                  <span className="text-[11px] text-muted-foreground">
                    {reviewCase.tenantRespondedAt ? new Date(reviewCase.tenantRespondedAt).toLocaleDateString("en-PH") : "No formal response recorded"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/20 p-3 rounded-lg border border-border">
                  "{reviewCase.tenantResponse || "No written explanation submitted by tenant."}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-xl border border-border bg-card px-4 text-xs font-bold text-card-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
