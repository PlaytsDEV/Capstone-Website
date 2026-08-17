import React from "react";
import { Link } from "react-router-dom";
import { FileText, ArrowRight, Calendar, ShieldCheck, Clock } from "lucide-react";

/**
 * Solid Snapshot Card: Displays resident's active lease contract timeline,
 * days remaining countdown, progress bar, security deposit refund status,
 * and quick link to `/applicant/contracts`.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantLeaseTimelineCard({ data, onCloseDrawer }) {
  if (!data) return null;

  const room = data.roomNumber || "Assigned Room";
  const bed = data.bedLabel || data.bedPosition || "Bed space";
  const status = (data.status || "active").toLowerCase();

  const startDate = data.leaseStartDate || data.startDate
    ? new Date(data.leaseStartDate || data.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Start of stay";

  const endDate = data.leaseEndDate || data.endDate
    ? new Date(data.leaseEndDate || data.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "End of term";

  const daysRemaining = data.daysRemaining !== undefined && data.daysRemaining !== null
    ? data.daysRemaining
    : null;

  const progressPercent = data.progressPercent !== undefined && data.progressPercent !== null
    ? Math.min(100, Math.max(0, data.progressPercent))
    : daysRemaining !== null
    ? 50
    : 0;

  const deposit = data.securityDeposit || data.depositAmount || 0;

  const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Lease Agreement Timeline">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <FileText className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Lease Agreement</span>
        </div>
        <span className={`tenant-snapshot-badge ${status}`} aria-label={`Contract Status: ${status}`}>
          {status}
        </span>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
          <span>Room {room} ({bed})</span>
          {daysRemaining !== null && (
            <span
              className={`flex items-center gap-1 font-semibold ${
                daysRemaining <= 7
                  ? "text-rose-700 dark:text-rose-400"
                  : daysRemaining <= 30
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              <Clock
                className={`w-3 h-3 ${
                  daysRemaining <= 7
                    ? "text-rose-600 dark:text-rose-400"
                    : daysRemaining <= 30
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-500"
                }`}
                aria-hidden="true"
              />
              {daysRemaining <= 0
                ? "Vacant Today"
                : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`}
            </span>
          )}
        </div>

        <div className="tenant-lease-progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
          <div className="tenant-lease-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="tenant-snapshot-grid">
        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>Lease Start</span>
          </span>
          <span className="tenant-snapshot-cell-val">{startDate}</span>
        </div>

        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>Lease Expiration</span>
          </span>
          <span className="tenant-snapshot-cell-val">{endDate}</span>
        </div>

        <div className="tenant-snapshot-cell col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <span className="tenant-snapshot-cell-label block">Security Deposit Held</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Refundable upon move-out clearance</span>
              </div>
            </div>
            <span className="tenant-snapshot-cell-val highlight">{formatCurrency(deposit)}</span>
          </div>
        </div>
      </div>

      <Link
        to="/applicant/contracts"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="View lease documents and renewal options"
      >
        <span>View Contract & Renewals</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
