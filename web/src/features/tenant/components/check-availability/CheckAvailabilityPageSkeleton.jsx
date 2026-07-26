import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";

/**
 * CheckAvailabilityPageSkeleton — Suspense fallback for the
 * /applicant/check-availability route (full-page bundle-load skeleton).
 *
 * Mirrors the real page structure:
 *   1. AvailabilityHeader (logo | filter bar | user button) — single sticky row
 *   2. Page title + result count bar
 *   3. Responsive room card grid (8 cards)
 *
 * NOTE: The inner CheckAvailabilitySkeleton (card-only) is used for DATA
 * loading *inside* the page. This skeleton wraps the whole page viewport.
 */
export default function CheckAvailabilityPageSkeleton() {
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
      {/* ── 1. AvailabilityHeader ──────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
          <SkeletonPulse width="88px" height="14px" />
        </div>

        {/* Filter bar (search + dropdowns) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search input */}
          <SkeletonPulse height="38px" borderRadius="8px" style={{ flex: 2 }} />
          {/* Branch dropdown */}
          <SkeletonPulse width="110px" height="38px" borderRadius="8px" />
          {/* Room type dropdown */}
          <SkeletonPulse width="110px" height="38px" borderRadius="8px" />
          {/* Lease term dropdown */}
          <SkeletonPulse width="110px" height="38px" borderRadius="8px" />
          {/* Price dropdown */}
          <SkeletonPulse width="120px" height="38px" borderRadius="8px" />
        </div>

        {/* User / Sign-in button */}
        <SkeletonPulse width="90px" height="36px" borderRadius="999px" style={{ flexShrink: 0 }} />
      </header>

      {/* ── 2. Title + result count bar ───────────────────────────────── */}
      <div
        style={{
          padding: "20px 32px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonPulse width="220px" height="22px" />
          <SkeletonPulse width="140px" height="13px" />
        </div>
        {/* Pagination / view controls */}
        <SkeletonPulse width="120px" height="32px" borderRadius="8px" />
      </div>

      {/* ── 3. Room card grid ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          padding: "12px 32px 40px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <article
            key={i}
            style={{
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            {/* Room image */}
            <SkeletonPulse width="100%" height="200px" borderRadius="0" />
            {/* Card body */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonPulse width="70%" height="16px" />
              <SkeletonPulse width="50%" height="13px" />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <SkeletonPulse width="80px" height="13px" />
                <SkeletonPulse width="70px" height="18px" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
