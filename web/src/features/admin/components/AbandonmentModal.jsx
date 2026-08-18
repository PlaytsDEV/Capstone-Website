import { useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { reservationApi } from "../../../shared/api/reservationApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function AbandonmentModal({ open, reservation, onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("Unannounced departure / tenant disappeared without notice");

  if (!open || !reservation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await reservationApi.triggerAbandonment(reservation._id, { reason });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to execute abandonment protocol.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(reason.trim() && !loading);

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3 className="text-base font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>Trigger Abandonment Protocol</span>
          </h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error mb-4" role="alert">{error}</div>}

          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-rose-50/60 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-xs mb-4">
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong>Warning:</strong> Triggering the abandonment protocol will mark this tenant as <em>abandoned</em>, forfeit their security deposit, and immediately release room inventory.
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Tenant: <strong className="text-slate-900 dark:text-slate-100">{reservation.userName || reservation.userId?.firstName || reservation.tenantName}</strong> | Room: <strong className="text-slate-900 dark:text-slate-100">{reservation.roomNumber || reservation.roomId?.name || "N/A"}</strong>
          </p>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Abandonment Reason / Administrative Notes *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="tenant-workspace-modal__actions mt-6 flex justify-end gap-2.5">
            <button type="button" className="btn btn-secondary cursor-pointer" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              title={
                !reason.trim()
                  ? "Please provide an abandonment reason"
                  : loading
                  ? "Processing abandonment protocol..."
                  : "Confirm abandonment and forfeit deposit"
              }
              className="btn btn-danger cursor-pointer bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              {loading ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm Abandonment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
