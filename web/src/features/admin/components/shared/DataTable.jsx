import { useMemo, useState } from "react";
import {
 ChevronUp,
 ChevronDown,
 ChevronLeft,
 ChevronRight,
} from "lucide-react";
import EmptyState from "./EmptyState";

/**
 * DataTable — Sortable, paginated, clickable table.
 *
 * Props:
 * columns: [{ key, label, sortable?, render?, width?, align? }]
 * data: array of row objects
 * pagination: { page, pageSize, total, onPageChange }
 * onRowClick: (row) => void
 * emptyState: { icon?, title, description? }
 * loading: boolean
 */
export default function DataTable({
  columns = [],
  data = [],
  pagination,
  onRowClick,
  onRowHover,
  onRowFocus,
  emptyState,
  loading = false,
  sorting = "client",
  sortKey: externalSortKey = null,
  sortDir: externalSortDir = "asc",
  onSortChange,
  serverPagination = false,
  disableRowInteraction = false,
  density = "compact",
}) {
  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const activeSortKey = sorting === "external" ? externalSortKey : sortKey;
  const activeSortDir = sorting === "external" ? externalSortDir : sortDir;

  const handleSort = (key) => {
    if (sorting === "external") {
      const nextDir =
        activeSortKey === key && activeSortDir === "asc" ? "desc" : "asc";
      onSortChange?.(key, nextDir);
      return;
    }
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (sorting === "external" || !sortKey) return safeData;
    return [...safeData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === "string" ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [safeData, sortKey, sortDir, sorting]);

  // Pagination
  const pageSize = pagination?.pageSize || safeData.length || 1;
  const currentPage = pagination?.page || 1;
  const total = pagination?.total ?? safeData.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Slice data for the current page
  const pagedData = pagination
    ? serverPagination
      ? sortedData
      : sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  const isCompact = density === "compact";
  const headerPadding = isCompact ? "px-3 py-2.5" : "px-4 py-3";
  const cellPadding = isCompact ? "px-3 py-2.5 text-xs font-medium" : "px-4 py-4 text-sm";

  if (!loading && safeData.length === 0 && emptyState) {
    return (
      <EmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        description={emptyState.description}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => {
                const sortField = col.sortKey || col.key;
                return (
                  <th
                    key={col.key}
                    className={`border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${headerPadding} ${col.sortable ? "cursor-pointer hover:text-foreground" : ""} ${col.align === "right" ? "text-right" : ""} ${col.align === "center" ? "text-center" : ""}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable && handleSort(sortField)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable &&
                        activeSortKey === sortField &&
                        (activeSortDir === "asc" ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {loading
              ? Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    {columns.map((col) => (
                      <td key={col.key} className={cellPadding}>
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : pagedData.map((row, i) => (
                  <tr
                    key={row.id || row._id || i}
                    className={`transition-colors hover:bg-muted/50 ${onRowClick ? "cursor-pointer" : ""} ${disableRowInteraction ? "cursor-default" : ""}`}
                    onMouseEnter={() => onRowHover?.(row)}
                    onFocus={() => onRowFocus?.(row)}
                    onClickCapture={(e) => {
                      if (!disableRowInteraction) return;
                      const target = e.target;
                      if (!(target instanceof Element)) return;
                      if (target.closest("[data-action-cell], [data-action-portal='true']")) return;
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      if (disableRowInteraction) return;
                      if (!onRowClick) return;

                      const target = e.target;
                      if (!(target instanceof Element)) {
                        onRowClick(row);
                        return;
                      }

                      // Don't fire row click if the event came from an action cell
                      if (target.closest("[data-action-cell]")) return;
                      onRowClick(row);
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${cellPadding} text-muted-foreground ${col.align === "right" ? "text-right" : ""} ${col.align === "center" ? "text-center" : ""}`}
                        {...(col.align === "right"
                          ? { "data-action-cell": "true" }
                          : {})}
                      >
                        {col.render ? col.render(row) : (row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (total > 0 || pageCount > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              {total} result{total !== 1 ? "s" : ""}
            </span>
            {pagination.onPageSizeChange && (
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    pagination.onPageSizeChange(Number(e.target.value));
                    pagination.onPageChange?.(1);
                  }}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                disabled={currentPage <= 1}
                onClick={() => pagination.onPageChange(currentPage - 1)}
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="min-w-[48px] text-center text-xs font-medium text-muted-foreground">
                {currentPage} / {pageCount}
              </span>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
                disabled={currentPage >= pageCount}
                onClick={() => pagination.onPageChange(currentPage + 1)}
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
