import React, { useMemo } from "react";
import { CreditCard, Droplets, Zap, Home, AlertTriangle, ShieldAlert } from "lucide-react";
import AdminPageHeader from "../../../../../shared/components/AdminPageHeader";
import { ExportButtons } from "../../../pages/analyticsTabShared";

const UTILITY_BRANCHES = [
  { value: "gil-puyat", label: "Gil Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const TABS = [
  { id: "electricity",          label: "Electricity",          icon: Zap },
  { id: "water",                label: "Water",                icon: Droplets },
  { id: "rent",                 label: "Rent",                 icon: Home },
  { id: "reservation-payments", label: "Reservation Payments", icon: CreditCard },
  { id: "overdue-notices",      label: "Overdue Notices",      icon: AlertTriangle },
  { id: "violations",           label: "Violations & Log",      icon: ShieldAlert },
];

export default function BillingToolbar({
  activeTab,
  onTabChange,
  branchFilter,
  onBranchChange,
  preset = "all",
  onPresetChange,
  isOwner,
  user,
  onExportCsv,
  onExportPdf,
  isExporting,
}) {
  const effectiveBranch = isOwner ? branchFilter : (user?.branch || "");
  const branchLabel =
    UTILITY_BRANCHES.find((b) => b.value === user?.branch)?.label ?? user?.branch;

  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      if (effectiveBranch === "guadalupe" && (tab.id === "electricity" || tab.id === "water")) {
        return false;
      }
      return true;
    });
  }, [effectiveBranch]);

  const controls = (
    <div className="flex flex-wrap items-center gap-2.5">
      {isOwner ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Branch:</span>
          <select
            value={branchFilter}
            onChange={(e) => onBranchChange?.(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
            aria-label="Filter billing workspace by branch"
            title="Filter workspace data by dormitory branch"
          >
            <option value="">All branches</option>
            {UTILITY_BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      ) : user?.branch ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Branch:</span>
          <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-card-foreground">
            {branchLabel}
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Range:</span>
        <select
          value={preset}
          onChange={(e) => onPresetChange?.(e.target.value)}
          className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
          aria-label="Filter export by preset date range"
          title="Filter export data by pre-set date ranges"
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="60d">Last 60 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last 1 year</option>
          <option value="2y">Last 2 years</option>
        </select>
      </div>
    </div>
  );

  const actions = (onExportCsv || onExportPdf) ? (
    <ExportButtons
      onCsv={onExportCsv}
      onPdf={onExportPdf}
      disabled={isExporting}
      loading={isExporting}
    />
  ) : null;

  return (
    <AdminPageHeader
      title="Billing"
      subtitle="Generate statements, review balances, and follow payment progress across dormitory rooms."
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      controls={controls}
      actions={actions}
      ariaLabel="Billing category tabs"
    />
  );
}




