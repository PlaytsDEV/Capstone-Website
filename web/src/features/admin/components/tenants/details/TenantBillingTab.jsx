import { useState } from "react";
import {
  Receipt,
  RefreshCw,
  Download,
  ArrowRight,
  ChevronDown,
  DollarSign,
  Zap,
} from "lucide-react";
import {
  formatBillingCycle,
  formatMoney,
  getPaymentStatusLabel,
} from "./tenantDetailConstants";

export default function TenantBillingTab({
  tenant,
  masterLedgerData,
  paymentHistory = [],
  generatingReceiptId,
  onViewBillReceipt,
  onNavigateToBilling,
}) {
  const [expandedBillCards, setExpandedBillCards] = useState({});

  const toggleBillCard = (id) => {
    setExpandedBillCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Consolidated Financial & Billing Ledger Container */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-4">
        {/* Header with Single Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/40">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>Itemized Statement of Account</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Detailed breakdown of contracted rent, submetered utilities, and move-in deposits
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onViewBillReceipt && onViewBillReceipt(null)}
              disabled={generatingReceiptId === "monthly-rent"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Download official Statement of Account (SOA) PDF"
            >
              {generatingReceiptId === "monthly-rent" ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span>Generating SOA...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Download Statement (SOA)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigateToBilling && onNavigateToBilling()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Open tenant's complete billing records in Admin Billing manager"
            >
              <span>Review in Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section 1: Itemized Billing Dues Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
              Itemized Dues &amp; Recurring Charges
            </span>
            <span className="text-[11px] text-muted-foreground">
              {masterLedgerData?.items?.length || 0} active ledger{" "}
              {masterLedgerData?.items?.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          <div className="space-y-2.5">
            {masterLedgerData?.items?.map((item) => {
              const Icon = item.icon || Receipt;
              const isExpanded = !!expandedBillCards[item.id];
              const isOverdue = item.status === "overdue";
              const isPaid = item.status === "paid" || item.balance <= 0;
              const cycleDisplay = formatBillingCycle(item.cycle, item.dueDate);

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-card border border-border rounded-xl shadow-2xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Icon, Title, Status Dot, Subtitle */}
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${
                          item.iconColor || "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {item.title}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              isPaid
                                ? "text-emerald-700 dark:text-emerald-400"
                                : isOverdue
                                ? "text-rose-700 dark:text-rose-400"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPaid
                                  ? "bg-emerald-500"
                                  : isOverdue
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            <span>
                              {isPaid ? "Settled" : isOverdue ? "Overdue" : "Pending"}
                            </span>
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>
                            Payment Due:{" "}
                            <strong className="font-medium text-foreground">
                              {item.dueDate || "Pending"}
                            </strong>
                          </span>
                          <span className="text-border">•</span>
                          <span>
                            Cycle:{" "}
                            <strong className="font-medium text-foreground">
                              {cycleDisplay}
                            </strong>
                          </span>
                          {isOverdue && item.overdueDays ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                              ({item.overdueDays} days past due)
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <div className="text-left sm:text-right">
                        <div
                          className={`text-base font-bold font-mono ${
                            isPaid ? "text-foreground" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isPaid ? formatMoney(item.billed) : formatMoney(item.balance)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isPaid
                            ? item.category === "rent"
                              ? "Monthly Rate (Covered)"
                              : "Settled in Full"
                            : `Due Now (Assessed: ${formatMoney(item.billed)})`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onViewBillReceipt && onViewBillReceipt(item.rawItem || item)
                          }
                          disabled={generatingReceiptId === (item.rawItem?.id || item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-semibold text-[11px] transition-all cursor-pointer shadow-xs whitespace-nowrap"
                          title="View / Download official statement receipt PDF"
                          aria-label="View official statement receipt"
                        >
                          {generatingReceiptId === (item.rawItem?.id || item.id) ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Receipt / Statement</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleBillCard(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-[11px] transition-all cursor-pointer shadow-xs whitespace-nowrap"
                          aria-label={`Toggle breakdown for ${item.title}`}
                        >
                          <span>{isExpanded ? "Hide Details" : "Breakdown"}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Seamless Expanded Breakdown */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Charge Category
                        </span>
                        <span className="font-medium text-foreground capitalize">
                          {item.category === "rent"
                            ? "Monthly Contracted Rent"
                            : item.category === "electricity"
                            ? "Submetered Electricity"
                            : item.category === "water"
                            ? "Shared Room Water"
                            : item.category === "penalty"
                            ? "Daily Late Fee (₱50/day)"
                            : "Disciplinary Fine"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Assigned Unit
                        </span>
                        <span className="font-medium text-foreground">
                          {tenant.room || "Room"}
                          {tenant.bed ? ` (Bed ${tenant.bed})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Billing Cycle
                        </span>
                        <span className="font-medium text-foreground">{cycleDisplay}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Settlement Status
                        </span>
                        <span
                          className={`font-medium ${
                            isPaid
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isOverdue
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {isPaid
                            ? `Paid in Full (${formatMoney(item.paid)})`
                            : `Balance Open: ${formatMoney(item.balance)}`}
                        </span>
                      </div>
                      <div className="sm:col-span-2 md:col-span-4 pt-1.5 text-[11px] text-muted-foreground border-t border-border/30">
                        {item.details}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Move-In Requirements & Deposits */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
              Move-in Fees &amp; Security Deposits
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* 1. Advance Rent */}
            <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Advance Rent
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>1 Month Applied</span>
                </span>
              </div>
              <div>
                <div className="text-base font-bold text-foreground font-mono">
                  {formatMoney(tenant.advanceRent)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Applied toward Month 1 stay
                </div>
              </div>
            </div>

            {/* 2. Security Deposit */}
            <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Security Deposit
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>Held (Refundable)</span>
                </span>
              </div>
              <div>
                <div className="text-base font-bold text-foreground font-mono">
                  {formatMoney(tenant.securityDeposit)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Held in escrow for checkout clearance
                </div>
              </div>
            </div>

            {/* 3. Reservation Fee */}
            <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px] font-medium">
                  Reservation Fee
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Paid &amp; Credited</span>
                </span>
              </div>
              <div>
                <div className="text-base font-bold text-foreground font-mono">
                  {formatMoney(tenant.reservationFee)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Credited at move-in settlement
                </div>
              </div>
            </div>

            {/* 4. Declared Appliances (Guadalupe / Active Add-ons) */}
            {(String(tenant?.branch || tenant?.roomId?.branch || "").toLowerCase().includes("guadalupe") ||
              Number(tenant?.applianceFees || 0) > 0 ||
              (Array.isArray(tenant?.selectedAppliances) && tenant.selectedAppliances.length > 0)) && (
              <div className="p-3 bg-card border border-border rounded-xl flex flex-col justify-between gap-2 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    Appliance Add-on
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span>Monthly Add-on</span>
                  </span>
                </div>
                <div>
                  <div className="text-base font-bold text-foreground font-mono">
                    {formatMoney(tenant?.applianceFees || 0)}/mo
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {Array.isArray(tenant?.selectedAppliances) && tenant.selectedAppliances.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0) > 0
                      ? `${tenant.selectedAppliances.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0)} declared unit(s) (Cycle 2+)`
                      : "No declared units (₱0/mo)"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payment History */}
      {paymentHistory.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Recent Payments ({paymentHistory.length})
          </h4>
          <div className="divide-y divide-border/40 text-xs">
            {paymentHistory.map((payment) => {
              const paymentStatusConfig = getPaymentStatusLabel(payment);
              return (
                <div
                  key={payment.id}
                  className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground block">
                      ₱{Number(payment.amount || 0).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {payment.date} • {payment.method} ({payment.reference})
                    </span>
                  </div>
                  <div
                    className={`px-2 py-0.5 text-xs font-semibold rounded ${paymentStatusConfig.bg} ${paymentStatusConfig.color}`}
                  >
                    {paymentStatusConfig.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
