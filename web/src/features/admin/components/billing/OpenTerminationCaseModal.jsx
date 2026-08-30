import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  User,
  FileText,
  DollarSign,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { showNotification } from "../../../../shared/utils/notification.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function OpenTerminationCaseModal({
  isOpen,
  branch,
  prefilledCaseData = null,
  initialTenantId = "",
  initialReason = "",
  initialTenantName = "",
  onClose,
  onCreated,
}) {
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [triggerReason, setTriggerReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isPrefilledMode = Boolean(
    prefilledCaseData?.tenantId ||
    prefilledCaseData?.tenantName ||
    initialTenantId ||
    initialTenantName
  );

  const prefilledTenantName = prefilledCaseData?.tenantName || initialTenantName || "Tenant";
  const prefilledRoomName = prefilledCaseData?.roomName || "Room";
  const prefilledBranch = (prefilledCaseData?.branch || branch) === "guadalupe" ? "Guadalupe" : "Gil Puyat";
  const prefilledBillNumber = prefilledCaseData?.billNumber || "";
  const prefilledRemainingAmount = prefilledCaseData?.remainingAmount != null ? Number(prefilledCaseData.remainingAmount) : null;

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      const initialRsn = prefilledCaseData?.triggerReason || initialReason || "";
      const initialTId = prefilledCaseData?.tenantId || initialTenantId || "";
      setTriggerReason(initialRsn);
      setSelectedTenantId(initialTId);

      if (!isPrefilledMode) {
        fetchActiveTenants();
      } else {
        setLoadingTenants(false);
      }
    }
  }, [isOpen, branch, prefilledCaseData, initialTenantId, initialReason, isPrefilledMode]);

  const fetchActiveTenants = async () => {
    try {
      setLoadingTenants(true);
      const res = await billingApi.getActiveTenantsForViolations(branch ? { branch } : {});
      setTenants(res.data || []);
    } catch (err) {
      console.error("[OpenTerminationCaseModal] Failed to load active tenants:", err);
    } finally {
      setLoadingTenants(false);
    }
  };

  if (!isOpen) return null;

  const selectedTenant = tenants.find((t) => String(t.tenantId) === String(selectedTenantId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetTenantId = isPrefilledMode
      ? (prefilledCaseData?.tenantId || initialTenantId)
      : (selectedTenant ? selectedTenant.tenantId : selectedTenantId);

    const targetReservationId = isPrefilledMode
      ? (prefilledCaseData?.reservationId || selectedTenant?.reservationId)
      : (selectedTenant ? selectedTenant.reservationId : undefined);

    const targetBranch = isPrefilledMode
      ? (prefilledCaseData?.branch || branch || "gil-puyat")
      : (selectedTenant?.branch || branch || "gil-puyat");

    if (!targetTenantId) {
      const errText = "Please select an active tenant.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    if (!triggerReason.trim()) {
      const errText = "Please provide a detailed formal reason explaining why this review case is being opened.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    try {
      setSubmitting(true);
      await billingApi.createTerminationCase({
        tenantId: targetTenantId,
        reservationId: targetReservationId,
        branch: targetBranch,
        billId: prefilledCaseData?.billId || undefined,
        totalOutstandingAtOpen: prefilledCaseData?.remainingAmount,
        penaltyAmountAtOpen: prefilledCaseData?.penaltyAmount,
        daysOverdueAtOpen: prefilledCaseData?.daysOverdue,
        triggerReason: triggerReason.trim(),
      });

      const msg = "Termination review case registered successfully.";
      setSuccessMsg(msg);
      showNotification(msg, "success");
      onCreated?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error("[OpenTerminationCaseModal] Create review case error:", err);
      const friendlyErr = err.message || "Unable to open termination review case. Please try again.";
      setError(friendlyErr);
      showNotification(friendlyErr, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-card-foreground">
                Open Termination Review Case
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Refer a severe lease infraction or notice exhaustion to the administrative review board.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
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

          {/* Tenant Identification Section */}
          {isPrefilledMode ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-card-foreground">
                  Target Tenant
                </label>
                <span className="text-[10px] font-bold text-muted-foreground">
                  Auto-populated from notice
                </span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-border text-xs font-bold shadow-xs">
                    {getInitials(prefilledTenantName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-card-foreground truncate">{prefilledTenantName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {prefilledRoomName} · {prefilledBranch}
                    </p>
                  </div>
                </div>

                {(prefilledBillNumber || prefilledRemainingAmount != null) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                    {prefilledBillNumber && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText size={13} className="shrink-0 text-muted-foreground" />
                        <span>Statement #{prefilledBillNumber}</span>
                      </div>
                    )}
                    {prefilledRemainingAmount != null && (
                      <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                        <DollarSign size={13} className="shrink-0" />
                        <span>₱{prefilledRemainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-card-foreground">
                Select Tenant <span className="text-rose-500">*</span>
              </label>
              {loadingTenants ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <LoaderCircle size={16} className="animate-spin inline mb-1" /> Loading active tenants...
                </div>
              ) : (
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  required
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={String(t.tenantId)} value={String(t.tenantId)}>
                      {t.fullName} ({t.roomName || "Room"} · {t.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"})
                    </option>
                  ))}
                </select>
              )}

              {selectedTenant && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 text-xs mt-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-border text-xs font-bold shadow-xs">
                    {getInitials(selectedTenant.fullName)}
                  </div>
                  <div>
                    <p className="font-bold text-card-foreground">{selectedTenant.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Room: <strong>{selectedTenant.roomName}</strong> · Warnings Logged: <strong>{selectedTenant.warningCount || 0}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trigger Reason */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-card-foreground">
                Case Rationale & Incident Details <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] font-medium ${triggerReason.length >= 1900 ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
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
              placeholder="Describe why this tenant is being referred to the review board (minimum 10 characters)..."
              className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-xl border border-border bg-card px-4 text-xs font-bold text-card-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!isPrefilledMode && !selectedTenantId)}
              title={!isPrefilledMode && !selectedTenantId ? "Please select a tenant first" : "Open Review Case"}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0A1628] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white cursor-pointer"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={13} className="animate-spin" /> Submitting...
                </>
              ) : (
                "Open Review Case"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
