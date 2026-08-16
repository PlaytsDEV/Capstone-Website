import { CreditCard, Droplets, Zap, Home, AlertTriangle, ShieldAlert } from "lucide-react";
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

  const visibleTabs = TABS.filter((tab) => {
    if (effectiveBranch === "guadalupe" && (tab.id === "electricity" || tab.id === "water")) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs sm:gap-3.5">
      {/* Top Bar: Title + Branch & Range Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-800 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <Zap size={14} className="shrink-0" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-card-foreground">
            Billing Workspace
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isOwner ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Branch:</span>
              <select
                value={branchFilter}
                onChange={(e) => onBranchChange?.(e.target.value)}
                className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Branch:</span>
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-card-foreground">
                {branchLabel}
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Range:</span>
            <select
              value={preset}
              onChange={(e) => onPresetChange?.(e.target.value)}
              className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
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

          {(onExportCsv || onExportPdf) && (
            <ExportButtons
              onCsv={onExportCsv}
              onPdf={onExportPdf}
              disabled={isExporting}
              loading={isExporting}
            />
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="overflow-x-auto border-t border-border/50 pt-2.5">
        <nav
          className="inline-flex w-full min-w-max items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
          aria-label="Billing category"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`billing-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`billing-panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-950 font-bold"
                    : "text-muted-foreground hover:bg-card hover:text-card-foreground"
                }`}
                title={`Switch to ${tab.label} billing view`}
              >
                <Icon
                  size={13}
                  className={
                    isActive
                      ? "text-white dark:text-slate-950"
                      : "text-muted-foreground"
                  }
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}



