import React from "react";
import SkeletonPulse from "../components/SkeletonPulse";

/**
 * TenantLayoutSkeleton — Suspense fallback for the /applicant layout shell
 * and any tenant route that doesn't have a dedicated page skeleton.
 *
 * Mirrors TenantLayout structure:
 *   Left sidebar (280px fixed) + TopBar + main content area.
 *
 * Used for:
 *   - Outer /applicant TenantLayout RouteShell
 *   - /applicant/reservation (no dedicated skeleton)
 */
export default function TenantLayoutSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--surface-page, #ffffff)",
      }}
    >
      {/* ── Sidebar (280px) ───────────────────────────────────────── */}
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          background: "var(--surface-card, #ffffff)",
          borderRight: "1px solid var(--border-divider, #e5e7eb)",
          display: "flex",
          flexDirection: "column",
          zIndex: 100,
        }}
      >
        {/* Logo row */}
        <div
          style={{
            padding: "16px 14px",
            borderBottom: "1px solid var(--border-divider, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
          <SkeletonPulse width="96px" height="16px" />
        </div>

        {/* User card */}
        <div
          style={{
            padding: "14px",
            borderBottom: "1px solid var(--border-divider, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <SkeletonPulse variant="circle" width="40px" />
          <div style={{ flex: 1 }}>
            <SkeletonPulse width="100px" height="13px" style={{ marginBottom: 6 }} />
            <SkeletonPulse width="130px" height="11px" />
          </div>
        </div>

        {/* Browse Rooms CTA */}
        <div style={{ padding: "12px 14px 6px" }}>
          <SkeletonPulse height="38px" borderRadius="8px" />
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Section 1 — Main */}
          <div>
            <SkeletonPulse width="36px" height="9px" style={{ marginBottom: 8, marginLeft: 10 }} />
            <SkeletonPulse height="34px" borderRadius="8px" />
          </div>

          {/* Section 2 — Account */}
          <div>
            <SkeletonPulse width="52px" height="9px" style={{ marginBottom: 8, marginLeft: 10 }} />
            {[1, 2, 3, 4].map((i) => (
              <SkeletonPulse key={i} height="34px" borderRadius="8px" style={{ marginBottom: 4 }} />
            ))}
          </div>

          {/* Section 3 — Preferences */}
          <div>
            <SkeletonPulse width="74px" height="9px" style={{ marginBottom: 8, marginLeft: 10 }} />
            {[1, 2].map((i) => (
              <SkeletonPulse key={i} height="34px" borderRadius="8px" style={{ marginBottom: 4 }} />
            ))}
          </div>
        </nav>

        {/* Sign Out */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-divider, #e5e7eb)" }}>
          <SkeletonPulse height="34px" borderRadius="8px" />
        </div>
      </aside>

      {/* ── Main area (offset for sidebar) ───────────────────────── */}
      <div style={{ flex: 1, marginLeft: 280, display: "flex", flexDirection: "column" }}>
        {/* ApplicantTopBar */}
        <header
          style={{
            height: 56,
            background: "var(--surface-card, #ffffff)",
            borderBottom: "1px solid var(--border-divider, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          <SkeletonPulse width="160px" height="15px" />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <SkeletonPulse width="28px" height="28px" borderRadius="8px" />
            <SkeletonPulse variant="circle" width="32px" />
          </div>
        </header>

        {/* Content area */}
        <main style={{ flex: 1, padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <SkeletonPulse width="220px" height="24px" />
          <SkeletonPulse width="340px" height="14px" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SkeletonPulse height="120px" borderRadius="12px" />
            <SkeletonPulse height="120px" borderRadius="12px" />
          </div>
          <SkeletonPulse height="200px" borderRadius="12px" />
        </main>
      </div>
    </div>
  );
}
