import React from "react";
import { Link } from "react-router-dom";
import { Megaphone, ArrowRight, Bell, Calendar, CheckCircle2 } from "lucide-react";

/**
 * Solid Snapshot Card: Displays resident's latest branch announcement,
 * facility advisories, and quick action to `/applicant/announcements`.
 *
 * Strictly follows Lilycrest zero-gradient, solid HSL aesthetic.
 */
export default function TenantAnnouncementCard({ data, onCloseDrawer }) {
  const announcements = Array.isArray(data) ? data : data?.recentAnnouncements || [];
  const latest = announcements[0] || (data?.title ? data : null);

  if (!latest) {
    return (
      <div className="tenant-snapshot-card" role="region" aria-label="Branch Announcements">
        <div className="tenant-snapshot-header">
          <div className="tenant-snapshot-title">
            <Megaphone className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
            <span>Branch Advisories</span>
          </div>
          <span className="tenant-snapshot-badge completed">Normal Operations</span>
        </div>

        <div className="flex items-start gap-2.5 my-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
              No Active Service Advisories
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              All branch utilities, security checkpoints, and common amenities are operating normally.
            </p>
          </div>
        </div>

        <Link
          to="/applicant/announcements"
          onClick={() => onCloseDrawer?.()}
          className="tenant-snapshot-action-btn mt-2"
          aria-label="View all branch announcements"
        >
          <span>View All Announcements</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const title = latest.title || latest.subject || "Branch Advisory";
  const content = latest.content || latest.message || latest.body || "";
  const dateStr = latest.createdAt
    ? new Date(latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Recent";

  return (
    <div className="tenant-snapshot-card" role="region" aria-label="Latest Branch Announcement">
      <div className="tenant-snapshot-header">
        <div className="tenant-snapshot-title">
          <Megaphone className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Branch Advisory</span>
        </div>
        <span className="tenant-snapshot-badge active">
          Latest Notice
        </span>
      </div>

      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 my-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
            {title}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            {dateStr}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
          {content}
        </p>
      </div>

      <Link
        to="/applicant/announcements"
        onClick={() => onCloseDrawer?.()}
        className="tenant-snapshot-action-btn"
        aria-label="Read full announcement on announcements page"
      >
        <span>Open Announcements Portal</span>
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
