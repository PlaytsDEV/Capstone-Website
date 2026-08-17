import React, { useState, useEffect } from "react";
import {
  X,
  BellRing,
  AlertTriangle,
  Send,
  LoaderCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  ShieldAlert,
  User,
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

const STAGE_METADATA = {
  1: {
    badge: "Stage 1: Friendly Reminder",
    badgeColor: "text-sky-700 dark:text-sky-400",
    dotColor: "bg-sky-500",
    headline: "First Overdue Payment Reminder",
    defaultNote: "Please settle your outstanding balance at your earliest convenience to maintain an account in good standing.",
    btnText: "Dispatch Notice 1",
  },
  2: {
    badge: "Stage 2: Urgent Demand",
    badgeColor: "text-amber-700 dark:text-amber-400",
    dotColor: "bg-amber-500",
    headline: "Urgent Payment Demand & Penalty Notice",
    defaultNote: "Your account is significantly past due and accumulating late penalties. Immediate settlement via online portal or office counter is required.",
    btnText: "Dispatch Notice 2",
  },
  3: {
    badge: "Stage 3 (Final): Intent to Terminate",
    badgeColor: "text-rose-700 dark:text-rose-400",
    dotColor: "bg-rose-500",
    headline: "Final Notice: Pre-Termination Demand",
    defaultNote: "FINAL NOTICE: Failure to settle this balance immediately will result in referral to the Administrative Termination Review Board for lease cancellation.",
    btnText: "Dispatch Notice 3 (Final Demand)",
  },
};

export default function DispatchNoticeModal({ isOpen, item, targetStage = 1, onClose, onDispatched }) {
  const [dispatching, setDispatching] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const stage = Number(targetStage) || 1;
  const meta = STAGE_METADATA[stage] || STAGE_METADATA[1];

  useEffect(() => {
    if (isOpen) {
      setNoticeMessage(meta.defaultNote);
      setError("");
      setSuccessMsg("");
    }
  }, [isOpen, stage, meta.defaultNote]);

  if (!isOpen || !item) return null;

  const remaining = Number(item.remainingAmount || item.frozenAmount || 0);
  const penalty = Number(item.penaltyAmount || 0);
  const daysOverdue = Number(item.daysOverdue || 0);

  const handleDispatch = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      setDispatching(true);
      await billingApi.sendOverdueNotice(item.billId, {
        noticeNumber: stage,
        noticeType: `notice_${stage}`,
        noticeMessage: noticeMessage.trim(),
      });

      const message = `Notice ${stage} successfully dispatched and recorded.`;
      setSuccessMsg(message);
      showNotification(message, "success");
      onDispatched?.();
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      console.error("Notice dispatch error:", err);
      const friendlyErr = err.message || `Unable to dispatch Notice ${stage}. Please try again.`;
      setError(friendlyErr);
      showNotification(friendlyErr, "error");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center text-amber-600 dark:text-amber-400">
              <BellRing size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-card-foreground">
                  Dispatch Overdue Notice
                </h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.badgeColor}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                  {meta.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Statement #{item.billNumber || String(item.billId).slice(-6)} · {item.roomName}
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
        <form onSubmit={handleDispatch} className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
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

          {/* Tenant & Room Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-white dark:bg-[#D4AF37] dark:text-[#0A1628] border border-[#0A1628]/20 dark:border-[#D4AF37]/40 text-xs font-bold shadow-xs">
                {getInitials(item.tenantName)}
              </div>
              <div>
                <p className="text-xs font-bold text-card-foreground">{item.tenantName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.roomName} · {item.branch === "gil-puyat" ? "Gil Puyat Branch" : "Guadalupe Branch"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Balance Due</span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                ₱{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Debt Breakdown Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Days Overdue</span>
              <span className="text-xs font-bold text-card-foreground mt-0.5 flex items-center gap-1">
                <Clock size={12} className="text-muted-foreground" /> {daysOverdue} Day(s)
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Late Penalties</span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                ₱{penalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Original Due Date</span>
              <span className="text-xs font-bold text-card-foreground mt-0.5 block">
                {item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-PH") : "N/A"}
              </span>
            </div>
          </div>

          {/* Stage Escalation Notice Preview */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText size={13} /> Official Notice Header
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                Multi-channel: Email + In-App Notice
              </span>
            </div>
            <p className="text-xs font-bold text-card-foreground">{meta.headline}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Recipient: <strong className="text-card-foreground">{item.tenantName}</strong> ({item.tenantEmail || "Email on file"})
            </p>
          </div>

          {/* Custom Administrative Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-card-foreground">
                Administrative Message Note
              </label>
              <span className={`text-[10px] font-medium ${noticeMessage.length >= 1900 ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
                {noticeMessage.length} / 2,000 characters
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="Include specific payment deadlines, offline counter availability, or instructions..."
              className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground">
              This note is included in the formal email notification and in-app statement delivered to the tenant.
            </p>
          </div>

          {stage === 3 && (
            <div className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                <ShieldAlert size={14} /> Review Board Auto-Referral Trigger
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Dispatching Notice 3 (Final Demand) automatically registers an active case in the <strong>Administrative Termination Review Board</strong>.
              </p>
            </div>
          )}

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
              disabled={dispatching}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0A1628] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#13243D] focus-visible:ring-2 focus-visible:ring-[#D4AF37] active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {dispatching ? (
                <>
                  <LoaderCircle size={13} className="animate-spin" /> Dispatching...
                </>
              ) : (
                <>
                  <Send size={13} /> {meta.btnText}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
