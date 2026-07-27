import { useState } from "react";
import { CreditCard, Droplets, Zap, Home } from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import UtilityBillingTab from "../components/billing/UtilityBillingTab";
import RentBillingTab from "../components/billing/RentBillingTab";
import ReservationPaymentReviewTab from "../components/billing/ReservationPaymentReviewTab";

const UTILITY_BRANCHES = [
  { value: "gil-puyat", label: "Gil Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];

const tabs = [
  { id: "electricity", label: "Electricity", icon: Zap },
  { id: "water",       label: "Water",       icon: Droplets },
  { id: "rent",        label: "Rent",        icon: Home },
  { id: "reservation-payments", label: "Reservation Payments", icon: CreditCard },
];

const AdminBillingPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [activeTab, setActiveTab] = useState("electricity");
  const [branchFilter, setBranchFilter] = useState("");

  return (
    <div>
      <header className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate statements, review balances, and follow payment progress
            without leaving the admin workspace
          </p>
        </div>

        <div
          className="flex flex-col gap-4 rounded-xl border border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Zap size={20} style={{ color: "var(--warning-dark)", marginTop: "2px", flexShrink: 0 }} />
            <div className="min-w-0">
              <span
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--warning-dark)" }}
              >
                Billing Workspace
              </span>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                Billing Management
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create billing cycles, review results, and send charges in a few
                clear steps.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
          {isOwner ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Branch
              </span>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-muted-foreground focus:outline-none"
                style={{ outlineColor: "var(--ring)" }}
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
          ) : user?.branch ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Branch
              </span>
              <span className="rounded-lg border border-border bg-muted px-2 py-2 text-xs text-muted-foreground">
                {UTILITY_BRANCHES.find((b) => b.value === user.branch)?.label ?? user.branch}
              </span>
            </div>
          ) : null}
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1"
            role="tablist"
            aria-label="Billing type"
          >
            {tabs.map((tab) => {
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
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition"
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
                    if (!isActive) e.currentTarget.style.background = "var(--muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "";
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </header>

      <div className="mt-5 min-h-[680px]">
        <section
          role="tabpanel"
          id="billing-panel-electricity"
          aria-labelledby="billing-tab-electricity"
          className={activeTab === "electricity" ? "block" : "hidden"}
        >
          <UtilityBillingTab
            utilityType="electricity"
            isActive={activeTab === "electricity"}
            ownerBranchFilter={isOwner ? branchFilter : undefined}
            onOwnerBranchChange={isOwner ? setBranchFilter : undefined}
          />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-water"
          aria-labelledby="billing-tab-water"
          className={activeTab === "water" ? "block" : "hidden"}
        >
          <UtilityBillingTab
            utilityType="water"
            isActive={activeTab === "water"}
            ownerBranchFilter={isOwner ? branchFilter : undefined}
            onOwnerBranchChange={isOwner ? setBranchFilter : undefined}
          />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-rent"
          aria-labelledby="billing-tab-rent"
          className={activeTab === "rent" ? "block" : "hidden"}
        >
          <RentBillingTab isActive={activeTab === "rent"} />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-reservation-payments"
          aria-labelledby="billing-tab-reservation-payments"
          className={activeTab === "reservation-payments" ? "block" : "hidden"}
        >
          <ReservationPaymentReviewTab isActive={activeTab === "reservation-payments"} />
        </section>
      </div>
    </div>
  );
};

export default AdminBillingPage;
