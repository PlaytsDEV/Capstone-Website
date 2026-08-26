import { useState } from "react";
import {
  Receipt,
  Users,
  Shield,
  RefreshCw,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  LogOut,
  Trash2,
  Skull,
  ClipboardList,
  CheckCircle,
} from "lucide-react";
import DeadlineBadge from "../../../../../shared/components/DeadlineBadge";
import { formatBedPosition } from "../../../../../shared/utils/bedIdentifier";
import { formatMoney } from "./tenantDetailConstants";

export default function TenantDetailModalSidebar({
  tenant,
  masterLedgerData,
  paymentConfig,
  paymentStatus,
  calculatedDueDate,
  attachedDocs = [],
  onOpenDocsPanel,
  onTriggerDialog,
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);

  return (
    <div className="lg:col-span-4 space-y-4">
      {/* Main Financial Ledger Hero Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Main Financial Ledger
          </span>
          {paymentConfig && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${paymentConfig.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${paymentConfig.dot}`} />
              <span>{paymentConfig.label}</span>
            </div>
          )}
        </div>

        {/* Primary Balance with Minimal Breakdown */}
        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground font-medium">Current Balance</span>
            <span
              className={`text-xl font-bold font-mono ${
                masterLedgerData?.totalBalance > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formatMoney(masterLedgerData?.totalBalance)}
            </span>
          </div>

          {/* Minimal Breakdown */}
          {masterLedgerData?.totalBalance > 0 ? (
            <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
              {masterLedgerData.items
                .filter((it) => it.balance > 0)
                .map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between text-muted-foreground"
                  >
                    <span className="truncate">{it.title}</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono shrink-0 ml-2">
                      {formatMoney(it.balance)}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="pt-2 border-t border-border/40 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle className="w-3 h-3 shrink-0" />
              <span>All active charges settled in full</span>
            </div>
          )}
        </div>

        {/* Due Date & Deadline if applicable */}
        {calculatedDueDate && masterLedgerData?.totalBalance > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Payment Due</span>
            <span className="font-medium text-foreground">{calculatedDueDate}</span>
          </div>
        )}

        {(calculatedDueDate || paymentStatus === "overdue") && (
          <div className="pt-1">
            <DeadlineBadge
              dueDate={calculatedDueDate}
              status={paymentStatus}
              type="bill"
              showConsequenceNote={false}
              penaltyRate={50}
            />
          </div>
        )}
      </div>

      {/* Basic Tenant & Room Assignment Card */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          Tenant & Room Details
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Branch</span>
            <span className="font-medium text-foreground">{tenant.branch || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room</span>
            <span className="font-medium text-foreground">{tenant.room || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bed Position</span>
            <span className="font-medium text-foreground">
              {String(tenant.roomType || tenant.room || "").toLowerCase().includes("private") ||
              String(tenant.bed || "").toLowerCase().includes("private") ||
              String(tenant.bed || "").toLowerCase().includes("entire")
                ? "Private Room"
                : formatBedPosition(tenant.bed)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Move-in Date</span>
            <span className="font-medium text-foreground">
              {tenant.moveInDate || tenant.moveIn || "N/A"}
            </span>
          </div>
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emergency Contact</span>
              <span className="font-medium text-foreground">
                {tenant.emergencyContact || "Not provided"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Emergency Phone</span>
              <span className="font-medium text-foreground">
                {tenant.emergencyPhone || "Not provided"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Relationship</span>
              <span className="font-medium text-foreground">
                {tenant.emergencyRelationship || "Not provided"}
              </span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-border/40">
            <button
              type="button"
              onClick={onOpenDocsPanel}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted hover:border-border-strong text-xs font-medium transition-colors cursor-pointer"
              title="Navigate to and expand attached application documents"
            >
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Application & Docs
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                {attachedDocs.length} Docs
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Operations Panel */}
      {tenant.reservationId && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Quick Operations
          </h4>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              onClick={() => onTriggerDialog("renew")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Extend Stay
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2.5 text-xs font-semibold hover:bg-muted hover:border-border-strong transition-colors cursor-pointer"
              onClick={() => onTriggerDialog("transfer")}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
              Transfer Room
            </button>

            {/* Guarded Actions Dropdown Accordion */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
              >
                <span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                  Danger & Account Actions
                </span>
                {showMoreActions ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showMoreActions && (
                <div className="mt-2 space-y-1.5 pt-1">
                  <button
                    type="button"
                    className="group w-full flex items-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2 text-xs font-medium hover:bg-muted hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors shadow-2xs cursor-pointer"
                    onClick={() => onTriggerDialog("moveOut")}
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    Move Out Tenant
                  </button>
                  <button
                    type="button"
                    className="group w-full flex items-center gap-2 rounded-lg border border-border bg-card text-foreground px-3 py-2 text-xs font-medium hover:bg-muted hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors shadow-2xs cursor-pointer"
                    onClick={() => onTriggerDialog("deleteTenant")}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    Delete Tenant Record
                  </button>
                  {tenant.isOwnerViewing && (
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-semibold transition-colors shadow-sm cursor-pointer mt-1"
                      onClick={() => onTriggerDialog("forceDelete")}
                    >
                      <Skull className="w-3.5 h-3.5 shrink-0" />
                      Force Delete Account
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
