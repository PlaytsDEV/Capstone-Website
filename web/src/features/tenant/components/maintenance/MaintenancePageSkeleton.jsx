import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * MaintenancePageSkeleton — shimmer skeleton that mirrors the Tenant Maintenance Workspace.
 */
export default function MaintenancePageSkeleton() {
  return (
    <div className="tenant-page">
      {/* Page Header */}
      <div className="page-header maintenance-page-header">
        <div>
          <SkeletonPulse width="240px" height="26px" style={{ marginBottom: 6 }} />
          <SkeletonPulse width="380px" height="13px" />
        </div>
        <SkeletonPulse width="140px" height="38px" borderRadius="8px" />
      </div>

      {/* Standalone Display-Only KPI Grid */}
      <div className="maintenance-kpi-grid">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="maintenance-kpi-card"
          >
            <div className="maintenance-kpi-card__top">
              <SkeletonPulse width="80px" height="12px" />
              <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
            </div>
            <SkeletonPulse width="48px" height="26px" style={{ margin: "6px 0" }} />
            <SkeletonPulse width="120px" height="11px" />
          </div>
        ))}
      </div>

      {/* Request Records Section */}
      <div className="section-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonPulse width="130px" height="20px" />
            <SkeletonPulse width="24px" height="20px" borderRadius="999px" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <SkeletonPulse width="80px" height="28px" borderRadius="999px" />
            <SkeletonPulse width="65px" height="28px" borderRadius="999px" />
            <SkeletonPulse width="100px" height="28px" borderRadius="999px" />
          </div>
        </div>

        <div className="maintenance-list">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="maintenance-item"
              style={{ flexDirection: "column", alignItems: "stretch", gap: 12, padding: "1.25rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <SkeletonPulse width="18px" height="18px" borderRadius="4px" style={{ marginTop: 2 }} />
                  <div>
                    <SkeletonPulse width="160px" height="16px" style={{ marginBottom: 4 }} />
                    <SkeletonPulse width="110px" height="12px" />
                  </div>
                </div>
                <SkeletonPulse width="85px" height="22px" borderRadius="999px" />
              </div>
              <SkeletonPulse width="80%" height="14px" />
              <div style={{ padding: "10px", background: "var(--muted)", borderRadius: "8px" }}>
                <SkeletonPulse width="100%" height="20px" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <SkeletonPulse width="95px" height="30px" borderRadius="6px" />
                <SkeletonPulse width="80px" height="30px" borderRadius="6px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
