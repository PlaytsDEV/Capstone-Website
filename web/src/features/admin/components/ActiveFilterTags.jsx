import React from "react";
import { X } from "lucide-react";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";

const MOVE_IN_LABELS = {
  today: "Move-In: Today",
  this_week: "Move-In: This Week",
  this_month: "Move-In: This Month",
  next_30_days: "Move-In: Next 30 Days",
  custom: "Move-In: Custom Range",
};

const APP_DATE_LABELS = {
  last_24h: "Submitted: Last 24 Hours",
  last_7d: "Submitted: Last 7 Days",
  this_month: "Submitted: This Month",
  custom: "Submitted: Custom Range",
};

const STATUS_LABELS = {
  all: "All Active",
  new: "New Applications",
  pending_review: "Pending Review",
  pending_application_review: "Under Review",
  needs_revision: "Needs Revision",
  approved_for_payment: "Approved for Payment",
  payment_pending: "Payment Pending",
  reserved: "Reserved",
  overdue: "Overdue Move-In",
  cancellation_requested: "Cancellation Requested",
  moveIn: "Move In",
  cancelled: "Cancelled",
  archived: "Archived",
};

export default function ActiveFilterTags({
  searchTerm,
  onClearSearch,
  statusFilter,
  onClearStatus,
  branchFilter,
  onClearBranch,
  advancedFilters = {},
  onClearAdvancedField,
  onClearAll,
  isOwner = false,
}) {
  const tags = [];

  if (searchTerm && searchTerm.trim()) {
    tags.push({
      id: "search",
      label: `Search: "${searchTerm.trim()}"`,
      onRemove: onClearSearch,
    });
  }

  if (isOwner && branchFilter && branchFilter !== "all") {
    const opt = OWNER_BRANCH_FILTER_OPTIONS.find((o) => o.value === branchFilter);
    tags.push({
      id: "branch",
      label: `Branch: ${opt?.label || branchFilter}`,
      onRemove: onClearBranch,
    });
  }

  if (statusFilter && statusFilter !== "all") {
    tags.push({
      id: "status",
      label: `Status: ${STATUS_LABELS[statusFilter] || statusFilter.replace(/_/g, " ")}`,
      onRemove: onClearStatus,
    });
  }

  if (advancedFilters.moveIn && advancedFilters.moveIn !== "any") {
    tags.push({
      id: "moveIn",
      label: MOVE_IN_LABELS[advancedFilters.moveIn] || `Move-In: ${advancedFilters.moveIn}`,
      onRemove: () => onClearAdvancedField("moveIn"),
    });
  }

  if (advancedFilters.applicationDate && advancedFilters.applicationDate !== "any") {
    tags.push({
      id: "appDate",
      label: APP_DATE_LABELS[advancedFilters.applicationDate] || `App Date: ${advancedFilters.applicationDate}`,
      onRemove: () => onClearAdvancedField("applicationDate"),
    });
  }

  if (advancedFilters.roomType && advancedFilters.roomType !== "any") {
    tags.push({
      id: "roomType",
      label: `Room Type: ${advancedFilters.roomType}`,
      onRemove: () => onClearAdvancedField("roomType"),
    });
  }

  if (tags.length === 0) return null;

  return (
    <div className="res-filter-tags">
      <span className="res-filter-tags__title">Active Filters:</span>
      <div className="res-filter-tags__list">
        {tags.map((tag) => (
          <span key={tag.id} className="res-filter-tag">
            <span>{tag.label}</span>
            <button
              type="button"
              className="res-filter-tag__remove"
              onClick={tag.onRemove}
              title={`Remove ${tag.label}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {tags.length >= 1 && (
          <button
            type="button"
            className="res-filter-tag--clear-all"
            onClick={onClearAll}
            title="Reset all active filters and scopes"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
