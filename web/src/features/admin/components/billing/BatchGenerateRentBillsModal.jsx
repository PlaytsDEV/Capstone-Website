import { LoaderCircle, Send, Users, X } from "lucide-react";
import { fmtCurrency, fmtMonth, formatBranch } from "../../utils/formatters";

export default function BatchGenerateRentBillsModal({
  isOpen,
  onClose,
  onConfirm,
  selectedRows = [],
  isGenerating = false,
  billingMonth = "",
}) {
  if (!isOpen || selectedRows.length === 0) return null;

  const totalAmount = selectedRows.reduce((sum, r) => sum + (Number(r.contractRate) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--color-accent,#D4AF37)]">
              Bulk Billing Action
            </p>
            <h3 className="mt-0.5 text-base font-bold text-card-foreground">
              Generate Rent Bills in Batch
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border bg-background">
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Selected Tenants</p>
            <p className="mt-1 text-base font-bold text-card-foreground flex items-center gap-1.5">
              <Users size={15} className="text-slate-500" />
              {selectedRows.length}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Bill Value</p>
            <p className="mt-1 text-base font-bold text-[color:var(--color-accent,#D4AF37)]">
              {fmtCurrency(totalAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Billing Cycle</p>
            <p className="mt-1 text-xs font-bold text-card-foreground">
              {billingMonth && billingMonth !== "all" ? fmtMonth(billingMonth) : "Current Active Month"}
            </p>
          </div>
        </div>

        <div className="px-6 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Selected Tenants ({selectedRows.length})
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30">
            {selectedRows.map((row) => (
              <div key={row.id || row.reservationId} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-semibold text-card-foreground">{row.tenantName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.roomName || "Unassigned"} • {row.branch ? formatBranch(row.branch) : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-card-foreground">
                    {fmtCurrency(row.contractRate)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">Monthly Rent</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Statements and notifications will be sent automatically.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="h-9 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-card-foreground shadow-xs hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isGenerating}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>{isGenerating ? "Generating..." : `Confirm & Generate (${selectedRows.length})`}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
