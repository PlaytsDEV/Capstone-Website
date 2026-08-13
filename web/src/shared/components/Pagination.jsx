import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Reusable, high-contrast Pagination component following Lilycrest DMS design system.
 * Uses solid HSL color tokens, clean 1px borders, and responsive flex layouts.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page number (1-based)
 * @param {number} props.totalPages - Total calculated pages
 * @param {number} props.totalItems - Total total count of items
 * @param {number} props.itemsPerPage - Number of items shown per page
 * @param {Function} props.onPageChange - Callback fired on page change: (newPage: number) => void
 * @param {Function} [props.onLimitChange] - Callback fired on limit change: (newLimit: number) => void
 * @param {number[]} [props.pageSizeOptions=[5, 10, 20, 50]] - Options for rows per page dropdown
 * @param {string} [props.itemLabel="items"] - Plural/singular item label (e.g. "inquiries", "vacancies")
 * @param {"numbered" | "compact"} [props.variant="numbered"] - Display style for page navigation controls
 * @param {number} [props.maxVisiblePages=5] - Maximum numbered pills to display
 * @param {string} [props.className=""] - Additional container wrapper CSS classes
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemLabel = "items",
  variant = "numbered",
  maxVisiblePages = 5,
  className = "",
}) {
  if (totalItems <= 0 && totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const actualTotalPages = Math.max(1, totalPages || Math.ceil(totalItems / itemsPerPage) || 1);

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(actualTotalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handlePageClick = (page) => {
    if (page < 1 || page > actualTotalPages || page === currentPage) return;
    if (onPageChange) {
      onPageChange(page);
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Summary Info & Items Per Page Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">{startItem}</span> to{" "}
          <span className="font-semibold text-foreground">{endItem}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span>{" "}
          {itemLabel}
        </p>

        {onLimitChange && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <label htmlFor="rows-per-page-select" className="cursor-pointer">
              Rows per page:
            </label>
            <select
              id="rows-per-page-select"
              value={itemsPerPage}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                if (onLimitChange) onLimitChange(newLimit);
                if (onPageChange) onPageChange(1);
              }}
              style={{
                backgroundColor: "var(--input-background, var(--bg-card))",
                borderColor: "var(--border-light, var(--border))",
              }}
              className="px-2.5 py-1 text-xs border rounded-lg text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1.5">
        {/* Previous Button */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => handlePageClick(currentPage - 1)}
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-light, var(--border))",
          }}
          className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground cursor-pointer"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          <span>Previous</span>
        </button>

        {/* Page Buttons / Indicator */}
        {variant === "compact" ? (
          <span className="px-3 py-1.5 text-xs font-semibold text-foreground">
            Page {currentPage} of {actualTotalPages}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            {getPageNumbers()[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => handlePageClick(1)}
                  className="h-8 min-w-[32px] px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer bg-card text-foreground border-border hover:bg-muted"
                >
                  1
                </button>
                {getPageNumbers()[0] > 2 && (
                  <span className="px-1 text-xs text-muted-foreground select-none">...</span>
                )}
              </>
            )}

            {getPageNumbers().map((pNum) => {
              const isActive = currentPage === pNum;
              return (
                <button
                  type="button"
                  key={pNum}
                  onClick={() => handlePageClick(pNum)}
                  aria-current={isActive ? "page" : undefined}
                  className={`h-8 min-w-[32px] px-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            {getPageNumbers()[getPageNumbers().length - 1] < actualTotalPages && (
              <>
                {getPageNumbers()[getPageNumbers().length - 1] < actualTotalPages - 1 && (
                  <span className="px-1 text-xs text-muted-foreground select-none">...</span>
                )}
                <button
                  type="button"
                  onClick={() => handlePageClick(actualTotalPages)}
                  className="h-8 min-w-[32px] px-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer bg-card text-foreground border-border hover:bg-muted"
                >
                  {actualTotalPages}
                </button>
              </>
            )}
          </div>
        )}

        {/* Next Button */}
        <button
          type="button"
          disabled={currentPage >= actualTotalPages}
          onClick={() => handlePageClick(currentPage + 1)}
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-light, var(--border))",
          }}
          className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-foreground cursor-pointer"
          title="Next Page"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>
    </div>
  );
}
