import React, { useEffect, useRef } from "react";
import { X, RotateCcw, Calendar, Home, Clock, Layers } from "lucide-react";

export default function ReservationFilterDrawer({
  isOpen,
  onClose,
  filters,
  onChange,
  statusFilter = "all",
  onStatusFilterChange,
  onReset,
  reservations = [],
  isOwner = false,
}) {
  const drawerRef = useRef(null);

  // Derive unique room types from loaded reservations
  const roomTypeOptions = React.useMemo(() => {
    const types = new Set();
    reservations.forEach((r) => {
      if (r.roomType) types.add(r.roomType);
    });
    return Array.from(types).sort();
  }, [reservations]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFieldChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="res-drawer-backdrop">
      <div className="res-drawer" ref={drawerRef}>
        <div className="res-drawer__header">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span>Extended Reservation Filters</span>
          </div>
          <button
            type="button"
            className="res-icon-btn"
            onClick={onClose}
            title="Close filter drawer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="res-drawer__body space-y-5">
          {/* Reservation Lifecycle Status */}
          <div className="res-drawer__section">
            <label className="res-drawer__label">
              <Layers size={14} className="text-muted-foreground" />
              <span>Reservation Status</span>
            </label>
            <select
              value={statusFilter || "all"}
              onChange={(e) => onStatusFilterChange?.(e.target.value)}
              className="res-drawer__select"
            >
              <option value="all">All Active Statuses</option>
              <option value="new">New Applications</option>
              <option value="under_review">Under Review</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="approved_for_payment">Approved for Payment</option>
              <option value="reserved">Reserved</option>
              <option value="moveIn">Move In</option>
              <option value="overdue">Overdue Move-In</option>
              <option value="cancellation_requested">Cancellation Requested</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              {isOwner && <option value="archived">Archived</option>}
            </select>
          </div>

          {/* Move-In Date Range */}
          <div className="res-drawer__section">
            <label className="res-drawer__label">
              <Calendar size={14} className="text-muted-foreground" />
              <span>Move-In Date Timeframe</span>
            </label>
            <select
              value={filters.moveIn || "any"}
              onChange={(e) => handleFieldChange("moveIn", e.target.value)}
              className="res-drawer__select"
            >
              <option value="any">Any Move-In Date</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="next_30_days">Next 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {filters.moveIn === "custom" && (
              <div className="res-drawer__date-row">
                <input
                  type="date"
                  value={filters.moveInStart || ""}
                  onChange={(e) => handleFieldChange("moveInStart", e.target.value)}
                  className="res-drawer__input-date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={filters.moveInEnd || ""}
                  onChange={(e) => handleFieldChange("moveInEnd", e.target.value)}
                  className="res-drawer__input-date"
                />
              </div>
            )}
          </div>

          {/* Application Submitted Date */}
          <div className="res-drawer__section">
            <label className="res-drawer__label">
              <Clock size={14} className="text-muted-foreground" />
              <span>Application Submitted</span>
            </label>
            <select
              value={filters.applicationDate || "any"}
              onChange={(e) => handleFieldChange("applicationDate", e.target.value)}
              className="res-drawer__select"
            >
              <option value="any">Any Time</option>
              <option value="last_24h">Last 24 Hours</option>
              <option value="last_7d">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range...</option>
            </select>

            {filters.applicationDate === "custom" && (
              <div className="res-drawer__date-row">
                <input
                  type="date"
                  value={filters.appDateStart || ""}
                  onChange={(e) => handleFieldChange("appDateStart", e.target.value)}
                  className="res-drawer__input-date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={filters.appDateEnd || ""}
                  onChange={(e) => handleFieldChange("appDateEnd", e.target.value)}
                  className="res-drawer__input-date"
                />
              </div>
            )}
          </div>

          {/* Room Type */}
          <div className="res-drawer__section">
            <label className="res-drawer__label">
              <Home size={14} className="text-muted-foreground" />
              <span>Room Category / Type</span>
            </label>
            <select
              value={filters.roomType || "any"}
              onChange={(e) => handleFieldChange("roomType", e.target.value)}
              className="res-drawer__select"
            >
              <option value="any">All Room Types</option>
              {roomTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="res-drawer__footer">
          <button
            type="button"
            onClick={onReset}
            className="res-drawer__btn-reset"
          >
            <RotateCcw size={14} />
            <span>Reset All</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="res-drawer__btn-apply"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
