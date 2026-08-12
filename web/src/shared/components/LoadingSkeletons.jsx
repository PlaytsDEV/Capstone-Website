import React from "react";
import "./GlobalLoading.css";

/**
 * Replaced all layout skeleton primitives with clean circular loading spinners
 */
export function InlineSpinner({ style }) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        width: "100%",
        ...style,
      }}
    >
      <div className="global-spinner" />
    </div>
  );
}

export function CardSkeleton({ height = 120, className = "", style }) {
  return <InlineSpinner style={{ minHeight: height, ...style }} />;
}

export function StatGridSkeleton({ count = 4, minWidth = 150, columns, className = "", style }) {
  return <InlineSpinner style={{ minHeight: 120, ...style }} />;
}

export function ListSkeleton({ rows = 4, avatar = false, className = "", style }) {
  return <InlineSpinner style={{ minHeight: 160, ...style }} />;
}

export function TableSkeleton({ rows = 5, columns = 5, className = "", style }) {
  return <InlineSpinner style={{ minHeight: 200, ...style }} />;
}

export function DrawerSkeleton({ rows = 5, className = "", style }) {
  return <InlineSpinner style={{ minHeight: 200, ...style }} />;
}

export function PageSkeleton() {
  return <InlineSpinner style={{ minHeight: 300, ...style }} />;
}

export function InquiryPipelineSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", padding: "16px" }}>
      <CardSkeleton height={280} />
      <CardSkeleton height={280} />
      <CardSkeleton height={280} />
    </div>
  );
}

export function MoveOutClearanceSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
      <CardSkeleton height={140} />
      <CardSkeleton height={200} />
    </div>
  );
}

export function DisputeModalSkeleton() {
  return <InlineSpinner style={{ minHeight: 220 }} />;
}
