import SkeletonPulse from "./SkeletonPulse";

const lineWidths = ["78%", "58%", "70%", "46%", "64%", "52%"];

export function CardSkeleton({ lines = 3, height = 120, className = "", style }) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        border: "1px solid var(--border-light, var(--border-card, #e5e7eb))",
        background: "var(--bg-card, var(--surface-card, #fff))",
        borderRadius: 12,
        padding: 16,
        minHeight: height,
        ...style,
      }}
    >
      <SkeletonPulse width="42%" height="14px" style={{ marginBottom: 14 }} />
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonPulse
          key={index}
          width={lineWidths[index % lineWidths.length]}
          height={index === 0 ? "18px" : "12px"}
          style={{ marginBottom: index === lines - 1 ? 0 : 10 }}
        />
      ))}
    </div>
  );
}

export function StatGridSkeleton({
  count = 4,
  minWidth = 150,
  columns,
  className = "",
  style,
}) {
  const gridTemplateColumns =
    columns != null
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(${minWidth}px, 1fr))`;

  return (
    <div
      className={className}
      aria-busy="true"
      aria-label="Loading content"
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: 12,
        ...style,
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} lines={2} height={96} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4, avatar = false, className = "", style }) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-label="Loading content"
      style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            border: "1px solid var(--border-light, var(--border-card, #e5e7eb))",
            background: "var(--bg-card, var(--surface-card, #fff))",
            borderRadius: 10,
            padding: 14,
          }}
        >
          {avatar && <SkeletonPulse variant="circle" width="42px" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonPulse width={lineWidths[index % lineWidths.length]} height="14px" />
            <SkeletonPulse width="38%" height="11px" style={{ marginTop: 8 }} />
          </div>
          <SkeletonPulse width="72px" height="24px" borderRadius="999px" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5, className = "", style }) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-label="Loading content"
      style={{
        overflowX: "auto",
        border: "1px solid var(--border-light, var(--border-card, #e5e7eb))",
        borderRadius: 10,
        background: "var(--bg-card, var(--surface-card, #fff))",
        ...style,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light, var(--border-card, #e5e7eb))" }}>
                <SkeletonPulse width={index === 0 ? "70px" : "54px"} height="10px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={columnIndex} style={{ padding: "15px 16px", borderBottom: rowIndex === rows - 1 ? 0 : "1px solid var(--border-light, var(--border-card, #e5e7eb))" }}>
                  <SkeletonPulse
                    width={lineWidths[(rowIndex + columnIndex) % lineWidths.length]}
                    height="13px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DrawerSkeleton({ rows = 5, className = "", style }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading content" style={{ padding: 4, ...style }}>
      <SkeletonPulse width="48%" height="18px" style={{ marginBottom: 18 }} />
      <StatGridSkeleton count={2} minWidth={180} style={{ marginBottom: 16 }} />
      <ListSkeleton rows={rows} avatar />
    </div>
  );
}

export function PageSkeleton({ stats = 4, cards = 2, tableColumns = 5, tableRows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading content" style={{ display: "grid", gap: 18 }}>
      <div>
        <SkeletonPulse width="220px" height="24px" style={{ marginBottom: 10 }} />
        <SkeletonPulse width="360px" height="13px" />
      </div>
      {stats > 0 && <StatGridSkeleton count={stats} />}
      {cards > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {Array.from({ length: cards }).map((_, index) => (
            <CardSkeleton key={index} lines={4} height={180} />
          ))}
        </div>
      )}
      <TableSkeleton columns={tableColumns} rows={tableRows} />
    </div>
  );
}
