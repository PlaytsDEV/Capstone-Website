import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun,
  LogIn,
  LogOut,
  Wrench,
  CreditCard,
  BellRing,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount || 0);

export default function AdminDailyBriefingCard({ briefing, onCloseDrawer }) {
  const navigate = useNavigate();

  if (!briefing) return null;

  const stats = briefing.stats || {};
  const moveIns = briefing.moveIns || [];
  const moveOuts = briefing.moveOuts || [];
  const maintenance = briefing.maintenance || [];
  const announcements = briefing.announcements || [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-xs text-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0">
            <Sun size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-foreground">{briefing.title || "Daily Shift Briefing"}</h4>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <Calendar size={11} className="shrink-0" />
              <span>{briefing.dateString}</span>
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0 bg-transparent">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Shift Standup
        </span>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Move Ins */}
        <div className="p-2 rounded-lg bg-muted/30 border border-border space-y-0.5 text-center">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <LogIn size={11} className="text-emerald-600" />
            <span>Move-Ins</span>
          </div>
          <div className="text-base font-bold text-foreground">{stats.moveInsCount || 0}</div>
          <div className="text-[10px] text-muted-foreground">Today</div>
        </div>

        {/* Urgent Maintenance */}
        <div className="p-2 rounded-lg bg-muted/30 border border-border space-y-0.5 text-center">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <Wrench size={11} className="text-rose-600" />
            <span>Urgent Fix</span>
          </div>
          <div className={`text-base font-bold ${stats.urgentMaintenanceCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
            {stats.urgentMaintenanceCount || 0}
          </div>
          <div className="text-[10px] text-muted-foreground">Attention</div>
        </div>

        {/* Collections */}
        <div className="p-2 rounded-lg bg-muted/30 border border-border space-y-0.5 text-center">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
            <CreditCard size={11} className="text-primary" />
            <span>Collected</span>
          </div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(stats.paymentsCollectedYesterday || 0)}
          </div>
          <div className="text-[10px] text-muted-foreground">Last 24h</div>
        </div>
      </div>

      {/* Today's Expected Move-Ins */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <LogIn size={12} className="text-emerald-600" />
            <span>Expected Move-Ins Today ({moveIns.length})</span>
          </div>
        </div>

        {moveIns.length === 0 ? (
          <div className="p-2 text-center rounded bg-muted/20 text-muted-foreground text-[11px]">
            No scheduled move-ins for today.
          </div>
        ) : (
          <div className="space-y-1">
            {moveIns.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border text-[11px]">
                <div>
                  <span className="font-bold text-foreground">{m.name}</span>
                  <span className="text-muted-foreground ml-1.5">({m.roomNumber} - {m.bedId})</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Ready for Key Turnover
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Urgent Maintenance Needing Action */}
      {maintenance.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-rose-600" />
              <span>Urgent Maintenance Pending ({maintenance.length})</span>
            </div>
          </div>

          <div className="space-y-1">
            {maintenance.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-[11px]">
                <div className="truncate min-w-0 pr-2">
                  <span className="font-bold text-foreground">{item.title}</span>
                  <span className="text-muted-foreground ml-1.5">({item.roomNumber})</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  High Priority
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Branch Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <BellRing size={11} className="text-primary" />
            <span>Active Branch Notice:</span>
          </div>
          {announcements.map((ann, idx) => (
            <div key={idx} className="p-2 rounded bg-muted/20 border border-border text-[11px] text-foreground font-medium">
              📢 {ann.title}
            </div>
          ))}
        </div>
      )}

      {/* 1-Click Operations Navigation */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => {
            if (onCloseDrawer) onCloseDrawer();
            navigate("/admin/reservations");
          }}
          className="py-1.5 px-2 rounded-lg bg-card border border-border text-foreground font-semibold text-[11px] hover:bg-muted transition-colors cursor-pointer text-center"
        >
          Reservations
        </button>

        <button
          type="button"
          onClick={() => {
            if (onCloseDrawer) onCloseDrawer();
            navigate("/admin/maintenance");
          }}
          className="py-1.5 px-2 rounded-lg bg-card border border-border text-foreground font-semibold text-[11px] hover:bg-muted transition-colors cursor-pointer text-center"
        >
          Maintenance
        </button>

        <button
          type="button"
          onClick={() => {
            if (onCloseDrawer) onCloseDrawer();
            navigate("/admin/billing");
          }}
          className="py-1.5 px-2 rounded-lg bg-card border border-border text-foreground font-semibold text-[11px] hover:bg-muted transition-colors cursor-pointer text-center"
        >
          Billing Ledger
        </button>
      </div>
    </div>
  );
}
