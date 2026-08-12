import React from "react";

export default function AuditFilterPanel({ filters = {}, onFilterChange }) {
  return (
    <div className="audit-filters-panel">
      <div className="filter-group">
        <label htmlFor="audit-filter-type">Activity Type</label>
        <select
          id="audit-filter-type"
          value={filters.type || "all"}
          onChange={(e) => onFilterChange("type", e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="login">Login/Logout</option>
          <option value="registration">Registration</option>
          <option value="data_modification">Data Modifications</option>
          <option value="data_deletion">Data Deletions</option>
          <option value="error">Errors</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="audit-filter-severity">Severity</label>
        <select
          id="audit-filter-severity"
          value={filters.severity || "all"}
          onChange={(e) => onFilterChange("severity", e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="audit-filter-date">Date Range</label>
        <select
          id="audit-filter-date"
          value={filters.dateRange || "all"}
          onChange={(e) => onFilterChange("dateRange", e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="1days">Last 24 Hours</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="audit-filter-role">User Role</label>
        <select
          id="audit-filter-role"
          value={filters.role || "all"}
          onChange={(e) => onFilterChange("role", e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="applicant">Applicant</option>
          <option value="tenant">Tenant</option>
          <option value="branch_admin">Branch Admin</option>
          <option value="owner">Owner</option>
        </select>
      </div>
    </div>
  );
}

