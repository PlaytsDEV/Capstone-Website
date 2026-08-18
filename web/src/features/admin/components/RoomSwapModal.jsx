import { useState } from "react";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import { reservationApi } from "../../../shared/api/reservationApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function RoomSwapModal({ open, activeTenants = [], onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [tenantAId, setTenantAId] = useState("");
  const [tenantBId, setTenantBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantAId || !tenantBId) {
      setError("Please select two distinct tenants to perform a room swap.");
      return;
    }
    if (tenantAId === tenantBId) {
      setError("Tenant A and Tenant B must be different individuals.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await reservationApi.swapRooms(tenantAId, tenantBId);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to execute direct room swap.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(tenantAId && tenantBId && tenantAId !== tenantBId && !loading);

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-[#D4AF37]" />
            <span>Direct Tenant Room Swap</span>
          </h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error mb-4" role="alert">{error}</div>}

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Select two active tenants to simultaneously swap their room assignments, beds, and ledger rates atomically.
          </p>

          <div className="flex flex-col gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Tenant (Tenant A) *
              </label>
              <select
                value={tenantAId}
                onChange={(e) => setTenantAId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              >
                <option value="">-- Select Tenant A --</option>
                {activeTenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.userName} - Room {t.roomNumber || t.roomName || "N/A"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Second Tenant (Tenant B) *
              </label>
              <select
                value={tenantBId}
                onChange={(e) => setTenantBId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0A1628] dark:focus:border-slate-500"
              >
                <option value="">-- Select Tenant B --</option>
                {activeTenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.userName} - Room {t.roomNumber || t.roomName || "N/A"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tenant-workspace-modal__actions mt-6 flex justify-end gap-2.5">
            <button type="button" className="btn btn-secondary cursor-pointer" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              title={
                !tenantAId || !tenantBId
                  ? "Please select both tenants to swap"
                  : tenantAId === tenantBId
                  ? "Tenant A and Tenant B must be different"
                  : loading
                  ? "Executing room swap..."
                  : "Execute room swap"
              }
              className="btn btn-primary cursor-pointer bg-[#0A1628] hover:bg-[#13243D] text-white flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Swapping...</span>
                </>
              ) : (
                <span>Execute Room Swap</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
