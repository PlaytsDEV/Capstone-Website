import { useState } from "react";
import { ArrowRightLeft, ChevronDown, ChevronRight, FileText, Receipt } from "lucide-react";
import { formatDate, formatMoney } from "./tenantDetailConstants";

// Admin-facing status → tone. Only the 5 approved labels ever surface.
const STATUS_TONE = Object.freeze({
  awaiting_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  action_required: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
});

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-foreground text-right">{value}</span>
  </div>
);

function balanceLine(bal) {
  if (!bal || !bal.hasBill || Number(bal.amountDue) <= 0) return "₱0 — no payment required";
  const paid = formatMoney(bal.amountPaid || 0);
  const remaining = formatMoney(bal.remaining ?? bal.amountDue);
  return `${formatMoney(bal.amountDue)}  ·  Paid ${paid}  ·  Remaining ${remaining}`;
}

function TransferHistoryEntry({ entry, onOpenDigitalContract, onViewBill }) {
  const [open, setOpen] = useState(false);

  const fromName = entry.fromRoom?.name || "—";
  const toName = entry.toRoom?.name || "—";
  const toBed = entry.toBed ? ` · ${entry.toBed}` : "";
  const isLegacy = entry.source === "legacy_immediate";
  const bal = entry.transferBalance || {};
  const settled =
    entry.finalSettlementAmount != null
      ? formatMoney(entry.finalSettlementAmount)
      : bal.hasBill && Number(bal.amountDue) > 0
        ? formatMoney(bal.amountDue)
        : "₱0";

  return (
    <div className="border border-border/60 rounded-xl bg-card">
      {/* Compact default row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
      >
        <ArrowRightLeft className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">
              {fromName} → {toName}
              {toBed}
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                STATUS_TONE[entry.status] || STATUS_TONE.completed
              }`}
            >
              {entry.userFacingStatus || entry.statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-[11px] text-muted-foreground">
            <span>Effective: {formatDate(entry.effectiveDate)}</span>
            <span>
              {entry.source === "scheduled"
                ? `Scheduled: ${formatDate(entry.scheduledAt || entry.createdAt)}`
                : `Recorded: ${formatDate(entry.completedAt || entry.createdAt)}`}
            </span>
            {entry.completedAt && (
              <span>Completed: {formatDate(entry.completedAt)}</span>
            )}
            {entry.cancelledAt && (
              <span>Cancelled: {formatDate(entry.cancelledAt)}</span>
            )}
            <span>
              {entry.status === "completed" ? "Final settlement" : "Scheduled Room Transfer Balance"}: {settled}
            </span>
            <span>
              Initiated by: {entry.initiatedBy?.name || (isLegacy ? "—" : "System")}
            </span>
          </div>
        </div>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        )}
      </button>

      {/* Expandable detail panel */}
      {open && (
        <div className="border-t border-border/50 p-3 space-y-3 text-xs">
          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">Transfer</p>
            <Row label="From Room" value={`${fromName}${entry.fromBed ? ` · ${entry.fromBed}` : ""}`} />
            <Row label="To Room" value={`${toName}${entry.toBed ? ` · ${entry.toBed}` : ""}`} />
            <Row label="Effective Date" value={formatDate(entry.effectiveDate)} />
            {entry.reason && <Row label="Reason" value={entry.reason} />}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">Financial</p>
            {entry.rentAdjustment != null && (
              <Row label="Rent Adjustment" value={formatMoney(entry.rentAdjustment)} />
            )}
            {entry.securityDepositAdjustment != null && (
              <Row label="Security Deposit Adjustment" value={formatMoney(entry.securityDepositAdjustment)} />
            )}
            <Row label="Transfer Balance" value={balanceLine(bal)} />
            {entry.finalSettlementAmount != null && (
              <Row label="Final Settlement" value={formatMoney(entry.finalSettlementAmount)} />
            )}
            {entry.settlementBillId && onViewBill && (
              <button
                type="button"
                onClick={() => onViewBill(entry.settlementBillId)}
                className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
              >
                <Receipt className="w-3 h-3" />
                View Bill
              </button>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">Utilities</p>
            <p className="text-[11px] text-muted-foreground">
              {entry.utilityNote ||
                "Electricity and applicable water charges follow the normal utility billing cycle, using the effective transfer date as the room-responsibility boundary."}
            </p>
          </div>

          {entry.addendumContractId && (
            <div>
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide mb-1">Contract</p>
              <button
                type="button"
                onClick={() =>
                  onOpenDigitalContract &&
                  onOpenDigitalContract({
                    _id: entry.addendumContractId,
                    id: entry.addendumContractId,
                    contractNumber: entry.addendum?.contractNumber,
                    contractPurpose: "amendment",
                  })
                }
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
              >
                <FileText className="w-3 h-3" />
                View {entry.addendum?.label || "Room Transfer Addendum"}
              </button>
            </div>
          )}

          {entry.status === "action_required" && entry.actionRequiredMessage && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-2 text-[11px] text-rose-700 dark:text-rose-300">
              {entry.actionRequiredMessage}
            </div>
          )}

          {isLegacy && (
            <p className="text-[10px] text-muted-foreground italic">
              Legacy transfer — recorded before scheduled room transfers. Audit record only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Admin — Room Transfer History for a tenant. Placed inside Tenant Details →
 * History, below the Room Stay Timeline. Consumes the SAME canonical serializer
 * as the Overview card (server `roomTransferHistory`). Audit record — no
 * client-side financial calculation.
 */
export default function RoomTransferHistorySection({
  roomTransferHistory = [],
  onOpenDigitalContract,
  onViewBill,
}) {
  if (!Array.isArray(roomTransferHistory) || roomTransferHistory.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          Room Transfer History ({roomTransferHistory.length})
        </h4>
      </div>

      <div className="space-y-2">
        {roomTransferHistory.map((entry) => (
          <TransferHistoryEntry
            key={entry.id}
            entry={entry}
            onOpenDigitalContract={onOpenDigitalContract}
            onViewBill={onViewBill}
          />
        ))}
      </div>
    </div>
  );
}
