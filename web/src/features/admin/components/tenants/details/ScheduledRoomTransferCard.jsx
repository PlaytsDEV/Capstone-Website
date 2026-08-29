import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, LoaderCircle } from "lucide-react";
import { formatDate, formatMoney } from "./tenantDetailConstants";
import { reservationApi } from "../../../../../shared/api/reservationApi";
import { showNotification } from "../../../../../shared/utils/notification";
import getFriendlyError from "../../../../../shared/utils/friendlyError";
import ConfirmModal from "../../../../../shared/components/ConfirmModal";

const STATUS_TONE = {
  awaiting_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  action_required: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// Reasons for which "Retry Transfer" is offered (payment of the normal Bill
// resolves the blocker). Everything else needs Administration-Office settlement.
const RETRYABLE_REASONS = new Set(["TRANSFER_BALANCE_UNPAID", "ADDITIONAL_BALANCE_DUE"]);

const REVIEW_GUIDANCE = {
  TRANSFER_BALANCE_UNPAID: "Settle the remaining balance before retrying the transfer.",
  ADDITIONAL_BALANCE_DUE: "An additional balance is required. Settle the updated Bill, then retry.",
  FINANCIAL_ADJUSTMENT_REQUIRED: "Please coordinate with the Administration Office, 2nd Floor.",
  PAYMENT_ALREADY_RECEIVED: "Please coordinate with the Administration Office, 2nd Floor.",
  OPERATIONAL_VALIDATION_FAILED: "Review the destination room/bed and retry after correcting the issue.",
  EXECUTION_FAILED: "Review the destination room/bed and retry after correcting the issue.",
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
  const queryClient = useQueryClient();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!transfer) return null;
  const {
    reservationId, currentRoom, scheduledRoom, effectiveTransferDate,
    currentMonthlyRent, newMonthlyRent, statusLabel, status,
    transferBalance, addendum, actionRequiredReason,
  } = transfer;

  const bal = transferBalance || {};
  const hasBalance = bal.hasBill && Number(bal.amountDue) > 0;
  const hasPayment = Number(bal.amountPaid || 0) > 0;
  const reasonCode = String(actionRequiredReason || "");
  const canCancel = ["awaiting_payment", "ready"].includes(status) || (status === "action_required" && !hasPayment);
  const canRetry = status === "action_required" && RETRYABLE_REASONS.has(reasonCode);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant-workspace-detail"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  const runCancel = async () => {
    setConfirmCancelOpen(false);
    setBusy(true);
    try {
      const res = await reservationApi.cancelScheduledRoomTransfer(reservationId);
      if (res?.outcome === "cancelled") {
        showNotification("Scheduled room transfer cancelled. The tenant remains in the current room.", "success");
      } else {
        showNotification(
          "A payment has already been received. Please coordinate with the Administration Office, 2nd Floor for settlement.",
          "warning",
        );
      }
      refresh();
    } catch (err) {
      showNotification(getFriendlyError(err) || "Failed to cancel the scheduled transfer.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runRetry = async () => {
    setBusy(true);
    try {
      const res = await reservationApi.retryScheduledRoomTransfer(reservationId);
      showNotification(
        res?.outcome === "executed"
          ? "Scheduled room transfer executed."
          : "The scheduled transfer still cannot be completed — see the status.",
        res?.outcome === "executed" ? "success" : "warning",
      );
      refresh();
    } catch (err) {
      showNotification(getFriendlyError(err) || "Retry failed.", "error");
    } finally {
      setBusy(false);
    }
  };

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
      ) : status === "action_required" ? (
        <p className="text-[11px] text-rose-700 dark:text-rose-400">
          {REVIEW_GUIDANCE[reasonCode] || actionRequiredReason || "This scheduled transfer needs review."}
        </p>
      ) : null}

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <p>Utilities: to follow after the transfer cutoff.</p>
        <p>Document: {addendum?.label || "Room Transfer Addendum — Scheduled"}</p>
      </div>

      {/* Actions — minimal: Cancel (safe states) + Review/Retry (action_required). */}
      <div className="flex flex-wrap gap-2 pt-1">
        {status === "action_required" ? (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            Review
          </button>
        ) : null}
        {canRetry ? (
          <button
            type="button"
            disabled={busy}
            onClick={runRetry}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy ? <LoaderCircle size={12} className="animate-spin" /> : null}
            Retry Transfer
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmCancelOpen(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel Scheduled Transfer
          </button>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={confirmCancelOpen}
        title="Cancel this scheduled room transfer?"
        message={
          hasPayment
            ? "A payment has already been received for this transfer. It cannot be cancelled automatically — you will be directed to coordinate settlement with the Administration Office, 2nd Floor."
            : "The tenant will remain in the current room and the reserved destination will be released."
        }
        confirmText="Cancel Transfer"
        cancelText="Keep Scheduled"
        variant={hasPayment ? "warning" : "info"}
        loading={busy}
        onConfirm={runCancel}
        onClose={() => setConfirmCancelOpen(false)}
      />

      {reviewOpen ? (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground">Scheduled Transfer — Review</h3>
            <div className="space-y-1">
              <Row label="Current Room" value={currentRoom?.name || "—"} />
              <Row label="Scheduled Room" value={scheduledRoom?.name || "—"} />
              <Row label="Effective Date" value={formatDate(effectiveTransferDate)} />
              <Row label="Status" value={statusLabel || status} />
              {hasBalance ? (
                <>
                  <Row label="Transfer Balance" value={formatMoney(bal.amountDue)} />
                  <Row label="Paid" value={formatMoney(bal.amountPaid || 0)} />
                  <Row label="Remaining" value={formatMoney(bal.remaining ?? bal.amountDue)} />
                </>
              ) : null}
              <Row label="Document" value={addendum?.label || "Room Transfer Addendum — Scheduled"} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {REVIEW_GUIDANCE[reasonCode] || "Review the details above and take the appropriate action."}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700" onClick={() => setReviewOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
