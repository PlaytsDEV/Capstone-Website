import React, { useState, useEffect, useCallback } from "react";
import {
  BellRing,
  ShieldAlert,
  DollarSign,
  AlertCircle,
  Clock,
} from "lucide-react";
import OverdueNoticeTracker from "../OverdueNoticeTracker.jsx";
import TerminationReviewBoard from "../TerminationReviewBoard.jsx";
import { billingApi } from "../../../../shared/api/billingApi.js";

/**
 * OverdueEscalationTab
 *
 * Consolidated management workspace unifying:
 * 1. 3-Notice Overdue Escalation Tracker (Payment Reminders)
 * 2. Administrative Termination Review Board (Lease Reviews)
 *
 * Provides a clean segmented sub-tab switch, live summary badges,
 * and seamless cross-tab escalation handoffs.
 */
export default function OverdueEscalationTab({ branch }) {
  const [activeSubTab, setActiveSubTab] = useState("notices"); // "notices" | "termination"

  // Live count states for badges & top overview
  const [stats, setStats] = useState({
    totalExposure: 0,
    overdueAccounts: 0,
    pendingNotice1Count: 0,
    notice1ActiveCount: 0,
    notice2ActiveCount: 0,
    notice3FinalCount: 0,
    terminationCasesCount: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Cross-view handoff state for opening a termination case from Notice 3
  const [prefilledCaseData, setPrefilledCaseData] = useState(null);

  const fetchSummaryCounts = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = {};
      if (branch && branch !== "all") params.branch = branch;

      const [noticesRes, casesRes] = await Promise.allSettled([
        billingApi.getOverdueNotices(params),
        billingApi.getTerminationCases(params),
      ]);

      const noticesData = noticesRes.status === "fulfilled" ? noticesRes.value : null;
      const casesData = casesRes.status === "fulfilled" ? casesRes.value : null;

      const noticeStats = noticesData?.stats || {};
      const overdueList = Array.isArray(noticesData?.data) ? noticesData.data : Array.isArray(noticesData) ? noticesData : [];
      const casesList = Array.isArray(casesData?.data) ? casesData.data : Array.isArray(casesData) ? casesData : [];

      setStats({
        totalExposure: noticeStats.totalExposure || 0,
        overdueAccounts: noticeStats.overdueAccounts || overdueList.length,
        pendingNotice1Count: noticeStats.pendingNotice1Count || 0,
        notice1ActiveCount: noticeStats.notice1ActiveCount || 0,
        notice2ActiveCount: noticeStats.notice2ActiveCount || 0,
        notice3FinalCount: noticeStats.notice3FinalCount || 0,
        terminationCasesCount: casesList.length,
      });
    } catch (err) {
      console.error("[OverdueEscalationTab] Failed to fetch summary counts:", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [branch]);

  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  const handleEscalateToTermination = (noticeItem) => {
    const tenantName = noticeItem.tenantName || "Tenant";
    const billNum = noticeItem.billNumber || String(noticeItem.billId || "").slice(-6);
    const debtAmount = Number(noticeItem.remainingAmount || noticeItem.frozenAmount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setPrefilledCaseData({
      tenantId: noticeItem.userId || noticeItem.tenantId || "",
      tenantName: tenantName,
      reservationId: noticeItem.reservationId?._id || noticeItem.reservationId || "",
      triggerReason: `Notice 3 (Final Demand) period elapsed without settlement for Statement #${billNum}. Outstanding overdue balance: ₱${debtAmount}.`,
    });

    setActiveSubTab("termination");
  };

  const handleClearPrefilledCase = () => {
    setPrefilledCaseData(null);
  };

  return (
    <div className="space-y-4">
      {/* Top 5 KPI Summary Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Overdue Amount
            </span>
            <DollarSign size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            ₱{Number(stats.totalExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Overdue Accounts
            </span>
            <AlertCircle size={18} className="text-slate-500 dark:text-slate-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-card-foreground mt-2">
            {stats.overdueAccounts || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Needs 1st Reminder
            </span>
            <Clock size={18} className="text-sky-600 dark:text-sky-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 mt-2">
            {stats.pendingNotice1Count || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              2nd Notice Urgent
            </span>
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
            {stats.notice1ActiveCount || stats.notice2ActiveCount || 0}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Final Notice Critical
            </span>
            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            {stats.notice3FinalCount || 0}
          </div>
        </div>
      </div>

      {/* Segmented Sub-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab("notices")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeSubTab === "notices"
                ? "bg-[#0A1628] text-white shadow-xs dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            <BellRing size={14} className={activeSubTab === "notices" ? "text-amber-400 dark:text-amber-600" : "text-muted-foreground"} />
            <span>Notice Escalation</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeSubTab === "notices"
                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {stats.overdueAccounts}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("termination")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeSubTab === "termination"
                ? "bg-[#0A1628] text-white shadow-xs dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            <ShieldAlert size={14} className={activeSubTab === "termination" ? "text-rose-400 dark:text-rose-600" : "text-muted-foreground"} />
            <span>Termination Review Board</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeSubTab === "termination"
                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {stats.terminationCasesCount}
            </span>
          </button>
        </div>
      </div>

      {/* Active Sub-Tab View */}
      {activeSubTab === "notices" ? (
        <OverdueNoticeTracker
          branch={branch}
          onEscalateToTermination={handleEscalateToTermination}
          onNoticesUpdated={fetchSummaryCounts}
          hideTopKpiCards={true}
        />
      ) : (
        <TerminationReviewBoard
          branch={branch}
          prefilledCaseData={prefilledCaseData}
          onClearPrefilledCase={handleClearPrefilledCase}
          onCasesUpdated={fetchSummaryCounts}
        />
      )}
    </div>
  );
}
