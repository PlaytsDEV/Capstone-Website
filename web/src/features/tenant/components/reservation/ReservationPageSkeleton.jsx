import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * ReservationPageSkeleton — Content skeleton for /applicant/reservation.
 * Replaces full TenantLayoutSkeleton to prevent duplicate fixed sidebars & topbars.
 */
export default function ReservationPageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      {/* Step Stepper Header */}
      <div
        className="p-6 rounded-xl border bg-card flex flex-col gap-4"
        style={{
          borderColor: "var(--border-divider, #e5e7eb)",
          background: "var(--surface-card, #ffffff)",
        }}
      >
        <div className="flex justify-between items-center">
          <SkeletonPulse width="160px" height="22px" />
          <SkeletonPulse width="100px" height="14px" />
        </div>
        {/* Progress bar steps */}
        <div className="grid grid-cols-5 gap-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <SkeletonPulse height="6px" borderRadius="999px" />
              <SkeletonPulse width="70%" height="11px" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Flow Grid: Step Form Card + Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Box */}
        <div
          className="lg:col-span-2 p-6 rounded-xl border bg-card space-y-5"
          style={{
            borderColor: "var(--border-divider, #e5e7eb)",
            background: "var(--surface-card, #ffffff)",
          }}
        >
          <SkeletonPulse width="200px" height="20px" />
          <SkeletonPulse width="300px" height="13px" />

          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SkeletonPulse width="80px" height="12px" style={{ marginBottom: 6 }} />
                <SkeletonPulse height="40px" borderRadius="8px" />
              </div>
              <div>
                <SkeletonPulse width="80px" height="12px" style={{ marginBottom: 6 }} />
                <SkeletonPulse height="40px" borderRadius="8px" />
              </div>
            </div>

            <div>
              <SkeletonPulse width="110px" height="12px" style={{ marginBottom: 6 }} />
              <SkeletonPulse height="40px" borderRadius="8px" />
            </div>

            <div>
              <SkeletonPulse width="140px" height="12px" style={{ marginBottom: 6 }} />
              <SkeletonPulse height="80px" borderRadius="8px" />
            </div>
          </div>
        </div>

        {/* Right Summary Sidebar Card */}
        <div
          className="p-6 rounded-xl border bg-card space-y-4 h-fit"
          style={{
            borderColor: "var(--border-divider, #e5e7eb)",
            background: "var(--surface-card, #ffffff)",
          }}
        >
          <SkeletonPulse width="140px" height="18px" />
          <SkeletonPulse width="100%" height="140px" borderRadius="10px" />
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <SkeletonPulse width="90px" height="13px" />
              <SkeletonPulse width="60px" height="13px" />
            </div>
            <div className="flex justify-between">
              <SkeletonPulse width="100px" height="13px" />
              <SkeletonPulse width="50px" height="13px" />
            </div>
            <div className="pt-2 border-t flex justify-between">
              <SkeletonPulse width="80px" height="15px" />
              <SkeletonPulse width="80px" height="15px" />
            </div>
          </div>
          <SkeletonPulse height="42px" borderRadius="8px" style={{ marginTop: 12 }} />
        </div>
      </div>
    </div>
  );
}
