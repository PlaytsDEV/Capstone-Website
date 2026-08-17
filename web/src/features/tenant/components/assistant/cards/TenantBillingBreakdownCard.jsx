import React from "react";
import { Link } from "react-router-dom";

/**
 * Solid Snapshot Card: Displays resident's active or latest billing breakdown
 * including pro-rata rent, submetered electricity, 100% free water badge,
 * appliance surcharges, penalties, and net amount.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantBillingBreakdownCard({ data, onCloseDrawer }) {
  if (!data) return null;

  const rent = Number(data.rentAmount || data.rent || 0);
  const electricity = Number(data.electricityAmount || data.electricity || 0);
  const appliances = Number(data.applianceFees || data.applianceAmount || 0);
  const penalties = Number(data.penalties || data.penaltyAmount || 0);
  const discount = Number(data.discount || data.discountAmount || 0);
  const total = Number(data.totalAmount || data.total || rent + electricity + appliances + penalties - discount);
  const remaining = data.remainingAmount !== undefined ? Number(data.remainingAmount) : total;

  const status = (data.status || "pending").toLowerCase();
  const isPaid = status === "paid" || remaining <= 0;

  const formattedMonth = data.billingMonth || data.month
    ? new Date(data.billingMonth || data.month).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Current Statement";

  const formattedDueDate = data.dueDate
    ? (data.dueDate.includes("T") || !isNaN(Date.parse(data.dueDate))
        ? new Date(data.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : data.dueDate)
    : "Monthly lease cycle";

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Billing Statement Breakdown">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <span className="truncate">{formattedMonth}</span>
        </div>
        <span className={`tenant-snapshot-badge ${status}`} aria-label={`Status: ${status}`}>
          {status}
        </span>
      </div>

      <div className="tenant-snapshot-grid">
        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label">Base Monthly Rent</span>
          <span className="tenant-snapshot-cell-val">
            {formatCurrency(rent)}
            {data.proRataDays ? ` (${data.proRataDays} days pro-rata)` : ""}
          </span>
        </div>

        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label">
            <span>Electricity Share</span>
          </span>
          <span className="tenant-snapshot-cell-val">{formatCurrency(electricity)}</span>
        </div>

        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label">
            <span>Water Consumption</span>
          </span>
          <span className="tenant-snapshot-cell-val free flex items-center gap-1">
            <span>FREE</span>
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">(₱0.00)</span>
          </span>
        </div>

        {appliances > 0 && (
          <div className="tenant-snapshot-cell">
            <span className="tenant-snapshot-cell-label">Appliance Fees</span>
            <span className="tenant-snapshot-cell-val">{formatCurrency(appliances)}</span>
          </div>
        )}

        {penalties > 0 && (
          <div className="tenant-snapshot-cell">
            <span className="tenant-snapshot-cell-label text-rose-600 dark:text-rose-400">Late Penalties</span>
            <span className="tenant-snapshot-cell-val text-rose-600 dark:text-rose-400">+{formatCurrency(penalties)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="tenant-snapshot-cell">
            <span className="tenant-snapshot-cell-label text-emerald-600 dark:text-emerald-400">Discount</span>
            <span className="tenant-snapshot-cell-val text-emerald-600 dark:text-emerald-400">-{formatCurrency(discount)}</span>
          </div>
        )}

        <div className="tenant-snapshot-cell col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <span className="tenant-snapshot-cell-label">
                {isPaid ? "Total Balance" : "Total Amount Due"}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {isPaid ? "Statement Settled" : `Due ${formattedDueDate}`}
              </span>
            </div>
            <span className="tenant-snapshot-cell-val highlight">{formatCurrency(remaining)}</span>
          </div>
        </div>
      </div>

      <Link
        to="/applicant/billing"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="View full billing statement on billing page"
      >
        <span>View Full Statement & Pay</span>
      </Link>
    </div>
  );
}
