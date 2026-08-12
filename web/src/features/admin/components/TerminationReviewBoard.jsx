import React, { useState, useEffect, useMemo } from "react";
import { ShieldAlert, RefreshCw, Search, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function TerminationReviewBoard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getTerminationCases();
      setCases(res.data || []);
    } catch (err) {
      console.error("Termination cases fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter((c) => {
      const name = String(c.tenantName || "").toLowerCase();
      const caseNum = String(c.caseNumber || c._id || "").toLowerCase();
      const reason = String(c.reason || "").toLowerCase();
      return name.includes(q) || caseNum.includes(q) || reason.includes(q);
    });
  }, [cases, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <ShieldAlert size={18} className="text-red-600" />
            Administrative Termination Review Board
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Case management and review board for notice 3 exhaustion and severe lease breaches.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case or tenant..."
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
            onClick={fetchCases}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            title="Refresh termination review cases"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Case #</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Tenant</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Reason / Triggers</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Balance Snapshot</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Board Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground italic">
                    Loading termination board cases...
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <CheckCircle2 size={24} className="text-emerald-600 mb-2" />
                      <p className="font-bold text-card-foreground">No active termination cases</p>
                      <p className="mt-0.5 text-[11px]">
                        {searchQuery ? `No cases match "${searchQuery}"` : "No pending termination cases under review."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c._id} className="group transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-semibold text-card-foreground">
                      #{c.caseNumber || String(c._id || "").slice(-6)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                          {getInitials(c.tenantName)}
                        </div>
                        <p className="font-bold text-card-foreground">{c.tenantName || "Tenant"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-medium">
                      {c.reason || "Notice 3 Exhaustion"}
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600">
                      ₱{Number(c.balanceSnapshot || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={c.outcome || "pending"} />
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
