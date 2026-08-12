import React from "react";
import { Search, Filter, Download, ChevronDown } from "lucide-react";

export default function AuditToolbar({
  filters,
  showFilters,
  onSearch,
  onToggleFilters,
  onFilterChange,
  onExport,
  isExporting = false,
}) {
  return (
    <div className="audit-filters-header">
      <div className="audit-filters-main">
        <div className="audit-search">
          <Search className="audit-search-icon" size={18} />
          <input
            type="text"
            placeholder="Search logs by action, user, or details..."
            value={filters?.search || ""}
            onChange={onSearch}
            aria-label="Search logs"
          />
        </div>
        <button
          type="button"
          className={`audit-filter-btn ${showFilters ? "audit-filter-btn--active" : ""}`}
          onClick={onToggleFilters}
          title={showFilters ? "Hide detailed filter options" : "Show detailed filter options"}
        >
          <Filter size={18} />
          <span>Filters</span>
          <ChevronDown
            size={16}
            style={{
              transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>
        <button
          type="button"
          className="audit-export-btn"
          onClick={onExport}
          disabled={isExporting}
          title={
            isExporting
              ? "Exporting audit logs in progress..."
              : "Export current audit logs matching active filters as JSON"
          }
        >
          <Download size={18} />
          <span>{isExporting ? "Exporting..." : "Export"}</span>
        </button>
      </div>
    </div>
  );
}

