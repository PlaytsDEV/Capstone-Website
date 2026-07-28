import { useState, useEffect } from "react";
import BaseModal from "./BaseModal";
import { reservationApi } from "../api/apiClient";
import { AlertCircle, CheckCircle, Clock, ShieldAlert, DollarSign, FileText } from "lucide-react";
import dayjs from "dayjs";
import { resolveSecurityDeposit } from "../utils/depositUtils";

/**
 * ============================================================================
 * DEPOSIT REFUND & RECONCILIATION MODAL (Scenario 3)
 * ============================================================================
 * Admin interface for inspecting offboarding financial settlements, verifying 30-day SLA refund deadlines,
 * and transitioning deposit refund statuses (pending -> approved -> processed / forfeited).
 */
export default function DepositRefundModal({
  isOpen,
  onClose,
  reservation,
  onSuccess,
}) {
  const [status, setStatus] = useState("processed");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (reservation) {
      setStatus(reservation.depositRefundStatus || "processed");
      setReference(reservation.depositRefundReference || "");
      setNotes("");
      setError(null);
    }
  }, [reservation]);

  if (!reservation) return null;

  const isForfeited = reservation.depositForfeited || reservation.depositRefundStatus === "forfeited";
  const securityDeposit = resolveSecurityDeposit(reservation);
  const refundAmount = Number(reservation.depositRefundAmount ?? (isForfeited ? 0 : securityDeposit));
  const deadline = reservation.depositRefundDeadline ? dayjs(reservation.depositRefundDeadline) : null;
  const isOverdue = deadline && deadline.isBefore(dayjs()) && reservation.depositRefundStatus !== "processed";

  const handleProcessRefund = async () => {
    setLoading(true);
    setError(null);
    try {
      await reservationApi.processDepositRefund(reservation._id, {
        status,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to process deposit refund status transition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Deposit Reconciliation & Settlement"
      subtitle={`Tenant: ${reservation.tenantName || reservation.userId?.name || "Resident"}`}
      variant={isForfeited ? "warning" : "primary"}
      size="md"
      loading={loading}
      confirmText="Update Payout Status"
      onConfirm={handleProcessRefund}
    >
      <div className="space-y-4 text-sm">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Deposit Summary Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700 dark:text-slate-300">Security Deposit</span>
            <span className="font-semibold text-base text-slate-900 dark:text-white">
              ₱{securityDeposit.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800 pt-2">
            <span className="text-slate-500">Settlement Type</span>
            <span className={`px-2 py-0.5 rounded-md font-medium ${
              isForfeited
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}>
              {isForfeited ? "Deposit Forfeited" : "Refund Calculated"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Net Refund Payable</span>
            <span className="font-bold text-slate-900 dark:text-emerald-400">
              ₱{refundAmount.toLocaleString()}
            </span>
          </div>

          {deadline && (
            <div className={`flex items-center justify-between text-xs p-2 rounded-lg border ${
              isOverdue
                ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
            }`}>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 30-Day SLA Deadline
              </span>
              <span className="font-semibold">{deadline.format("MMM DD, YYYY")} {isOverdue && "(OVERDUE)"}</span>
            </div>
          )}
        </div>

        {/* Payout Action Controls */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Target Refund Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="approved">Approved (Queued for Payout)</option>
              <option value="processed">Processed (Paid Out)</option>
              <option value="forfeited">Forfeited (Contract Breach)</option>
            </select>
          </div>

          {status === "processed" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Payout Reference Number / GCash Ref
              </label>
              <input
                type="text"
                placeholder="e.g. GCASH-REF-987654321"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Audit Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Deposit net refund released via bank transfer after final utility deduction."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
