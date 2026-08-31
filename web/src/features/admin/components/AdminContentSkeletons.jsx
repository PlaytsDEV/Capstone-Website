import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";
import "../../owner/styles/owner-dashboard.css";
import "../../owner/styles/owner-permissions.css";
import "../styles/permission-editor.css";
import "../../owner/styles/owner-branches.css";
import "../../owner/styles/owner-settings.css";
import "../styles/admin-backup.css";
import "../styles/admin-reports.css";
import "../../../shared/components/AdminPageHeader.css";

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Full-width shimmer block with a label row above it — used for section cards. */
function SkelCard({ height = "120px", style = {} }) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid var(--border-light, #e5e7eb)",
        padding: "20px",
        background: "var(--bg-card, #fff)",
        ...style,
      }}
    >
      <SkeletonPulse variant="text" width="40%" height="11px" style={{ marginBottom: "12px" }} />
      <SkeletonPulse width="100%" height={height} borderRadius="8px" />
    </div>
  );
}

/** A single table row skeleton (icon + two text cols + badge). */
function SkelTableRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: "1px solid var(--border-light, #e5e7eb)" }}>
      <SkeletonPulse variant="circle" width="36px" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <SkeletonPulse variant="text" width="45%" height="13px" />
        <SkeletonPulse variant="text" width="30%" height="11px" />
      </div>
      <SkeletonPulse width="60px" height="22px" borderRadius="6px" />
    </div>
  );
}

// ─── AdminDashboardSkeleton ───────────────────────────────────────────────────
// Mirrors the real dashboard: header bar → 5 KPI cards → 2-column content
// (inquiry list + pie chart) → 2 trend charts → reservations table.
export function AdminDashboardSkeleton() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{ padding: "24px 28px", maxWidth: "100%", boxSizing: "border-box" }}
    >
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonPulse variant="text" width="160px" height="22px" />
          <SkeletonPulse variant="text" width="300px" height="13px" />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <SkeletonPulse width="110px" height="32px" borderRadius="8px" />
          <SkeletonPulse width="110px" height="32px" borderRadius="8px" />
        </div>
      </div>

      {/* 5 KPI stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--border-light, #e5e7eb)",
              background: "var(--bg-card, #fff)",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonPulse variant="text" width="70%" height="11px" />
              <SkeletonPulse variant="circle" width="16px" />
            </div>
            <SkeletonPulse width="55%" height="28px" borderRadius="6px" />
            <SkeletonPulse variant="text" width="80%" height="11px" />
          </div>
        ))}
      </div>

      {/* 2-column: inquiry list + reservation donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Inquiries */}
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--border-light, #e5e7eb)",
            background: "var(--bg-card, #fff)",
            padding: "22px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <SkeletonPulse variant="text" width="150px" height="16px" />
              <SkeletonPulse variant="text" width="200px" height="11px" />
            </div>
            <SkeletonPulse width="64px" height="13px" borderRadius="4px" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => <SkelTableRow key={i} />)}
        </div>

        {/* Reservation donut */}
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid var(--border-light, #e5e7eb)",
            background: "var(--bg-card, #fff)",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <SkeletonPulse variant="text" width="160px" height="16px" />
          <SkeletonPulse variant="text" width="190px" height="11px" />
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <SkeletonPulse variant="circle" width="150px" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {["65%", "45%", "35%"].map((w, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SkeletonPulse variant="circle" width="10px" />
                  <SkeletonPulse variant="text" width={w} height="12px" />
                </div>
                <SkeletonPulse variant="text" width="24px" height="12px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2 trend charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <SkelCard height="160px" />
        <SkelCard height="160px" />
      </div>

      {/* Recent reservations table */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border-light, #e5e7eb)",
          background: "var(--bg-card, #fff)",
          padding: "22px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            <SkeletonPulse variant="text" width="180px" height="16px" />
            <SkeletonPulse variant="text" width="250px" height="11px" />
          </div>
          <SkeletonPulse width="64px" height="13px" borderRadius="4px" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => <SkelTableRow key={i} />)}
      </div>
    </div>
  );
}

// ─── Table-page skeleton (Reservations, Tenants, Billing, etc.) ──────────────
export function AdminTablePageSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ padding: "24px 28px" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonPulse variant="text" width="180px" height="20px" />
          <SkeletonPulse variant="text" width="280px" height="12px" />
        </div>
        <SkeletonPulse width="120px" height="36px" borderRadius="8px" />
      </div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
        <SkeletonPulse width="200px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="140px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="140px" height="36px" borderRadius="8px" />
      </div>
      {/* Table card */}
      <div style={{ borderRadius: "12px", border: "1px solid var(--border-light, #e5e7eb)", background: "var(--bg-card, #fff)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light, #e5e7eb)", display: "flex", gap: "24px" }}>
          {[28, 18, 14, 12, 10].map((w, i) => (
            <SkeletonPulse key={i} variant="text" width={`${w}%`} height="11px" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light, #e5e7eb)", display: "flex", alignItems: "center", gap: "20px" }}>
            <SkeletonPulse variant="circle" width="32px" />
            <SkeletonPulse variant="text" width="22%" height="13px" />
            <SkeletonPulse variant="text" width="16%" height="13px" />
            <SkeletonPulse variant="text" width="14%" height="13px" />
            <SkeletonPulse variant="text" width="12%" height="13px" />
            <SkeletonPulse width="70px" height="24px" borderRadius="6px" style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Maintenance skeleton (Dashboard KPI summary cards + Filter bar + Data Table) ──
export function AdminMaintenanceSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ padding: "24px 28px" }}>
      {/* Page header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
        <SkeletonPulse variant="text" width="160px" height="24px" />
        <SkeletonPulse variant="text" width="340px" height="13px" />
      </div>

      {/* 4 KPI summary stat cards matching MANAGEMENT_SUMMARY_CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--border-light, #e5e7eb)",
              background: "var(--bg-card, #fff)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonPulse variant="text" width="55%" height="11px" />
              <SkeletonPulse width="28px" height="28px" borderRadius="8px" />
            </div>
            <SkeletonPulse width="45%" height="24px" borderRadius="6px" />
            <SkeletonPulse variant="text" width="75%" height="10px" />
          </div>
        ))}
      </div>

      {/* Filter toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <SkeletonPulse width="240px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="130px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="120px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="100px" height="36px" borderRadius="8px" style={{ marginLeft: "auto" }} />
      </div>

      {/* Table card */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border-light, #e5e7eb)",
          background: "var(--bg-card, #fff)",
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border-light, #e5e7eb)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
          <SkeletonPulse variant="text" width="22%" height="11px" />
          <SkeletonPulse variant="text" width="26%" height="11px" />
          <SkeletonPulse variant="text" width="14%" height="11px" />
          <SkeletonPulse variant="text" width="12%" height="11px" />
          <SkeletonPulse variant="text" width="10%" height="11px" />
          <SkeletonPulse variant="text" width="8%" height="11px" style={{ marginLeft: "auto" }} />
        </div>

        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border-light, #e5e7eb)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
            {/* Resident & Room */}
            <div style={{ width: "22%", display: "flex", alignItems: "center", gap: "10px" }}>
              <SkeletonPulse variant="circle" width="32px" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <SkeletonPulse variant="text" width="70%" height="12px" />
                <SkeletonPulse variant="text" width="45%" height="10px" />
              </div>
            </div>
            {/* Issue details */}
            <div style={{ width: "26%", display: "flex", flexDirection: "column", gap: "4px" }}>
              <SkeletonPulse variant="text" width="80%" height="12px" />
              <SkeletonPulse variant="text" width="55%" height="10px" />
            </div>
            {/* Urgency & Timeline */}
            <div style={{ width: "14%", display: "flex", flexDirection: "column", gap: "4px" }}>
              <SkeletonPulse width="60px" height="18px" borderRadius="4px" />
              <SkeletonPulse variant="text" width="70%" height="10px" />
            </div>
            {/* Status */}
            <div style={{ width: "12%" }}>
              <SkeletonPulse width="72px" height="22px" borderRadius="6px" />
            </div>
            {/* Branch */}
            <div style={{ width: "10%" }}>
              <SkeletonPulse variant="text" width="60px" height="11px" />
            </div>
            {/* Action */}
            <div style={{ width: "8%", marginLeft: "auto", display: "flex", justifyContent: "flex-end" }}>
              <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Room Availability / Inventory Workspace Skeleton ───────────────────────
// Mirrors RoomAvailabilityPage: AdminPageHeader (with vacancy schedule, export, add actions) →
// 6 KPI stat metric cards (Total Rooms, Available, Partial, Full, Maintenance, Total Beds) →
// main card container → filter preset chips bar → search input + filter dropdowns →
// multi-category status legend bar → floor-grouped double-deck bunk bed matrix cards →
// bottom summary & page controls footer.
export function AdminRoomAvailabilitySkeleton() {
  return (
    <div
      className="space-y-6"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading room inventory workspace"
    >
      {/* Pattern 1 Sticky Sub-Header matching AdminPageHeader */}
      <div className="admin-page-header admin-page-header--sticky">
        <div className="admin-page-header-top">
          <div className="admin-page-header-heading">
            <SkeletonPulse variant="text" width="170px" height="24px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="420px" height="13px" />
          </div>
          <div className="admin-page-header-side">
            <div className="admin-page-header-actions flex items-center gap-2 flex-wrap">
              {/* Check Vacancy Schedule action button */}
              <SkeletonPulse width="190px" height="32px" borderRadius="8px" />
              {/* Export CSV action button */}
              <SkeletonPulse width="90px" height="32px" borderRadius="8px" />
              {/* Export PDF action button */}
              <SkeletonPulse width="90px" height="32px" borderRadius="8px" />
              {/* Add Room action button */}
              <SkeletonPulse width="95px" height="32px" borderRadius="8px" />
            </div>
          </div>
        </div>
      </div>

      {/* 6 KPI Stat Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-4">
        {[
          { labelW: "70px", valW: "36px" }, // Total Rooms
          { labelW: "55px", valW: "32px" }, // Available
          { labelW: "45px", valW: "32px" }, // Partial
          { labelW: "35px", valW: "28px" }, // Full
          { labelW: "75px", valW: "24px" }, // Maintenance
          { labelW: "65px", valW: "36px" }, // Total Beds
        ].map((kpi, i) => (
          <div
            key={i}
            className="flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <SkeletonPulse variant="text" width={kpi.labelW} height="11px" />
              <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
            </div>
            <SkeletonPulse variant="text" width={kpi.valW} height="24px" style={{ marginTop: "8px" }} />
          </div>
        ))}
      </div>

      {/* Main Inventory Container */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Optimized Toolbar with Preset Chips, Search, & Active Filter Controls */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Quick Preset Filter Chips Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SkeletonPulse variant="text" width="55px" height="11px" style={{ marginRight: "4px" }} />
              {["92px", "88px", "76px", "65px", "106px"].map((width, idx) => (
                <SkeletonPulse key={idx} width={width} height="28px" borderRadius="9999px" />
              ))}
            </div>
          </div>

          {/* Search Bar & Dropdown Select Controls */}
          <div className="flex flex-col lg:flex-row gap-3 items-end">
            {/* Search Input with Micro-Label */}
            <div className="flex-1 flex flex-col gap-1 min-w-[240px] w-full">
              <SkeletonPulse variant="text" width="45px" height="10px" />
              <SkeletonPulse width="100%" height="36px" borderRadius="8px" />
            </div>

            {/* Filter Dropdowns & Add Room Button */}
            <div className="flex gap-2.5 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <SkeletonPulse variant="text" width="35px" height="10px" />
                <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
              </div>
              <div className="flex flex-col gap-1">
                <SkeletonPulse variant="text" width="35px" height="10px" />
                <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
              </div>
              <SkeletonPulse width="105px" height="36px" borderRadius="8px" />
            </div>
          </div>
        </div>

        {/* Multi-Category Status Legend Bar */}
        <div className="mb-5 rounded-xl p-3.5 border border-border bg-card shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            {/* Room Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonPulse variant="text" width="80px" height="11px" style={{ marginRight: "4px" }} />
              {["75px", "70px", "60px", "90px"].map((w, idx) => (
                <SkeletonPulse key={idx} width={w} height="22px" borderRadius="9999px" />
              ))}
            </div>

            {/* Bed Deck Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2.5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-3.5">
              <SkeletonPulse variant="text" width="75px" height="11px" style={{ marginRight: "4px" }} />
              {["65px", "72px", "72px", "110px", "55px"].map((w, idx) => (
                <SkeletonPulse key={idx} width={w} height="22px" borderRadius="4px" />
              ))}
            </div>
          </div>
        </div>

        {/* Floor Grouped Room Card Grid */}
        <div className="space-y-8 mt-2">
          {[
            { floorW: "55px", roomsW: "65px", availW: "85px" },
            { floorW: "55px", roomsW: "65px", availW: "85px" },
          ].map((floorGroup, fIdx) => (
            <div key={fIdx} className="space-y-3">
              {/* Floor Section Header */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xs">
                <div className="flex items-center gap-2.5">
                  <SkeletonPulse width="28px" height="28px" borderRadius="8px" />
                  <SkeletonPulse variant="text" width={floorGroup.floorW} height="16px" />
                  <SkeletonPulse width={floorGroup.roomsW} height="20px" borderRadius="9999px" />
                </div>
                <SkeletonPulse width={floorGroup.availW} height="20px" borderRadius="9999px" />
              </div>

              {/* Double Deck Room Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                {Array.from({ length: 4 }).map((_, cardIdx) => (
                  <div
                    key={cardIdx}
                    className="rounded-xl p-3.5 flex flex-col justify-between w-full bg-card border border-border"
                  >
                    {/* Card Top Header */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60">
                      <div>
                        <SkeletonPulse variant="text" width="80px" height="18px" style={{ marginBottom: "4px" }} />
                        <SkeletonPulse variant="text" width="110px" height="12px" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <SkeletonPulse width="68px" height="20px" borderRadius="9999px" />
                        <SkeletonPulse variant="text" width="65px" height="11px" />
                      </div>
                    </div>

                    {/* Double Deck Bunk Layout Frame */}
                    <div className="space-y-2 my-1">
                      <div className="flex items-center justify-between px-0.5">
                        <SkeletonPulse variant="text" width="105px" height="10px" />
                        <SkeletonPulse variant="text" width="65px" height="10px" />
                      </div>

                      {/* Bunk Frames (2 Double Deck Bunks per 4-cap room) */}
                      <div className="grid grid-cols-1 gap-2">
                        {[1, 2].map((bunkIdx) => (
                          <div
                            key={bunkIdx}
                            className="rounded-lg p-2 bg-muted/40 border border-border/80 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between border-b border-border/40 pb-1">
                              <SkeletonPulse variant="text" width="45px" height="11px" />
                              <SkeletonPulse variant="text" width="60px" height="10px" />
                            </div>

                            {/* Top Deck */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <SkeletonPulse width="24px" height="16px" borderRadius="4px" />
                                <SkeletonPulse variant="text" width="28px" height="11px" />
                              </div>
                              <SkeletonPulse width="72px" height="18px" borderRadius="4px" />
                            </div>

                            <div className="w-full h-px bg-border/40 my-0.5" />

                            {/* Bottom Deck */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <SkeletonPulse width="24px" height="16px" borderRadius="4px" />
                                <SkeletonPulse variant="text" width="28px" height="11px" />
                              </div>
                              <SkeletonPulse width="72px" height="18px" borderRadius="4px" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amenity Pills Strip */}
                    <div className="my-2 flex flex-wrap gap-1">
                      <SkeletonPulse width="80px" height="18px" borderRadius="4px" />
                      <SkeletonPulse width="48px" height="18px" borderRadius="4px" />
                    </div>

                    {/* Card Footer Details */}
                    <div className="pt-2 mt-1 border-t border-border/60 flex items-center justify-between text-xs">
                      <SkeletonPulse width="55px" height="18px" borderRadius="4px" />
                      <SkeletonPulse variant="text" width="85px" height="13px" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Summary & Fast Page Controls Footer */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-6 px-1 border-t border-border/60 text-xs">
          <SkeletonPulse variant="text" width="180px" height="13px" />
          <div className="flex items-center gap-3 ml-auto">
            <SkeletonPulse variant="text" width="70px" height="13px" />
            <div className="flex items-center gap-1">
              <SkeletonPulse width="65px" height="28px" borderRadius="8px" />
              <SkeletonPulse width="28px" height="28px" borderRadius="8px" />
              <SkeletonPulse width="28px" height="28px" borderRadius="8px" />
              <SkeletonPulse width="55px" height="28px" borderRadius="8px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible aliases for AdminCardGridSkeleton / AdminRoomManagementSkeleton
export const AdminRoomManagementSkeleton = AdminRoomAvailabilitySkeleton;
export const AdminCardGridSkeleton = AdminRoomAvailabilitySkeleton;

// ─── Form-page skeleton (Settings, Roles) ────────────────────────────────────
export function AdminFormPageSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "28px" }}>
        <SkeletonPulse variant="text" width="200px" height="22px" />
        <SkeletonPulse variant="text" width="320px" height="13px" />
      </div>
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border-light, #e5e7eb)",
          background: "var(--bg-card, #fff)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
          maxWidth: "720px",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <SkeletonPulse variant="text" width="30%" height="12px" />
            <SkeletonPulse width="100%" height="38px" borderRadius="8px" />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
          <SkeletonPulse width="90px" height="36px" borderRadius="8px" />
          <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

// ─── Role & Permissions workspace skeleton ──────────────────────────────────
export function AdminRolePermissionsSkeleton() {
  return (
    <div
      className="sa2"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading role permissions workspace"
    >
      {/* Page Header */}
      <div className="sa2-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <SkeletonPulse variant="text" width="110px" height="12px" style={{ marginBottom: "6px" }} />
          <SkeletonPulse variant="text" width="280px" height="26px" />
        </div>

        <div className="flex items-center gap-2">
          <SkeletonPulse width="96px" height="34px" borderRadius="6px" />
        </div>
      </div>

      {/* Metrics Banner (3 Cards) */}
      <div className="sa-perm-metrics-grid">
        {[
          { labelWidth: "90px", valWidth: "36px" },
          { labelWidth: "130px", valWidth: "36px" },
          { labelWidth: "120px", valWidth: "36px" },
        ].map((item, i) => (
          <div key={i} className="sa-metric-card" style={{ cursor: "default", pointerEvents: "none" }}>
            <SkeletonPulse width="42px" height="42px" borderRadius="8px" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <SkeletonPulse variant="text" width={item.labelWidth} height="11px" />
              <SkeletonPulse variant="text" width={item.valWidth} height="22px" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Workspace Card */}
      <div className="sa2-card">
        <div className="sa2-section-head flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
              <SkeletonPulse variant="text" width="230px" height="18px" />
            </div>
            <SkeletonPulse variant="text" width="340px" height="13px" />
          </div>

          <SkeletonPulse width="110px" height="36px" borderRadius="6px" />
        </div>

        {/* Dedicated Separate Filter Toolbar */}
        <div className="sa-perm-filter-section">
          <div className="sa-perm-filter-row">
            <div className="sa-perm-filter-inputs">
              <SkeletonPulse width="240px" height="36px" borderRadius="6px" />
              <SkeletonPulse width="130px" height="36px" borderRadius="6px" />
              <SkeletonPulse width="150px" height="36px" borderRadius="6px" />
            </div>
            <div className="sa-perm-scope-pills">
              <SkeletonPulse width="65px" height="32px" borderRadius="9999px" />
              <SkeletonPulse width="135px" height="32px" borderRadius="9999px" />
              <SkeletonPulse width="125px" height="32px" borderRadius="9999px" />
            </div>
          </div>
        </div>

        {/* Branch Admin Cards List with Accordion */}
        <div className="sa-perm-list" style={{ padding: "0" }}>
          {/* Card 1: Expanded Card with full PermissionEditor skeleton */}
          <div className="sa2-card sa-perm-card sa-perm-card--open">
            <div className="sa-perm-card-header">
              <div className="sa-perm-user-info">
                <SkeletonPulse width="40px" height="40px" borderRadius="8px" />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <SkeletonPulse variant="text" width="140px" height="14px" />
                  <SkeletonPulse variant="text" width="190px" height="12px" />
                </div>
              </div>

              <div className="sa-perm-meta flex items-center gap-2">
                <SkeletonPulse width="110px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="115px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="90px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
              </div>
            </div>

            <div className="sa-perm-card-body">
              <div className="permission-editor">
                {/* Header */}
                <div className="pe-header">
                  <div className="pe-title-block">
                    <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <SkeletonPulse variant="text" width="190px" height="14px" />
                      <SkeletonPulse variant="text" width="280px" height="12px" />
                    </div>
                  </div>
                  <SkeletonPulse width="110px" height="26px" borderRadius="9999px" />
                </div>

                {/* Quick Role Presets Toolbar */}
                <div className="pe-presets-bar">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <SkeletonPulse variant="text" width="95px" height="12px" />
                    <SkeletonPulse width="85px" height="28px" borderRadius="6px" />
                    <SkeletonPulse width="110px" height="28px" borderRadius="6px" />
                    <SkeletonPulse width="105px" height="28px" borderRadius="6px" />
                    <SkeletonPulse width="75px" height="28px" borderRadius="6px" />
                  </div>
                </div>

                {/* Categorized Permission Groups */}
                <div className="pe-categories">
                  {[
                    { titleWidth: "160px", descWidth: "320px" },
                    { titleWidth: "140px", descWidth: "280px" },
                    { titleWidth: "190px", descWidth: "300px" },
                    { titleWidth: "170px", descWidth: "290px" },
                  ].map((cat, idx) => (
                    <div key={idx} className="pe-category-group">
                      <div className="pe-category-header flex justify-between items-center">
                        <div className="pe-category-title flex items-center gap-2">
                          <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
                          <SkeletonPulse variant="text" width={cat.titleWidth} height="14px" />
                        </div>
                        <SkeletonPulse width="85px" height="20px" borderRadius="12px" />
                      </div>
                      <SkeletonPulse variant="text" width={cat.descWidth} height="11px" style={{ margin: "4px 0 12px" }} />

                      <div className="pe-grid">
                        {[1, 2].map((item) => (
                          <div key={item} className="pe-item" style={{ pointerEvents: "none" }}>
                            <SkeletonPulse width="32px" height="32px" borderRadius="6px" />
                            <div className="pe-item-content" style={{ flex: 1 }}>
                              <div className="pe-item-title-row flex justify-between items-center mb-1">
                                <SkeletonPulse variant="text" width="130px" height="13px" />
                                <SkeletonPulse width="55px" height="18px" borderRadius="10px" />
                              </div>
                              <SkeletonPulse variant="text" width="85%" height="11px" />
                            </div>
                            <SkeletonPulse width="36px" height="20px" borderRadius="12px" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="pe-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <SkeletonPulse variant="text" width="220px" height="12px" />
                  <SkeletonPulse width="140px" height="36px" borderRadius="6px" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Collapsed Card */}
          <div className="sa2-card sa-perm-card sa-perm-card--collapsed">
            <div className="sa-perm-card-header">
              <div className="sa-perm-user-info">
                <SkeletonPulse width="40px" height="40px" borderRadius="8px" />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <SkeletonPulse variant="text" width="130px" height="14px" />
                  <SkeletonPulse variant="text" width="180px" height="12px" />
                </div>
              </div>
              <div className="sa-perm-meta flex items-center gap-2">
                <SkeletonPulse width="100px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="115px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="90px" height="24px" borderRadius="9999px" />
                <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat conversation list partial skeleton (Sidebar live reload) ──────────
export function ChatConversationListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {/* Group 1: Open */}
      <div className="space-y-1">
        <div className="px-2.5 py-1 flex items-center justify-between">
          <SkeletonPulse variant="text" width="60px" height="10px" />
          <SkeletonPulse width="20px" height="16px" borderRadius="9999px" />
        </div>
        {[
          { nameW: "120px", roomW: "140px", msgW: "90%", timeW: "45px", unread: true },
          { nameW: "100px", roomW: "120px", msgW: "75%", timeW: "35px", urgent: true },
          { nameW: "135px", roomW: "150px", msgW: "85%", timeW: "50px" },
        ].slice(0, Math.min(count, 3)).map((item, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-lg border border-transparent flex items-start gap-2.5"
          >
            <SkeletonPulse variant="circle" width="32px" style={{ flexShrink: 0 }} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <SkeletonPulse variant="text" width={item.nameW} height="13px" />
                <SkeletonPulse variant="text" width={item.timeW} height="10px" />
              </div>
              <SkeletonPulse variant="text" width={item.roomW} height="11px" />
              <SkeletonPulse variant="text" width={item.msgW} height="11px" />
            </div>
            {item.unread && (
              <SkeletonPulse width="18px" height="18px" borderRadius="9999px" style={{ flexShrink: 0 }} />
            )}
            {item.urgent && (
              <SkeletonPulse width="48px" height="16px" borderRadius="4px" style={{ flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Group 2: In Review */}
      {count > 3 && (
        <div className="space-y-1 pt-1">
          <div className="px-2.5 py-1 flex items-center justify-between">
            <SkeletonPulse variant="text" width="75px" height="10px" />
            <SkeletonPulse width="20px" height="16px" borderRadius="9999px" />
          </div>
          {[
            { nameW: "110px", roomW: "130px", msgW: "80%", timeW: "40px" },
            { nameW: "95px", roomW: "115px", msgW: "65%", timeW: "55px" },
          ].slice(0, count - 3).map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-transparent flex items-start gap-2.5"
            >
              <SkeletonPulse variant="circle" width="32px" style={{ flexShrink: 0 }} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <SkeletonPulse variant="text" width={item.nameW} height="13px" />
                  <SkeletonPulse variant="text" width={item.timeW} height="10px" />
                </div>
                <SkeletonPulse variant="text" width={item.roomW} height="11px" />
                <SkeletonPulse variant="text" width={item.msgW} height="11px" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat message feed partial skeleton (Message feed live reload) ──────────
export function ChatMessageFeedSkeleton({ count = 4 }) {
  const bubbles = [
    { isTenant: true, senderW: "110px", timeW: "60px", lines: ["85%", "60%"], avatar: "28px" },
    { isTenant: false, senderW: "90px", timeW: "55px", lines: ["70%", "90%", "40%"], avatar: "28px" },
    { isTenant: true, senderW: "110px", timeW: "60px", lines: ["50%"], avatar: "28px" },
    { isTenant: false, senderW: "90px", timeW: "55px", lines: ["80%", "45%"], avatar: "28px" },
  ];

  return (
    <div className="space-y-4" aria-hidden="true">
      {bubbles.slice(0, count).map((bubble, idx) => (
        <div
          key={idx}
          className={`flex items-end gap-2.5 ${
            bubble.isTenant ? "justify-start" : "justify-end flex-row-reverse"
          }`}
        >
          <SkeletonPulse variant="circle" width={bubble.avatar} style={{ flexShrink: 0, marginBottom: "4px" }} />
          <div
            className={`max-w-[78%] rounded-xl p-3.5 space-y-2 border border-border bg-card shadow-2xs ${
              bubble.isTenant ? "rounded-bl-xs" : "rounded-br-xs"
            }`}
            style={{ width: "65%" }}
          >
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-border/40">
              <SkeletonPulse variant="text" width={bubble.senderW} height="12px" />
              <SkeletonPulse variant="text" width={bubble.timeW} height="10px" />
            </div>
            <div className="space-y-1.5 pt-0.5">
              {bubble.lines.map((lineWidth, lineIdx) => (
                <SkeletonPulse key={lineIdx} variant="text" width={lineWidth} height="11px" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Chat full page skeleton (Support Chat Workspace) ────────────────────────
export function AdminChatSkeleton() {
  return (
    <section
      className="admin-chat-page space-y-4"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading support chat workspace"
    >
      {/* Pattern 1 Sticky Sub-Header matching AdminPageHeader */}
      <div className="admin-page-header admin-page-header--sticky">
        <div className="admin-page-header-top">
          <div className="admin-page-header-heading">
            <SkeletonPulse variant="text" width="140px" height="24px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="460px" height="13px" />
          </div>
          <div className="admin-page-header-side">
            <div className="admin-page-header-actions flex items-center gap-2">
              <SkeletonPulse width="90px" height="32px" borderRadius="8px" />
              <SkeletonPulse width="76px" height="28px" borderRadius="9999px" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        {[
          { labelW: "85px", valW: "40px" }, // Total Threads
          { labelW: "50px", valW: "32px" }, // Unread
          { labelW: "100px", valW: "32px" }, // Urgent Priority
          { labelW: "95px", valW: "32px" }, // Assigned to Me
        ].map((kpi, i) => (
          <div
            key={i}
            className="flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <SkeletonPulse variant="text" width={kpi.labelW} height="11px" />
              <SkeletonPulse width="32px" height="32px" borderRadius="8px" />
            </div>
            <SkeletonPulse variant="text" width={kpi.valW} height="24px" style={{ marginTop: "8px" }} />
          </div>
        ))}
      </div>

      {/* Main 2-Column Responsive Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] gap-4 items-start min-h-[640px]">
        {/* Left Sidebar: Conversations & Filters */}
        <aside className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-[700px] overflow-hidden">
          {/* Search & Filter Toolbar */}
          <div className="p-3 border-b border-border space-y-2.5 bg-card/60">
            {/* Search Input */}
            <SkeletonPulse width="100%" height="36px" borderRadius="8px" />

            {/* 4 Segmented Quick Tabs */}
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted border border-border">
              {["32px", "42px", "40px", "52px"].map((w, idx) => (
                <div key={idx} className="py-1 flex items-center justify-center">
                  <SkeletonPulse variant="text" width={w} height="12px" />
                </div>
              ))}
            </div>

            {/* Filter Trigger & Reset Link */}
            <div className="flex items-center justify-between pt-0.5">
              <SkeletonPulse width="80px" height="26px" borderRadius="6px" />
              <SkeletonPulse variant="text" width="50px" height="12px" />
            </div>
          </div>

          {/* Grouped Conversation Threads List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <ChatConversationListSkeleton count={5} />
          </div>
        </aside>

        {/* Right Chat Pane: Selected Thread & Message Feed */}
        <section className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-[720px] overflow-hidden">
          {/* Thread Header Bar */}
          <header className="p-3.5 border-b border-border bg-card/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SkeletonPulse variant="circle" width="40px" style={{ flexShrink: 0 }} />
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <SkeletonPulse variant="text" width="140px" height="16px" />
                  <SkeletonPulse variant="text" width="120px" height="12px" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SkeletonPulse width="110px" height="22px" borderRadius="6px" />
                  <SkeletonPulse width="80px" height="22px" borderRadius="6px" />
                  <SkeletonPulse width="85px" height="22px" borderRadius="6px" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <SkeletonPulse width="140px" height="28px" borderRadius="8px" />
              <SkeletonPulse width="95px" height="30px" borderRadius="8px" />
              <SkeletonPulse width="125px" height="30px" borderRadius="8px" />
            </div>
          </header>

          {/* Conversational Message Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/15 min-h-[440px]">
            <ChatMessageFeedSkeleton count={4} />
          </div>

          {/* Reply Composer Footer */}
          <footer className="p-3 border-t border-border bg-card space-y-2.5">
            {/* Quick Replies Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {["170px", "160px", "175px", "150px"].map((width, idx) => (
                <SkeletonPulse key={idx} width={width} height="26px" borderRadius="9999px" style={{ flexShrink: 0 }} />
              ))}
            </div>

            {/* AI Draft Suggestion & Textarea */}
            <div className="space-y-2">
              <SkeletonPulse width="130px" height="28px" borderRadius="6px" />
              <SkeletonPulse width="100%" height="70px" borderRadius="8px" />
            </div>

            {/* Composer Footer Actions */}
            <div className="flex items-center justify-between">
              <SkeletonPulse variant="text" width="60px" height="11px" />
              <SkeletonPulse width="105px" height="32px" borderRadius="8px" />
            </div>
          </footer>
        </section>
      </div>
    </section>
  );
}

// ─── Spinner-only fallback (kept for non-admin contexts) ─────────────────────
export function AdminSpinnerFallback() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "360px",
        width: "100%",
        padding: "48px 24px",
      }}
    >
      <div className="global-spinner" />
    </div>
  );
}

// ─── Branches workspace skeleton ────────────────────────────────────────────
export function AdminBranchesSkeleton() {
  return (
    <div
      className="sa2"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading branch management workspace"
    >
      {/* Page Header */}
      <div className="sa2-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <SkeletonPulse variant="text" width="130px" height="12px" style={{ marginBottom: "6px" }} />
          <SkeletonPulse variant="text" width="160px" height="28px" style={{ marginBottom: "8px" }} />
          <SkeletonPulse variant="text" width="460px" height="14px" />
        </div>
        <SkeletonPulse width="96px" height="38px" borderRadius="9999px" />
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="sa-branches-overview">
        {[
          { labelWidth: "120px", valWidth: "80px", metaWidth: "150px" },
          { labelWidth: "100px", valWidth: "60px", metaWidth: "180px" },
          { labelWidth: "110px", valWidth: "50px", metaWidth: "140px" },
          { labelWidth: "105px", valWidth: "55px", metaWidth: "190px" },
        ].map((card, idx) => (
          <div key={idx} className="sa-branches-overview-card">
            <SkeletonPulse variant="text" width={card.labelWidth} height="11px" style={{ marginBottom: "12px" }} />
            <SkeletonPulse variant="text" width={card.valWidth} height="28px" style={{ marginBottom: "10px" }} />
            <SkeletonPulse variant="text" width={card.metaWidth} height="12px" />
          </div>
        ))}
      </div>

      {/* 2 Branch Cards Grid */}
      <div className="sa-branches-grid">
        {[1, 2].map((i) => (
          <div key={i} className="sa-branch-card">
            {/* Branch Card Header */}
            <div className="sa-branch-card-header">
              <SkeletonPulse width="48px" height="48px" borderRadius="12px" style={{ flexShrink: 0 }} />
              <div className="sa-branch-card-heading">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <SkeletonPulse variant="text" width={i === 1 ? "150px" : "130px"} height="20px" />
                  <SkeletonPulse variant="text" width="80px" height="12px" />
                </div>
                <SkeletonPulse width="68px" height="26px" borderRadius="9999px" />
              </div>
            </div>

            {/* Occupancy Block */}
            <div className="sa-branch-occupancy">
              <div className="sa-branch-occupancy-header" style={{ marginBottom: "12px" }}>
                <SkeletonPulse variant="text" width="70px" height="13px" />
                <SkeletonPulse variant="text" width="50px" height="24px" />
              </div>
              <div className="sa2-bar-track" style={{ marginBottom: "8px" }}>
                <SkeletonPulse width={i === 1 ? "68%" : "54%"} height="8px" borderRadius="9999px" />
              </div>
              <SkeletonPulse variant="text" width="140px" height="12px" />
            </div>

            {/* 8 Stats Grid */}
            <div className="sa-branch-stats">
              {Array.from({ length: 8 }).map((_, statIdx) => (
                <div key={statIdx} className="sa-branch-stat-item">
                  <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <SkeletonPulse variant="text" width="36px" height="16px" />
                    <SkeletonPulse variant="text" width="70px" height="10px" />
                  </div>
                </div>
              ))}
            </div>

            {/* Assigned Admins Section */}
            <div className="sa-branch-admins">
              <div className="sa-branch-admins-header">
                <SkeletonPulse width="14px" height="14px" borderRadius="3px" />
                <SkeletonPulse variant="text" width="140px" height="12px" />
              </div>
              <div className="sa-branch-admins-list">
                <div className="sa-branch-admin-row">
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <SkeletonPulse variant="text" width="120px" height="14px" />
                    <SkeletonPulse variant="text" width="160px" height="11px" />
                  </div>
                  <SkeletonPulse width="88px" height="24px" borderRadius="9999px" />
                </div>
              </div>
            </div>

            {/* Quick Links Section */}
            <div className="sa-branch-links" style={{ marginTop: "18px" }}>
              <div className="sa-branch-admins-header">
                <SkeletonPulse width="14px" height="14px" borderRadius="3px" />
                <SkeletonPulse variant="text" width="85px" height="12px" />
              </div>
              <div className="sa-branch-link-grid">
                {[
                  { label: "Occupancy", desc: "Open the occupancy workspace" },
                  { label: "Accounts", desc: "Review branch-scoped accounts" },
                  { label: "Reservations", desc: "Inspect pending reservations" },
                  { label: "Overdue Billing", desc: "Jump to financial reporting" },
                  { label: "Maintenance", desc: "See open maintenance requests" },
                  { label: "Inquiries", desc: "Review pending inquiries" },
                ].map((link, linkIdx) => (
                  <div key={linkIdx} className="sa-branch-link-card" style={{ pointerEvents: "none" }}>
                    <SkeletonPulse variant="text" width="80px" height="14px" style={{ marginBottom: "4px" }} />
                    <SkeletonPulse variant="text" width="90%" height="11px" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Policies & Settings workspace skeleton ─────────────────────────────────
export function AdminPoliciesSettingsSkeleton() {
  return (
    <div
      className="sa2"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading settings and policies"
    >
      {/* Page Header */}
      <div className="sa2-header">
        <div>
          <SkeletonPulse variant="text" width="130px" height="12px" style={{ marginBottom: "6px" }} />
          <SkeletonPulse variant="text" width="220px" height="28px" style={{ marginBottom: "8px" }} />
          <SkeletonPulse variant="text" width="480px" height="14px" />
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border mb-6">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
          <SkeletonPulse variant="text" width="120px" height="14px" />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
          <SkeletonPulse variant="text" width="160px" height="14px" />
        </div>
      </div>

      {/* Metadata Bar (Inline Toolbar) */}
      <section className="sa-settings-meta-bar">
        <div className="sa-settings-meta-item">
          <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <SkeletonPulse variant="text" width="120px" height="10px" />
            <SkeletonPulse variant="text" width="160px" height="14px" />
          </div>
        </div>
        <div className="sa-settings-meta-divider" />
        <div className="sa-settings-meta-item">
          <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <SkeletonPulse variant="text" width="120px" height="10px" />
            <SkeletonPulse variant="text" width="140px" height="14px" />
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <SkeletonPulse width="140px" height="24px" borderRadius="9999px" />
        </div>
      </section>

      {/* Section 1: Financial & Billing Rules (2 Subgroups) */}
      <section className="sa-settings-section">
        <div className="sa-settings-section-header">
          <div>
            <SkeletonPulse variant="text" width="180px" height="20px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="360px" height="13px" />
          </div>
          <SkeletonPulse width="160px" height="26px" borderRadius="9999px" />
        </div>
        
        {/* Subgroup 1 (3 Cards) */}
        <div className="sa-settings-subgroup">
          <div className="sa-settings-subgroup-header">
            <SkeletonPulse variant="text" width="200px" height="14px" />
            <SkeletonPulse variant="text" width="300px" height="11px" />
          </div>
          <div className="sa-settings-form-grid sa-settings-form-grid--3col">
            {[1, 2, 3].map((_, idx) => (
              <div key={idx} className="sa-settings-field-card">
                <div className="sa-settings-field-header">
                  <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
                  <div className="sa-settings-field-heading">
                    <SkeletonPulse variant="text" width="110px" height="14px" />
                  </div>
                </div>
                <div className="sa-setting-preview-wrap">
                  <SkeletonPulse variant="text" width="80px" height="20px" style={{ marginBottom: "6px" }} />
                  <SkeletonPulse variant="text" width="95%" height="12px" />
                </div>
                <SkeletonPulse width="100%" height="38px" borderRadius="8px" />
              </div>
            ))}
          </div>
        </div>

        {/* Subgroup 2 (4 Cards) */}
        <div className="sa-settings-subgroup" style={{ marginTop: "20px" }}>
          <div className="sa-settings-subgroup-header">
            <SkeletonPulse variant="text" width="200px" height="14px" />
            <SkeletonPulse variant="text" width="300px" height="11px" />
          </div>
          <div className="sa-settings-form-grid sa-settings-form-grid--4col">
            {[1, 2, 3, 4].map((_, idx) => (
              <div key={idx} className="sa-settings-field-card">
                <div className="sa-settings-field-header">
                  <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
                  <div className="sa-settings-field-heading">
                    <SkeletonPulse variant="text" width="110px" height="14px" />
                  </div>
                </div>
                <div className="sa-setting-preview-wrap">
                  <SkeletonPulse variant="text" width="80px" height="20px" style={{ marginBottom: "6px" }} />
                  <SkeletonPulse variant="text" width="95%" height="12px" />
                </div>
                <SkeletonPulse width="100%" height="38px" borderRadius="8px" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Lease Pricing & Room Type Discounts (4 Cards) */}
      <section className="sa-settings-section">
        <div className="sa-settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <SkeletonPulse variant="text" width="220px" height="20px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="400px" height="13px" />
          </div>
          <SkeletonPulse width="170px" height="38px" borderRadius="10px" />
        </div>
        <div className="sa-settings-form-grid sa-settings-form-grid--4col">
          {[1, 2, 3, 4].map((_, idx) => (
            <div key={idx} className="sa-settings-field-card">
              <div className="sa-settings-field-header">
                <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
                <div className="sa-settings-field-heading">
                  <SkeletonPulse variant="text" width="110px" height="14px" />
                </div>
              </div>
              <div className="sa-setting-preview-wrap">
                <SkeletonPulse variant="text" width="70px" height="20px" style={{ marginBottom: "6px" }} />
                <SkeletonPulse variant="text" width="95%" height="12px" />
              </div>
              <SkeletonPulse width="100%" height="38px" borderRadius="8px" />
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Branch Governance (2 Cards) */}
      <section className="sa-settings-section">
        <div className="sa-settings-section-header">
          <div>
            <SkeletonPulse variant="text" width="260px" height="20px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="420px" height="13px" />
          </div>
          <SkeletonPulse width="140px" height="26px" borderRadius="9999px" />
        </div>
        <div className="sa-branch-matrix-grid">
          {[1, 2].map((i) => (
            <div key={i} className="sa-branch-matrix-card">
              <div className="sa-branch-matrix-header">
                <SkeletonPulse width="38px" height="38px" borderRadius="8px" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <SkeletonPulse variant="text" width="140px" height="16px" />
                  <SkeletonPulse variant="text" width="80px" height="11px" />
                </div>
                <SkeletonPulse width="90px" height="24px" borderRadius="9999px" />
              </div>
              <SkeletonPulse width="100%" height="70px" borderRadius="8px" />
              <SkeletonPulse width="100%" height="60px" borderRadius="8px" style={{ marginTop: "12px" }} />
            </div>
          ))}
        </div>
      </section>

      {/* Settings Footer */}
      <footer className="sa-settings-footer">
        <SkeletonPulse variant="text" width="220px" height="12px" />
        <SkeletonPulse width="140px" height="38px" borderRadius="8px" />
      </footer>
    </div>
  );
}

// ─── System Backup skeleton ──────────────────────────────────────────────────
export function AdminSystemBackupSkeleton() {
  return (
    <div
      className="backup-page"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading system backup workspace"
    >
      {/* Header */}
      <div className="backup-page__header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SkeletonPulse width="24px" height="24px" borderRadius="6px" />
          <SkeletonPulse variant="text" width="180px" height="26px" />
        </div>
        <SkeletonPulse variant="text" width="440px" height="14px" style={{ marginTop: "4px" }} />
      </div>

      {/* Configuration Card */}
      <div className="backup-config-card">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
          <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
          <SkeletonPulse variant="text" width="160px" height="18px" />
        </div>

        <div className="backup-config-grid">
          {/* Automatic Backup toggle box */}
          <div className="backup-toggle-row">
            <div className="backup-toggle-label">
              <SkeletonPulse variant="text" width="130px" height="15px" style={{ marginBottom: "4px" }} />
              <SkeletonPulse variant="text" width="180px" height="12px" />
            </div>
            <SkeletonPulse width="44px" height="24px" borderRadius="12px" />
          </div>

          {/* Interval selector */}
          <div className="backup-interval-group">
            <SkeletonPulse variant="text" width="120px" height="12px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse width="100%" height="42px" borderRadius="8px" />
          </div>
        </div>

        {/* Actions bar */}
        <div className="backup-actions">
          <div className="backup-actions__info">
            <SkeletonPulse variant="text" width="240px" height="13px" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SkeletonPulse width="120px" height="38px" borderRadius="6px" />
            <SkeletonPulse width="150px" height="38px" borderRadius="6px" />
          </div>
        </div>
      </div>

      {/* History Card */}
      <div className="backup-history-card">
        <div className="backup-history-card__header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
            <SkeletonPulse variant="text" width="130px" height="18px" />
          </div>
          <SkeletonPulse width="80px" height="30px" borderRadius="6px" />
        </div>

        {/* Table */}
        <table className="backup-table">
          <thead>
            <tr>
              {["Date", "Type", "Status", "Size", "Duration", "Triggered By", "Actions"].map((head, idx) => (
                <th key={idx} style={{ textAlign: head === "Actions" ? "right" : "left" }}>
                  <SkeletonPulse
                    variant="text"
                    width={head === "Actions" ? "50px" : "70px"}
                    height="12px"
                    style={head === "Actions" ? { marginLeft: "auto" } : {}}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { typeW: "65px", statusW: "75px", sizeW: "60px", durW: "40px", trigW: "110px" },
              { typeW: "75px", statusW: "75px", sizeW: "55px", durW: "45px", trigW: "70px" },
              { typeW: "65px", statusW: "60px", sizeW: "58px", durW: "35px", trigW: "120px" },
              { typeW: "75px", statusW: "75px", sizeW: "62px", durW: "42px", trigW: "95px" },
              { typeW: "65px", statusW: "75px", sizeW: "50px", durW: "38px", trigW: "80px" },
            ].map((row, i) => (
              <tr key={i}>
                <td><SkeletonPulse variant="text" width="120px" height="13px" /></td>
                <td><SkeletonPulse width={row.typeW} height="22px" borderRadius="9999px" /></td>
                <td><SkeletonPulse width={row.statusW} height="22px" borderRadius="9999px" /></td>
                <td><SkeletonPulse variant="text" width={row.sizeW} height="13px" /></td>
                <td><SkeletonPulse variant="text" width={row.durW} height="13px" /></td>
                <td><SkeletonPulse variant="text" width={row.trigW} height="13px" /></td>
                <td>
                  <div className="backup-table-actions" style={{ justifyContent: "flex-end" }}>
                    <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
                    <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
                    <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="backup-pagination">
          <div className="backup-pagination__left">
            <SkeletonPulse variant="text" width="90px" height="13px" />
            <SkeletonPulse width="60px" height="28px" borderRadius="4px" />
            <SkeletonPulse variant="text" width="90px" height="13px" />
          </div>
          <div className="backup-pagination__buttons">
            <SkeletonPulse width="30px" height="28px" borderRadius="6px" />
            <SkeletonPulse variant="text" width="40px" height="14px" />
            <SkeletonPulse width="30px" height="28px" borderRadius="6px" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics AI Insight Skeleton ──────────────────────────────────────────
function SkelAnalyticsInsight() {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid var(--border, #e2e8f0)",
        background: "var(--card, #fff)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          background: "var(--muted, #f8fafc)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SkeletonPulse width="24px" height="24px" borderRadius="6px" />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <SkeletonPulse variant="text" width="160px" height="14px" />
            <SkeletonPulse variant="text" width="280px" height="11px" />
          </div>
        </div>
        <SkeletonPulse width="50px" height="14px" borderRadius="4px" />
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <SkeletonPulse variant="text" width="90%" height="13px" />
        <SkeletonPulse variant="text" width="75%" height="13px" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "4px" }}>
          <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", background: "var(--background, #f8fafc)" }}>
            <SkeletonPulse variant="text" width="100px" height="11px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="90%" height="12px" />
          </div>
          <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", background: "var(--background, #f8fafc)" }}>
            <SkeletonPulse variant="text" width="110px" height="11px" style={{ marginBottom: "6px" }} />
            <SkeletonPulse variant="text" width="85%" height="12px" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Table Skeleton ───────────────────────────────────────────────
function SkelAnalyticsTable({
  columns = ["20%", "15%", "15%", "15%", "15%", "10%"],
  searchPlaceholderWidth = "220px",
  filterCount = 2,
  rows = 5,
}) {
  return (
    <div
      style={{
        borderRadius: "10px",
        border: "1px solid var(--border, #e2e8f0)",
        background: "var(--card, #fff)",
        overflow: "hidden",
      }}
    >
      {/* Table Header / Title */}
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <SkeletonPulse variant="text" width="180px" height="16px" />
          <SkeletonPulse variant="text" width="320px" height="12px" />
        </div>
        <SkeletonPulse width="80px" height="32px" borderRadius="8px" />
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Table Filter Toolbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
            padding: "12px",
            background: "var(--muted, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", flex: 1 }}>
            <SkeletonPulse width={searchPlaceholderWidth} height="32px" borderRadius="8px" />
            {Array.from({ length: filterCount }).map((_, i) => (
              <SkeletonPulse key={i} width="140px" height="32px" borderRadius="8px" />
            ))}
          </div>
          <SkeletonPulse variant="text" width="110px" height="12px" />
        </div>

        {/* Data Table */}
        <div style={{ borderRadius: "8px", border: "1px solid var(--border, #e2e8f0)", overflow: "hidden" }}>
          {/* Column headers */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--muted, #f8fafc)",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {columns.map((colWidth, idx) => (
              <SkeletonPulse key={idx} variant="text" width={colWidth} height="11px" />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div
              key={rIdx}
              style={{
                padding: "14px 16px",
                borderBottom: rIdx < rows - 1 ? "1px solid var(--border, #e2e8f0)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              {columns.map((colWidth, cIdx) => (
                <div key={cIdx} style={{ width: colWidth, display: "flex", alignItems: "center" }}>
                  {cIdx === columns.length - 1 ? (
                    <SkeletonPulse width="50px" height="20px" borderRadius="10px" />
                  ) : (
                    <SkeletonPulse variant="text" width="70%" height="12px" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Pagination Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", paddingTop: "4px" }}>
          <SkeletonPulse variant="text" width="120px" height="12px" />
          <div style={{ display: "flex", gap: "6px" }}>
            <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
            <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Tab Content Detail Skeleton ──────────────────────────────────
export function AdminAnalyticsDetailSkeleton({ tab = "occupancy", isOwner = false }) {
  if (tab === "overview") {
    return (
      <div className="analytics-tab-content active" aria-busy="true" aria-live="polite">
        {/* 4 KPI stat cards */}
        <div className="analytics-kpi-grid">
          {[
            { labelW: "85px", valW: "65px", changeW: "120px" },
            { labelW: "105px", valW: "90px", changeW: "110px" },
            { labelW: "75px", valW: "45px", changeW: "115px" },
            { labelW: "80px", valW: "45px", changeW: "115px" },
          ].map((kpi, i) => (
            <div key={i} className="analytics-kpi-card" style={{ pointerEvents: "none" }}>
              <SkeletonPulse width="30px" height="30px" borderRadius="6px" style={{ marginBottom: "12px" }} />
              <SkeletonPulse variant="text" width={kpi.labelW} height="11px" style={{ marginBottom: "6px" }} />
              <SkeletonPulse variant="text" width={kpi.valW} height="24px" style={{ marginBottom: "6px" }} />
              <SkeletonPulse variant="text" width={kpi.changeW} height="11px" />
            </div>
          ))}
        </div>

        {/* 4 Chart Cards Grid (2x2) */}
        <div className="analytics-charts-grid">
          {/* Card 1: Occupancy Trend */}
          <div className="analytics-chart-card">
            <div className="analytics-chart-card-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <SkeletonPulse variant="text" width="120px" height="15px" />
                <SkeletonPulse variant="text" width="150px" height="12px" />
              </div>
              <SkeletonPulse width="105px" height="28px" borderRadius="6px" />
            </div>
            <div className="analytics-chart-card-body">
              <SkeletonPulse width="100%" height="140px" borderRadius="8px" />
            </div>
          </div>

          {/* Card 2: Revenue Collections */}
          <div className="analytics-chart-card">
            <div className="analytics-chart-card-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <SkeletonPulse variant="text" width="135px" height="15px" />
                <SkeletonPulse variant="text" width="170px" height="12px" />
              </div>
              <SkeletonPulse width="105px" height="28px" borderRadius="6px" />
            </div>
            <div className="analytics-chart-card-body">
              <SkeletonPulse width="100%" height="140px" borderRadius="8px" />
            </div>
          </div>

          {/* Card 3: Reservation Activity */}
          <div className="analytics-chart-card">
            <div className="analytics-chart-card-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <SkeletonPulse variant="text" width="135px" height="15px" />
                <SkeletonPulse variant="text" width="120px" height="12px" />
              </div>
              <SkeletonPulse width="105px" height="28px" borderRadius="6px" />
            </div>
            <div className="analytics-chart-card-body">
              <SkeletonPulse width="100%" height="140px" borderRadius="8px" />
            </div>
          </div>

          {/* Card 4: Period Comparison */}
          <div className="analytics-chart-card">
            <div className="analytics-chart-card-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <SkeletonPulse variant="text" width="130px" height="15px" />
                <SkeletonPulse variant="text" width="145px" height="12px" />
              </div>
            </div>
            <div className="analytics-chart-card-body">
              {[
                { labelW: "100px", valW: "45px", changeW: "50px" },
                { labelW: "115px", valW: "75px", changeW: "45px" },
                { labelW: "90px", valW: "35px", changeW: "40px" },
                { labelW: "95px", valW: "35px", changeW: "40px" },
              ].map((row, i) => (
                <div key={i} className="analytics-metric-row">
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <SkeletonPulse variant="text" width={row.labelW} height="13px" />
                    <SkeletonPulse variant="text" width="80px" height="10px" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                    <SkeletonPulse variant="text" width={row.valW} height="15px" />
                    <SkeletonPulse variant="text" width={row.changeW} height="11px" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detailed tab skeleton (Occupancy, Billing, Operations, Demographics, Consolidated, Financials, Monitoring)
  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1" aria-busy="true" aria-live="polite">
      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--card, #fff)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonPulse variant="text" width="60%" height="11px" />
              <SkeletonPulse width="28px" height="28px" borderRadius="6px" />
            </div>
            <SkeletonPulse variant="text" width="45%" height="22px" />
            <SkeletonPulse variant="text" width="75%" height="10px" />
          </div>
        ))}
      </div>

      {/* AI Insight Section */}
      {tab !== "acquisition" && <SkelAnalyticsInsight />}

      {/* 2x2 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1 */}
        <div
          style={{
            borderRadius: "10px",
            border: "1px solid var(--border, #e2e8f0)",
            background: "var(--card, #fff)",
            overflow: "hidden",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <SkeletonPulse variant="text" width="130px" height="15px" />
              <SkeletonPulse variant="text" width="180px" height="11px" />
            </div>
            <SkeletonPulse width="90px" height="26px" borderRadius="6px" />
          </div>
          <SkeletonPulse width="100%" height="160px" borderRadius="8px" />
        </div>

        {/* Panel 2 */}
        <div
          style={{
            borderRadius: "10px",
            border: "1px solid var(--border, #e2e8f0)",
            background: "var(--card, #fff)",
            overflow: "hidden",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <SkeletonPulse variant="text" width="120px" height="15px" />
              <SkeletonPulse variant="text" width="160px" height="11px" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "160px" }}>
            <SkeletonPulse variant="circle" width="120px" />
          </div>
        </div>
      </div>

      {/* Secondary 2-col or Table depending on tab */}
      <SkelAnalyticsTable
        columns={
          tab === "occupancy"
            ? ["15%", "15%", "15%", "12%", "12%", "12%", "10%"]
            : tab === "billing" || tab === "revenue" || tab === "financials"
            ? ["20%", "15%", "15%", "15%", "15%", "10%"]
            : ["18%", "18%", "14%", "14%", "14%", "12%"]
        }
        searchPlaceholderWidth={
          tab === "occupancy"
            ? "240px"
            : tab === "billing" || tab === "revenue"
            ? "220px"
            : "200px"
        }
        filterCount={tab === "occupancy" ? 2 : 1}
      />
    </div>
  );
}

// ─── Main AdminAnalyticsSkeleton (Full Page matching AnalyticsPage) ──────────
export function AdminAnalyticsSkeleton({ activeTab = "overview", isOwner = false }) {
  const tabs = [
    { key: "overview", labelW: "60px" },
    { key: "occupancy", labelW: "70px" },
    { key: "revenue", labelW: "105px" },
    { key: "operations", labelW: "75px" },
    { key: "demographics", labelW: "85px" },
    ...(isOwner
      ? [
          { key: "consolidated", labelW: "80px" },
          { key: "financials", labelW: "75px" },
          { key: "monitoring", labelW: "80px" },
        ]
      : []),
  ];

  return (
    <div
      className="analytics-container"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading analytics workspace"
    >
      {/* Top Bar matching .analytics-topbar */}
      <div className="analytics-topbar">
        <div className="analytics-topbar-row">
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonPulse variant="text" width="120px" height="22px" />
            <SkeletonPulse variant="text" width="220px" height="13px" />
          </div>
          <div className="analytics-topbar-actions">
            <SkeletonPulse width="90px" height="34px" borderRadius="8px" />
          </div>
        </div>

        {/* Segmented Navigation Tabs matching .analytics-tabs */}
        <div className="analytics-tabs">
          {tabs.map((t) => (
            <div
              key={t.key}
              className="analytics-tab"
              style={{ pointerEvents: "none", borderBottomColor: "transparent", background: "transparent" }}
            >
              <SkeletonPulse variant="circle" width="15px" />
              <SkeletonPulse variant="text" width={t.labelW} height="13px" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="analytics-layout">
        <main className="analytics-main">
          <AdminAnalyticsDetailSkeleton tab={activeTab} isOwner={isOwner} />
        </main>
      </div>
    </div>
  );
}


