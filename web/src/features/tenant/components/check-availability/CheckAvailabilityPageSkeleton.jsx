import React from "react";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";
import CheckAvailabilitySkeleton from "./CheckAvailabilitySkeleton";
import "../../styles/check-availability.css";

/**
 * CheckAvailabilityPageSkeleton — Suspense fallback for the
 * /applicant/check-availability route (full-page bundle-load skeleton).
 *
 * Mirrors the exact page layout:
 *   1. AvailabilityHeader sticky top bar (Logo | Filter Bar | User control)
 *   2. Main container (max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8)
 *   3. Title section (Available Rooms + room count)
 *   4. Room grid (ca-grid) with 6 card skeletons via CheckAvailabilitySkeleton
 */
export default function CheckAvailabilityPageSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="ca-page-container min-h-screen"
      style={{ backgroundColor: "var(--surface-page)" }}
    >
      {/* ── 1. AvailabilityHeader ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "var(--surface-card)",
          borderBottom: "1px solid var(--border-divider)",
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="ca-header-row">
            {/* Logo */}
            <div className="ca-logo" style={{ pointerEvents: "none" }}>
              <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
              <SkeletonPulse width="95px" height="22px" />
            </div>

            {/* Filter bar */}
            <div className="ca-filter-bar" style={{ pointerEvents: "none" }}>
              {/* Search input pill */}
              <SkeletonPulse height="44px" borderRadius="10px" style={{ flex: 1, minWidth: 160 }} />
              {/* Filter dropdown pills */}
              <SkeletonPulse width="120px" height="44px" borderRadius="10px" />
              <SkeletonPulse width="130px" height="44px" borderRadius="10px" />
              <SkeletonPulse width="130px" height="44px" borderRadius="10px" />
              <SkeletonPulse width="215px" height="44px" borderRadius="10px" />
            </div>

            {/* User / Sign-in button */}
            <SkeletonPulse width="120px" height="44px" borderRadius="9999px" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </header>

      {/* ── 2. Main Page Body ───────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title + result count bar */}
        <div style={{ marginBottom: "16px" }}>
          <SkeletonPulse width="180px" height="28px" style={{ marginBottom: "8px" }} />
          <SkeletonPulse width="110px" height="14px" />
        </div>

        {/* Room card grid */}
        <div className="ca-grid">
          <CheckAvailabilitySkeleton count={15} />
        </div>
      </main>
    </div>
  );
}

