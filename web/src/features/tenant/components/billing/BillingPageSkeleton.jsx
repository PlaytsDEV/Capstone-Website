import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * BillingPageSkeleton — shimmer skeleton that mirrors the Tenant BillingTab layout 1:1.
 * Features solid, neutral surfaces with crisp 1px borders and zero blue gradients.
 */
export default function BillingPageSkeleton() {
  return (
    <div
      className="tenant-billing"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading billing dashboard"
    >
      {/* Page Header */}
      <div className="billing-page-header" style={{ marginBottom: "24px" }}>
        <SkeletonPulse width="180px" height="26px" style={{ marginBottom: "8px" }} />
        <SkeletonPulse width="280px" height="14px" />
      </div>

      {/* Top KPI Cards Grid (Rent & Fees Due, Utilities Due) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {[1, 2].map((card) => (
          <div
            key={card}
            style={{
              background: "var(--surface-card, #ffffff)",
              borderRadius: 16,
              border: "1px solid var(--border-card, #e2e8f0)",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <SkeletonPulse width="120px" height="14px" />
                <SkeletonPulse width="90px" height="20px" borderRadius="10px" />
              </div>
              <SkeletonPulse width="160px" height="32px" />
            </div>
            <div
              style={{
                marginBottom: 16,
                background: "var(--surface-hover, #f8fafc)",
                borderRadius: 10,
                padding: "12px 14px",
                border: "1px solid var(--border-card, #f1f5f9)",
              }}
            >
              <SkeletonPulse width="100%" height="28px" borderRadius="6px" />
            </div>
            <SkeletonPulse width="100%" height="42px" borderRadius="8px" />
          </div>
        ))}
      </div>

      {/* Navigation Pill Tabs */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            display: "flex",
            background: "var(--surface-hover, #f1f5f9)",
            padding: "4px",
            borderRadius: "30px",
            gap: "4px",
          }}
        >
          <SkeletonPulse width="120px" height="34px" borderRadius="24px" />
          <SkeletonPulse width="100px" height="34px" borderRadius="24px" />
          <SkeletonPulse width="130px" height="34px" borderRadius="24px" />
        </div>
      </div>

      {/* Bill Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            style={{
              background: "var(--surface-card, #ffffff)",
              borderRadius: 12,
              border: "1px solid var(--border-card, #e2e8f0)",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div style={{ padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <SkeletonPulse width="170px" height="15px" style={{ marginBottom: 8 }} />
                  <SkeletonPulse width="min(220px, 65vw)" height="12px" />
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <SkeletonPulse width="75px" height="22px" borderRadius="20px" />
                  <SkeletonPulse width="90px" height="16px" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
