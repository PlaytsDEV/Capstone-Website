import {
  Zap,
  Home,
  Droplets,
  ShieldAlert,
  AlertOctagon,
  FileText,
  Receipt,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
} from "lucide-react";
import {
  WARNING_DETAILS_MAP,
  formatDate,
  formatMoney,
} from "./tenantDetailConstants";

export default function WarningCard({ warning, onAction, tenant }) {
  const isOverdue =
    warning.severity === "high" ||
    String(warning.code || "").startsWith("overdue_") ||
    warning.type === "overdue_balance";
  const isViolation = warning.code === "tenant_violation" || warning.category === "violation";
  const isElectricity =
    warning.code === "overdue_electricity" ||
    warning.code === "outstanding_electricity" ||
    warning.category === "electricity";
  const isRent =
    warning.code === "overdue_rent" ||
    warning.code === "outstanding_rent" ||
    warning.category === "rent";
  const isWater =
    warning.code === "overdue_water" ||
    warning.code === "outstanding_water" ||
    warning.category === "water";
  const isPenalty = warning.code === "overdue_penalty" || warning.category === "penalty";
  const isLease =
    warning.code === "lease_expired" ||
    warning.code === "lease_expiring_soon" ||
    warning.category === "contract";
  const isProof =
    warning.code === "pending_payment_verification" || warning.category === "payment";

  // Semantic Icon
  const getIcon = () => {
    if (isElectricity)
      return (
        <Zap
          className={`w-4 h-4 shrink-0 ${
            isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
          }`}
        />
      );
    if (isRent)
      return (
        <Home
          className={`w-4 h-4 shrink-0 ${
            isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
          }`}
        />
      );
    if (isWater)
      return (
        <Droplets
          className={`w-4 h-4 shrink-0 ${
            isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
          }`}
        />
      );
    if (isViolation)
      return (
        <ShieldAlert
          className={`w-4 h-4 shrink-0 ${
            warning.severity === "high"
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        />
      );
    if (isPenalty)
      return <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />;
    if (isLease)
      return (
        <FileText
          className={`w-4 h-4 shrink-0 ${
            warning.code === "lease_expired"
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        />
      );
    if (isProof) return <Receipt className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    return <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  };

  // Badge Status & Dot Config
  const getBadgeConfig = () => {
    if (isOverdue) {
      return {
        text: warning.overdueDays ? `${warning.overdueDays} Days Overdue` : "Overdue",
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
      };
    }
    if (isViolation) {
      return {
        text: warning.status
          ? `Violation (${String(warning.status).replace(/_/g, " ")})`
          : "Active Violation",
        color:
          warning.severity === "high"
            ? "text-rose-700 dark:text-rose-400"
            : "text-amber-700 dark:text-amber-400",
        dot: warning.severity === "high" ? "bg-rose-500" : "bg-amber-500",
      };
    }
    if (warning.code === "lease_expired") {
      return {
        text: "Contract Expired",
        color: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
      };
    }
    if (warning.code === "lease_expiring_soon") {
      return {
        text: "Ending Soon",
        color: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
      };
    }
    if (isProof) {
      return {
        text: "Pending Verification",
        color: "text-sky-700 dark:text-sky-400",
        dot: "bg-sky-500",
      };
    }
    return {
      text: "Pending Settlement",
      color: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    };
  };

  const badge = getBadgeConfig();
  const meta = WARNING_DETAILS_MAP[warning.type] || WARNING_DETAILS_MAP[warning.code] || {};
  const rawTitle = warning.title || meta.title || warning.type || "System Warning";
  const title = rawTitle
    .replace(/^Unpaid\s+Electricity$/i, "Electricity")
    .replace(/^Unpaid\s+Water(?:\s+Share)?$/i, "Water")
    .replace(/^Unpaid\s+Rent$/i, "Rent")
    .replace(/^Unpaid\s+Balance$/i, "Outstanding Balance")
    .replace(/^Unpaid\s+/i, "");

  return (
    <div className="p-4 rounded-xl transition-all bg-card border border-border shadow-2xs hover:border-slate-300 dark:hover:border-slate-700">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {getIcon()}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-bold text-xs text-foreground truncate">
              {title}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-transparent border border-slate-200 dark:border-slate-700 ${badge.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              <span className="capitalize">{badge.text}</span>
            </span>
          </div>
        </div>

        {warning.amount != null && Number(warning.amount) > 0 && (
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
            {formatMoney(warning.amount)}
          </span>
        )}
      </div>

      {/* Main Context / Description */}
      <div className="text-xs text-muted-foreground mt-2 leading-relaxed pl-6.5">
        {warning.message || warning.details || meta.details}
      </div>

      {/* Itemized Context Badges & Metadata */}
      <div className="mt-3 pl-6.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        {(warning.dueDate || warning.date) && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Due Date: <strong className="text-foreground font-medium">{warning.dueDate || warning.date}</strong></span>
          </div>
        )}
        {warning.dateOfIncident && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Incident Date: <strong className="text-foreground font-medium">{formatDate(warning.dateOfIncident)}</strong></span>
          </div>
        )}
        {warning.location && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Location: <strong className="text-foreground font-medium">{warning.location}</strong></span>
          </div>
        )}
        {warning.penaltyAmount != null && Number(warning.penaltyAmount) > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Violation Fine: <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatMoney(warning.penaltyAmount)}</strong></span>
          </div>
        )}
        {isOverdue && !isViolation && (
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Daily Penalty: ₱50/day</span>
          </div>
        )}
      </div>

      {/* Quick Action Footer */}
      <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap pl-6.5">
        <span className="text-[11px] text-muted-foreground italic truncate">
          {warning.recommendation ||
            meta.recommendation ||
            (isOverdue
              ? "Review billing breakdown and record payment."
              : "Review records and assist tenant.")}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {(isElectricity ||
            isRent ||
            isWater ||
            isPenalty ||
            warning.code === "overdue_balance" ||
            warning.code === "outstanding_balance" ||
            isOverdue) && (
            <button
              type="button"
              onClick={() => onAction && onAction("view_bill")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>View Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isLease && (
            <button
              type="button"
              onClick={() => onAction && onAction("renew_lease")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Renew Lease</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isViolation && (
            <button
              type="button"
              onClick={() => onAction && onAction("view_violations")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Review Violation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isProof && (
            <button
              type="button"
              onClick={() => onAction && onAction("verify_receipt")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Verify Receipt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
