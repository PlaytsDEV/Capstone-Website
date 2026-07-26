import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";

/**
 * AdminLayoutSkeleton — Suspense fallback for the /admin layout shell
 * and admin routes.
 *
 * Mirrors AdminLayout structure:
 *   Admin Sidebar (fixed left rail) + TopBar + admin-content main area.
 */
export default function AdminLayoutSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
      }}
    >
      {/* ── Sidebar (260px) ───────────────────────────────────────── */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          zIndex: 100,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 64,
            padding: "0 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
          <SkeletonPulse width="110px" height="16px" />
        </div>

        {/* Navigation Section 1 (Workspace) */}
        <div style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <SkeletonPulse width="60px" height="10px" style={{ marginBottom: 12, marginLeft: 8 }} />
            {[100, 110, 95, 105, 90, 115, 85, 100].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", marginBottom: 4 }}>
                <SkeletonPulse width="20px" height="20px" borderRadius="6px" />
                <SkeletonPulse width={`${w}px`} height="13px" />
              </div>
            ))}
          </div>

          {/* Navigation Section 2 (System) */}
          <div>
            <SkeletonPulse width="45px" height="10px" style={{ marginBottom: 12, marginLeft: 8 }} />
            {[90, 105, 80, 95].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", marginBottom: 4 }}>
                <SkeletonPulse width="20px" height="20px" borderRadius="6px" />
                <SkeletonPulse width={`${w}px`} height="13px" />
              </div>
            ))}
          </div>
        </div>

        {/* Admin User Footer */}
        <div style={{ padding: "16px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonPulse variant="circle" width="36px" />
          <div style={{ flex: 1 }}>
            <SkeletonPulse width="90px" height="13px" style={{ marginBottom: 4 }} />
            <SkeletonPulse width="60px" height="11px" />
          </div>
        </div>
      </aside>

      {/* ── Main Layout Area ─────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 260, display: "flex", flexDirection: "column" }}>
        {/* TopBar */}
        <header
          style={{
            height: 64,
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonPulse width="50px" height="13px" />
            <span style={{ color: "#cbd5e1", fontSize: 12 }}>/</span>
            <SkeletonPulse width="90px" height="13px" />
          </div>

          {/* TopBar Right Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
            <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
            <SkeletonPulse variant="circle" width="36px" />
          </div>
        </header>

        {/* Admin Main Content Area Skeleton */}
        <main style={{ flex: 1, padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <SkeletonPulse width="200px" height="24px" style={{ marginBottom: 8 }} />
              <SkeletonPulse width="320px" height="13px" />
            </div>
            <SkeletonPulse width="120px" height="36px" borderRadius="8px" />
          </div>

          {/* Stats card grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ padding: 20, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <SkeletonPulse width="80px" height="12px" style={{ marginBottom: 12 }} />
                <SkeletonPulse width="110px" height="24px" style={{ marginBottom: 8 }} />
                <SkeletonPulse width="60px" height="11px" />
              </div>
            ))}
          </div>

          {/* Main Table / Content Card */}
          <div style={{ padding: 24, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonPulse width="160px" height="18px" />
              <SkeletonPulse width="240px" height="32px" borderRadius="6px" />
            </div>

            {/* Table Rows Skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                <SkeletonPulse width="180px" height="14px" />
                <SkeletonPulse width="100px" height="14px" />
                <SkeletonPulse width="120px" height="14px" />
                <SkeletonPulse width="80px" height="24px" borderRadius="999px" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
