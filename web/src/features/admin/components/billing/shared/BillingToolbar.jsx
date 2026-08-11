import { CreditCard, Droplets, Zap, Home } from "lucide-react";

const UTILITY_BRANCHES = [
  { value: "gil-puyat", label: "Gil Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const TABS = [
  { id: "electricity",          label: "Electricity",          icon: Zap },
  { id: "water",                label: "Water",                icon: Droplets },
  { id: "rent",                 label: "Rent",                 icon: Home },
  { id: "reservation-payments", label: "Reservation Payments", icon: CreditCard },
];

export default function BillingToolbar({
  activeTab,
  onTabChange,
  branchFilter,
  onBranchChange,
  isOwner,
  user,
}) {
  const branchLabel =
    UTILITY_BRANCHES.find((b) => b.value === user?.branch)?.label ?? user?.branch;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(43_64%_52%/0.15)] text-[color:var(--color-accent,#D4AF37)]">
          <Zap size={14} className="shrink-0" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-accent,#D4AF37)]">
          Billing Workspace
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isOwner ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Branch</span>
            <select
              value={branchFilter}
              onChange={(e) => onBranchChange?.(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:border-[color:var(--color-accent,#D4AF37)] focus:outline-none dark:bg-muted"
              aria-label="Filter billing workspace by branch"
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
            <span className="text-xs font-medium text-muted-foreground">Branch</span>
            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
              {branchLabel}
            </span>
          </div>
        ) : null}

        <nav
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
          aria-label="Billing category"
        >
          {TABS.map((tab) => {
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
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-amber-300 shadow-xs dark:bg-amber-400 dark:text-slate-950"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon
                  size={13}
                  className={
                    isActive
                      ? "text-[color:var(--color-accent,#D4AF37)] dark:text-slate-950"
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
