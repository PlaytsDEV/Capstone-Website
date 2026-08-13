import React from "react";
import "./LoadingSkeletons.css";

/* ─── Base shimmer block ─────────────────────────────────────────────────── */
function Shimmer({ className = "", style }) {
  return (
    <div
      className={`sk-shimmer ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/* ─── InlineSpinner — kept for cases that explicitly want a spinner ────────*/
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
      <div className="sk-spinner" />
    </div>
  );
}

/* ─── Stat / KPI card grid skeleton ─────────────────────────────────────── */
export function StatGridSkeleton({ count = 4, className = "", style }) {
  return (
    <div
      className={`sk-stat-grid ${className}`}
      style={style}
      aria-busy="true"
      aria-label="Loading statistics"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-stat-card">
          <div className="sk-stat-card__header">
            <Shimmer className="sk-stat-card__icon" />
            <Shimmer className="sk-stat-card__label" />
          </div>
          <Shimmer className="sk-stat-card__value" />
        </div>
      ))}
    </div>
  );
}

/* ─── Table skeleton ─────────────────────────────────────────────────────── */
export function TableSkeleton({ rows = 5, columns = 5, className = "", style }) {
  return (
    <div
      className={`sk-table ${className}`}
      style={style}
      aria-busy="true"
      aria-label="Loading table"
    >
      {/* Header */}
      <div className="sk-table__header">
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer key={i} className="sk-table__th" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="sk-table__row">
          {/* First column: avatar + two text lines */}
          <div className="sk-table__cell sk-table__cell--avatar">
            <Shimmer className="sk-table__avatar" />
            <div className="sk-table__cell-lines">
              <Shimmer className="sk-table__line sk-table__line--name" />
              <Shimmer className="sk-table__line sk-table__line--sub" />
            </div>
          </div>
          {/* Remaining columns */}
          {Array.from({ length: columns - 1 }).map((_, colIdx) => (
            <div key={colIdx} className="sk-table__cell">
              <Shimmer
                className="sk-table__line"
                style={{ width: colIdx === columns - 2 ? "60px" : `${65 + (colIdx * 7) % 25}%` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Generic card skeleton ──────────────────────────────────────────────── */
export function CardSkeleton({ height = 120, className = "", style }) {
  return (
    <div
      className={`sk-card ${className}`}
      style={{ minHeight: height, ...style }}
      aria-busy="true"
      aria-label="Loading"
    >
      <Shimmer className="sk-card__title" />
      <Shimmer className="sk-card__body" />
      <Shimmer className="sk-card__body sk-card__body--short" />
    </div>
  );
}

/* ─── List skeleton ──────────────────────────────────────────────────────── */
export function ListSkeleton({ rows = 4, avatar = false, className = "", style }) {
  return (
    <div className={`sk-list ${className}`} style={style} aria-busy="true" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-list__row">
          {avatar && <Shimmer className="sk-list__avatar" />}
          <div className="sk-list__lines">
            <Shimmer className="sk-list__line sk-list__line--name" />
            <Shimmer className="sk-list__line sk-list__line--sub" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Drawer / sidebar skeleton ─────────────────────────────────────────── */
export function DrawerSkeleton({ rows = 5, className = "", style }) {
  return (
    <div className={`sk-drawer ${className}`} style={style} aria-busy="true" aria-label="Loading">
      <Shimmer className="sk-drawer__title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-drawer__field">
          <Shimmer className="sk-drawer__label" />
          <Shimmer className="sk-drawer__input" />
        </div>
      ))}
    </div>
  );
}

/* ─── Full-page skeleton ─────────────────────────────────────────────────── */
export function PageSkeleton() {
  return (
    <div className="sk-page" aria-busy="true" aria-label="Loading page">
      <Shimmer className="sk-page__heading" />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

/* ─── Inquiry pipeline skeleton ──────────────────────────────────────────── */
export function InquiryPipelineSkeleton() {
  return (
    <div className="sk-pipeline" aria-busy="true" aria-label="Loading pipeline">
      {[0, 1, 2].map((i) => (
        <div key={i} className="sk-pipeline__col">
          <Shimmer className="sk-pipeline__col-header" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="sk-pipeline__card">
              <Shimmer className="sk-pipeline__card-title" />
              <Shimmer className="sk-pipeline__card-sub" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Move-out clearance skeleton ────────────────────────────────────────── */
export function MoveOutClearanceSkeleton() {
  return (
    <div className="sk-moveout" aria-busy="true" aria-label="Loading clearance">
      <CardSkeleton height={140} />
      <CardSkeleton height={200} />
    </div>
  );
}

/* ─── Dispute modal skeleton ─────────────────────────────────────────────── */
export function DisputeModalSkeleton() {
  return (
    <div className="sk-modal" aria-busy="true" aria-label="Loading">
      <Shimmer className="sk-modal__title" />
      <Shimmer className="sk-modal__body" />
      <Shimmer className="sk-modal__body sk-modal__body--short" />
    </div>
  );
}
