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
      return "text-rose-600 dark:text-rose-400";
    }
    if (normPriority === "urgent") {
      return "text-amber-600 dark:text-amber-400";
    }
    if (normPriority === "high") {
      return "text-amber-700 dark:text-amber-400";
    }
    return "text-slate-600 dark:text-slate-400";
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider bg-transparent ${getPriorityStyle()}`}>
        {isEmergency || normPriority === "emergency" ? (
          <Zap className="w-3.5 h-3.5 text-rose-500" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        {isEmergency ? "Emergency" : normPriority}
      </span>

      {isEscalated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-transparent text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5" /> Timeline Escalated
        </span>
      )}

      {isTenantDamage && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-transparent text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-3.5 h-3.5" /> Tenant Damage Billable
        </span>
      )}
    </div>
  );
}
