import React from "react";

/**
 * PeriodComparisonCard - Standardized period-over-period comparative list panel.
 * Displays key indicators compared against the previous period with semantic delta badges.
 */
export default function PeriodComparisonCard({
  title = "Period comparison",
  subtitle = "Current vs previous period",
  rows = [],
  className = "",
}) {
  return (
    <div
      className={`bg-card rounded-[10px] border border-border overflow-hidden flex flex-col h-full ${className}`}
    >
      <div className="px-4 pt-3.5 pb-2">
        <div className="text-[14px] font-semibold text-foreground tracking-tight">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </div>
      <div className="p-4 pt-1 flex-1 flex flex-col justify-around">
        {rows.map((row, idx) => {
          const isUp =
            row.changeType === "up" ||
            (row.changeType !== "neutral" &&
              typeof row.change === "string" &&
              (row.change.includes("↑") || /(?:^|\s)\+\s*\d/.test(row.change)));
          const isDown =
            row.changeType === "down" ||
            (row.changeType !== "neutral" &&
              typeof row.change === "string" &&
              (row.change.includes("↓") || /(?:^|\s)-\s*\d/.test(row.change)));

          let changeColor = "text-muted-foreground";
          if (isUp) changeColor = "text-emerald-600 dark:text-emerald-400";
          if (isDown) changeColor = "text-rose-600 dark:text-rose-400";

          return (
            <div
              key={row.id || idx}
              className={`flex items-center justify-between py-2.5 ${
                idx < rows.length - 1 ? "border-b border-border/60" : ""
              }`}
            >
              <div>
                <div className="text-[13px] font-medium text-foreground">{row.label}</div>
                {row.sublabel && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {row.sublabel}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold text-foreground leading-tight">
                  {row.value ?? "—"}
                </div>
                {row.change && (
                  <div className={`text-[11px] font-medium mt-0.5 ${changeColor}`}>
                    {row.change}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
