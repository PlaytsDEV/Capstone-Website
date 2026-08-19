import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  DoorOpen,
  MessageSquare,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import "../../styles/admin-shift-triage.css";

export default function AdminShiftTriageCenter({
  triage = {},
  isLoading = false,
}) {
  const navigate = useNavigate();

  const {
    unverifiedPayments = 0,
    expiringLeases = 0,
    todayMoveIns = 0,
    todayMoveOuts = 0,
    unrespondedInquiries = 0,
    urgentMaintenance = 0,
    totalActionable = 0,
  } = triage || {};

  const triageItems = useMemo(
    () => [
      {
        id: "triage-payments",
        label: "Pending Receipts",
        count: unverifiedPayments,
        desc:
          unverifiedPayments > 0
            ? `${unverifiedPayments} payment${unverifiedPayments === 1 ? "" : "s"} to verify`
            : "All payments verified",
        icon: CreditCard,
        iconClass:
          unverifiedPayments > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-400 dark:text-slate-500",
        btnLabel: "Review Receipts",
        action: () => navigate("/admin/billing?tab=reservation-payments"),
      },
      {
        id: "triage-leases",
        label: "Expiring Leases",
        count: expiringLeases,
        desc:
          expiringLeases > 0
            ? `${expiringLeases} lease${expiringLeases === 1 ? "" : "s"} ending in 14d`
            : "No leases expiring soon",
        icon: Calendar,
        iconClass:
          expiringLeases > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-400 dark:text-slate-500",
        btnLabel: "View Leases",
        action: () => navigate("/admin/tenants?filter=expiring_soon"),
      },
      {
        id: "triage-arrivals",
        label: "Today's Check-ins",
        count: `${todayMoveIns} / ${todayMoveOuts}`,
        desc: `${todayMoveIns} move-in${todayMoveIns === 1 ? "" : "s"}, ${todayMoveOuts} departure${todayMoveOuts === 1 ? "" : "s"}`,
        icon: DoorOpen,
        iconClass:
          todayMoveIns > 0 || todayMoveOuts > 0
            ? "text-sky-600 dark:text-sky-400"
            : "text-slate-400 dark:text-slate-500",
        btnLabel: "Check Schedule",
        action: () => navigate("/admin/reservations"),
      },
      {
        id: "triage-inquiries",
        label: "Open Inquiries",
        count: unrespondedInquiries,
        desc:
          unrespondedInquiries > 0
            ? `${unrespondedInquiries} awaiting response`
            : "Inbox up to date",
        icon: MessageSquare,
        iconClass:
          unrespondedInquiries > 0
            ? "text-sky-600 dark:text-sky-400"
            : "text-slate-400 dark:text-slate-500",
        btnLabel: "Reply Inquiries",
        action: () => navigate("/admin/inquiries"),
      },
      {
        id: "triage-maintenance",
        label: "Urgent Repairs",
        count: urgentMaintenance,
        desc:
          urgentMaintenance > 0
            ? `${urgentMaintenance} high priority ticket${urgentMaintenance === 1 ? "" : "s"}`
            : "All tickets normal",
        icon: Wrench,
        iconClass:
          urgentMaintenance > 0
            ? "text-rose-600 dark:text-rose-400"
            : "text-slate-400 dark:text-slate-500",
        btnLabel: "Dispatch Now",
        action: () => navigate("/admin/maintenance?priority=high"),
      },
    ],
    [
      expiringLeases,
      navigate,
      todayMoveIns,
      todayMoveOuts,
      unrespondedInquiries,
      unverifiedPayments,
      urgentMaintenance,
    ]
  );

  return (
    <section className="shift-triage-container" aria-label="Daily Shift Triage Center">
      <div className="shift-triage-header">
        <div className="shift-triage-title-wrap">
          <Sparkles className="shift-triage-icon" aria-hidden="true" />
          <div>
            <h2 className="shift-triage-title">Daily Shift Triage Center</h2>
            <p className="shift-triage-subtitle">
              Prioritized action queues requiring administrative attention today
            </p>
          </div>
        </div>
        <div className="shift-triage-badge-pill">
          {totalActionable > 0 ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              <span>{totalActionable} items requiring attention</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-700 dark:text-emerald-300">All Shift Queues Clear</span>
            </>
          )}
        </div>
      </div>

      <div className="shift-triage-grid">
        {triageItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.id} className="shift-triage-card">
              <div>
                <div className="shift-triage-card-top">
                  <span className="shift-triage-card-label">{item.label}</span>
                  <Icon className={`shift-triage-card-icon ${item.iconClass}`} aria-hidden="true" />
                </div>
                <div className="shift-triage-card-body">
                  <div className="shift-triage-card-count">{item.count}</div>
                  <div className="shift-triage-card-desc" title={item.desc}>
                    {item.desc}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="shift-triage-card-btn"
                onClick={item.action}
              >
                <span>{item.btnLabel}</span>
                <ArrowRight size={12} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
