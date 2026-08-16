import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * BillingPageSkeleton — shimmer skeleton that mirrors the Tenant Statement Ledger layout 1:1.
 * Features solid, neutral surfaces with crisp 1px borders and zero gradients.
 */
export default function BillingPageSkeleton() {
  return (
    <div
      className="tenant-billing"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading billing dashboard"
    >
      {/* Top Ledger Hero Card */}
      <div className="statement-ledger-hero">
        <div className="statement-ledger-hero__top">
          <div>
            <SkeletonPulse width="140px" height="14px" style={{ marginBottom: "10px" }} />
            <SkeletonPulse width="220px" height="42px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse width="300px" height="14px" />
          </div>
          <div>
            <SkeletonPulse width="180px" height="44px" borderRadius="10px" />
          </div>
        </div>
        <div className="statement-ledger-hero__chips">
          <SkeletonPulse width="160px" height="24px" borderRadius="6px" />
          <SkeletonPulse width="140px" height="24px" borderRadius="6px" />
          <SkeletonPulse width="140px" height="24px" borderRadius="6px" />
        </div>
      </div>

      {/* Filter Chips Toolbar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <SkeletonPulse width="120px" height="34px" borderRadius="20px" />
        <SkeletonPulse width="100px" height="34px" borderRadius="20px" />
        <SkeletonPulse width="110px" height="34px" borderRadius="20px" />
      </div>

      {/* Selection Toolbar */}
      <div className="ledger-selection-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
          <SkeletonPulse width="150px" height="16px" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <SkeletonPulse width="160px" height="16px" />
          <SkeletonPulse width="140px" height="36px" borderRadius="8px" />
        </div>
      </div>

      {/* Statement Cards Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1, 2, 3].map((row) => (
          <div key={row} className="statement-card">
            <div style={{ padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
                  <SkeletonPulse width="20px" height="20px" borderRadius="4px" />
                  <div>
                    <SkeletonPulse width="180px" height="16px" style={{ marginBottom: 6 }} />
                    <SkeletonPulse width="min(220px, 60vw)" height="12px" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <SkeletonPulse width="75px" height="22px" borderRadius="20px" />
                  <SkeletonPulse width="90px" height="18px" />
                  <SkeletonPulse width="95px" height="32px" borderRadius="6px" />
                  <SkeletonPulse width="20px" height="20px" borderRadius="4px" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
