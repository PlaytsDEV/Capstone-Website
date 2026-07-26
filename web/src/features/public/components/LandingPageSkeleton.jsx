import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";

/**
 * LandingPageSkeleton — Suspense fallback for the "/" (LandingPage) route.
 *
 * Mirrors the real landing page structure:
 *   1. Navbar bar (logo left + nav links right)
 *   2. Full-viewport Hero section (image backdrop + headline/CTA overlay)
 *   3. Three faint section-divider stubs below the fold
 *
 * Does NOT depend on ThemeProvider/ThemeContext so it is safe to render
 * before any context has loaded.
 */
export default function LandingPageSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── 1. Navbar ──────────────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
          <SkeletonPulse width="100px" height="16px" />
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[80, 64, 72, 60].map((w, i) => (
            <SkeletonPulse key={i} width={`${w}px`} height="13px" />
          ))}
          {/* CTA button */}
          <SkeletonPulse width="100px" height="36px" borderRadius="999px" />
        </div>
      </header>

      {/* ── 2. Hero (full-viewport) ────────────────────────────────────── */}
      <section
        style={{
          flex: "0 0 100vh",
          position: "relative",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          marginTop: 68,
          height: "calc(100vh - 68px)",
          backgroundColor: "#e8e8e8",
        }}
      >
        {/* Backdrop image shimmer */}
        <SkeletonPulse
          width="100%"
          height="100%"
          borderRadius="0"
          style={{ position: "absolute", inset: 0 }}
        />

        {/* Gradient overlay (simulates the real hero overlay) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(255,255,255,0.88) 0%, rgba(243,230,184,0.72) 45%, rgba(232,211,146,0.35) 75%, transparent 100%)",
          }}
        />

        {/* Headline + sub + CTA */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "0 48px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 600,
          }}
        >
          {/* Badge pill */}
          <SkeletonPulse width="180px" height="28px" borderRadius="999px" />

          {/* Main headline — 2 lines */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SkeletonPulse width="480px" height="48px" borderRadius="10px" />
            <SkeletonPulse width="360px" height="48px" borderRadius="10px" />
          </div>

          {/* Subtitle */}
          <SkeletonPulse width="420px" height="16px" />
          <SkeletonPulse width="320px" height="16px" />

          {/* CTA buttons row */}
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <SkeletonPulse width="160px" height="48px" borderRadius="999px" />
            <SkeletonPulse width="140px" height="48px" borderRadius="999px" />
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 32, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SkeletonPulse width="56px" height="28px" />
                <SkeletonPulse width="80px" height="12px" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Section stubs below the fold ───────────────────────────── */}
      {[200, 160, 180].map((h, i) => (
        <div
          key={i}
          style={{
            borderTop: "1px solid rgba(0,0,0,0.06)",
            padding: "40px 48px",
          }}
        >
          <SkeletonPulse width="200px" height="22px" style={{ marginBottom: 16 }} />
          <SkeletonPulse width="320px" height="14px" style={{ marginBottom: 24 }} />
          <SkeletonPulse width="100%" height={`${h}px`} borderRadius="16px" />
        </div>
      ))}
    </div>
  );
}
