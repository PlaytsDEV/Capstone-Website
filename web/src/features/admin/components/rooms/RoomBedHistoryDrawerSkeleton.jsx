import React from "react";

export default function RoomBedHistoryDrawerSkeleton() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      {/* Drawer Header Skeleton */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="h-6 w-48 bg-muted rounded"></div>
        <div className="h-8 w-8 bg-muted rounded-full"></div>
      </div>

      {/* Summary KPI Strip Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 bg-muted rounded-lg p-3"></div>
        <div className="h-16 bg-muted rounded-lg p-3"></div>
      </div>

      {/* Accordion Skeletons */}
      <div className="space-y-3 pt-2">
        <div className="h-12 bg-muted rounded-lg"></div>
        <div className="h-32 bg-muted rounded-lg"></div>
        <div className="h-12 bg-muted rounded-lg"></div>
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    </div>
  );
}
