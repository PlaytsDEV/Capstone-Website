import { useState } from "react";
import {
  X,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  Minus,
  Edit2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Users,
} from "lucide-react";
import { useVisitAvailabilityHistory } from "../../../shared/hooks/queries/useReservations";
import VisitConflictHistoryPanel from "./VisitConflictHistoryPanel";
import VisitScheduledUsersPanel from "./VisitScheduledUsersPanel";

/* ── Day label map ────────────────────────────────────────────────────────── */
const DAY_NAMES = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/* ── Relative timestamp formatter ─────────────────────────────────────────── */
function formatRelative(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Full timestamp formatter ─────────────────────────────────────────────── */
function formatFull(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Role badge ───────────────────────────────────────────────────────────── */
function RoleBadge({ role }) {
  const label =
    role === "owner"
      ? "Owner"
      : role === "branch_admin"
        ? "Branch Admin"
        : role === "admin"
          ? "Admin"
          : role || "Unknown";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      {label}
    </span>
  );
}

/* ── Single diff line item with transparent background & semantic dots ─────── */
function DiffBadge({ type, children }) {
  const dotColor =
    type === "added"
      ? "bg-emerald-500"
      : type === "removed"
        ? "bg-rose-500"
        : "bg-amber-500";

  const textColor =
    type === "added"
      ? "text-emerald-700 dark:text-emerald-400"
      : type === "removed"
        ? "text-rose-700 dark:text-rose-400"
        : "text-amber-700 dark:text-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-transparent ${textColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      {type === "added" && <Plus size={10} className="shrink-0" />}
      {type === "removed" && <Minus size={10} className="shrink-0" />}
      {type === "modified" && <Edit2 size={10} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
}

/* ── Human-readable diff renderer ────────────────────────────────────────── */
function DiffSummary({ diff }) {
  if (!diff) return <span className="text-xs text-slate-400">No diff data</span>;

  const items = [];

  // Weekday additions
  (diff.added?.enabledWeekdays || []).forEach((day) => {
    items.push(
      <DiffBadge key={`add-day-${day}`} type="added">
        {DAY_NAMES[day] || `Day ${day}`} enabled
      </DiffBadge>,
    );
  });

  // Weekday removals
  (diff.removed?.enabledWeekdays || []).forEach((day) => {
    items.push(
      <DiffBadge key={`rem-day-${day}`} type="removed">
        {DAY_NAMES[day] || `Day ${day}`} disabled
      </DiffBadge>,
    );
  });

  // Slot changes
  (diff.modified?.slots || []).forEach((slot, idx) => {
    if (slot.type === "added") {
      items.push(
        <DiffBadge key={`slot-add-${idx}`} type="added">
          Slot {slot.label} added
        </DiffBadge>,
      );
    } else if (slot.type === "removed") {
      items.push(
        <DiffBadge key={`slot-rem-${idx}`} type="removed">
          Slot {slot.label} removed
        </DiffBadge>,
      );
    } else if (slot.type === "modified") {
      if (slot.changes?.capacity) {
        items.push(
          <DiffBadge key={`slot-cap-${idx}`} type="modified">
            {slot.label} capacity {slot.changes.capacity.from} → {slot.changes.capacity.to}
          </DiffBadge>,
        );
      }
      if (slot.changes?.enabled !== undefined) {
        items.push(
          <DiffBadge key={`slot-en-${idx}`} type="modified">
            {slot.label} {slot.changes.enabled.to ? "enabled" : "disabled"}
          </DiffBadge>,
        );
      }
    }
  });

  // Blackout additions
  (diff.added?.blackoutDates || []).forEach((b, idx) => {
    items.push(
      <DiffBadge key={`blk-add-${idx}`} type="added">
        Blackout added: {b.date}
        {b.reason ? ` (${b.reason})` : ""}
      </DiffBadge>,
    );
  });

  // Blackout removals
  (diff.removed?.blackoutDates || []).forEach((b, idx) => {
    items.push(
      <DiffBadge key={`blk-rem-${idx}`} type="removed">
        Blackout removed: {b.date}
      </DiffBadge>,
    );
  });

  if (items.length === 0) {
    return <span className="text-xs text-slate-400">No changes recorded</span>;
  }

  return <div className="flex flex-wrap gap-1.5 mt-1">{items}</div>;
}

/* ── Single history record card with whole-header clickable accordion ───────── */
function HistoryRecord({ record }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 space-y-2.5">
      {/* Clickable Header Accordion */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 cursor-pointer select-none group"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span
            className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400"
            title={formatFull(record.changedAt)}
          >
            <Clock size={12} className="text-slate-400 shrink-0" />
            {formatRelative(record.changedAt)}
          </span>
          {record.changedBy?.email && (
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {record.changedBy.email}
            </span>
          )}
          {record.changedBy?.role && <RoleBadge role={record.changedBy.role} />}
        </div>

        <button
          type="button"
          className="p-1 rounded text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          title={expanded ? "Collapse change snapshot" : "Expand change snapshot"}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Admin Note without side-colored border */}
      {record.changeDescription && (
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
          <span className="text-slate-400 font-medium">Note: </span>
          <span>&ldquo;{record.changeDescription}&rdquo;</span>
        </div>
      )}

      {/* Diff badges */}
      <DiffSummary diff={record.diff} />

      {/* Collapsible Snapshot */}
      {expanded && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
            Snapshot after change
          </span>
          <div className="grid grid-cols-1 gap-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
            <div>
              <strong className="text-slate-900 dark:text-slate-100">Operating Days:</strong>{" "}
              {(record.snapshot?.enabledWeekdays || [])
                .map((d) => DAY_NAMES[d] || d)
                .join(", ") || "None"}
            </div>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">Active Slots:</strong>{" "}
              {(record.snapshot?.slots || [])
                .filter((s) => s.enabled)
                .map((s) => `${s.label} (cap ${s.capacity})`)
                .join(", ") || "None"}
            </div>
            {(record.snapshot?.blackoutDates || []).length > 0 && (
              <div>
                <strong className="text-slate-900 dark:text-slate-100">Blackouts:</strong>{" "}
                {record.snapshot.blackoutDates
                  .map((b) => `${b.date}${b.reason ? ` — ${b.reason}` : ""}`)
                  .join("; ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main drawer component ────────────────────────────────────────────────── */
function VisitAvailabilityHistoryDrawer({ open, onClose, branch }) {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("snapshots");
  const LIMIT = 15;

  const { data, isLoading, isError } = useVisitAvailabilityHistory(
    branch,
    { page, limit: LIMIT },
    { enabled: open && !!branch },
  );

  const records = data?.records || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="visit-history-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <aside
        className={`visit-history-drawer${open ? " visit-history-drawer--open" : ""}`}
        aria-label="Availability Rule Change History"
        aria-hidden={!open}
        role="complementary"
      >
        {/* Drawer header */}
        <div className="visit-history-drawer__header flex-col items-stretch gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Audit History
              </h2>
              {branch && (
                <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={onClose}
              title="Close audit history drawer"
              aria-label="Close audit history drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Minimalist Segmented Sub-Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("snapshots")}
              className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "snapshots"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ClipboardList size={13} className="shrink-0" />
              <span>Rule Snapshots</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("conflicts")}
              className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "conflicts"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <span>Impact Logs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scheduled_users")}
              className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "scheduled_users"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users size={13} className="text-sky-500 shrink-0" />
              <span>Scheduled Users</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="visit-history-drawer__body bg-slate-50/50 dark:bg-slate-950">
          {activeTab === "conflicts" ? (
            <VisitConflictHistoryPanel branch={branch} />
          ) : activeTab === "scheduled_users" ? (
            <VisitScheduledUsersPanel branch={branch} />
          ) : (
            <>
              {isLoading && (
                <div className="visit-history-state visit-history-state--loading">
                  <Loader2 size={22} className="spin" />
                  <span>Loading change history…</span>
                </div>
              )}

              {isError && (
                <div className="visit-history-state visit-history-state--error">
                  <AlertCircle size={20} />
                  <span>Failed to load history. Please try again.</span>
                </div>
              )}

              {!isLoading && !isError && records.length === 0 && (
                <div className="visit-history-state visit-history-state--empty">
                  <ClipboardList size={32} />
                  <strong>No history yet</strong>
                  <span>
                    Changes to availability rules will appear here after the first save.
                  </span>
                </div>
              )}

              {!isLoading && !isError && records.length > 0 && (
                <div className="visit-history-records-list">
                  {records.map((record) => (
                    <HistoryRecord key={record._id} record={record} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination footer */}
        {activeTab === "snapshots" && !isLoading && !isError && total > LIMIT && (
          <div className="visit-history-drawer__footer bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <span className="visit-history-pagination-info">
              Page {page} of {totalPages} &middot; {total} records
            </span>
            <div className="visit-history-pagination-controls">
              <button
                type="button"
                className="visit-history-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                title={page <= 1 ? "Already at first page" : "Previous page"}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="visit-history-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                title={page >= totalPages ? "Already at last page" : "Next page"}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default VisitAvailabilityHistoryDrawer;

