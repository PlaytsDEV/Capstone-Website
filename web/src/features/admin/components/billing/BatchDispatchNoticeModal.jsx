import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MailWarning,
  DollarSign,
  Users,
  Search,
  CheckSquare,
  Square,
  FileText,
  Clock,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";
import { showNotification } from "../../../../shared/utils/notification.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const DEFAULT_STAGE_NOTES = {
  1: "Please settle your outstanding balance at your earliest convenience to maintain an account in good standing.",
  2: "Your rent payment is significantly overdue and penalty fees are continuing to accrue. Please settle your balance immediately to avoid further escalation.",
  3: "FINAL DEMAND: Immediate settlement is required to prevent formal administrative lease termination review.",
};

const STAGE_BADGE_INFO = {
  1: { label: "Stage 1: Friendly Reminder", dotClass: "bg-sky-500", textClass: "text-sky-700 dark:text-sky-400", sub: "Review overdue accounts, verify email coverage, and dispatch first payment reminders in bulk." },
  2: { label: "Stage 2: Urgent Demand Notice", dotClass: "bg-amber-500", textClass: "text-amber-700 dark:text-amber-400", sub: "Review accounts with active Notice 1, verify balance details, and dispatch 2nd urgent notices." },
  3: { label: "Stage 3: Final Demand Notice", dotClass: "bg-rose-500", textClass: "text-rose-700 dark:text-rose-400", sub: "Review severely overdue accounts and dispatch final demand notices prior to termination review." },
};

export default function BatchDispatchNoticeModal({
  isOpen,
  eligibleNotices = [],
  preselectedBillIds = [],
  targetStage = 1,
  onClose,
  onDispatched,
}) {
  const stage = Number(targetStage) || 1;
  const badgeInfo = STAGE_BADGE_INFO[stage] || STAGE_BADGE_INFO[1];

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [noticeMessage, setNoticeMessage] = useState(DEFAULT_STAGE_NOTES[stage] || DEFAULT_STAGE_NOTES[1]);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      setSearchQuery("");
      setNoticeMessage(DEFAULT_STAGE_NOTES[stage] || DEFAULT_STAGE_NOTES[1]);

      const preselected = Array.isArray(preselectedBillIds)
        ? preselectedBillIds
        : preselectedBillIds instanceof Set
        ? Array.from(preselectedBillIds)
        : [];

      if (preselected.length > 0) {
        setSelectedIds(new Set(preselected));
      } else {
        setSelectedIds(new Set(eligibleNotices.map((n) => n.billId || n._id)));
      }
    }
  }, [isOpen, eligibleNotices, preselectedBillIds, stage]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return eligibleNotices;
    const q = searchQuery.toLowerCase();
    return eligibleNotices.filter((n) => {
      const name = String(n.tenantName || "").toLowerCase();
      const room = String(n.roomName || n.roomId || "").toLowerCase();
      const bill = String(n.billNumber || n.billId || "").toLowerCase();
      const email = String(n.tenantEmail || "").toLowerCase();
      return name.includes(q) || room.includes(q) || bill.includes(q) || email.includes(q);
    });
  }, [eligibleNotices, searchQuery]);

  const selectedAccounts = useMemo(() => {
    return eligibleNotices.filter((n) => selectedIds.has(n.billId || n._id));
  }, [eligibleNotices, selectedIds]);

  const totalExposure = useMemo(() => {
    return selectedAccounts.reduce((sum, n) => sum + Number(n.remainingAmount || n.frozenAmount || 0), 0);
  }, [selectedAccounts]);

  const accountsWithEmail = useMemo(() => {
    return selectedAccounts.filter((n) => Boolean(n.tenantEmail && n.tenantEmail.trim()));
  }, [selectedAccounts]);

  const accountsWithoutEmail = useMemo(() => {
    return selectedAccounts.filter((n) => !n.tenantEmail || !n.tenantEmail.trim());
  }, [selectedAccounts]);

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map((n) => n.billId || n._id)));
    }
  };

  const handleToggleItem = (billId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });
  };

  const handleDispatchBatch = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const targetBillIds = Array.from(selectedIds);
    if (targetBillIds.length === 0) {
      const errText = "Please select at least one overdue account to dispatch reminders.";
      setError(errText);
      showNotification(errText, "warning");
      return;
    }

    try {
      setDispatching(true);
      const res = await billingApi.batchSendOverdueNotices({
        billIds: targetBillIds,
        noticeNumber: stage,
        noticeMessage: noticeMessage.trim(),
      });

      const count = Number(res?.data?.successCount ?? 0);
      const failCount = Number(res?.data?.failureCount ?? 0);

      if (count === 0 && failCount > 0) {
        const firstErr = res?.data?.errors?.[0]?.error || "Failed to dispatch notices.";
        setError(firstErr);
        showNotification(firstErr, "error");
        return;
      }

      let msg = `Successfully dispatched Notice ${stage} to ${count} tenant account(s).`;
      if (failCount > 0) {
        msg += ` (${failCount} failed)`;
      }

      setSuccessMsg(msg);
      showNotification(msg, failCount > 0 ? "warning" : "success");
      onDispatched?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Batch notice dispatch error:", err);
      const friendlyErr = err.message || "Failed to batch dispatch notices. Please try again.";
      setError(friendlyErr);
      showNotification(friendlyErr, "error");
    } finally {
      setDispatching(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-amber-600 dark:text-amber-400">
              <Send size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-card-foreground">
                  Batch Dispatch {stage === 3 ? "Final Demand Notices" : stage === 2 ? "Urgent Demand Notices" : "Payment Reminders"}
                </h2>
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border border-border bg-muted/40 ${badgeInfo.textClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${badgeInfo.dotClass}`} />
                  {badgeInfo.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {badgeInfo.sub}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleDispatchBatch} className="max-h-[78vh] overflow-y-auto p-6 space-y-4">
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

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-0.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold">Selected Accounts</span>
                <Users size={14} />
              </div>
              <p className="text-base font-bold text-card-foreground">
                {selectedAccounts.length} <span className="text-xs font-normal text-muted-foreground">of {eligibleNotices.length}</span>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-0.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold">Total Overdue Exposure</span>
                <DollarSign size={14} />
              </div>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                ₱{totalExposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-0.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold">Email Delivery Coverage</span>
                <Mail size={14} />
              </div>
              <p className="text-base font-bold text-card-foreground">
                {accountsWithEmail.length} <span className="text-xs font-normal text-muted-foreground">with Email</span>
              </p>
            </div>
          </div>

          {/* Missing Email Notice Warning Banner */}
          {accountsWithoutEmail.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-xs text-amber-700 dark:text-amber-400">
              <MailWarning size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">Email Address Notice</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {accountsWithoutEmail.length} selected tenant account(s) do not have an email address on file. They will receive the reminder via in-app dashboard notifications only.
                </p>
              </div>
            </div>
          )}

          {/* Accounts Multi-Select Section */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-card-foreground">
                  Select Target Accounts ({selectedAccounts.length} selected)
                </label>
              </div>

              {/* In-Modal Search Input */}
              <div className="relative flex items-center w-full sm:w-56">
                <Search size={13} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter accounts..."
                  className="w-full h-7 rounded-lg border border-border bg-card pl-7 pr-6 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-muted-foreground hover:text-card-foreground cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Accounts Table */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 hover:text-card-foreground transition cursor-pointer"
                >
                  {selectedIds.size === filteredList.length && filteredList.length > 0 ? (
                    <CheckSquare size={14} className="text-[#0A1628] dark:text-[#D4AF37]" />
                  ) : (
                    <Square size={14} className="text-muted-foreground" />
                  )}
                  <span>Select All ({filteredList.length})</span>
                </button>
                <span>Balance & Email Status</span>
              </div>

              <div className="max-h-52 overflow-y-auto divide-y divide-border">
                {filteredList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No eligible accounts match the current filter.
                  </div>
                ) : (
                  filteredList.map((item) => {
                    const billId = item.billId || item._id;
                    const isSelected = selectedIds.has(billId);
                    const hasEmail = Boolean(item.tenantEmail && item.tenantEmail.trim());
                    const balance = Number(item.remainingAmount || item.frozenAmount || 0);

                    return (
                      <div
                        key={String(billId)}
                        onClick={() => handleToggleItem(billId)}
                        className={`flex items-center justify-between p-2.5 transition cursor-pointer hover:bg-muted/30 ${
                          isSelected ? "bg-muted/10" : "opacity-75"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleItem(billId);
                            }}
                            className="text-muted-foreground hover:text-card-foreground cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={15} className="text-[#0A1628] dark:text-[#D4AF37]" />
                            ) : (
                              <Square size={15} className="text-muted-foreground" />
                            )}
                          </button>

                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] text-[10px] font-bold">
                            {getInitials(item.tenantName)}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-card-foreground truncate">
                              {item.tenantName || "Tenant"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.roomName || "Room"} · Statement #{item.billNumber || String(billId).slice(-6)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            ₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5">
                            {hasEmail ? (
                              <span className="text-muted-foreground truncate max-w-[140px]" title={item.tenantEmail}>
                                {item.tenantEmail}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                In-App Only
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Customizable Reminder Note Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-card-foreground">
                Reminder Message (Included in Email & Notification) <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10px] font-medium ${noticeMessage.length >= 950 ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
                {noticeMessage.length} / 1,000 characters
              </span>
            </div>
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={1000}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="Enter the friendly reminder message text..."
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
              disabled={dispatching || selectedAccounts.length === 0}
              title={selectedAccounts.length === 0 ? "Select at least one account" : `Dispatch ${stage === 3 ? "Final Demand" : `Notice ${stage}`} to ${selectedAccounts.length} tenant account(s)`}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0A1628] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white cursor-pointer"
            >
              {dispatching ? (
                <>
                  <LoaderCircle size={13} className="animate-spin" /> Dispatching...
                </>
              ) : (
                <>
                  <Send size={12} className="text-amber-400 dark:text-amber-600" />
                  <span>Dispatch {stage === 3 ? "Final Demand" : `Notice ${stage}`} ({selectedAccounts.length})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
