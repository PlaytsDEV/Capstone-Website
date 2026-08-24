import React from "react";

export default function RoomBedHistoryDrawerSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Summary KPI Strip Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl p-3.5 border border-border/40"></div>
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl p-3.5 border border-border/40"></div>
      </div>

      {/* Accordion Skeletons */}
      <div className="space-y-3 pt-2">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-2"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl border border-border/40"></div>
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl border border-border/40"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl border border-border/40"></div>
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl border border-border/40"></div>
      </div>
    </div>
  );
}
