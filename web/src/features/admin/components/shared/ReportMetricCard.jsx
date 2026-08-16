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
      className={`bg-card rounded-[10px] border border-border p-4 transition-all duration-150 flex flex-col justify-between ${
        clickable
          ? "cursor-pointer hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]"
          : ""
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
        {/* Top-left rounded icon badge */}
        <div
          className={`w-7 h-7 rounded-[6px] mb-2.5 flex items-center justify-center text-sm ${currentTone.badge}`}
        >
          {React.isValidElement(IconComponent) ? (
            IconComponent
          ) : (
            <IconComponent size={15} strokeWidth={1.75} />
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
