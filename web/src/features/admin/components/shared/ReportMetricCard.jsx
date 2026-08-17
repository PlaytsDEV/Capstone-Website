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
      badge: "text-sky-600 dark:text-sky-400",
      defaultIcon: Bed,
    },
    green: {
      badge: "text-emerald-600 dark:text-emerald-400",
      defaultIcon: PhilippinePeso,
    },
    amber: {
      badge: "text-amber-600 dark:text-amber-400",
      defaultIcon: Clock,
    },
    purple: {
      badge: "text-slate-500 dark:text-slate-400",
      defaultIcon: Wrench,
    },
    teal: {
      badge: "text-teal-600 dark:text-teal-400",
      defaultIcon: CheckCircle2,
    },
    rose: {
      badge: "text-rose-600 dark:text-rose-400",
      defaultIcon: TrendingDown,
    },
    indigo: {
      badge: "text-sky-600 dark:text-sky-400",
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
    (changeType !== "neutral" &&
      typeof displayChange === "string" &&
      (displayChange.includes("↑") || /(?:^|\s)\+\s*\d/.test(displayChange)));
  const isDown =
    changeType === "down" ||
    (changeType !== "neutral" &&
      typeof displayChange === "string" &&
      (displayChange.includes("↓") || /(?:^|\s)-\s*\d/.test(displayChange)));

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
            className={`flex shrink-0 items-center justify-center text-sm ${currentTone.badge}`}
          >
            {React.isValidElement(IconComponent) ? (
              IconComponent
            ) : (
              <IconComponent size={18} strokeWidth={2} />
            )}
          </div>

          {anomalyBadge && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium tracking-tight bg-transparent border border-slate-200 dark:border-slate-800"
              title={anomalyBadge.tooltip || anomalyBadge.label}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  anomalyBadge.severity === "danger"
                    ? "bg-rose-500"
                    : anomalyBadge.severity === "warning"
                    ? "bg-amber-500"
                    : anomalyBadge.severity === "success"
                    ? "bg-emerald-500"
                    : "bg-sky-500"
                }`}
              />
              <span
                className={
                  anomalyBadge.severity === "danger"
                    ? "text-rose-600 dark:text-rose-400"
                    : anomalyBadge.severity === "warning"
                    ? "text-amber-700 dark:text-amber-400"
                    : anomalyBadge.severity === "success"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-sky-700 dark:text-sky-400"
                }
              >
                {anomalyBadge.label || anomalyBadge.text}
              </span>
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
