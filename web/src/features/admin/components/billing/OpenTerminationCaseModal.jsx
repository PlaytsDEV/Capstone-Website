import React, { useState, useEffect } from "react";
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  Search,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function OpenTerminationCaseModal({ isOpen, branch, onClose, onCreated }) {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [triggerReason, setTriggerReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      setTriggerReason("");
      setSelectedTenantId("");
      fetchActiveTenants();
    }
  }, [isOpen, branch]);

  const fetchActiveTenants = async () => {
    try {
      setLoadingTenants(true);
      const res = await billingApi.getActiveTenantsForViolations(branch ? { branch } : {});
      setTenants(res.data || []);
    } catch (err) {
      console.error("Failed to load active tenants:", err);
    } finally {
      setLoadingTenants(false);
    }
  };

  if (!isOpen) return null;

  const filteredTenants = tenants.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.fullName && t.fullName.toLowerCase().includes(q)) ||
      (t.roomName && t.roomName.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  const selectedTenant = tenants.find((t) => String(t.tenantId) === String(selectedTenantId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!selectedTenantId) {
      setError("Please select an active resident.");
      return;
    }

    if (!triggerReason.trim()) {
      setError("Please provide a detailed formal reason explaining why this review case is being opened.");
      return;
    }

    try {
      setSubmitting(true);
      await billingApi.createTerminationCase({
        tenantId: selectedTenant.tenantId,
        reservationId: selectedTenant.reservationId,
        branch: selectedTenant.branch || branch || "gil-puyat",
        triggerReason: triggerReason.trim(),
      });

      setSuccessMsg("Termination review case registered successfully.");
      onCreated?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Create review case error:", err);
      setError(err.message || "Failed to open termination review case.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-card-foreground">
                Open Termination Review Case
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Refer a serious lease breach or notice exhaustion to the administrative review board.
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

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Select Resident */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-card-foreground">
              Select Resident <span className="text-red-500">*</span>
            </label>
            {loadingTenants ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                <Loader2 size={16} className="animate-spin inline mb-1" /> Loading active residents...
              </div>
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                required
                className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              >
                <option value="">-- Choose Resident --</option>
                {tenants.map((t) => (
                  <option key={String(t.tenantId)} value={String(t.tenantId)}>
                    {t.fullName} ({t.roomName || "Room"} · {t.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedTenant && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 text-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold dark:bg-slate-800 dark:text-slate-100">
                {getInitials(selectedTenant.fullName)}
              </div>
              <div>
                <p className="font-bold text-card-foreground">{selectedTenant.fullName}</p>
                <p className="text-[11px] text-muted-foreground">
                  Room: <strong>{selectedTenant.roomName}</strong> · Warning Count: <strong>{selectedTenant.warningCount || 0}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Trigger Reason */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-card-foreground">
                Case Rationale & Incident Details <span className="text-red-500">*</span>
              </label>
              <span className={`text-[10px] font-medium ${triggerReason.length >= 1900 ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                {triggerReason.length} / 2,000 characters
              </span>
            </div>
            <textarea
              rows={4}
              required
              minLength={10}
              maxLength={2000}
              value={triggerReason}
              onChange={(e) => setTriggerReason(e.target.value)}
              placeholder="Describe why this resident is being referred to the review board (minimum 10 characters)..."
              className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
            />
          </div>


          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-xl border border-border bg-card px-4 text-xs font-bold text-card-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedTenantId}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Submitting...
                </>
              ) : (
                "Open Review Case"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
