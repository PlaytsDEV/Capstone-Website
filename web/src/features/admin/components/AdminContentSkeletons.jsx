import React from "react";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";

/**
 * Content-only skeletons for Admin and Super-Admin inside pages.
 * Rendered inside <main className="admin-content"> during Suspense lazy route transitions.
 * Zero duplicate sidebars or topbars!
 */

// 1. Dashboard Skeleton
export function AdminDashboardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonPulse width="180px" height="26px" style={{ marginBottom: 8 }} />
          <SkeletonPulse width="340px" height="14px" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse width="130px" height="34px" borderRadius="8px" />
          <SkeletonPulse width="110px" height="34px" borderRadius="8px" />
        </div>
      </div>

      {/* 5 KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-5 bg-card"
            style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
          >
            <div className="flex justify-between items-center mb-3">
              <SkeletonPulse width="80px" height="11px" />
              <SkeletonPulse width="16px" height="16px" borderRadius="4px" />
            </div>
            <SkeletonPulse width="60px" height="28px" style={{ marginBottom: 6 }} />
            <SkeletonPulse width="110px" height="11px" />
          </div>
        ))}
      </div>

      {/* Middle Grid (Inquiries + Status Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 rounded-xl border p-6 bg-card"
          style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
        >
          <div className="flex justify-between items-center mb-6">
            <SkeletonPulse width="160px" height="20px" />
            <SkeletonPulse width="80px" height="14px" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-transparent" style={{ background: "rgba(0,0,0,0.02)" }}>
                <div className="flex items-center gap-3">
                  <SkeletonPulse width="40px" height="40px" borderRadius="10px" />
                  <div>
                    <SkeletonPulse width="130px" height="14px" style={{ marginBottom: 6 }} />
                    <SkeletonPulse width="180px" height="12px" />
                  </div>
                </div>
                <SkeletonPulse width="70px" height="22px" borderRadius="6px" />
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl border p-6 bg-card"
          style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
        >
          <SkeletonPulse width="140px" height="20px" style={{ marginBottom: 16 }} />
          <div className="flex justify-center py-6">
            <SkeletonPulse variant="circle" width="160px" />
          </div>
          <div className="space-y-3 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <SkeletonPulse width="90px" height="13px" />
                <SkeletonPulse width="30px" height="13px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Table Page Skeleton (Reservations, Tenants, Billing, Audit Logs, Users, Inquiries, Notifications, System Backup)
export function AdminTablePageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonPulse width="200px" height="26px" style={{ marginBottom: 8 }} />
          <SkeletonPulse width="320px" height="14px" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse width="120px" height="38px" borderRadius="8px" />
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border"
        style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
      >
        <SkeletonPulse width="260px" height="36px" borderRadius="8px" />
        <div className="flex items-center gap-3">
          <SkeletonPulse width="130px" height="36px" borderRadius="8px" />
          <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="rounded-xl border p-6 bg-card"
        style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
      >
        {/* Table Headers */}
        <div className="grid grid-cols-5 gap-4 pb-4 border-b" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
          <SkeletonPulse width="100px" height="12px" />
          <SkeletonPulse width="120px" height="12px" />
          <SkeletonPulse width="90px" height="12px" />
          <SkeletonPulse width="80px" height="12px" />
          <SkeletonPulse width="60px" height="12px" style={{ justifySelf: "end" }} />
        </div>

        {/* Table Rows */}
        <div className="divide-y" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-5 gap-4 items-center py-4">
              <div className="flex items-center gap-3">
                <SkeletonPulse variant="circle" width="32px" />
                <SkeletonPulse width="110px" height="14px" />
              </div>
              <SkeletonPulse width="130px" height="13px" />
              <SkeletonPulse width="90px" height="13px" />
              <SkeletonPulse width="80px" height="24px" borderRadius="999px" />
              <SkeletonPulse width="70px" height="30px" borderRadius="6px" style={{ justifySelf: "end" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. Card Grid Skeleton (Room Availability, Branch Management)
export function AdminCardGridSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonPulse width="220px" height="26px" style={{ marginBottom: 8 }} />
          <SkeletonPulse width="340px" height="14px" />
        </div>
        <SkeletonPulse width="140px" height="38px" borderRadius="8px" />
      </div>

      {/* Tabs / Filter Row */}
      <div className="flex items-center gap-3">
        <SkeletonPulse width="100px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="120px" height="36px" borderRadius="8px" />
        <SkeletonPulse width="110px" height="36px" borderRadius="8px" />
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-6 bg-card flex flex-col gap-4"
            style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
          >
            <div className="flex justify-between items-center">
              <SkeletonPulse width="140px" height="18px" />
              <SkeletonPulse width="65px" height="22px" borderRadius="999px" />
            </div>
            <SkeletonPulse width="100%" height="120px" borderRadius="10px" />
            <div className="space-y-2">
              <SkeletonPulse width="85%" height="13px" />
              <SkeletonPulse width="60%" height="13px" />
            </div>
            <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
              <SkeletonPulse width="90px" height="14px" />
              <SkeletonPulse width="80px" height="32px" borderRadius="8px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Form / Settings Page Skeleton (System Settings, Role Permissions)
export function AdminFormPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SkeletonPulse width="240px" height="26px" style={{ marginBottom: 8 }} />
          <SkeletonPulse width="360px" height="14px" />
        </div>
        <SkeletonPulse width="130px" height="38px" borderRadius="8px" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-5 bg-card flex items-center gap-4"
            style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
          >
            <SkeletonPulse width="42px" height="42px" borderRadius="10px" />
            <div>
              <SkeletonPulse width="90px" height="12px" style={{ marginBottom: 6 }} />
              <SkeletonPulse width="50px" height="22px" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Settings Card */}
      <div
        className="rounded-xl border p-6 bg-card flex flex-col gap-6"
        style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
      >
        <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
          <div>
            <SkeletonPulse width="180px" height="18px" style={{ marginBottom: 4 }} />
            <SkeletonPulse width="280px" height="12px" />
          </div>
          <SkeletonPulse width="200px" height="36px" borderRadius="8px" />
        </div>

        {/* Form Fields / Toggle List */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "var(--border-light, #f1f5f9)" }}>
            <div className="flex items-center gap-3">
              <SkeletonPulse width="36px" height="36px" borderRadius="8px" />
              <div>
                <SkeletonPulse width="160px" height="14px" style={{ marginBottom: 4 }} />
                <SkeletonPulse width="220px" height="12px" />
              </div>
            </div>
            <SkeletonPulse width="44px" height="24px" borderRadius="999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 5. Chat Page Skeleton
export function AdminChatSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-[calc(100vh-140px)] gap-4">
      {/* Left Conversations Sidebar */}
      <div
        className="w-80 rounded-xl border p-4 bg-card flex flex-col gap-4"
        style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
      >
        <SkeletonPulse width="120px" height="20px" />
        <SkeletonPulse width="100%" height="34px" borderRadius="8px" />
        <div className="space-y-3 overflow-hidden flex-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-transparent">
              <SkeletonPulse variant="circle" width="38px" />
              <div className="flex-1">
                <SkeletonPulse width="100px" height="13px" style={{ marginBottom: 4 }} />
                <SkeletonPulse width="130px" height="11px" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Chat Panel */}
      <div
        className="flex-1 rounded-xl border p-6 bg-card flex flex-col justify-between"
        style={{ borderColor: "var(--border-light, #e2e8f0)", background: "var(--bg-card, #ffffff)" }}
      >
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
          <div className="flex items-center gap-3">
            <SkeletonPulse variant="circle" width="40px" />
            <div>
              <SkeletonPulse width="120px" height="16px" style={{ marginBottom: 4 }} />
              <SkeletonPulse width="80px" height="12px" />
            </div>
          </div>
        </div>

        <div className="space-y-4 py-6">
          <div className="flex gap-3 max-w-[60%]">
            <SkeletonPulse variant="circle" width="32px" />
            <SkeletonPulse width="220px" height="48px" borderRadius="12px" />
          </div>
          <div className="flex gap-3 max-w-[60%] ml-auto justify-end">
            <SkeletonPulse width="180px" height="40px" borderRadius="12px" />
          </div>
          <div className="flex gap-3 max-w-[60%]">
            <SkeletonPulse variant="circle" width="32px" />
            <SkeletonPulse width="260px" height="54px" borderRadius="12px" />
          </div>
        </div>

        <div className="pt-4 border-t flex gap-3" style={{ borderColor: "var(--border-light, #e2e8f0)" }}>
          <SkeletonPulse width="100%" height="40px" borderRadius="8px" />
          <SkeletonPulse width="80px" height="40px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}
