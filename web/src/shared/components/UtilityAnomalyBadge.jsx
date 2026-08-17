import { AlertTriangle, RotateCcw, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Visual badge indicator for utility sub-meter anomalies and cost-shielding warnings.
 *
 * @param {Object} props
 * @param {boolean} [props.isRollover] - Meter rollover detected
 * @param {boolean} [props.isSpike] - High consumption spike warning
 * @param {number} [props.spikeThreshold] - Threshold in kWh triggering spike warning (default 1500)
 * @param {number} [props.vacantBedOverhead] - Amount absorbed by owner for vacant beds
 * @param {string} [props.className] - Optional container CSS class override
 */
export default function UtilityAnomalyBadge({
  isRollover = false,
  isSpike = false,
  spikeThreshold = 1500,
  vacantBedOverhead = 0,
  className = "",
}) {
  if (!isRollover && !isSpike && !vacantBedOverhead) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-transparent text-emerald-600 dark:text-emerald-400 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Normal Consumption
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {isRollover && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-transparent text-sky-600 dark:text-sky-400">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Meter Rollover
        </span>
      )}

      {isSpike && (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-transparent text-amber-600 dark:text-amber-400"
          title={`Abnormal consumption spike exceeding ${spikeThreshold} kWh threshold`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Consumption Spike (&gt;{spikeThreshold} kWh)
        </span>
      )}

      {vacantBedOverhead > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-transparent text-slate-700 dark:text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Owner Absorbed: ₱{vacantBedOverhead.toLocaleString()}
        </span>
      )}
    </div>
  );
}
