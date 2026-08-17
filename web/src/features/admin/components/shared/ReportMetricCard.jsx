import React from "react";
import {
  Bed,
  CheckCircle2,
  Clock,
  DollarSign,
  PhilippinePeso,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

/**
 * ReportMetricCard - Standardized KPI card across all Analytics tabs.
 * Adheres strictly to the Lilycrest DMS Overview design:
 * - Rounded square icon badge with soft tint background
 * - Uppercase tracked label (11px, muted slate)
 * - High-contrast bold stat numeral (24px, foreground)
 * - Semantic delta indicator (↑ 5.2% vs prev period) or supporting note
 */
export default function ReportMetricCard({
  icon: CustomIcon = null,
  label,
  value,
  trend = null,
  change = null,
  changeType = null,
  note = null,
  tone = "blue",
  anomalyBadge = null,
  onClick = null,
  className = "",
}) {
  const toneClasses = {
    blue: {
      badge: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
      defaultIcon: Bed,
    },
    green: {
      badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      defaultIcon: PhilippinePeso,
    },
    amber: {
      badge: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
      defaultIcon: Clock,
    },
    purple: {
      badge: "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
      defaultIcon: Wrench,
    },
    teal: {
      badge: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400",
      defaultIcon: CheckCircle2,
    },
    rose: {
      badge: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
      defaultIcon: TrendingDown,
    },
    indigo: {
      badge: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
      defaultIcon: Users,
    },
  };

  const currentTone = toneClasses[tone] || toneClasses.blue;
  const IconComponent = CustomIcon || currentTone.defaultIcon;
  const clickable = typeof onClick === "function";

  // Determine trend / change content
  const displayChange = change || trend || note;
  const isUp =
    changeType === "up" ||
    (typeof displayChange === "string" &&
      (displayChange.includes("↑") || displayChange.includes("+")));
  const isDown =
    changeType === "down" ||
    (typeof displayChange === "string" &&
      (displayChange.includes("↓") || displayChange.includes("-")));

  let changeColor = "text-muted-foreground";
  if (isUp) changeColor = "text-emerald-600 dark:text-emerald-400 font-medium";
  if (isDown) changeColor = "text-rose-600 dark:text-rose-400 font-medium";

  return (
    <article
      className={`bg-card rounded-[10px] border border-border p-4 transition-all duration-200 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 ${
        clickable
          ? "cursor-pointer active:scale-[0.99]"
          : "cursor-default"
      } ${className}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div>
        {/* Top-left rounded icon badge + optional anomaly badge */}
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div
            className={`w-7 h-7 rounded-[6px] flex items-center justify-center text-sm ${currentTone.badge}`}
          >
            {React.isValidElement(IconComponent) ? (
              IconComponent
            ) : (
              <IconComponent size={15} strokeWidth={1.75} />
            )}
          </div>

          {anomalyBadge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-tight border ${
                anomalyBadge.severity === "danger"
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800"
                  : anomalyBadge.severity === "warning"
                  ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                  : anomalyBadge.severity === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
              }`}
              title={anomalyBadge.tooltip || anomalyBadge.label}
            >
              {anomalyBadge.label || anomalyBadge.text}
            </span>
          )}
        </div>

        {/* Label */}
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] mb-1.5 line-clamp-1">
          {label}
        </div>

        {/* Value */}
        <div className="text-[24px] font-semibold text-foreground tracking-tight leading-none mb-1">
          {value ?? "—"}
        </div>
      </div>

      {/* Sub-metric Delta / Note */}
      {displayChange ? (
        <div className={`text-[11px] flex items-center gap-1 mt-1 ${changeColor}`}>
          {typeof displayChange === "object" && displayChange.text
            ? displayChange.text
            : displayChange}
        </div>
      ) : null}
    </article>
  );
}
