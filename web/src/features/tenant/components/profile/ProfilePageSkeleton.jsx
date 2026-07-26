import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * ProfilePageSkeleton — shimmer skeleton that mirrors the inner ProfilePage layout 1:1.
 * Rendered inside TenantLayout's <Outlet /> while profile data loads.
 */
export default function ProfilePageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      {/* Welcome Banner */}
      <SkeletonPulse height="100px" borderRadius="16px" />

      {/* Profile Completion + Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SkeletonPulse height="140px" borderRadius="12px" />
        <SkeletonPulse height="140px" borderRadius="12px" />
      </div>

      {/* Reservation Card */}
      <SkeletonPulse height="180px" borderRadius="12px" />

      {/* Activity Section */}
      <div className="space-y-3">
        <SkeletonPulse width="160px" height="18px" style={{ marginBottom: 12 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonPulse variant="circle" width="32px" />
            <div style={{ flex: 1 }}>
              <SkeletonPulse width="60%" height="13px" style={{ marginBottom: 6 }} />
              <SkeletonPulse width="40%" height="11px" />
            </div>
            <SkeletonPulse width="60px" height="11px" />
          </div>
        ))}
      </div>
    </div>
  );
}
