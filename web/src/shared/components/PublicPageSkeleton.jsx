import React from "react";
import SkeletonPulse from "./SkeletonPulse";

/**
 * PublicPageSkeleton — Suspense fallback for simple public pages:
 *   /privacy-policy, /terms-of-service, /auth-action, /verify-email
 *
 * Mirrors: navbar bar + centred prose card (title + paragraph rows).
 * Intentionally minimal — these pages are text/info, not dashboards.
 */
export default function PublicPageSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Navbar bar ──────────────────────────────────────────────── */}
      <header
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "#ffffff",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
          <SkeletonPulse width="90px" height="14px" />
        </div>
        <SkeletonPulse width="72px" height="14px" />
      </header>

      {/* ── Page body ────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 760,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Page title */}
          <SkeletonPulse width="280px" height="28px" />
          <SkeletonPulse width="200px" height="14px" />

          {/* Prose paragraph rows */}
          {[100, 88, 92, 75, 90, 68, 85, 60].map((w, i) => (
            <SkeletonPulse
              key={i}
              width={`${w}%`}
              height="13px"
              variant="text"
              style={{ marginTop: i === 4 ? 24 : 0 }} /* gap between paragraphs */
            />
          ))}

          {/* Second block */}
          <SkeletonPulse width="200px" height="20px" style={{ marginTop: 16 }} />
          {[95, 80, 88, 72].map((w, i) => (
            <SkeletonPulse key={`b${i}`} width={`${w}%`} height="13px" variant="text" />
          ))}
        </div>
      </main>
    </div>
  );
}
