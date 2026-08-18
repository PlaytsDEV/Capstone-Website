import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  User,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  SlidersHorizontal,
} from "lucide-react";
import logo from "../../../../assets/images/LOGO.svg";
import ProfileAvatar, { getProfileInitials } from "../../../../shared/components/ProfileAvatar";
import { formatDisplayName } from "../../../../shared/utils/formatDate";


/**
 * Redesigned header — single row: Logo | Filter Bar | Sign In + Quick Suggestion Pills
 * Memoized to prevent header re-renders on card interactions and state updates.
 */
const AvailabilityHeader = React.memo(({
  user,
  searchQuery,
  setSearchQuery,
  selectedBranch,
  onBranchFilter,
  selectedRoomType,
  onRoomTypeFilter,
  availableRoomTypes,
  selectedLeaseTermFilter = "All",
  onLeaseTermFilterChange,
  maxPrice,
  setMaxPrice,
  onClearAll,
  onLogout,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Local slider state — only commits to parent on release (prevents jitter)
  const [localPrice, setLocalPrice] = useState(maxPrice);
  useEffect(() => { setLocalPrice(maxPrice); }, [maxPrice]);

  const handleSliderChange = (e) => setLocalPrice(Number(e.target.value));
  const handleSliderCommit = () => setMaxPrice(localPrice);

  const priceLabel =
    localPrice >= 15000
      ? "Any Price"
      : `Up to ₱${localPrice.toLocaleString()}`;

  const userInitials = getProfileInitials(user, "?");
  const userDisplayName = user
    ? formatDisplayName(
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.name ||
          user.fullName ||
          user.username ||
          (user.email ? user.email.split("@")[0] : "") ||
          "User"
      )
    : "Guest";


  // Global keyboard shortcut '/' to focus search and 'Esc' to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, setSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleBadge = (role) => {
    const map = {
      owner: {
        dot: "var(--chart-3, #d97706)",
        color: "var(--chart-3, #d97706)",
        label: "Owner",
      },
      branch_admin: {
        dot: "var(--info, #2563eb)",
        color: "var(--info-dark, #1e40af)",
        label: "Branch Admin",
      },
      tenant: {
        dot: "var(--primary, #0a1628)",
        color: "var(--primary, #0a1628)",
        label: "Tenant",
      },
    };
    const cfg = map[role] || {
      dot: "var(--success, #059669)",
      color: "var(--success-dark, #065f46)",
      label: "Applicant",
    };
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wide border border-slate-200 dark:border-slate-700 bg-transparent"
        style={{
          color: cfg.color,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: cfg.dot }}
        />
        {cfg.label}
      </span>
    );
  };

  const hasActiveFilters =
    selectedBranch !== "All" ||
    selectedRoomType !== "All" ||
    selectedLeaseTermFilter !== "All" ||
    maxPrice !== 15000 ||
    searchQuery.trim() !== "";

  // Active secondary filter count for the Filters toggle button
  const activeSecondaryFiltersCount = [
    selectedBranch !== "All",
    selectedRoomType !== "All",
    selectedLeaseTermFilter !== "All",
    maxPrice !== 15000,
  ].filter(Boolean).length;

  return (
    <header className="sticky top-0 z-50 ca-header-root" style={{ backgroundColor: "var(--surface-card)", borderBottom: "1px solid var(--border-divider)" }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Main Header Row */}
        <div className="ca-header-row">
          {/* Logo */}
          <Link
            to="/"
            className="ca-logo"
            aria-label="Lilycrest Home"
          >
            <img
              src={logo}
              alt="Lilycrest logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
            />
            <span
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ color: "var(--text-heading)" }}
            >
              Lilycrest
            </span>
          </Link>

          {/* Unified Filter Bar / Search Container */}
          <div className="ca-filter-bar">
            {/* Search Input Wrap */}
            <div className="ca-search-wrap">
              <Search className="ca-search-icon" size={17} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search rooms, branches, amenities (e.g. WiFi, Aircon)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ca-search-input"
                aria-label="Search rooms"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="ca-search-clear-btn"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  title="Clear search text (Esc)"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="ca-search-shortcut-badge" title="Press / to search">
                  /
                </span>
              )}
            </div>

            {/* Filter Toggle Button (visible on tablet, laptop, and mobile viewports) */}
            <button
              type="button"
              className={`ca-mobile-filter-toggle ${mobileFiltersOpen ? "ca-mobile-filter-toggle--active" : ""}`}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-label="Toggle filter options"
              aria-expanded={mobileFiltersOpen}
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Filters</span>
              {activeSecondaryFiltersCount > 0 && (
                <span className="ca-filter-count-badge">
                  {activeSecondaryFiltersCount}
                </span>
              )}
            </button>

            {/* Inline Controls group (visible only on large desktop screens >= 1280px) */}
            <div className="ca-filter-controls--desktop">
              {/* Branch dropdown */}
              <select
                className="ca-filter-select"
                value={selectedBranch}
                onChange={(e) => onBranchFilter(e.target.value)}
                aria-label="Filter by branch"
              >
                <option value="All">All Branches</option>
                <option value="Gil Puyat">Gil Puyat</option>
                <option value="Guadalupe">Guadalupe</option>
              </select>

              {/* Room Type dropdown */}
              <select
                className="ca-filter-select"
                value={selectedRoomType}
                onChange={(e) => onRoomTypeFilter(e.target.value)}
                aria-label="Filter by room type"
              >
                {availableRoomTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "All" ? "All Types" : type}
                  </option>
                ))}
              </select>

              {/* Lease Term dropdown */}
              <select
                className="ca-filter-select"
                value={selectedLeaseTermFilter}
                onChange={(e) => onLeaseTermFilterChange && onLeaseTermFilterChange(e.target.value)}
                aria-label="Filter by stay type"
              >
                <option value="All">All Stay Types</option>
                <option value="longTerm">Long-Term (6+ mos)</option>
                <option value="shortTerm">Short-Term (1–5 mos)</option>
              </select>

              {/* Price range slider — local state, commits on release */}
              <div className="ca-price-slider-wrap">
                <span className="ca-price-label">{priceLabel}</span>
                <input
                  type="range"
                  className="ca-price-slider"
                  min={3000}
                  max={15000}
                  step={500}
                  value={localPrice}
                  onChange={handleSliderChange}
                  onMouseUp={handleSliderCommit}
                  onTouchEnd={handleSliderCommit}
                  aria-label="Filter by maximum price"
                />
              </div>

              {/* Clear — always rendered to prevent layout shift */}
              <button
                className="ca-clear-btn"
                onClick={onClearAll}
                style={{ visibility: hasActiveFilters ? "visible" : "hidden" }}
                title="Reset all search queries and filters"
              >
                Clear
              </button>
            </div>
          </div>

          {/* User menu / Sign In */}
          <div className="ca-header-user">
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`ca-user-trigger ${showUserMenu ? "ca-user-trigger--open" : ""}`}
                  aria-label="User menu"
                  aria-expanded={showUserMenu}
                >
                  <div className="ca-user-trigger-avatar">
                    <ProfileAvatar user={user} initials={userInitials} size={34} />
                  </div>
                  <span className="ca-user-trigger-name capitalize">
                    {userDisplayName}
                  </span>
                  <ChevronDown
                    className="w-4 h-4 ca-user-trigger-chevron shrink-0"
                  />
                </button>

                {showUserMenu && (
                  <div
                    className="ca-user-popover"
                    role="menu"
                  >
                    {/* User identity */}
                    <div className="ca-user-identity-card">
                      <div className="flex items-center gap-2.5">
                        <ProfileAvatar user={user} initials={userInitials} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="text-[13px] font-semibold truncate leading-none capitalize"
                              style={{ color: "var(--text-heading)" }}
                            >
                              {userDisplayName}
                            </p>
                            {roleBadge(user?.role)}
                          </div>

                          <p
                            className="text-[11px] truncate mt-1.5 leading-tight"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {user?.email || ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Nav links */}
                    <div>
                      <Link
                        to="/applicant/profile"
                        className="ca-user-menu-item ca-user-menu-item--profile"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <div className="ca-user-menu-icon">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="ca-user-menu-title">
                            My Profile
                          </p>
                          <p className="ca-user-menu-sub">
                            View your dashboard
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 ca-user-menu-arrow" />
                      </Link>
                    </div>

                    {/* Divider */}
                    <div className="ca-user-menu-divider" />

                    {/* Sign Out */}
                    <div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="ca-user-menu-item ca-user-menu-item--logout"
                      >
                        <div className="ca-user-menu-icon">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span className="ca-user-menu-title flex-1">
                          Sign Out
                        </span>
                        <ChevronRight className="w-4 h-4 ca-user-menu-arrow" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="ca-signin-btn"
                aria-label="Sign In"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>

        {/* Collapsible Secondary Filter Shelf (for Laptop, Tablet & Mobile) */}
        {mobileFiltersOpen && (
          <div className="ca-filter-shelf-panel">
            <div className="ca-filter-shelf-grid">
              {/* Branch */}
              <div className="ca-shelf-field">
                <label className="ca-shelf-field-label">Branch</label>
                <select
                  className="ca-filter-select ca-filter-select--full"
                  value={selectedBranch}
                  onChange={(e) => onBranchFilter(e.target.value)}
                  aria-label="Filter by branch"
                >
                  <option value="All">All Branches</option>
                  <option value="Gil Puyat">Gil Puyat</option>
                  <option value="Guadalupe">Guadalupe</option>
                </select>
              </div>

              {/* Room Type */}
              <div className="ca-shelf-field">
                <label className="ca-shelf-field-label">Room Type</label>
                <select
                  className="ca-filter-select ca-filter-select--full"
                  value={selectedRoomType}
                  onChange={(e) => onRoomTypeFilter(e.target.value)}
                  aria-label="Filter by room type"
                >
                  {availableRoomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Types" : type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stay Type */}
              <div className="ca-shelf-field">
                <label className="ca-shelf-field-label">Stay Type</label>
                <select
                  className="ca-filter-select ca-filter-select--full"
                  value={selectedLeaseTermFilter}
                  onChange={(e) => onLeaseTermFilterChange && onLeaseTermFilterChange(e.target.value)}
                  aria-label="Filter by stay type"
                >
                  <option value="All">All Stay Types</option>
                  <option value="longTerm">Long-Term (6+ mos)</option>
                  <option value="shortTerm">Short-Term (1–5 mos)</option>
                </select>
              </div>

              {/* Price Slider */}
              <div className="ca-shelf-field ca-shelf-field--slider">
                <div className="flex items-center justify-between mb-1">
                  <label className="ca-shelf-field-label mb-0">Max Price</label>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-heading)" }}>
                    {priceLabel}
                  </span>
                </div>
                <input
                  type="range"
                  className="ca-price-slider"
                  min={3000}
                  max={15000}
                  step={500}
                  value={localPrice}
                  onChange={handleSliderChange}
                  onMouseUp={handleSliderCommit}
                  onTouchEnd={handleSliderCommit}
                  aria-label="Filter by maximum price"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="ca-shelf-actions">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="ca-shelf-reset-btn"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
});

export default AvailabilityHeader;
