import { useState, useMemo, useEffect } from "react";
import {
  Shield, Building2, Info, Search, Filter,
  CheckCircle2, Sliders, Users, ChevronDown, ChevronsUpDown,
  X, AlertCircle, RefreshCw
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PermissionEditor from "../../admin/components/PermissionEditor";
import {
  useUsers,
  useUpdatePermissions,
} from "../../../shared/hooks/queries/useUsers";
import { AdminRolePermissionsSkeleton } from "../../admin/components/AdminContentSkeletons";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";
import AdminPageHeader from "../../../shared/components/AdminPageHeader";
import "../styles/owner-dashboard.css";
import "../styles/owner-permissions.css";

const formatBranch = (branch) => {
  if (!branch) return "Unassigned Branch";
  return branch
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getInitials = (firstName = "", lastName = "") => {
  const f = firstName.trim().charAt(0) || "";
  const l = lastName.trim().charAt(0) || "";
  return (f + l).toUpperCase() || "BA";
};

export default function RolePermissionsPage({ isEmbedded = false }) {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all"); // 'all' | 'full' | 'custom' | 'restricted'
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());

  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useUsers({ role: "branch_admin" });

  const updatePermissions = useUpdatePermissions();
  const users = useMemo(() => {
    const raw = usersResponse?.users || usersResponse || [];
    return Array.isArray(raw) ? raw : [];
  }, [usersResponse]);

  const focusedUserId = searchParams.get("userId");

  const hasFocusedUser = Boolean(
    focusedUserId &&
      users.some((user) => String(user._id) === String(focusedUserId))
  );

  // Initialize expanded cards when users load
  useEffect(() => {
    if (users.length > 0 && expandedCardIds.size === 0) {
      setExpandedCardIds(new Set(users.map((u) => String(u._id))));
    }
  }, [users]);

  // Ensure focused user is expanded and scrolled into view
  useEffect(() => {
    if (!hasFocusedUser) return;

    setExpandedCardIds((prev) => new Set([...prev, String(focusedUserId)]));

    const targetCard = document.getElementById(`sa-perm-card-${focusedUserId}`);
    if (!targetCard) return;

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusedUserId, hasFocusedUser]);

  // Extract unique branches for filter dropdown
  const uniqueBranches = useMemo(() => {
    const branches = new Set();
    users.forEach((u) => {
      if (u.branch) branches.add(u.branch);
    });
    return Array.from(branches);
  }, [users]);

  // Filtered users based on search, branch, and access scope
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
      const email = (user.email || "").toLowerCase();
      const query = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !query || fullName.includes(query) || email.includes(query);

      const matchesBranch =
        selectedBranch === "all" || user.branch === selectedBranch;

      const permCount = (user.permissions || []).length;
      let matchesAccess = true;
      if (accessFilter === "full") {
        matchesAccess = permCount >= 8;
      } else if (accessFilter === "custom") {
        matchesAccess = permCount > 0 && permCount < 8;
      } else if (accessFilter === "restricted") {
        matchesAccess = permCount === 0;
      }

      return matchesSearch && matchesBranch && matchesAccess;
    });
  }, [users, searchTerm, selectedBranch, accessFilter]);

  // Compute metrics
  const totalAdmins = users.length;
  const fullAccessAdmins = users.filter(
    (u) => (u.permissions || []).length >= 8
  ).length;
  const customAccessAdmins = users.filter(
    (u) => (u.permissions || []).length > 0 && (u.permissions || []).length < 8
  ).length;
  const restrictedAdmins = users.filter(
    (u) => (u.permissions || []).length === 0
  ).length;

  const toggleCard = (userId) => {
    const id = String(userId);
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allExpanded =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => expandedCardIds.has(String(u._id)));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedCardIds(new Set());
    } else {
      setExpandedCardIds(new Set(users.map((u) => String(u._id))));
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setAccessFilter("all");
  };

  const hasActiveFilters =
    searchTerm !== "" || selectedBranch !== "all" || accessFilter !== "all";

  if (isLoading && !usersResponse) {
    return <AdminRolePermissionsSkeleton />;
  }

  return (
    <div className={isEmbedded ? "sa-perm-embedded" : "sa2"}>
      {/* Page / Context Header */}
      {!isEmbedded ? (
        <AdminPageHeader
          title="Roles & Permissions"
          subtitle="Adjust branch admin capabilities and granular module permissions."
          actions={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Synchronize and refresh permissions list"
            >
              <RefreshCw
                size={14}
                className={isRefetching ? "animate-spin" : ""}
              />
              <span>{isRefetching ? "Synchronizing…" : "Refresh"}</span>
            </button>
          }
        />
      ) : (
        <div className="sa-perm-context-bar flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg mb-2">
          <div className="flex items-center gap-2.5">
            <div className="sa-perm-context-icon">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-foreground tracking-tight">
                Granular Role Permissions Configuration
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Assign module-level capabilities and operational scopes across branch administrator accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sa-perm-header-btn flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Synchronize and refresh permissions list"
          >
            <RefreshCw
              size={13}
              className={isRefetching ? "animate-spin" : ""}
            />
            <span>{isRefetching ? "Syncing…" : "Refresh"}</span>
          </button>
        </div>
      )}

      {/* Summary KPI Banner (Static Informational Cards) */}
      <div className="sa-perm-metrics-grid">
        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-navy">
            <Users size={20} />
          </div>
          <div className="sa-metric-info">
            <span className="sa-metric-label">Branch Administrators</span>
            <div className="flex items-baseline gap-2">
              <h3 className="sa-metric-value">{totalAdmins}</h3>
              <span className="sa-metric-subtext">Total active accounts</span>
            </div>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-green">
            <CheckCircle2 size={20} />
          </div>
          <div className="sa-metric-info">
            <span className="sa-metric-label">Full Access Accounts</span>
            <div className="flex items-baseline gap-2">
              <h3 className="sa-metric-value">{fullAccessAdmins}</h3>
              <span className="sa-metric-subtext">
                {totalAdmins > 0
                  ? `${Math.round((fullAccessAdmins / totalAdmins) * 100)}% of total (8/8)`
                  : "8/8 modules"}
              </span>
            </div>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-amber">
            <Sliders size={20} />
          </div>
          <div className="sa-metric-info">
            <span className="sa-metric-label">Customized Access</span>
            <div className="flex items-baseline gap-2">
              <h3 className="sa-metric-value">{customAccessAdmins}</h3>
              <span className="sa-metric-subtext">
                {restrictedAdmins > 0
                  ? `${restrictedAdmins} restricted (0/8)`
                  : "Tailored policies"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="sa2-card sa-perm-main-card">
        {/* Workspace Card Header */}
        <div className="sa-perm-section-head">
          <div className="sa-perm-section-info">
            <div className="flex items-center gap-2">
              <div className="sa-perm-title-icon">
                <Shield size={16} />
              </div>
              <h2 className="sa-perm-section-title">
                Branch Admin Granular Access
              </h2>
            </div>
            <p className="sa-perm-section-subtitle">
              Toggle feature access switches and assign capabilities for each branch admin.
            </p>
            {hasFocusedUser && (
              <p className="sa-perm-focus-note mt-2">
                <Info size={13} />
                Focused on selected branch admin account.
              </p>
            )}
          </div>

          <div className="sa-perm-section-actions">
            {filteredUsers.length > 0 && (
              <button
                type="button"
                className="sa-perm-expand-toggle-btn"
                onClick={handleToggleAll}
                title={allExpanded ? "Collapse all admin panels" : "Expand all admin panels"}
              >
                <ChevronsUpDown size={14} />
                <span>
                  {allExpanded
                    ? `Collapse All (${filteredUsers.length})`
                    : `Expand All (${filteredUsers.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Consolidated Streamlined Filter Toolbar */}
        <div className="sa-perm-filter-toolbar">
          <div className="sa-perm-filter-left">
            {/* Search Box */}
            <div className="sa-search-box">
              <Search size={15} className="sa-search-icon" />
              <input
                type="text"
                placeholder="Search admin name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sa-search-input"
                aria-label="Search administrators by name or email"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="sa-search-clear-btn"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search text"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Branch Filter Dropdown */}
            {uniqueBranches.length > 0 && (
              <div className="sa-filter-box">
                <Building2 size={14} className="sa-filter-icon" />
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="sa-filter-select"
                  aria-label="Filter by branch location"
                >
                  <option value="all">All Branches</option>
                  {uniqueBranches.map((b) => (
                    <option key={b} value={b}>
                      {formatBranch(b)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Scope Segmented Filter Pills */}
          <div className="sa-perm-scope-pills" role="tablist" aria-label="Filter by access scope">
            <button
              type="button"
              role="tab"
              aria-selected={accessFilter === "all"}
              className={`sa-perm-scope-pill-btn ${
                accessFilter === "all" ? "sa-perm-scope-pill-btn--active" : ""
              }`}
              onClick={() => setAccessFilter("all")}
            >
              <span>All</span>
              <span className="sa-perm-scope-pill-count">{totalAdmins}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={accessFilter === "full"}
              className={`sa-perm-scope-pill-btn ${
                accessFilter === "full" ? "sa-perm-scope-pill-btn--active" : ""
              }`}
              onClick={() => setAccessFilter("full")}
            >
              <CheckCircle2 size={12} className="opacity-80" />
              <span>Full Access (8/8)</span>
              <span className="sa-perm-scope-pill-count">{fullAccessAdmins}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={accessFilter === "custom"}
              className={`sa-perm-scope-pill-btn ${
                accessFilter === "custom" ? "sa-perm-scope-pill-btn--active" : ""
              }`}
              onClick={() => setAccessFilter("custom")}
            >
              <Sliders size={12} className="opacity-80" />
              <span>Custom Scope</span>
              <span className="sa-perm-scope-pill-count">{customAccessAdmins}</span>
            </button>
            {restrictedAdmins > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={accessFilter === "restricted"}
                className={`sa-perm-scope-pill-btn sa-perm-scope-pill-btn--danger ${
                  accessFilter === "restricted"
                    ? "sa-perm-scope-pill-btn--danger-active"
                    : ""
                }`}
                onClick={() => setAccessFilter("restricted")}
              >
                <AlertCircle size={12} className="opacity-80" />
                <span>Restricted</span>
                <span className="sa-perm-scope-pill-count">{restrictedAdmins}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="sa-perm-active-filter-bar">
            <span className="sa-perm-filter-label">Active Filters:</span>
            {accessFilter !== "all" && (
              <span className="sa-perm-filter-tag">
                Scope:{" "}
                <strong>
                  {accessFilter === "full"
                    ? "Full Access"
                    : accessFilter === "custom"
                    ? "Custom Access"
                    : "Restricted"}
                </strong>
                <button
                  type="button"
                  onClick={() => setAccessFilter("all")}
                  title="Remove scope filter"
                  aria-label="Remove scope filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {selectedBranch !== "all" && (
              <span className="sa-perm-filter-tag">
                Branch: <strong>{formatBranch(selectedBranch)}</strong>
                <button
                  type="button"
                  onClick={() => setSelectedBranch("all")}
                  title="Remove branch filter"
                  aria-label="Remove branch filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="sa-perm-filter-tag">
                Query: <strong>"{searchTerm}"</strong>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  title="Clear search query"
                  aria-label="Clear search query"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              className="sa-perm-reset-filters-btn"
              onClick={handleClearFilters}
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="sa-perm-list">
            {[1, 2].map((idx) => (
              <div key={idx} className="sa-perm-card sa-perm-card--collapsed">
                <div className="sa-perm-card-header">
                  <div className="sa-perm-user-info">
                    <SkeletonPulse width="42px" height="42px" borderRadius="8px" />
                    <div className="flex flex-col gap-1.5">
                      <SkeletonPulse variant="text" width="160px" height="15px" />
                      <SkeletonPulse variant="text" width="210px" height="12px" />
                    </div>
                  </div>
                  <div className="sa-perm-meta flex items-center gap-2">
                    <SkeletonPulse width="100px" height="26px" borderRadius="9999px" />
                    <SkeletonPulse width="120px" height="26px" borderRadius="9999px" />
                    <SkeletonPulse width="95px" height="26px" borderRadius="9999px" />
                    <SkeletonPulse width="20px" height="20px" borderRadius="4px" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="sa2-empty-state">
            <AlertCircle size={36} className="text-danger mb-2" />
            <h3 className="text-sm font-bold text-foreground">
              Failed to load administrators
            </h3>
            <p className="sa2-empty">
              An error occurred while fetching role permissions data.
            </p>
            <button
              type="button"
              className="sa-perm-reset-filters-btn mt-3"
              onClick={() => refetch()}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredUsers.length === 0 && (
          <div className="sa2-empty-state">
            <Shield size={36} className="text-muted-foreground opacity-40 mb-2" />
            <h3 className="text-sm font-bold text-foreground">
              No matching branch administrators
            </h3>
            <p className="sa2-empty">
              {users.length === 0
                ? "No branch administrator accounts are currently registered."
                : "No branch administrator accounts match your active search filters."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="sa-perm-reset-filters-btn mt-3"
                onClick={handleClearFilters}
              >
                Clear All Search Filters
              </button>
            )}
          </div>
        )}

        {/* Branch Admin Cards Accordion List */}
        {!isLoading && !error && filteredUsers.length > 0 && (
          <div className="sa-perm-list">
            {filteredUsers.map((user) => {
              const permCount = (user.permissions || []).length;
              const isExpanded = expandedCardIds.has(String(user._id));
              const isFocused = String(user._id) === String(focusedUserId);
              const initials = getInitials(user.firstName, user.lastName);

              return (
                <section
                  key={user._id}
                  id={`sa-perm-card-${user._id}`}
                  className={`sa-perm-card ${
                    isFocused ? "sa-perm-card--focused" : ""
                  } ${isExpanded ? "sa-perm-card--open" : "sa-perm-card--collapsed"}`}
                >
                  <header
                    className="sa-perm-card-header sa-perm-card-header--clickable"
                    onClick={() => toggleCard(user._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleCard(user._id);
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`sa-perm-body-${user._id}`}
                    title={isExpanded ? "Click to collapse permissions panel" : "Click to expand permissions configuration"}
                  >
                    {/* User Profile Block */}
                    <div className="sa-perm-user-info">
                      <div className="sa-perm-avatar" title={`Branch Admin: ${user.firstName} ${user.lastName}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="sa-perm-user-name">
                            {user.firstName} {user.lastName}
                          </h3>
                          {isFocused && (
                            <span className="sa-perm-focused-badge">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="sa-perm-user-email truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Scope Badges */}
                    <div className="sa-perm-meta">
                      {/* Branch Location */}
                      <span className="sa-perm-branch" title={`Assigned Branch: ${formatBranch(user.branch)}`}>
                        <Building2 size={12} className="opacity-75" />
                        <span>{formatBranch(user.branch)}</span>
                      </span>

                      {/* Access Scope Status Pill */}
                      {permCount >= 8 ? (
                        <span className="sa-perm-scope-badge sa-perm-scope-full" title="All 8 system capabilities granted">
                          <CheckCircle2 size={12} />
                          <span>8/8 Full Access</span>
                        </span>
                      ) : permCount > 0 ? (
                        <span className="sa-perm-scope-badge sa-perm-scope-custom" title={`${permCount} of 8 system capabilities granted`}>
                          <Sliders size={12} />
                          <span>{permCount}/8 Custom Scope</span>
                        </span>
                      ) : (
                        <span className="sa-perm-scope-badge sa-perm-scope-restricted" title="No system capabilities granted">
                          <AlertCircle size={12} />
                          <span>0/8 Restricted</span>
                        </span>
                      )}

                      {/* Role Pill */}
                      <span className="sa-perm-role-pill">
                        Branch Admin
                      </span>

                      {/* Expand / Collapse Chevron */}
                      <div className="sa-perm-chevron-wrapper">
                        <ChevronDown
                          size={18}
                          className={`sa-perm-chevron ${
                            isExpanded ? "sa-perm-chevron--open" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </header>

                  {/* Expanded Permission Editor Body */}
                  {isExpanded && (
                    <div
                      id={`sa-perm-body-${user._id}`}
                      className="sa-perm-card-body"
                    >
                      <PermissionEditor
                        permissions={user.permissions || []}
                        saving={
                          updatePermissions.isPending &&
                          updatePermissions.variables?.userId === user._id
                        }
                        onSave={(permissions) =>
                          updatePermissions.mutate({
                            userId: user._id,
                            permissions,
                          })
                        }
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
