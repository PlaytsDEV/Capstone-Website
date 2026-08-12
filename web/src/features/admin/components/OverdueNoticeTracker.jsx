import React, { useState, useEffect, useMemo } from "react";
import { BellRing, RefreshCw, Search, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function OverdueNoticeTracker() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getOverdueNotices();
      setNotices(res.data || []);
    } catch (err) {
      console.error("Notices fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSendNotice = async (billId, noticeType) => {
    try {
      setDispatchLoading(`${billId}-${noticeType}`);
      await billingApi.sendOverdueNotice(billId, noticeType);
      await fetchNotices();
    } catch (err) {
      alert(err.message || "Failed to dispatch overdue notice.");
    } finally {
      setDispatchLoading(null);
    }
  };

  const filteredNotices = useMemo(() => {
    if (!searchQuery.trim()) return notices;
    const q = searchQuery.toLowerCase();
    return notices.filter((n) => {
      const name = String(n.tenantName || "").toLowerCase();
      const room = String(n.roomId || "").toLowerCase();
      const bill = String(n.billNumber || n.billId || "").toLowerCase();
      return name.includes(q) || room.includes(q) || bill.includes(q);
    });
  }, [notices, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <BellRing size={18} className="text-amber-600 dark:text-amber-400" />
            3-Notice Overdue Escalation Tracker
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Automated & manual notice delivery receipts (Notice 1 → Notice 2 → Notice 3 Final).
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenant or bill..."
              className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
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

      {/* Notices Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Tenant</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Bill #</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Latest Stage</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Frozen Overdue Balance</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Delivery Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Dispatch Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    <LoaderCircle size={20} className="animate-spin text-muted-foreground inline mb-1" /> Loading overdue notices...
                  </td>
                </tr>
              ) : filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle2 size={26} className="text-emerald-600 mb-2" />
                      <p className="font-bold text-card-foreground">No overdue notice records</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {searchQuery ? `No notices match "${searchQuery}"` : "All tenant rent balances are currently in good standing."}
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
                          <p className="text-[11px] text-muted-foreground">Room: <strong className="text-card-foreground font-semibold">{n.roomId || "N/A"}</strong></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-card-foreground">
                      #{n.billNumber || String(n.billId || "").slice(-6)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={n.noticeType || `notice_${n.noticeCount || 1}`} />
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">
                      ₱{Number(n.frozenAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground font-medium">
                      {n.deliveredAt ? (
                        <span className="text-emerald-700 font-semibold">Delivered: {new Date(n.deliveredAt).toLocaleTimeString("en-PH")}</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Pending Delivery</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSendNotice(n.billId, "notice_1")}
                          disabled={dispatchLoading === `${n.billId}-notice_1`}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50"
                          title="Dispatch Notice 1: Friendly Payment Reminder"
                        >
                          N1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendNotice(n.billId, "notice_2")}
                          disabled={dispatchLoading === `${n.billId}-notice_2`}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 active:scale-[0.98] disabled:opacity-50"
                          title="Dispatch Notice 2: Urgent Demand Notice"
                        >
                          N2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendNotice(n.billId, "notice_3")}
                          disabled={dispatchLoading === `${n.billId}-notice_3`}
                          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-red-300 bg-red-600 text-[11px] font-semibold text-white hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
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
    </div>
  );
}
