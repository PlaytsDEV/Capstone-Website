import { useState, useMemo, useEffect } from "react";
import {
  Shield, UserCog, GitBranch, Info, Search, Filter,
  CheckCircle2, Sliders, Users, ChevronDown, ChevronsUpDown,
  X, SlidersHorizontal, AlertCircle, RefreshCw
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PermissionEditor from "../../admin/components/PermissionEditor";
import {
  useUsers,
  useUpdatePermissions,
} from "../../../shared/hooks/queries/useUsers";
import { AdminRolePermissionsSkeleton } from "../../admin/components/AdminContentSkeletons";
import SkeletonPulse from "../../../shared/components/SkeletonPulse";
import "../styles/owner-dashboard.css";
import "../styles/owner-permissions.css";

const formatBranch = (branch) => {
  if (!branch) return "Unassigned";
  return branch
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  const allExpanded = filteredUsers.length > 0 && filteredUsers.every((u) => expandedCardIds.has(String(u._id)));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedCardIds(new Set());
    } else {
      setExpandedCardIds(new Set(users.map((u) => String(u._id))));
    }
  };

  if (isLoading && !usersResponse) {
    return <AdminRolePermissionsSkeleton />;
  }

  return (
    <div className={isEmbedded ? "sa-perm-embedded" : "sa2"}>
      {/* Page Header */}
      {!isEmbedded ? (
        <div className="sa2-header flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="sa2-eyebrow">Owner Controls</p>
            <h1 className="sa2-title">Role Permissions Workspace</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="sa-perm-header-btn flex items-center gap-1.5"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh permissions list"
            >
              <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
              <span>{isRefetching ? "Syncing…" : "Refresh"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2">
          <p className="text-xs font-medium text-muted-foreground">
            Configure granular feature permissions and administrative access switches for branch administrators.
          </p>
          <button
            type="button"
            className="sa-perm-header-btn flex items-center gap-1.5 self-start sm:self-auto"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh permissions list"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            <span>{isRefetching ? "Syncing…" : "Refresh"}</span>
          </button>
        </div>
      )}

      {/* Summary KPI Banner (Static Informational Cards) */}
      <div className="sa-perm-metrics-grid">
        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-blue">
            <Users size={20} />
          </div>
          <div className="text-left">
            <span className="sa-metric-label">Branch Admins</span>
            <h3 className="sa-metric-value">{totalAdmins}</h3>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-green">
            <CheckCircle2 size={20} />
          </div>
          <div className="text-left">
            <span className="sa-metric-label">Full Access Accounts</span>
            <h3 className="sa-metric-value">{fullAccessAdmins}</h3>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-amber">
            <Sliders size={20} />
          </div>
          <div className="text-left">
            <span className="sa-metric-label">Customized Access</span>
            <h3 className="sa-metric-value">{customAccessAdmins}</h3>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="sa2-card">
        <div className="sa2-section-head flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="sa2-card-title">
              <Shield
                size={18}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              Branch Admin Granular Access
            </h2>
            <p className="sa2-subtle">
              Toggle feature access switches and assign capabilities for each branch admin.
            </p>
            {hasFocusedUser && (
              <p className="sa-perm-focus-note mt-2">
                <Info
                  size={13}
                  style={{
                    display: "inline",
                    marginRight: 5,
                    verticalAlign: "middle",
                  }}
                />
                Focused on selected admin account.
              </p>
            )}
          </div>

          {filteredUsers.length > 0 && (
            <button
              type="button"
              className="sa-perm-expand-toggle-btn flex items-center gap-1.5"
              onClick={handleToggleAll}
              title={allExpanded ? "Collapse all admin cards" : "Expand all admin cards"}
            >
              <ChevronsUpDown size={14} />
              <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
            </button>
          )}
        </div>

        {/* Dedicated Separate Filter Toolbar */}
        <div className="sa-perm-filter-section">
          <div className="sa-perm-filter-row">
            <div className="sa-perm-filter-inputs">
              {/* Search Box */}
              <div className="sa-search-box">
                <Search size={15} className="sa-search-icon" />
                <input
                  type="text"
                  placeholder="Search admin name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sa-search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="sa-search-clear-btn"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search query"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Branch Filter Dropdown */}
              {uniqueBranches.length > 0 && (
                <div className="sa-filter-box">
                  <Filter size={14} className="sa-filter-icon" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="sa-filter-select"
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

              {/* Access Scope Dropdown */}
              <div className="sa-filter-box">
                <SlidersHorizontal size={14} className="sa-filter-icon" />
                <select
                  value={accessFilter}
                  onChange={(e) => setAccessFilter(e.target.value)}
                  className="sa-filter-select"
                >
                  <option value="all">All Access Scopes</option>
                  <option value="full">Full Access (8/8)</option>
                  <option value="custom">Custom Scope (1-7/8)</option>
                  <option value="restricted">Restricted (0/8)</option>
                </select>
              </div>
            </div>

            {/* Scope Quick Filter Pills */}
            <div className="sa-perm-scope-pills">
              <button
                type="button"
                className={`sa-perm-scope-pill-btn ${accessFilter === "all" ? "sa-perm-scope-pill-btn--active" : ""}`}
                onClick={() => setAccessFilter("all")}
              >
                All
                <span className="sa-perm-scope-pill-count">{totalAdmins}</span>
              </button>
              <button
                type="button"
                className={`sa-perm-scope-pill-btn ${accessFilter === "full" ? "sa-perm-scope-pill-btn--active" : ""}`}
                onClick={() => setAccessFilter("full")}
              >
                Full Access (8/8)
                <span className="sa-perm-scope-pill-count">{fullAccessAdmins}</span>
              </button>
              <button
                type="button"
                className={`sa-perm-scope-pill-btn ${accessFilter === "custom" ? "sa-perm-scope-pill-btn--active" : ""}`}
                onClick={() => setAccessFilter("custom")}
              >
                Custom Scope
                <span className="sa-perm-scope-pill-count">{customAccessAdmins}</span>
              </button>
              {restrictedAdmins > 0 && (
                <button
                  type="button"
                  className={`sa-perm-scope-pill-btn ${accessFilter === "restricted" ? "sa-perm-scope-pill-btn--active" : ""}`}
                  onClick={() => setAccessFilter("restricted")}
                >
                  Restricted
                  <span className="sa-perm-scope-pill-count">{restrictedAdmins}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Pill indicator if filtered */}
        {(accessFilter !== "all" || selectedBranch !== "all" || searchTerm) && (
          <div className="sa-perm-active-filter-bar flex items-center gap-2">
            <span className="sa-perm-filter-label">Active Filter:</span>
            {accessFilter !== "all" && (
              <span className="sa-perm-filter-tag">
                Scope: {accessFilter === "full" ? "Full Access" : accessFilter === "custom" ? "Custom Access" : "Restricted"}
                <button type="button" onClick={() => setAccessFilter("all")}>
                  <X size={11} />
                </button>
              </span>
            )}
            {selectedBranch !== "all" && (
              <span className="sa-perm-filter-tag">
                Branch: {formatBranch(selectedBranch)}
                <button type="button" onClick={() => setSelectedBranch("all")}>
                  <X size={11} />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="sa-perm-filter-tag">
                Search: "{searchTerm}"
                <button type="button" onClick={() => setSearchTerm("")}>
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              className="sa-perm-reset-filters-btn"
              onClick={() => {
                setAccessFilter("all");
                setSelectedBranch("all");
                setSearchTerm("");
              }}
            >
              Reset All
            </button>
          </div>
        )}

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="sa-perm-list">
            <div className="sa2-card sa-perm-card sa-perm-card--open">
              <div className="sa-perm-card-header">
                <div className="sa-perm-user-info">
                  <SkeletonPulse width="40px" height="40px" borderRadius="8px" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <SkeletonPulse variant="text" width="140px" height="14px" />
                    <SkeletonPulse variant="text" width="190px" height="12px" />
                  </div>
                </div>
                <div className="sa-perm-meta flex items-center gap-2">
                  <SkeletonPulse width="110px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="115px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="90px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
                </div>
              </div>
            </div>
            <div className="sa2-card sa-perm-card sa-perm-card--collapsed">
              <div className="sa-perm-card-header">
                <div className="sa-perm-user-info">
                  <SkeletonPulse width="40px" height="40px" borderRadius="8px" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <SkeletonPulse variant="text" width="130px" height="14px" />
                    <SkeletonPulse variant="text" width="180px" height="12px" />
                  </div>
                </div>
                <div className="sa-perm-meta flex items-center gap-2">
                  <SkeletonPulse width="100px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="115px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="90px" height="24px" borderRadius="9999px" />
                  <SkeletonPulse width="18px" height="18px" borderRadius="4px" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {!isLoading && error ? (
          <p className="sa2-empty">Failed to load permissions data.</p>
        ) : null}
        {!isLoading && !error && filteredUsers.length === 0 ? (
          <div className="sa2-empty-state">
            <Shield size={32} className="text-muted-foreground opacity-40 mb-2" />
            <p className="sa2-empty">
              {users.length === 0
                ? "No branch admin accounts found."
                : "No branch admin accounts match your search filters."}
            </p>
            {(accessFilter !== "all" || selectedBranch !== "all" || searchTerm) && (
              <button
                type="button"
                className="sa-perm-reset-filters-btn mt-3"
                onClick={() => {
                  setAccessFilter("all");
                  setSelectedBranch("all");
                  setSearchTerm("");
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : null}

        {/* Branch Admin Cards List with Accordion */}
        {!isLoading && !error && filteredUsers.length > 0 ? (
          <div className="sa-perm-list">
            {filteredUsers.map((user) => {
              const permCount = (user.permissions || []).length;
              const isExpanded = expandedCardIds.has(String(user._id));

              return (
                <section
                  key={user._id}
                  id={`sa-perm-card-${user._id}`}
                  className={`sa2-card sa-perm-card ${
                    String(user._id) === String(focusedUserId)
                      ? "sa-perm-card--focused"
                      : ""
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
                  >
                    <div className="sa-perm-user-info">
                      <div className="sa-perm-avatar">
                        <UserCog size={18} />
                      </div>
                      <div>
                        <h3 className="sa-perm-user-name">
                          {user.firstName} {user.lastName}
                        </h3>
                        <div className="sa-perm-user-email">{user.email}</div>
                      </div>
                    </div>

                    <div className="sa-perm-meta flex items-center gap-2">
                      <span className="sa-perm-branch">
                        <GitBranch size={11} />
                        {formatBranch(user.branch)}
                      </span>

                      {/* Access Scope Status Pill */}
                      {permCount >= 8 ? (
                        <span className="sa-perm-scope-badge sa-perm-scope-full">
                          <CheckCircle2 size={12} />
                          8/8 Full Access
                        </span>
                      ) : permCount > 0 ? (
                        <span className="sa-perm-scope-badge sa-perm-scope-custom">
                          <Sliders size={12} />
                          {permCount}/8 Custom Scope
                        </span>
                      ) : (
                        <span className="sa-perm-scope-badge sa-perm-scope-restricted">
                          <AlertCircle size={12} />
                          0/8 Restricted
                        </span>
                      )}

                      <span className="sa-perm-role-pill">Branch Admin</span>

                      <div className="sa-perm-chevron-wrapper">
                        <ChevronDown
                          size={18}
                          className={`sa-perm-chevron ${isExpanded ? "sa-perm-chevron--open" : ""}`}
                        />
                      </div>
                    </div>
                  </header>

                  {isExpanded && (
                    <div className="sa-perm-card-body">
                      <PermissionEditor
                        permissions={user.permissions || []}
                        saving={
                          updatePermissions.isPending &&
                          updatePermissions.variables?.userId === user._id
                        }
                        onSave={(permissions) =>
                          updatePermissions.mutate({ userId: user._id, permissions })
                        }
                      />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
