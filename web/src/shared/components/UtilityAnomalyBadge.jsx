import { AlertTriangle, RotateCcw, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Visual badge indicator for utility sub-meter anomalies and cost-shielding warnings.
 *
 * @param {Object} props
 * @param {boolean} [props.isRollover] - Meter rollover detected
 * @param {boolean} [props.isSpike] - High consumption spike warning
 * @param {number} [props.vacantBedOverhead] - Amount absorbed by owner for vacant beds
 * @param {string} [props.className] - Optional container CSS class override
 */
export default function UtilityAnomalyBadge({
  isRollover = false,
  isSpike = false,
  vacantBedOverhead = 0,
  className = "",
}) {
  if (!isRollover && !isSpike && !vacantBedOverhead) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" /> Normal Consumption
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {isRollover && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
          <RotateCcw className="w-3.5 h-3.5" /> Meter Rollover
        </span>
      )}

      {isSpike && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" /> Consumption Spike (>1500 kWh)
        </span>
      )}

      {vacantBedOverhead > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <ShieldAlert className="w-3.5 h-3.5" /> Owner Absorbed: ₱{vacantBedOverhead.toLocaleString()}
        </span>
      )}
    </div>
  );
}
