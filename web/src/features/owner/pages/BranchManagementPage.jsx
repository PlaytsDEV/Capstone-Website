import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorClosed,
  Hammer,
  MessageSquare,
  RotateCw,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { useApiClient } from "../../../shared/api/apiClient";
import { buildBranchScopedHref } from "../../../shared/utils/branchFilterQuery.mjs";
import { AdminBranchesSkeleton } from "../../admin/components/AdminContentSkeletons";
import "../styles/owner-dashboard.css";
import "../styles/owner-branches.css";

const BRANCH_META = Object.freeze({
  "gil-puyat": {
    color: "#2563eb",
    surface: "#eff6ff",
    border: "#bfdbfe",
    label: "Gil Puyat",
  },
  guadalupe: {
    color: "#d97706",
    surface: "#fff7ed",
    border: "#fde68a",
    label: "Guadalupe",
  },
});

const WARNING_COPY = Object.freeze({
  noAssignedAdmin: "No assigned admin",
  highOccupancyPressure: "High occupancy pressure",
  elevatedUnresolvedWorkload: "Elevated unresolved workload",
});

const formatAdminName = (admin) =>
  `${admin.firstName || ""} ${admin.lastName || ""}`.trim() ||
  admin.email ||
  "Branch admin";

const getInitials = (admin) => {
  const first = (admin.firstName || "").trim().charAt(0).toUpperCase();
  const last = (admin.lastName || "").trim().charAt(0).toUpperCase();
  if (first && last) return `${first}${last}`;
  if (first) return first;
  if (admin.email) return admin.email.charAt(0).toUpperCase();
  return "BA";
};

const formatSyncTime = (isoString) => {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
};

export default function BranchManagementPage() {
  const { authFetch } = useApiClient();
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } =
    useQuery({
      queryKey: ["branches", "summary"],
      queryFn: () => authFetch("/branches/summary"),
      staleTime: 60_000,
    });

  const branches = useMemo(() => {
    return (data?.branches || []).map((branchSummary) => {
      const meta = BRANCH_META[branchSummary.branch] || {
        color: "#475569",
        surface: "#f8fafc",
        border: "#e2e8f0",
        label: branchSummary.label || branchSummary.branch,
      };

      return {
        ...branchSummary,
        color: meta.color,
        surface: meta.surface,
        borderColor: meta.border,
        warningLabels: Object.entries(branchSummary.warningStates || {})
          .filter(([, active]) => active)
          .map(([key]) => WARNING_COPY[key] || key),
      };
    });
  }, [data?.branches]);

  const comparisonSummary = useMemo(() => {
    return branches.reduce(
      (summary, branch) => ({
        totalBeds: summary.totalBeds + Number(branch.occupancy?.totalBeds || 0),
        occupiedBeds:
          summary.occupiedBeds + Number(branch.occupancy?.occupiedBeds || 0),
        availableBeds:
          summary.availableBeds + Number(branch.occupancy?.availableBeds || 0),
        overdueBillingCount:
          summary.overdueBillingCount + Number(branch.overdueBillingCount || 0),
        unresolvedWorkloadCount:
          summary.unresolvedWorkloadCount +
          Number(branch.unresolvedWorkloadCount || 0),
      }),
      {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        overdueBillingCount: 0,
        unresolvedWorkloadCount: 0,
      },
    );
  }, [branches]);

  const comparisonRate =
    comparisonSummary.totalBeds > 0
      ? (
          (comparisonSummary.occupiedBeds / comparisonSummary.totalBeds) *
          100
        ).toFixed(1)
      : "0.0";

  const lastSyncFormatted = formatSyncTime(
    data?.syncedAt || (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null),
  );

  if (isLoading && !data) {
    return <AdminBranchesSkeleton />;
  }

  return (
    <div className="sa2">
      {/* ── Page Header ── */}
      <div className="sa2-header">
        <div>
          <p className="sa2-eyebrow">System Control Hub</p>
          <h1 className="sa2-title">Branches Operations Matrix</h1>
          <p className="sa-branches-header-copy">
            Real-time branch operational capacity, occupancy distribution, and
            direct-action workflow matrices across the dormitory network.
          </p>
        </div>
        <div className="sa-branches-header-actions">
          {lastSyncFormatted && (
            <span className="sa-branches-sync-indicator">
              <span className="sa-branches-sync-dot" />
              Synced at {lastSyncFormatted}
            </span>
          )}
          <button
            type="button"
            className="sa-branches-refresh-btn"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Synchronize branch statistics"
          >
            <RotateCw
              size={15}
              className={isFetching ? "sa-branches-state-spinner" : ""}
            />
            <span>{isFetching ? "Synchronizing..." : "Synchronize"}</span>
          </button>
        </div>
      </div>

      {/* ── Network Overview Strip ── */}
      <div className="sa-branches-overview">
        <article className="sa-branches-overview-card">
          <div className="sa-branches-overview-top">
            <span className="sa-branches-overview-label">Network Occupancy</span>
            <div className="sa-branches-overview-icon-badge">
              <TrendingUp size={16} />
            </div>
          </div>
          <strong className="sa-branches-overview-value">
            {comparisonRate}%
          </strong>
          <span className="sa-branches-overview-meta">
            {comparisonSummary.occupiedBeds} of {comparisonSummary.totalBeds}{" "}
            beds occupied network-wide
          </span>
        </article>

        <article className="sa-branches-overview-card">
          <div className="sa-branches-overview-top">
            <span className="sa-branches-overview-label">
              Available Capacity
            </span>
            <div className="sa-branches-overview-icon-badge">
              <BedDouble size={16} />
            </div>
          </div>
          <strong className="sa-branches-overview-value">
            {comparisonSummary.availableBeds}
          </strong>
          <span className="sa-branches-overview-meta">
            Vacant beds ready for immediate occupancy
          </span>
        </article>

        <article
          className={`sa-branches-overview-card ${
            comparisonSummary.overdueBillingCount > 0
              ? "sa-branches-overview-card--alert"
              : ""
          }`}
        >
          <div className="sa-branches-overview-top">
            <span className="sa-branches-overview-label">Overdue Billing</span>
            <div className="sa-branches-overview-icon-badge sa-branches-overview-icon-badge--danger">
              <CreditCard size={16} />
            </div>
          </div>
          <strong className="sa-branches-overview-value">
            {comparisonSummary.overdueBillingCount}
          </strong>
          <span className="sa-branches-overview-meta">
            {comparisonSummary.overdueBillingCount > 0
              ? "Unsettled tenant statements requiring follow-up"
              : "All billing statements are fully settled"}
          </span>
        </article>

        <article
          className={`sa-branches-overview-card ${
            comparisonSummary.unresolvedWorkloadCount > 0
              ? "sa-branches-overview-card--warning"
              : ""
          }`}
        >
          <div className="sa-branches-overview-top">
            <span className="sa-branches-overview-label">Open Workload</span>
            <div className="sa-branches-overview-icon-badge sa-branches-overview-icon-badge--warning">
              <Clock size={16} />
            </div>
          </div>
          <strong className="sa-branches-overview-value">
            {comparisonSummary.unresolvedWorkloadCount}
          </strong>
          <span className="sa-branches-overview-meta">
            Pending reservations, maintenance, and inquiries
          </span>
        </article>
      </div>

      {/* ── Error State ── */}
      {error ? (
        <section className="sa-branches-state sa-branches-state--error">
          <AlertTriangle size={22} />
          <div>
            <strong>Unable to synchronize branch summaries</strong>
            <p>
              {error.message ||
                "The branch summary endpoint could not be retrieved from the server."}
            </p>
          </div>
        </section>
      ) : (
        /* ── Branch Comparison Grid ── */
        <div className="sa-branches-grid">
          {branches.map((branch) => {
            const hasOverdue = branch.overdueBillingCount > 0;
            const hasMaintenance = branch.openMaintenanceCount > 0;
            const hasReservations = branch.pendingReservationsCount > 0;
            const hasInquiries = branch.pendingInquiriesCount > 0;
            const hasNoAdmin = branch.assignedAdminCount === 0;

            return (
              <article key={branch.branch} className="sa-branch-card">
                {/* ── Branch Card Header ── */}
                <div className="sa-branch-card-header">
                  <div
                    className="sa-branch-icon"
                    style={{
                      background: branch.surface,
                      color: branch.color,
                      border: `1px solid ${branch.borderColor}`,
                    }}
                  >
                    <Building2 size={24} />
                  </div>
                  <div className="sa-branch-card-heading">
                    <div>
                      <h2 className="sa-branch-card-name">{branch.label}</h2>
                      <span className="sa-branch-card-id">{branch.branch}</span>
                    </div>
                    {branch.warningLabels.length ? (
                      <div className="sa-branch-warning-badges">
                        {branch.warningLabels.map((warning) => (
                          <span
                            key={warning}
                            className="sa-branch-warning-badge"
                          >
                            <AlertTriangle size={12} />
                            {warning}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="sa-branch-health-pill">
                        <CheckCircle2 size={13} />
                        Stable
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Branch Occupancy Bar ── */}
                <div className="sa-branch-occupancy">
                  <div className="sa-branch-occupancy-header">
                    <span className="sa-branch-occupancy-title">
                      Capacity Occupancy
                    </span>
                    <span
                      className="sa-branch-occupancy-rate"
                      style={{ color: branch.color }}
                    >
                      {branch.occupancy?.rate || 0}%
                    </span>
                  </div>
                  <div className="sa2-bar-track">
                    <div
                      className="sa2-bar-fill"
                      style={{
                        width: `${Math.min(branch.occupancy?.rate || 0, 100)}%`,
                        background: branch.color,
                      }}
                    />
                  </div>
                  <div className="sa-branch-occupancy-detail">
                    <span>
                      <strong>{branch.occupancy?.occupiedBeds || 0}</strong> of{" "}
                      <strong>{branch.occupancy?.totalBeds || 0}</strong> beds
                      occupied
                    </span>
                    <span className="sa-branch-occupancy-sub">
                      <strong>
                        {branch.occupancy?.availableBeds || 0}
                      </strong>{" "}
                      available
                    </span>
                  </div>
                </div>

                {/* ── Interactive Workflow Metric Tiles ── */}
                <div className="sa-branch-metrics-section">
                  <span className="sa-branch-section-eyebrow">
                    Workflows & Metric Matrix
                  </span>
                  <div className="sa-branch-stats-grid">
                    {/* 1. Total Rooms */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/room-availability",
                        branch.branch,
                      )}
                      className="sa-branch-tile"
                      title="Open Room Availability workspace for this branch"
                    >
                      <div className="sa-branch-tile-top">
                        <DoorClosed size={16} className="sa-branch-tile-icon" />
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.totalRooms}
                      </span>
                      <span className="sa-branch-tile-label">Rooms</span>
                    </Link>

                    {/* 2. Available Beds */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/room-availability",
                        branch.branch,
                        { tab: "occupancy" },
                      )}
                      className="sa-branch-tile"
                      title="Inspect bed capacity and occupancy distribution"
                    >
                      <div className="sa-branch-tile-top">
                        <BedDouble size={16} className="sa-branch-tile-icon" />
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.occupancy?.availableBeds || 0}
                      </span>
                      <span className="sa-branch-tile-label">
                        Available Beds
                      </span>
                    </Link>

                    {/* 3. Active Tenants */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/users",
                        branch.branch,
                        { role: "tenant" },
                      )}
                      className="sa-branch-tile"
                      title="Review active tenant directory for this branch"
                    >
                      <div className="sa-branch-tile-top">
                        <Users size={16} className="sa-branch-tile-icon" />
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.tenantCount}
                      </span>
                      <span className="sa-branch-tile-label">Tenants</span>
                    </Link>

                    {/* 4. Assigned Admins */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/users",
                        branch.branch,
                        { role: "branch_admin" },
                      )}
                      className={`sa-branch-tile ${
                        hasNoAdmin ? "sa-branch-tile--danger" : ""
                      }`}
                      title="Manage assigned branch administrators"
                    >
                      <div className="sa-branch-tile-top">
                        <UserCog size={16} className="sa-branch-tile-icon" />
                        {hasNoAdmin && (
                          <span
                            className="sa-branch-tile-dot sa-branch-tile-dot--danger"
                            title="No admin assigned"
                          />
                        )}
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.assignedAdminCount}
                      </span>
                      <span className="sa-branch-tile-label">
                        Assigned Admins
                      </span>
                    </Link>

                    {/* 5. Overdue Billing */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/analytics/details",
                        branch.branch,
                        { tab: "financials" },
                      )}
                      className={`sa-branch-tile ${
                        hasOverdue ? "sa-branch-tile--danger" : ""
                      }`}
                      title="Inspect overdue accounts and financial ledger"
                    >
                      <div className="sa-branch-tile-top">
                        <CreditCard size={16} className="sa-branch-tile-icon" />
                        {hasOverdue && (
                          <span
                            className="sa-branch-tile-dot sa-branch-tile-dot--danger"
                            title="Action required"
                          />
                        )}
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.overdueBillingCount}
                      </span>
                      <span className="sa-branch-tile-label">
                        Overdue Billing
                      </span>
                    </Link>

                    {/* 6. Open Maintenance */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/maintenance",
                        branch.branch,
                      )}
                      className={`sa-branch-tile ${
                        hasMaintenance ? "sa-branch-tile--warning" : ""
                      }`}
                      title="Review open maintenance requests and dispatch"
                    >
                      <div className="sa-branch-tile-top">
                        <Hammer size={16} className="sa-branch-tile-icon" />
                        {hasMaintenance && (
                          <span
                            className="sa-branch-tile-dot sa-branch-tile-dot--warning"
                            title="Pending resolution"
                          />
                        )}
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.openMaintenanceCount}
                      </span>
                      <span className="sa-branch-tile-label">
                        Open Maintenance
                      </span>
                    </Link>

                    {/* 7. Pending Reservations */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/reservations",
                        branch.branch,
                      )}
                      className={`sa-branch-tile ${
                        hasReservations ? "sa-branch-tile--info" : ""
                      }`}
                      title="Process pending reservation applications"
                    >
                      <div className="sa-branch-tile-top">
                        <Building2 size={16} className="sa-branch-tile-icon" />
                        {hasReservations && (
                          <span
                            className="sa-branch-tile-dot sa-branch-tile-dot--info"
                            title="Awaiting approval"
                          />
                        )}
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.pendingReservationsCount}
                      </span>
                      <span className="sa-branch-tile-label">
                        Reservations
                      </span>
                    </Link>

                    {/* 8. Pending Inquiries */}
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/inquiries",
                        branch.branch,
                      )}
                      className={`sa-branch-tile ${
                        hasInquiries ? "sa-branch-tile--warning" : ""
                      }`}
                      title="Answer pending prospect inquiries"
                    >
                      <div className="sa-branch-tile-top">
                        <MessageSquare
                          size={16}
                          className="sa-branch-tile-icon"
                        />
                        {hasInquiries && (
                          <span
                            className="sa-branch-tile-dot sa-branch-tile-dot--warning"
                            title="Pending response"
                          />
                        )}
                        <ArrowUpRight
                          size={14}
                          className="sa-branch-tile-jump"
                        />
                      </div>
                      <span className="sa-branch-tile-value">
                        {branch.pendingInquiriesCount}
                      </span>
                      <span className="sa-branch-tile-label">Inquiries</span>
                    </Link>
                  </div>
                </div>

                {/* ── Assigned Branch Admins Roster ── */}
                <div className="sa-branch-admins">
                  <div className="sa-branch-admins-header">
                    <div className="sa-branch-admins-header-left">
                      <UserCog size={15} />
                      <span>
                        Assigned Branch Admins ({branch.assignedAdminCount})
                      </span>
                    </div>
                    <Link
                      to={buildBranchScopedHref(
                        "/admin/users",
                        branch.branch,
                        { role: "branch_admin" },
                      )}
                      className="sa-branch-manage-link"
                    >
                      Manage Staff →
                    </Link>
                  </div>

                  {branch.assignedAdmins?.length ? (
                    <div className="sa-branch-admins-list">
                      {branch.assignedAdmins.map((admin) => (
                        <div key={admin._id} className="sa-branch-admin-row">
                          <div className="sa-branch-admin-info">
                            <div className="sa-branch-admin-avatar">
                              {getInitials(admin)}
                            </div>
                            <div>
                              <span className="sa-branch-admin-name">
                                {formatAdminName(admin)}
                              </span>
                              <span className="sa-branch-admin-email">
                                {admin.email}
                              </span>
                            </div>
                          </div>
                          <span className="sa-branch-admin-badge">
                            Branch Admin
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sa-branch-admins-empty">
                      <AlertCircle size={16} />
                      <div>
                        <strong>No administrator currently assigned</strong>
                        <p>
                          This branch lacks staff coverage. Use Manage Staff to
                          assign an administrator.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Branch Action Footer ── */}
                <div className="sa-branch-footer-actions">
                  <Link
                    to={buildBranchScopedHref(
                      "/admin/room-availability",
                      branch.branch,
                    )}
                    className="sa-branch-action-btn"
                  >
                    Room Matrix
                  </Link>
                  <Link
                    to={buildBranchScopedHref(
                      "/admin/analytics/details",
                      branch.branch,
                      { tab: "financials" },
                    )}
                    className="sa-branch-action-btn"
                  >
                    Financial Report
                  </Link>
                  <Link
                    to={buildBranchScopedHref("/admin/users", branch.branch)}
                    className="sa-branch-action-btn sa-branch-action-btn--primary"
                  >
                    Branch Accounts
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
