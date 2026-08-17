import { useState } from "react";
import {
  X,
  History,
  ChevronLeft,
  ChevronRight,
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
  return <span className="visit-history-role-badge">{label}</span>;
}

/* ── Single diff line item ────────────────────────────────────────────────── */
function DiffBadge({ type, children }) {
  return (
    <span className={`visit-diff-badge visit-diff-badge--${type}`}>
      {type === "added" && <Plus size={10} />}
      {type === "removed" && <Minus size={10} />}
      {type === "modified" && <Edit2 size={10} />}
      {children}
    </span>
  );
}

/* ── Human-readable diff renderer ────────────────────────────────────────── */
function DiffSummary({ diff }) {
  if (!diff) return <span className="visit-history-no-diff">No diff data</span>;

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
    return <span className="visit-history-no-diff">No changes recorded</span>;
  }

  return <div className="visit-diff-list">{items}</div>;
}

/* ── Single history record card ───────────────────────────────────────────── */
function HistoryRecord({ record }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="visit-history-record">
      <div className="visit-history-record__header">
        <div className="visit-history-record__meta">
          <span className="visit-history-record__time" title={formatFull(record.changedAt)}>
            <Clock size={12} />
            {formatRelative(record.changedAt)}
          </span>
          {record.changedBy?.email && (
            <span className="visit-history-record__actor">
              {record.changedBy.email}
            </span>
          )}
          {record.changedBy?.role && <RoleBadge role={record.changedBy.role} />}
        </div>
        <button
          type="button"
          className="visit-history-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse change details" : "Expand change details"}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {record.changeDescription && (
        <p className="visit-history-record__note">&ldquo;{record.changeDescription}&rdquo;</p>
      )}

      <div className="visit-diff-summary">
        <DiffSummary diff={record.diff} />
      </div>

      {expanded && (
        <div className="visit-history-record__snapshot">
          <p className="visit-history-snapshot-label">Snapshot after change</p>
          <div className="visit-history-snapshot-grid">
            <div>
              <strong>Operating Days:</strong>{" "}
              {(record.snapshot?.enabledWeekdays || [])
                .map((d) => DAY_NAMES[d] || d)
                .join(", ") || "None"}
            </div>
            <div>
              <strong>Active Slots:</strong>{" "}
              {(record.snapshot?.slots || [])
                .filter((s) => s.enabled)
                .map((s) => `${s.label} (cap ${s.capacity})`)
                .join(", ") || "None"}
            </div>
            {(record.snapshot?.blackoutDates || []).length > 0 && (
              <div>
                <strong>Blackouts:</strong>{" "}
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

  // Reset to page 1 when branch changes
  const handleBranchChange = () => setPage(1);
  void handleBranchChange; // suppress unused warning

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
        <div className="visit-history-drawer__header flex-col items-stretch gap-3">
          <div className="flex items-center justify-between">
            <div className="visit-history-drawer__title">
              <History size={16} />
              <span>Audit History</span>
              {branch && (
                <span className="visit-history-branch-chip">
                  {branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="visit-history-close-btn"
              onClick={onClose}
              aria-label="Close history drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sub Tab Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("snapshots")}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-colors text-center ${
                activeTab === "snapshots"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Rule Snapshots
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("conflicts")}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1 ${
                activeTab === "conflicts"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
              <span>Impact Logs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scheduled_users")}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1 ${
                activeTab === "scheduled_users"
                  ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users size={12} className="text-sky-500 shrink-0" />
              <span>Scheduled Users</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="visit-history-drawer__body">
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
          <div className="visit-history-drawer__footer">
            <span className="visit-history-pagination-info">
              Page {page} of {totalPages} &middot; {total} records
            </span>
            <div className="visit-history-pagination-controls">
              <button
                type="button"
                className="visit-history-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="visit-history-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
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
