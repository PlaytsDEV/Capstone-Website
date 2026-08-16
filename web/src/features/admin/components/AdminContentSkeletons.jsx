import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";
import "../../super-admin/styles/superadmin-dashboard.css";
import "../../super-admin/styles/superadmin-permissions.css";
import "../styles/permission-editor.css";
import "../../super-admin/styles/superadmin-branches.css";
import "../../super-admin/styles/superadmin-settings.css";
import "../styles/admin-backup.css";

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
      aria-label="Loading policies and maintenance settings"
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

