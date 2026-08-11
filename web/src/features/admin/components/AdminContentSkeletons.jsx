import React from "react";
import "../../../shared/components/GlobalLoading.css";

/**
 * Plain circular spinner fallbacks for Admin and Super-Admin inside pages.
 */

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

export function AdminDashboardSkeleton() {
  return <AdminSpinnerFallback />;
}

export function AdminTablePageSkeleton() {
  return <AdminSpinnerFallback />;
}

export function AdminCardGridSkeleton() {
  return <AdminSpinnerFallback />;
}

export function AdminFormPageSkeleton() {
  return <AdminSpinnerFallback />;
}

export function AdminChatSkeleton() {
  return <AdminSpinnerFallback />;
}
