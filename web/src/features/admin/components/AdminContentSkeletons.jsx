import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";

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

      {/* 6 KPI summary stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
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
            {/* Urgency & SLA */}
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

// ─── Card-grid skeleton (Room Availability, Branches) ────────────────────────
export function AdminCardGridSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonPulse variant="text" width="160px" height="20px" />
          <SkeletonPulse variant="text" width="240px" height="12px" />
        </div>
        <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--border-light, #e5e7eb)",
              background: "var(--bg-card, #fff)",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <SkeletonPulse width="100%" height="120px" borderRadius="8px" />
            <SkeletonPulse variant="text" width="60%" height="14px" />
            <SkeletonPulse variant="text" width="80%" height="11px" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonPulse width="50px" height="22px" borderRadius="6px" />
              <SkeletonPulse width="70px" height="22px" borderRadius="6px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

// ─── Chat skeleton ────────────────────────────────────────────────────────────
export function AdminChatSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true" style={{ display: "flex", height: "calc(100vh - 64px)" }}>
      {/* Sidebar */}
      <div style={{ width: "280px", flexShrink: 0, borderRight: "1px solid var(--border-light, #e5e7eb)", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <SkeletonPulse width="100%" height="36px" borderRadius="8px" style={{ marginBottom: "8px" }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px" }}>
            <SkeletonPulse variant="circle" width="38px" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <SkeletonPulse variant="text" width="70%" height="13px" />
              <SkeletonPulse variant="text" width="50%" height="11px" />
            </div>
          </div>
        ))}
      </div>
      {/* Message pane */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", gap: "14px" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" }}>
            {i % 2 === 0 && <SkeletonPulse variant="circle" width="32px" />}
            <SkeletonPulse
              width={`${30 + (i * 7) % 30}%`}
              height="44px"
              borderRadius="12px"
            />
          </div>
        ))}
        <div style={{ marginTop: "auto" }}>
          <SkeletonPulse width="100%" height="48px" borderRadius="10px" />
        </div>
      </div>
    </div>
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

