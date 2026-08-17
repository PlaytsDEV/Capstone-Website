import React, { useState, useEffect, useMemo } from "react";
import {
  BellRing,
  RefreshCw,
  Search,
  CheckCircle2,
  LoaderCircle,
  X,
  AlertCircle,
  Clock,
  DollarSign,
  Send,
  ShieldAlert,
} from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";
import DispatchNoticeModal from "./billing/DispatchNoticeModal.jsx";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function OverdueNoticeTracker({ branch }) {
  const [notices, setNotices] = useState([]);
  const [stats, setStats] = useState({
    totalExposure: 0,
    overdueAccounts: 0,
    pendingNotice1Count: 0,
    notice1ActiveCount: 0,
    notice2ActiveCount: 0,
    notice3FinalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all"); // all, eligible, notice_1, notice_2, notice_3

  // Modal State
  const [selectedItemForNotice, setSelectedItemForNotice] = useState(null);
  const [selectedTargetStage, setSelectedTargetStage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (branch && branch !== "all") params.branch = branch;
      if (stageFilter !== "all") params.stage = stageFilter;

      const res = await billingApi.getOverdueNotices(params);
      setNotices(res.data || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Notices fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [branch, stageFilter]);

  const handleOpenNoticeModal = (item, stage) => {
    setSelectedItemForNotice(item);
    setSelectedTargetStage(stage);
    setIsModalOpen(true);
  };

  const filteredNotices = useMemo(() => {
    if (!searchQuery.trim()) return notices;
    const q = searchQuery.toLowerCase();
    return notices.filter((n) => {
      const name = String(n.tenantName || "").toLowerCase();
      const room = String(n.roomName || n.roomId || "").toLowerCase();
      const bill = String(n.billNumber || n.billId || "").toLowerCase();
      return name.includes(q) || room.includes(q) || bill.includes(q);
    });
  }, [notices, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 text-card-foreground">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <BellRing size={18} className="text-amber-600 dark:text-amber-400" />
            3-Notice Overdue Escalation Tracker
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Formal overdue escalation state machine (Eligible → Notice 1 → Notice 2 → Notice 3 Final → Review Board).
          </p>

        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant, room, bill..."
              className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={fetchNotices}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            title="Refresh notice delivery log"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-4">
        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Overdue Debt
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
              <DollarSign size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            ₱{Number(stats.totalExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Overdue Accounts
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <AlertCircle size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {stats.overdueAccounts || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Pending Notice 1
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 mt-2">
            {stats.pendingNotice1Count || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Notice 2 Urgent
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <AlertCircle size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
            {stats.notice1ActiveCount || stats.notice2ActiveCount || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Notice 3 / Critical
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
              <ShieldAlert size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            {stats.notice3FinalCount || 0}
          </div>
        </div>
      </div>

      {/* Stage Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2 text-xs">
        <span className="text-[11px] font-bold text-muted-foreground mr-1">Stage Filter:</span>
        {[
          { key: "all", label: "All Overdue" },
          { key: "eligible", label: "Needs Notice 1 (N0)" },
          { key: "notice_1", label: "Notice 1 Sent" },
          { key: "notice_2", label: "Notice 2 Sent" },
          { key: "notice_3", label: "Notice 3 Final / Escalated" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStageFilter(tab.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              stageFilter === tab.key
                ? "bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notices Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Tenant</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Bill #</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Current Stage</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Overdue Balance</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Delivery Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Dispatch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    <LoaderCircle size={20} className="animate-spin text-muted-foreground inline mb-1" /> Loading overdue escalation records...
                  </td>
                </tr>
              ) : filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle2 size={26} className="text-emerald-600 mb-2" />
                      <p className="font-bold text-card-foreground">No overdue notice records</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {searchQuery
                          ? `No records match "${searchQuery}"`
                          : stageFilter !== "all"
                          ? "No records found for the selected stage filter."
                          : "All tenant accounts are in good standing."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNotices.map((n) => (
                  <tr key={n._id} className="group transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                          {getInitials(n.tenantName)}
                        </div>
                        <div>
                          <p className="font-bold text-card-foreground">{n.tenantName || "Tenant"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Room: <strong className="text-card-foreground font-semibold">{n.roomName || n.roomId || "N/A"}</strong> · {n.daysOverdue}d late
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-card-foreground">
                      #{n.billNumber || String(n.billId || "").slice(-6)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={n.noticeStage || `notice_${n.noticeCount || 1}`} />
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">
                      ₱{Number(n.remainingAmount || n.frozenAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-medium">
                      {n.deliveredAt ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Delivered: {new Date(n.deliveredAt).toLocaleDateString("en-PH")}
                        </span>
                      ) : n.noticeCount === 0 ? (
                        <span className="text-blue-700 dark:text-blue-400 font-medium">Eligible for Notice 1</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Pending Delivery</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenNoticeModal(n, 1)}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          title="Dispatch Notice 1: Friendly Payment Reminder"
                        >
                          N1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenNoticeModal(n, 2)}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                          title="Dispatch Notice 2: Urgent Demand Notice"
                        >
                          N2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenNoticeModal(n, 3)}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-red-300 bg-red-600 text-[11px] font-semibold text-white hover:bg-red-700 active:scale-[0.98] dark:border-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                          title="Dispatch Notice 3 (Final): Intent to Terminate"
                        >
                          N3 Final
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Notice Modal */}
      {isModalOpen && selectedItemForNotice && (
        <DispatchNoticeModal
          isOpen={isModalOpen}
          item={selectedItemForNotice}
          targetStage={selectedTargetStage}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItemForNotice(null);
          }}
          onDispatched={fetchNotices}
        />
      )}
    </div>
  );
}
