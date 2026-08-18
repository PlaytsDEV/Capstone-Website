import React from "react";
import { Link } from "react-router-dom";
import { Wrench, ArrowRight, CheckCircle2, Calendar, UserCheck, PlusCircle } from "lucide-react";

/**
 * Solid Snapshot Card: Displays resident's active or latest maintenance ticket
 * including ticket number, category/type, urgency level, technician status,
 * scheduled date, and quick action to `/applicant/maintenance`.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantMaintenanceCard({ data, onCloseDrawer }) {
  if (!data) return null;

  // Handle case where data is empty object or empty array
  const hasValidTicket =
    data &&
    !Array.isArray(data) &&
    (data.ticketCode || data.ticketNumber || data.category || data.description);

  if (!hasValidTicket) {
    return (
      <div className="tenant-snapshot-card" role="region" aria-label="Maintenance Status">
        <div className="tenant-snapshot-header">
          <div className="tenant-snapshot-title">
            <Wrench className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
            <span>Maintenance Status</span>
          </div>
          <span className="tenant-snapshot-badge completed">All Clear</span>
        </div>

        <div className="flex items-start gap-2.5 my-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
              No Pending Maintenance Requests
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              All room fixtures, lighting, and plumbing facilities are marked operational.
            </p>
          </div>
        </div>

        <Link
          to="/applicant/maintenance"
          onClick={() => onCloseDrawer?.()}
          className="tenant-snapshot-action-btn mt-2"
          aria-label="Report a facility issue"
        >
          <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Report New Facility Issue</span>
        </Link>
      </div>
    );
  }

  const ticketCode = data.ticketCode || data.ticketNumber || data.id || "MNT-ACTIVE";
  const category = data.category || data.type || data.request_type || "Facility Repair";
  const urgency = (data.urgency || "normal").toLowerCase();
  const status = (data.status || "pending").toLowerCase();
  const description = data.description || "Active maintenance request under review";
  const provider = data.providerName || data.technician || "Assigned Technician";

  const scheduledDate = data.scheduledDate
    ? new Date(data.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Maintenance Ticket Snapshot">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <Wrench className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Ticket {ticketCode}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`tenant-snapshot-badge ${urgency}`} aria-label={`Urgency: ${urgency}`}>
            {urgency}
          </span>
          <span className={`tenant-snapshot-badge ${status}`} aria-label={`Status: ${status}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
          {category}
        </span>
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
          {description}
        </p>
      </div>

      <div className="tenant-snapshot-grid">
        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>Service Provider</span>
          </span>
          <span className="tenant-snapshot-cell-val truncate">{provider}</span>
        </div>

        <div className="tenant-snapshot-cell">
          <span className="tenant-snapshot-cell-label flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <span>Scheduled Visit</span>
          </span>
          <span className="tenant-snapshot-cell-val">
            {scheduledDate || "To be confirmed"}
          </span>
        </div>
      </div>

      <Link
        to="/applicant/maintenance"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="Open full maintenance workspace"
      >
        <span>Open Maintenance Portal</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

