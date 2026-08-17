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
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.email ||
      "User"
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
        bg: "color-mix(in srgb, var(--chart-3, #d97706) 14%, var(--card, #fff))",
        color: "var(--chart-3, #d97706)",
        label: "Owner",
      },
      branch_admin: {
        bg: "color-mix(in srgb, var(--info, #2563eb) 14%, var(--card, #fff))",
        color: "var(--info-dark, #1e40af)",
        label: "Branch Admin",
      },
      tenant: {
        bg: "color-mix(in srgb, var(--primary, #0a1628) 12%, var(--card, #fff))",
        color: "var(--primary, #0a1628)",
        label: "Tenant",
      },
    };
    const cfg = map[role] || {
      bg: "color-mix(in srgb, var(--success, #059669) 14%, var(--card, #fff))",
      color: "var(--success-dark, #065f46)",
      label: "Applicant",
    };
    return (
      <span
        className="shrink-0 px-1.5 py-px text-[9px] font-semibold rounded uppercase tracking-wide border"
        style={{
          backgroundColor: cfg.bg,
          color: cfg.color,
          borderColor: "color-mix(in srgb, currentColor 20%, transparent)",
        }}
      >
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

  // Active filter count for mobile badge
  const activeFiltersCount = [
    selectedBranch !== "All",
    selectedRoomType !== "All",
    selectedLeaseTermFilter !== "All",
    maxPrice !== 15000,
    searchQuery.trim() !== "",
  ].filter(Boolean).length;

  const quickTags = [
    { label: "All Rooms", action: () => onClearAll() },
    {
      label: "Guadalupe",
      action: () => onBranchFilter(selectedBranch === "Guadalupe" ? "All" : "Guadalupe"),
      isActive: selectedBranch === "Guadalupe",
    },
    {
      label: "Gil Puyat",
      action: () => onBranchFilter(selectedBranch === "Gil Puyat" ? "All" : "Gil Puyat"),
      isActive: selectedBranch === "Gil Puyat",
    },
    {
      label: "Private",
      action: () => onRoomTypeFilter(selectedRoomType === "Private" ? "All" : "Private"),
      isActive: selectedRoomType === "Private",
    },
    {
      label: "Shared",
      action: () => onRoomTypeFilter(selectedRoomType === "Shared" ? "All" : "Shared"),
      isActive: selectedRoomType === "Shared",
    },
    {
      label: "Quadruple",
      action: () => onRoomTypeFilter(selectedRoomType === "Quadruple" ? "All" : "Quadruple"),
      isActive: selectedRoomType === "Quadruple",
    },
    {
      label: "Aircon",
      action: () => setSearchQuery(searchQuery.toLowerCase().includes("aircon") ? "" : "aircon"),
      isActive: searchQuery.toLowerCase().includes("aircon"),
    },
    {
      label: "Under ₱6,000",
      action: () => {
        setMaxPrice(maxPrice === 6000 ? 15000 : 6000);
        setLocalPrice(maxPrice === 6000 ? 15000 : 6000);
      },
      isActive: maxPrice === 6000,
    },
  ];

  return (
    <header className="sticky top-0 z-50" style={{ backgroundColor: "var(--surface-card)", borderBottom: "1px solid var(--border-divider)" }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 lg:px-12 py-1">
        {/* Single row: Logo | Filter Bar | Sign In */}
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
              className="w-8 h-8 object-contain"
            />
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ color: "var(--text-heading)" }}
            >
              Lilycrest
            </span>
          </Link>

          {/* Unified Filter Bar */}
          <div className="ca-filter-bar">
            {/* Search Input */}
            <div className="ca-search-wrap">
              <Search className="ca-search-icon" />
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
                  <X size={13} />
                </button>
              ) : (
                <span className="ca-search-shortcut-badge" title="Press / to search">
                  /
                </span>
              )}
            </div>

            {/* Mobile Filter Toggle */}
            <button
              type="button"
              className="ca-mobile-filter-toggle"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-label="Toggle filter options"
              aria-expanded={mobileFiltersOpen}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: "var(--text-heading)",
                    color: "var(--surface-card)",
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Controls group (dropdowns & slider) */}
            <div className={`ca-filter-controls ${mobileFiltersOpen ? "ca-filter-controls--open" : ""}`}>
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
                    <ProfileAvatar user={user} initials={userInitials} size={32} />
                  </div>
                  <span className="flex-1 text-sm font-medium truncate leading-tight text-left" style={{ color: "var(--text-heading)" }}>
                    {userDisplayName}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 ca-user-trigger-chevron shrink-0 ${showUserMenu ? "rotate-180" : ""}`}
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
                              className="text-[13px] font-semibold truncate leading-none"
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border hover:border-gray-400 transition-colors text-sm font-medium"
                style={{ color: "var(--text-heading)" }}
              >
                <User className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Quick Filter Tags Row */}
        <div className="ca-quick-tags pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
            Quick:
          </span>
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={tag.action}
              className={`ca-quick-tag ${tag.isActive ? "ca-quick-tag--active" : ""}`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
});

export default AvailabilityHeader;
