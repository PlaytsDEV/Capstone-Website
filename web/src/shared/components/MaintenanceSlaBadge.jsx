import { AlertTriangle, Clock, Zap, ShieldAlert, CheckCircle } from "lucide-react";

/**
 * Visual SLA badge indicator for maintenance tickets.
 *
 * @param {Object} props
 * @param {string} [props.priority] - Ticket priority ("low" | "medium" | "high" | "urgent" | "emergency")
 * @param {boolean} [props.isEscalated] - Auto-escalation flag
 * @param {boolean} [props.isEmergency] - Emergency keyword / off-hours trigger
 * @param {boolean} [props.isTenantDamage] - Tenant-caused damage billing flag
 * @param {string} [props.className] - Optional container CSS class override
 */
export default function MaintenanceSlaBadge({
  priority = "medium",
  isEscalated = false,
  isEmergency = false,
  isTenantDamage = false,
  className = "",
}) {
  const normPriority = String(priority).toLowerCase();

  const getPriorityStyle = () => {
    if (isEmergency || normPriority === "emergency") {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
    if (normPriority === "urgent") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
    if (normPriority === "high") {
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
    }
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider border ${getPriorityStyle()}`}>
        {isEmergency || normPriority === "emergency" ? (
          <Zap className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        {isEmergency ? "Emergency" : normPriority}
      </span>

      {isEscalated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <AlertTriangle className="w-3.5 h-3.5" /> Timeline Escalated
        </span>
      )}

      {isTenantDamage && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <ShieldAlert className="w-3.5 h-3.5" /> Tenant Damage Billable
        </span>
      )}
    </div>
  );
}
