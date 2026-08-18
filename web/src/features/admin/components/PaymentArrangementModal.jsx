import { useState } from "react";
import { Info, LoaderCircle } from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function PaymentArrangementModal({ open, bill, onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [milestone1Amount, setMilestone1Amount] = useState("");
  const [milestone1Date, setMilestone1Date] = useState("");
  const [milestone2Amount, setMilestone2Amount] = useState("");
  const [milestone2Date, setMilestone2Date] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !bill) return null;

  const totalBillAmount = Number(bill.totalAmount || bill.grossAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const m1 = Number(milestone1Amount || 0);
    const m2 = Number(milestone2Amount || 0);
    const sum = m1 + m2;

    if (Math.abs(sum - totalBillAmount) > 0.01) {
      setError(`Sum of milestone payments (₱${sum.toFixed(2)}) must exactly equal master bill total (₱${totalBillAmount.toFixed(2)}).`);
      return;
    }

    if (!milestone1Date || !milestone2Date) {
      setError("Please specify due dates for both milestone sub-invoices.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await billingApi.createMilestoneArrangement(bill._id, [
        { amount: m1, dueDate: milestone1Date },
        { amount: m2, dueDate: milestone2Date }
      ]);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create payment arrangement.");
    } finally {
      setLoading(false);
    }
  };

  const isFormFilled = Boolean(milestone1Amount && milestone1Date && milestone2Amount && milestone2Date);

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create Payment Arrangement (Milestone Invoices)</h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error mb-4" role="alert">{error}</div>}

          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-sky-50/60 dark:bg-sky-950/20 text-sky-800 dark:text-sky-300 text-xs mb-4">
            <Info size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              Master Invoice Total: <strong>PHP {totalBillAmount.toLocaleString()}</strong>.
              Voiding this bill will generate 2 exact-amount milestone sub-invoices.
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Milestone 1 Amount (PHP) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2500"
                value={milestone1Amount}
                onChange={(e) => setMilestone1Amount(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              />
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-1">
                Milestone 1 Due Date *
              </label>
              <input
                type="date"
                value={milestone1Date}
                onChange={(e) => setMilestone1Date(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Milestone 2 Amount (PHP) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2500"
                value={milestone2Amount}
                onChange={(e) => setMilestone2Amount(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              />
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-1">
                Milestone 2 Due Date *
              </label>
              <input
                type="date"
                value={milestone2Date}
                onChange={(e) => setMilestone2Date(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              />
            </div>
          </div>

          <div className="tenant-workspace-modal__actions mt-6 flex justify-end gap-2.5">
            <button type="button" className="btn btn-secondary cursor-pointer" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormFilled}
              title={
                !isFormFilled
                  ? "Please fill in amounts and due dates for both milestones"
                  : loading
                  ? "Creating milestone invoices..."
                  : "Issue milestone invoices"
              }
              className="btn btn-primary cursor-pointer bg-[#0A1628] hover:bg-[#13243D] text-white flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Issue Milestone Invoices</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
