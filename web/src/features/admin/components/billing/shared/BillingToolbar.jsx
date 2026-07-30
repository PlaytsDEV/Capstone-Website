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

/**
 * BillingToolbar
 * Unified single-row control bar: branch filter (owner) + billing category tabs.
 * Replaces the previous ad-hoc header band that used color-mix gradient backgrounds.
 */
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      {/* Left: workspace context label */}
      <div className="flex min-w-0 items-center gap-2">
        <Zap size={15} style={{ color: "var(--warning-dark)", flexShrink: 0 }} />
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--warning-dark)" }}
        >
          Billing Workspace
        </span>
      </div>

      {/* Right: branch filter + tab pills */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Branch selector — owner sees dropdown, branch admin sees static badge */}
        {isOwner ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Branch</span>
            <select
              value={branchFilter}
              onChange={(e) => onBranchChange?.(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <option value="">All branches</option>
              {UTILITY_BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : branchLabel ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Branch</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {branchLabel}
            </span>
          </div>
        ) : null}

        {/* Tab pill group */}
        <div
          className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-1"
          role="tablist"
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
                aria-controls={`billing-panel-${tab.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150"
                style={
                  isActive
                    ? {
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--muted-foreground)" }
                }
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "var(--background)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "";
                }}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
