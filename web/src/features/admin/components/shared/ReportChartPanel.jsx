import React from "react";

/**
 * ReportChartPanel - Standardized chart card container across Analytics tabs.
 * Adheres strictly to the Lilycrest DMS Overview design:
 * - 10px rounded border, solid card surface
 * - Clean dual-line header (bold title + muted subtitle on left, actions on right)
 * - Clean body container with proper chart height handling
 */
export default function ReportChartPanel({
  title,
  subtitle = null,
  actions = null,
  children,
  className = "",
}) {
  return (
    <section
      className={`report-chart-panel bg-card rounded-[10px] border border-border overflow-hidden flex flex-col h-full ${className}`}
    >
      <header className="report-chart-panel__header px-4 pt-3.5 pb-0 flex justify-between items-start gap-3">
        <div className="report-chart-panel__copy flex-1">
          <h2 className="report-chart-panel__title text-[14px] font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="report-chart-panel__subtitle text-[12px] text-muted-foreground mt-0.5 font-normal">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="report-chart-panel__actions flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="report-chart-panel__body p-4 flex-1 flex flex-col justify-center relative">
        {children}
      </div>
    </section>
  );
}
