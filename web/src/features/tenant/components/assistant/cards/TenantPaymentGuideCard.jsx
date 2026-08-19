import React from "react";
import { Link } from "react-router-dom";
import { CreditCard, ArrowRight, QrCode, Building, ShieldCheck } from "lucide-react";

/**
 * Solid Snapshot Card: Displays resident's accepted payment methods,
 * current statement balance, due date, and quick action to `/applicant/billing`.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantPaymentGuideCard({ data, onCloseDrawer }) {
  const currentBill = data?.currentBill || (data?.totalAmount !== undefined || data?.remainingAmount !== undefined ? data : null);
  const remaining = currentBill?.remainingAmount !== undefined
    ? Number(currentBill.remainingAmount)
    : Number(currentBill?.totalAmount || 0);

  const formattedDueDate = currentBill?.dueDate
    ? (currentBill.dueDate.includes("T") || !isNaN(Date.parse(currentBill.dueDate))
        ? new Date(currentBill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : currentBill.dueDate)
    : "Monthly lease cycle";

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isPaid = remaining <= 0;

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Payment Options Guide">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <CreditCard className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Payment Channels Guide</span>
        </div>
        <span className={`tenant-snapshot-badge ${isPaid ? "paid" : "pending"}`} aria-label={`Status: ${isPaid ? "Settled" : "Pending"}`}>
          {isPaid ? "Settled" : "Balance Due"}
        </span>
      </div>

      <div className="mb-2.5">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span>Current Statement Balance</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(remaining)}</span>
        </div>
        {!isPaid && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
            Due on <strong>{formattedDueDate}</strong>
          </span>
        )}
      </div>

      <div className="space-y-1.5 my-2.5">
        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <QrCode className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
              1. GCash / Maya (Instant)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Scan QR code or checkout via PayMongo gateway on your Billing tab.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <Building className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
              2. Online Bank Transfer
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Direct transfer to official Lilycrest BDO or BPI branch accounts.
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
        <span>Payments are verified and receipted automatically.</span>
      </div>

      <Link
        to="/applicant/billing"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="Proceed to Billing page to settle balance"
      >
        <span>Go to Billing & Settle Online</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
