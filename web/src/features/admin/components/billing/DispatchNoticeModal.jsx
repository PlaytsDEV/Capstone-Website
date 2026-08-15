import React, { useState, useEffect } from "react";
import {
  X,
  BellRing,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  ShieldAlert,
  User,
  Clock,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const STAGE_METADATA = {
  1: {
    badge: "Stage 1: Friendly Reminder",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    headline: "First Overdue Payment Reminder",
    defaultNote: "Please settle your outstanding balance at your earliest convenience to maintain an account in good standing.",
    btnText: "Dispatch Notice 1",
  },
  2: {
    badge: "Stage 2: Urgent Demand",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    headline: "Urgent Payment Demand & Penalty Notice",
    defaultNote: "Your account is significantly past due and accumulating late penalties. Immediate settlement via online portal or office counter is required.",
    btnText: "Dispatch Notice 2",
  },
  3: {
    badge: "Stage 3 (Final): Intent to Terminate",
    badgeClass: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
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

      setSuccessMsg(`Notice ${stage} successfully dispatched and recorded.`);
      onDispatched?.();
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      console.error("Notice dispatch error:", err);
      setError(err.message || `Failed to dispatch Notice ${stage}.`);
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <BellRing size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-card-foreground">
                  Dispatch Overdue Notice
                </h2>
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}>
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

          {/* Tenant & Room Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
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
              <span className="text-sm font-bold text-red-600">
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
              <span className="text-xs font-bold text-amber-600 mt-0.5 block">
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
                Multi-channel: Email + In-App Push
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
              <span className={`text-[10px] font-medium ${noticeMessage.length >= 1900 ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
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
              This note is merged into the formal email body and in-app receipt delivered to the resident.
            </p>
          </div>


          {stage === 3 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert size={14} /> Review Board Auto-Referral Trigger
              </div>
              <p className="text-[11px] leading-relaxed">
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
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {dispatching ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Dispatching...
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
