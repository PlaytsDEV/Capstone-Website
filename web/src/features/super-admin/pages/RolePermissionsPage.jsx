import { useState, useMemo, useEffect } from "react";
import { Shield, UserCog, GitBranch, Info, Search, Filter, CheckCircle2, Sliders, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PermissionEditor from "../../admin/components/PermissionEditor";
import {
  useUsers,
  useUpdatePermissions,
} from "../../../shared/hooks/queries/useUsers";
import { ListSkeleton } from "../../../shared/components/LoadingSkeletons";
import "../styles/superadmin-dashboard.css";
import "../styles/superadmin-permissions.css";

const formatBranch = (branch) => {
  if (!branch) return "Unassigned";
  return branch
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function RolePermissionsPage() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");

  const {
    data: usersResponse,
    isLoading,
    error,
  } = useUsers({ role: "branch_admin" });

  const updatePermissions = useUpdatePermissions();
  const users = usersResponse?.users || usersResponse || [];
  const focusedUserId = searchParams.get("userId");

  const hasFocusedUser = Boolean(
    focusedUserId &&
      users.some((user) => String(user._id) === String(focusedUserId))
  );

  useEffect(() => {
    if (!hasFocusedUser) return;

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

  // Filtered users based on search & branch dropdown
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
      const email = (user.email || "").toLowerCase();
      const query = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !query || fullName.includes(query) || email.includes(query);

      const matchesBranch =
        selectedBranch === "all" || user.branch === selectedBranch;

      return matchesSearch && matchesBranch;
    });
  }, [users, searchTerm, selectedBranch]);

  // Compute metrics
  const totalAdmins = users.length;
  const fullAccessAdmins = users.filter(
    (u) => (u.permissions || []).length >= 8
  ).length;
  const customAccessAdmins = totalAdmins - fullAccessAdmins;

  return (
    <div className="sa2">
      {/* Page Header */}
      <div className="sa2-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="sa2-eyebrow">Owner Controls</p>
          <h1 className="sa2-title">Role Permissions Workspace</h1>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="sa-perm-metrics-grid">
        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-blue">
            <Users size={20} />
          </div>
          <div>
            <span className="sa-metric-label">Branch Admins</span>
            <h3 className="sa-metric-value">{totalAdmins}</h3>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="sa-metric-label">Full Access Accounts</span>
            <h3 className="sa-metric-value">{fullAccessAdmins}</h3>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-icon sa-icon-purple">
            <Sliders size={20} />
          </div>
          <div>
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

          {/* Search & Filter Controls */}
          <div className="sa-perm-controls flex items-center gap-3">
            <div className="sa-search-box">
              <Search size={15} className="sa-search-icon" />
              <input
                type="text"
                placeholder="Search admin name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sa-search-input"
              />
            </div>

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
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? <ListSkeleton rows={4} avatar /> : null}
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
          </div>
        ) : null}

        {/* Branch Admin Cards List */}
        {!isLoading && !error && filteredUsers.length > 0 ? (
          <div className="sa-perm-list">
            {filteredUsers.map((user) => (
              <section
                key={user._id}
                id={`sa-perm-card-${user._id}`}
                className={`sa2-card sa-perm-card ${
                  String(user._id) === String(focusedUserId)
                    ? "sa-perm-card--focused"
                    : ""
                }`}
              >
                <div className="sa-perm-card-header">
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
                  <div className="sa-perm-meta">
                    <span className="sa-perm-branch">
                      <GitBranch size={11} />
                      {formatBranch(user.branch)}
                    </span>
                    <span className="sa-perm-role-pill">Branch Admin</span>
                  </div>
                </div>

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
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
