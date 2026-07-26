import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * CheckAvailabilitySkeleton — shimmer skeleton room cards shown while rooms load.
 * Renders inside <div className="ca-grid"> to match RoomCard grid dimensions.
 */
export default function CheckAvailabilitySkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="group rounded-2xl border border-border overflow-hidden bg-card flex flex-col h-full"
          style={{ pointerEvents: "none" }}
        >
          {/* Image placeholder (4:3 aspect ratio matching RoomCard) */}
          <div className="relative aspect-[4/3] w-full bg-muted">
            <SkeletonPulse width="100%" height="100%" borderRadius="0" />
          </div>

          {/* Card body */}
          <div className="p-4 flex flex-col flex-1 gap-2.5">
            {/* Header row: Branch tag & Room Type */}
            <div className="flex items-center justify-between mb-0.5">
              <SkeletonPulse width="72px" height="20px" borderRadius="999px" />
              <SkeletonPulse width="88px" height="14px" />
            </div>

            {/* Room Name */}
            <SkeletonPulse width="65%" height="20px" />

            {/* Bed availability dots row */}
            <div className="flex items-center gap-1.5 my-1">
              <SkeletonPulse width="10px" height="10px" variant="circle" />
              <SkeletonPulse width="10px" height="10px" variant="circle" />
              <SkeletonPulse width="10px" height="10px" variant="circle" />
              <SkeletonPulse width="10px" height="10px" variant="circle" />
              <SkeletonPulse width="90px" height="12px" style={{ marginLeft: 6 }} />
            </div>

            {/* Price section & View Details button */}
            <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
              <div className="space-y-1">
                <SkeletonPulse width="64px" height="11px" />
                <SkeletonPulse width="96px" height="22px" />
              </div>
              <SkeletonPulse width="92px" height="32px" borderRadius="8px" />
            </div>
          </div>
        </article>
      ))}
    </>
  );
}
