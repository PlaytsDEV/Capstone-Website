import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BellRing,
  ShieldAlert,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
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
 * Features:
 * - Dynamic Contextual KPIs (Notice metrics vs. Case metrics)
 * - URL Search Parameter synchronization (?subtab=notices | termination)
 * - Streamlined single-tier sub-navigation
 * - Full Lilycrest DMS design token compliance
 */
export default function OverdueEscalationTab({ branch }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get("subtab");
  const activeSubTab = subtabParam === "termination" ? "termination" : "notices";

  const handleSubTabChange = useCallback(
    (nextSubTab) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("subtab", nextSubTab);
      setSearchParams(nextParams, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  // Live count states for badges & top overview
  const [noticeStats, setNoticeStats] = useState({
    totalExposure: 0,
    overdueAccounts: 0,
    pendingNotice1Count: 0,
    notice1ActiveCount: 0,
    notice2ActiveCount: 0,
    notice3FinalCount: 0,
  });

  const [terminationStats, setTerminationStats] = useState({
    totalCases: 0,
    activeCases: 0,
    pendingAdjudication: 0,
    paymentPlans: 0,
    approvedEvictions: 0,
    totalFrozenExposure: 0,
  });

  const [loadingSummary, setLoadingSummary] = useState(false);
  const fetchIdRef = useRef(0);

  // Cross-view handoff state for opening a termination case from Notice 3
  const [prefilledCaseData, setPrefilledCaseData] = useState(null);

  const fetchSummaryCounts = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    try {
      setLoadingSummary(true);
      const params = {};
      if (branch && branch !== "all") params.branch = branch;

      const [noticesRes, casesRes] = await Promise.allSettled([
        billingApi.getOverdueNotices(params),
        billingApi.getTerminationCases(params),
      ]);

      if (currentFetchId !== fetchIdRef.current) return;

      const noticesData = noticesRes.status === "fulfilled" ? noticesRes.value : null;
      const casesData = casesRes.status === "fulfilled" ? casesRes.value : null;

      const nStats = noticesData?.stats || {};
      const overdueList = Array.isArray(noticesData?.data) ? noticesData.data : Array.isArray(noticesData) ? noticesData : [];
      const casesList = Array.isArray(casesData?.data) ? casesData.data : Array.isArray(casesData) ? casesData : [];

      setNoticeStats({
        totalExposure: nStats.totalExposure || 0,
        overdueAccounts: nStats.overdueAccounts || overdueList.length,
        pendingNotice1Count: nStats.pendingNotice1Count || 0,
        notice1ActiveCount: nStats.notice1ActiveCount || 0,
        notice2ActiveCount: nStats.notice2ActiveCount || 0,
        notice3FinalCount: nStats.notice3FinalCount || 0,
      });

      // Compute termination metrics
      let activeCount = 0;
      let pendingCount = 0;
      let planCount = 0;
      let evictionCount = 0;
      let frozenExposure = 0;

      casesList.forEach((c) => {
        const isResolved = c.status === "resolved" || c.status === "closed";
        if (!isResolved) activeCount++;

        const outcome = c.decision?.outcome || c.outcome;
        if (!outcome || outcome === "open" || outcome === "under_review" || c.status === "open") {
          pendingCount++;
        }
        if (outcome === "payment_plan_approved") {
          planCount++;
        }
        if (outcome === "termination_approved") {
          evictionCount++;
        }

        const balance = Number(c.totalOutstandingAtOpen || c.balanceSnapshot || 0);
        if (!isNaN(balance)) {
          frozenExposure += balance;
        }
      });

      setTerminationStats({
        totalCases: casesList.length,
        activeCases: activeCount,
        pendingAdjudication: pendingCount,
        paymentPlans: planCount,
        approvedEvictions: evictionCount,
        totalFrozenExposure: frozenExposure,
      });
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error("[OverdueEscalationTab] Failed to fetch summary counts:", err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoadingSummary(false);
      }
    }
  }, [branch]);

  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  const handleEscalateToTermination = (noticeItem) => {
    const tenantName = noticeItem.tenantName || "Tenant";
    const billNum = noticeItem.billNumber || String(noticeItem.billId || "").slice(-6);
    const rawDebt = Number(noticeItem.remainingAmount || noticeItem.frozenAmount || 0);
    const debtFormatted = rawDebt.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setPrefilledCaseData({
      tenantId: noticeItem.userId || noticeItem.tenantId || "",
      tenantName: tenantName,
      reservationId: noticeItem.reservationId?._id || noticeItem.reservationId || "",
      roomName: noticeItem.roomName || noticeItem.roomId || "Room",
      branch: noticeItem.branch || branch || "gil-puyat",
      billId: noticeItem.billId || noticeItem._id || "",
      billNumber: billNum,
      remainingAmount: rawDebt,
      penaltyAmount: Number(noticeItem.penaltyAmount || 0),
      daysOverdue: Number(noticeItem.daysOverdue || 0),
      triggerReason: `Delinquent overdue balance for Statement #${billNum} (₱${debtFormatted}) escalated for administrative review.`,
    });

    handleSubTabChange("termination");
  };

  const handleClearPrefilledCase = () => {
    setPrefilledCaseData(null);
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Contextual KPI Summary Cards */}
      {activeSubTab === "notices" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Total Overdue Amount
              </span>
              <DollarSign size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
              ₱{Number(noticeStats.totalExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {noticeStats.overdueAccounts || 0}
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
              {noticeStats.pendingNotice1Count || 0}
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
              {(noticeStats.notice1ActiveCount || 0) + (noticeStats.notice2ActiveCount || 0)}
            </div>
          </div>

          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Escalated to Review
              </span>
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
              {noticeStats.notice3FinalCount || 0}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Total Frozen Exposure
              </span>
              <DollarSign size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
              ₱{Number(terminationStats.totalFrozenExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Active Review Cases
              </span>
              <ShieldAlert size={18} className="text-slate-500 dark:text-slate-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-card-foreground mt-2">
              {terminationStats.totalCases || 0}
            </div>
          </div>

          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Pending Adjudication
              </span>
              <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
              {terminationStats.pendingAdjudication || 0}
            </div>
          </div>

          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Payment Plans Active
              </span>
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
              {terminationStats.paymentPlans || 0}
            </div>
          </div>

          <div className="group relative flex flex-col justify-between min-h-[100px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                Approved Evictions
              </span>
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-2">
              {terminationStats.approvedEvictions || 0}
            </div>
          </div>
        </div>
      )}

      {/* Streamlined Sub-Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-1.5 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSubTabChange("notices")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "notices"
                ? "bg-[#0A1628] text-white shadow-xs dark:bg-slate-100 dark:text-slate-900 font-bold"
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
              {noticeStats.overdueAccounts}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("termination")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "termination"
                ? "bg-[#0A1628] text-white shadow-xs dark:bg-slate-100 dark:text-slate-900 font-bold"
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
              {terminationStats.totalCases}
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

