import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";
import { AdminDashboardSkeleton } from "./AdminContentSkeletons";

/**
 * AdminLayoutSkeleton
 *
 * Full-page shimmer skeleton that mirrors the real AdminLayout structure:
 *   sidebar (256 px) | topbar (74 px) + scrollable content
 *
 * Used as the loading fallback for both:
 *   1. ProtectedRoute — while Firebase auth state is being verified
 *   2. RouteShell Suspense — while the AdminLayout JS chunk is downloading
 *
 * Both phases now show the same visual so there is zero jarring transition
 * between "auth loading" and "chunk loading".
 */
export default function AdminLayoutSkeleton() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg-page, #f8fafc)",
        fontFamily: "var(--font-family, Inter, sans-serif)",
      }}
    >
      {/* ── Sidebar skeleton ──────────────────────────────────── */}
      <aside
        style={{
          width: "256px",
          flexShrink: 0,
          height: "100vh",
          borderRight: "1px solid var(--border-light, #e5e7eb)",
          background: "var(--bg-card, #fff)",
          display: "flex",
          flexDirection: "column",
          padding: "0",
        }}
      >
        {/* Logo row */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border-light, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <SkeletonPulse variant="circle" width="32px" />
          <SkeletonPulse variant="text" width="90px" height="14px" />
        </div>

        {/* Nav section label */}
        <div style={{ padding: "20px 20px 8px" }}>
          <SkeletonPulse variant="text" width="60px" height="10px" />
        </div>

        {/* Nav items */}
        <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {[1, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6].map((opacity, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 10px",
                borderRadius: "8px",
                background: i === 0 ? "var(--skeleton-base, rgba(0,0,0,0.06))" : "transparent",
                opacity,
              }}
            >
              <SkeletonPulse variant="circle" width="18px" />
              <SkeletonPulse variant="text" width={`${55 + (i * 17) % 30}%`} height="12px" />
            </div>
          ))}
        </div>

        {/* System section label */}
        <div style={{ padding: "20px 20px 8px", marginTop: "8px" }}>
          <SkeletonPulse variant="text" width="48px" height="10px" />
        </div>

        <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {[0.6, 0.6, 0.6, 0.6].map((opacity, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 10px",
                borderRadius: "8px",
                opacity,
              }}
            >
              <SkeletonPulse variant="circle" width="18px" />
              <SkeletonPulse variant="text" width={`${50 + (i * 13) % 35}%`} height="12px" />
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar skeleton */}
        <div
          style={{
            height: "74px",
            flexShrink: 0,
            borderBottom: "1px solid var(--border-light, #e5e7eb)",
            background: "rgba(255,255,255,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          {/* Breadcrumb area */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SkeletonPulse variant="text" width="40px" height="12px" />
            <span style={{ color: "var(--border-light, #e5e7eb)", fontSize: "16px" }}>/</span>
            <SkeletonPulse variant="text" width="80px" height="12px" />
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SkeletonPulse variant="text" width="110px" height="12px" />
            <SkeletonPulse variant="circle" width="22px" />
            <SkeletonPulse variant="circle" width="22px" />
            <SkeletonPulse variant="circle" width="36px" />
          </div>
        </div>

        {/* Content area — use the dashboard skeleton */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-page, #f8fafc)" }}>
          <AdminDashboardSkeleton />
        </div>
      </div>
    </div>
  );
}
