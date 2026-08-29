import { ArrowRightLeft } from "lucide-react";
import { formatDate, formatMoney } from "./tenantDetailConstants";

const STATUS_TONE = {
  awaiting_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  action_required: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-foreground text-right">{value}</span>
  </div>
);

/**
 * Admin — one concise card for an upcoming (not-yet-effective) room transfer.
 * The tenant's CURRENT room/rent elsewhere in this modal stay the SOURCE
 * values until the effective date; this card only describes what is scheduled.
 */
export default function ScheduledRoomTransferCard({ transfer }) {
  if (!transfer) return null;
  const {
    currentRoom, scheduledRoom, effectiveTransferDate,
    currentMonthlyRent, newMonthlyRent, statusLabel, status,
    transferBalance, addendum, actionRequiredReason,
  } = transfer;

  const bal = transferBalance || {};
  const hasBalance = bal.hasBill && Number(bal.amountDue) > 0;

  return (
    <div className="border border-sky-200/70 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <ArrowRightLeft className="w-3.5 h-3.5 text-sky-500" />
          Scheduled Room Transfer
        </h4>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[status] || STATUS_TONE.completed}`}>
          {statusLabel || status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <div>
          <Row label="Current Room" value={currentRoom?.name || "—"} />
          <Row label="Scheduled Room" value={scheduledRoom?.name || "—"} />
          <Row label="Effective Date" value={formatDate(effectiveTransferDate)} />
        </div>
        <div>
          <Row label="Current Monthly Rent" value={formatMoney(currentMonthlyRent ?? 0)} />
          <Row label="New Monthly Rent" value={formatMoney(newMonthlyRent ?? 0)} />
        </div>
      </div>

      <div className="border-t border-sky-200/60 dark:border-sky-900/40 pt-2">
        {hasBalance ? (
          <>
            <Row label="Transfer Balance" value={formatMoney(bal.amountDue)} />
            <Row label="Paid" value={formatMoney(bal.amountPaid || 0)} />
            <Row label="Remaining" value={formatMoney(bal.remaining ?? bal.amountDue)} />
            <Row label="Due" value={formatDate(bal.dueDate || effectiveTransferDate)} />
          </>
        ) : (
          <Row label="Transfer Balance" value="₱0 — no payment required" />
        )}
      </div>

      {status === "ready" ? (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Payment requirements are settled. Transfer is scheduled for {formatDate(effectiveTransferDate)}.
        </p>
      ) : status === "action_required" && actionRequiredReason ? (
        <p className="text-[11px] text-rose-700 dark:text-rose-400">{actionRequiredReason}</p>
      ) : null}

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>Utilities: to follow after the transfer cutoff.</p>
        <p>
          Document:{" "}
          {addendum?.label || "Room Transfer Addendum — Scheduled"}
        </p>
      </div>
    </div>
  );
}
