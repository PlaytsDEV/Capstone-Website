import { useState } from "react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useFinancialOverview } from "../../../shared/hooks/queries/useFinancial";
import { PageShell, SummaryBar } from "../components/shared";
import { formatBranch } from "../utils/formatters";
import {
  BarChart2,
  AlertCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/admin-financial.css";

/* ── Formatters ── */
const fmtCurrency = (n) =>
  `₱${(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "—";

/* ── Status badge ── */
const STATUS_COLORS = {
  overdue: { bg: "#FEF2F2", color: "#DC2626", label: "Overdue" },
  pending: { bg: "#FFFBEB", color: "#D97706", label: "Pending" },
  "partially-paid": { bg: "#EFF6FF", color: "#2563EB", label: "Partial" },
};

function StatusChip({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      className="fin-status-chip"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

/* ── Room Row ── */
function RoomRow({ room }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className={`fin-room-row${open ? " fin-room-row--open" : ""}`}>
      {/* Summary header */}
      <button className="fin-room-row__header" onClick={() => setOpen((v) => !v)}>
        <div className="fin-room-row__meta">
          <span className="fin-room-row__name">{room.roomName}</span>
          <span className="fin-room-row__branch">{formatBranch(room.branch)}</span>
        </div>

        <div className="fin-room-row__badges">
          {room.overdueCount > 0 && (
            <span className="fin-badge fin-badge--overdue">
              <AlertCircle size={11} /> {room.overdueCount} overdue
            </span>
          )}
          {room.pendingCount > 0 && (
            <span className="fin-badge fin-badge--pending">
              <Clock size={11} /> {room.pendingCount} pending
            </span>
          )}
        </div>

        <span className="fin-room-row__total">{fmtCurrency(room.totalOwed)}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded tenant list */}
      {open && (
        <div className="fin-room-row__body">
          <table className="fin-tenant-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Billing Month</th>
                <th>Due</th>
                <th>Status</th>
                <th>Amount Owed</th>
              </tr>
            </thead>
            <tbody>
              {room.tenants.map((t, i) => (
                <tr key={i}>
                  <td>{t.name}</td>
                  <td>
                    {t.billingMonth
                      ? new Date(t.billingMonth).toLocaleDateString("en-PH", {
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td>{fmtDate(t.dueDate)}</td>
                  <td><StatusChip status={t.status} /></td>
                  <td className="fin-tenant-table__amount">{fmtCurrency(t.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fin-room-row__actions">
            <button
              className="fin-room-row__billing-link"
              onClick={() => navigate("/admin/billing")}
            >
              Open Billing <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function FinancialPage() {
  const { user } = useAuth();
  const [branch, setBranch] = useState("all");
  const { data, isLoading, isError, refetch, isFetching } = useFinancialOverview(
    branch === "all" ? undefined : branch,
  );

  const kpis = data?.kpis || {};
  const rooms = data?.rooms || [];

  const summaryItems = [
    {
      label: "Total Outstanding",
      value: fmtCurrency(kpis.totalOwed),
      color: kpis.totalOwed > 0 ? "red" : "green",
    },
    { label: "Overdue Bills", value: kpis.overdueCount || 0, color: "red" },
    { label: "Pending Bills", value: kpis.pendingCount || 0, color: "orange" },
    { label: "Collected (30d)", value: fmtCurrency(kpis.totalPaid30d), color: "green" },
  ];

  return (
    <PageShell>
      <PageShell.Summary>
        <SummaryBar items={summaryItems} />
      </PageShell.Summary>

      <PageShell.Content>
        {/* Header toolbar */}
        <div className="fin-toolbar">
          <div className="fin-toolbar__left">
            <h2 className="fin-toolbar__title">
              <BarChart2 size={18} />
              Financial Overview
            </h2>
            {user?.role === "owner" && (
              <select
                className="fin-branch-select"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="all">All Branches</option>
                <option value="branch-a">Branch A</option>
                <option value="branch-b">Branch B</option>
              </select>
            )}
          </div>
          <button
            className="fin-toolbar__refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw size={14} className={isFetching ? "fin-spin" : ""} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Error state */}
        {isError && (
          <div className="fin-error">
            <AlertCircle size={16} /> Failed to load financial data. Try refreshing.
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="fin-room-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="fin-room-skeleton" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && rooms.length === 0 && (
          <div className="fin-empty">
            <CheckCircle size={40} />
            <h3>All Clear</h3>
            <p>No outstanding balances found
              {branch !== "all" ? ` for ${formatBranch(branch)}` : ""}.
            </p>
          </div>
        )}

        {/* Room list */}
        {!isLoading && rooms.length > 0 && (
          <>
            <div className="fin-section-header">
              <span>Rooms with Outstanding Balances</span>
              <span className="fin-section-header__count">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="fin-room-list">
              {rooms.map((room) => (
                <RoomRow key={String(room.roomId)} room={room} />
              ))}
            </div>
          </>
        )}
      </PageShell.Content>
    </PageShell>
  );
}
