import React, { useState, useEffect } from "react";
import { UserCheck, X, AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { escalateTenantAssistant } from "../../../api/tenantAssistantApi";

const CATEGORIES = [
  { value: "billing_dispute", label: "Billing & Utility Inquiry" },
  { value: "contract_lease", label: "Contract Renewal & Move-Out" },
  { value: "facility_repair", label: "Urgent Room & Facility Maintenance" },
  { value: "security_curfew", label: "Curfew & Security Concern" },
  { value: "roommate_concern", label: "Roommate & Common Space Concern" },
  { value: "general_inquiry", label: "Other Front Desk Concern" },
];

const PRIORITIES = [
  { value: "normal", label: "Normal Priority" },
  { value: "high", label: "High Priority" },
  { value: "urgent", label: "Urgent (Requires Immediate Attention)" },
];

/**
 * Solid Modal: Allows resident tenants to escalate their conversation directly
 * to branch administrators with category, priority, and summary notes.
 */
export default function TenantHumanEscalateModal({
  isOpen,
  onClose,
  lastBotMessage = "",
  onEscalationSuccess,
}) {
  const [category, setCategory] = useState("billing_dispute");
  const [priority, setPriority] = useState("normal");
  const [summary, setSummary] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSummary("");
      setTouched(false);
      setErrorMsg("");
      setSuccessData(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer;
    if (successData) {
      timer = setTimeout(() => {
        onClose();
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [successData, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isInvalid = touched && !summary.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (!summary.trim()) {
      setErrorMsg("Please provide a brief explanation of your concern.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await escalateTenantAssistant({
        category,
        priority,
        summary: summary.trim(),
        lastBotMessage,
      });

      setSuccessData(res);
      onEscalationSuccess?.(res);
    } catch (err) {
      console.error("Escalation failed:", err);
      setErrorMsg(err?.message || "Failed to submit escalation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalate-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="escalate-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Escalate to Branch Admin
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with our local front desk team for personalized human assistance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        {successData ? (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Escalation Submitted
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm">
              Your message has been sent directly to the Branch Admin team. Staff will connect with you in live chat promptly.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
              >
                View Live Chat
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div
                className="flex items-start gap-2 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-slate-200 dark:border-slate-800 rounded-xl"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="escalate-category"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Concern Category <span className="text-rose-500">*</span>
              </label>
              <select
                id="escalate-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="escalate-priority"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Priority Level
              </label>
              <select
                id="escalate-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-colors"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="escalate-summary"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Summary of Concern <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {summary.length}/1000
                </span>
              </div>
              <textarea
                id="escalate-summary"
                rows={4}
                maxLength={1000}
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                onBlur={() => setTouched(true)}
                placeholder="Explain your concern or question for the admin team..."
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-colors resize-none ${
                  isInvalid
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-slate-300 dark:border-slate-700 focus:ring-slate-900 dark:focus:ring-slate-400"
                }`}
              />
              {isInvalid && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  Summary is required before submitting.
                </p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || (touched && !summary.trim())}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Escalation</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
