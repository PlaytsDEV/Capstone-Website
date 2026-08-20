import React from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, ShieldCheck, Users, Volume2, Wifi } from "lucide-react";

/**
 * Solid Snapshot Card: Displays resident's building access schedule,
 * gate curfew, quiet hours, and visitor guidelines.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantHouseRulesCard({ data, onCloseDrawer }) {
  const branch = data?.branch || "Lilycrest Residence";

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Building Policies and House Rules">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <Clock className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Building Access & Rules</span>
        </div>
        <span className="tenant-snapshot-badge active" aria-label="Branch: Active Policy">
          {branch}
        </span>
      </div>

      <div className="space-y-2 my-2.5">
        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
              Main Gate Hours: 11:00 PM – 5:00 AM
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Gates lock nightly for building security. 24/7 late access is accommodated with valid tenant ID.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
              Quiet Hours: 10:00 PM – 7:00 AM
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Observed in all dorm corridors, study lounges, and residential floors.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <Users className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
              Day Visitors: 8:00 AM – 8:00 PM
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Guests are welcomed in common lounges and reception areas.
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 pb-2">
        <Wifi className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
        <span>High-speed Wi-Fi & water are free and included in your rent.</span>
      </div>

      <Link
        to="/applicant/contracts"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="View lease agreement terms and rules"
      >
        <span>View Full Tenancy Agreement</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
