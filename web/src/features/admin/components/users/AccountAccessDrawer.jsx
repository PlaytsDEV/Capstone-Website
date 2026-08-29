import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Info,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  User,
  Shield,
} from "lucide-react";

import { DetailDrawer, StatusBadge } from "../shared";
import { useUser } from "../../../../shared/hooks/queries/useUsers";
import { useAuditLogs } from "../../../../shared/hooks/queries/useAuditLogs";
import {
  DrawerSkeleton,
  ListSkeleton,
} from "../../../../shared/components/LoadingSkeletons";

/* ---------------------------
   CONSTANTS
---------------------------- */
const ROLE_LABELS = Object.freeze({
  applicant: "Applicant",
  tenant: "Tenant",
  branch_admin: "Branch Admin",
  owner: "Owner",
});

const PERMISSION_LABELS = Object.freeze({
  manageReservations: "Manage Reservations",
  manageTenants: "Manage Tenants",
  manageBilling: "Manage Billing",
  manageRooms: "Manage Rooms",
  manageMaintenance: "Manage Maintenance",
  manageAnnouncements: "Manage Announcements",
  viewReports: "View Reports",
  manageUsers: "Manage Users",
});

/* ---------------------------
   HELPERS
---------------------------- */
function formatDateTime(value) {
  if (!value) return "Never";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBranch(branch) {
  if (!branch) return "—";

  return String(branch)
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatLabel(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatRole(role) {
  return ROLE_LABELS[role] || formatLabel(role);
}

function formatActor(actor) {
  if (!actor) return null;

  const fullName = `${actor.firstName || ""} ${actor.lastName || ""}`.trim();
  return fullName || actor.email || null;
}

function toPermissionLabels(role, permissions) {
  if (role === "owner") return Object.values(PERMISSION_LABELS);
  if (role !== "branch_admin") return [];

  return (permissions || [])
    .map((p) => PERMISSION_LABELS[p] || p)
    .sort((a, b) => a.localeCompare(b));
}

/* ---------------------------
   COMPONENT
---------------------------- */
export default function AccountAccessDrawer({
  open,
  userSummary,
  onClose,
  canViewReports,
  canManagePermissions,
  onOpenPermissions,
}) {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = useCallback((fieldKey, text) => {
    if (!text || text === "—") return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField((prev) => (prev === fieldKey ? null : prev));
    }, 2000);
  }, []);

  const userId = open ? userSummary?._id : null;

  const { data: userDetail, isLoading, isError } = useUser(userId);

  const resolvedUser = userDetail || userSummary || null;

  const isTenantRole =
    resolvedUser?.role === "tenant" || resolvedUser?.role === "applicant";

  const hasActiveTenantStay =
    resolvedUser?.role === "tenant" && Boolean(userSummary?.hasActiveStay);

  const permissionLabels = useMemo(() => {
    return toPermissionLabels(
      resolvedUser?.role,
      resolvedUser?.permissions || []
    );
  }, [resolvedUser?.permissions, resolvedUser?.role]);

  const auditParams = useMemo(() => {
    if (!resolvedUser?.email) return null;

    return {
      user: resolvedUser.email,
      limit: 6,
      offset: 0,
    };
  }, [resolvedUser?.email]);

  const {
    data: auditEvents = [],
    isLoading: auditLoading,
    isError: auditError,
  } = useAuditLogs(auditParams || {}, {
    enabled: Boolean(open && canViewReports && auditParams),
  });

  const displayName = resolvedUser
    ? `${resolvedUser.firstName || ""} ${resolvedUser.lastName || ""}`.trim() ||
      resolvedUser.username ||
      resolvedUser.email ||
      "Account"
    : "Account";

  const initials = resolvedUser
    ? `${(resolvedUser.firstName || "A")[0]}${(resolvedUser.lastName || "")[0] || ""}`.toUpperCase()
    : "A";

  const canOpenPermissions =
    canManagePermissions &&
    resolvedUser?.role === "branch_admin" &&
    resolvedUser?.isArchived !== true;

  const visibleAudit = (auditEvents || []).slice(0, 4);

  const statusChanger = formatActor(resolvedUser?.statusChangedBy);
  const statusChangeDate = resolvedUser?.statusChangedAt
    ? formatDateTime(resolvedUser.statusChangedAt)
    : null;

  const lastStatusUpdateText = statusChangeDate
    ? `${statusChangeDate}${statusChanger ? ` by ${statusChanger}` : ""}`
    : "Never";

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-bold text-base tracking-wide flex-shrink-0 border border-border shadow-sm">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-foreground tracking-tight leading-none">
              {displayName} Access
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {resolvedUser?.email && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-xs font-medium text-muted-foreground">
                  <span>{resolvedUser.email}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy("headerEmail", resolvedUser.email)
                    }
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy email address"
                    aria-label="Copy email address"
                  >
                    {copiedField === "headerEmail" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
              <StatusBadge status={resolvedUser?.accountStatus || "active"} />
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border border-border bg-muted/60 text-foreground">
                {formatRole(resolvedUser?.role)}
              </span>
            </div>
          </div>
        </div>
      }
      width={isTenantRole ? 880 : 1020}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
          {canOpenPermissions && (
            <button
              onClick={() => onOpenPermissions?.(resolvedUser)}
              className="h-9 px-4 rounded-md bg-[var(--color-accent)] text-[var(--color-text-primary)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Manage Access
            </button>
          )}
        </div>
      }
    >
      {isLoading && <DrawerSkeleton rows={4} />}

      {isError && (
        <div className="p-4 rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground">
          Failed to load account details.
        </div>
      )}

      {!isLoading && !isError && resolvedUser && (
        <div className="flex flex-col gap-6 pt-1">
          {/* ROLE-ADAPTIVE GRID */}
          <div
            className={`grid grid-cols-1 ${
              isTenantRole ? "md:grid-cols-2" : "lg:grid-cols-3"
            } gap-5`}
          >
            {/* CARD 1: CORE IDENTITY & CREDENTIALS */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2.5 border-b border-border">
                <User className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Core Profile
                </h3>
              </div>

              <div className="flex flex-col">
                <Row
                  label="Username"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-sm font-medium">
                        {resolvedUser.username || "—"}
                      </span>
                      {resolvedUser.username && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy("username", resolvedUser.username)
                          }
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                          title="Copy username"
                          aria-label="Copy username"
                        >
                          {copiedField === "username" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </span>
                  }
                />
                <Row
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-sm font-medium">
                        {resolvedUser.phone || "—"}
                      </span>
                      {resolvedUser.phone && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy("phone", resolvedUser.phone)
                          }
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                          title="Copy phone number"
                          aria-label="Copy phone number"
                        >
                          {copiedField === "phone" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </span>
                  }
                />
                <Row label="Role" value={formatRole(resolvedUser.role)} />
                <Row label="Branch" value={formatBranch(resolvedUser.branch)} />
                <Row
                  label="Email Verified"
                  value={
                    resolvedUser.isEmailVerified ? (
                      <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 font-semibold text-xs">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Pending
                      </span>
                    )
                  }
                />
                <Row
                  label="Registration Date"
                  value={formatDateTime(resolvedUser.createdAt)}
                />
              </div>
            </div>

            {/* CARD 2: ACCOUNT SECURITY & LIFECYCLE STATE */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2.5 border-b border-border">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Access State
                </h3>
              </div>

              <div className="flex flex-col">
                <Row
                  label="Current Status"
                  value={
                    <StatusBadge
                      status={resolvedUser.accountStatus || "active"}
                    />
                  }
                />
                <Row
                  label="Last Status Change"
                  value={lastStatusUpdateText}
                />
                <Row
                  label="Archived"
                  value={resolvedUser.isArchived ? "Yes" : "No"}
                />
                <Row
                  label="Dormitory Stay Status"
                  value={
                    hasActiveTenantStay ? (
                      <div className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          Active Stay
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate("/admin/tenants");
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border border-border bg-muted/40 hover:bg-muted text-foreground transition-all duration-150 whitespace-nowrap shadow-none hover:shadow-sm"
                          title="Open in Tenant Management"
                        >
                          <span>Open in Tenants</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {resolvedUser?.role === "applicant"
                          ? (userSummary?.hasLifecycleReservation
                              ? "Pending Move-in"
                              : "No Active Stay")
                          : resolvedUser?.role === "tenant"
                            ? "No Active Stay"
                            : "Not Applicable"}
                      </span>
                    )
                  }
                />
                <Row
                  label="Last Account Update"
                  value={formatDateTime(resolvedUser.updatedAt)}
                />
              </div>
            </div>

            {/* CARD 3: PERMISSION SUMMARY (ADMINS / OWNERS ONLY) */}
            {!isTenantRole && (
              <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 pb-2.5 border-b border-border">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Permission Summary
                  </h3>
                </div>

                {resolvedUser.role === "owner" && (
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground leading-relaxed">
                    Owner accounts keep full platform access. This account
                    inherits all administrative permissions.
                  </div>
                )}

                {resolvedUser.role === "branch_admin" && (
                  <>
                    <div className="text-xs font-bold tracking-wide uppercase text-muted-foreground mb-1">
                      {permissionLabels.length} enabled permission
                      {permissionLabels.length === 1 ? "" : "s"}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {permissionLabels.length > 0 ? (
                        permissionLabels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center min-h-[26px] px-2.5 rounded-md bg-muted/40 border border-border text-foreground text-xs font-medium"
                          >
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No permissions assigned.
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* AUDIT EVENTS */}
          {canViewReports && (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Recent Related Audit Events
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    (Showing latest {visibleAudit.length} of{" "}
                    {auditEvents.length})
                  </span>
                </div>
              </div>

              <div className="p-5">
                {auditLoading && <ListSkeleton rows={2} />}
                {auditError && (
                  <div className="text-xs text-muted-foreground">
                    Failed to load audit events.
                  </div>
                )}

                {!auditLoading && !auditError && visibleAudit.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {visibleAudit.map((event) => (
                      <div
                        key={event.logId || event.timestamp}
                        className="p-3.5 rounded-lg border border-border flex flex-col justify-between h-full bg-card hover:bg-muted/10 transition-colors"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h4 className="text-xs font-bold text-foreground leading-tight">
                              {event.action || "Audit event"}
                            </h4>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-foreground text-[11px] font-medium flex-shrink-0">
                              <Info className="w-3 h-3 text-muted-foreground" />
                              {event.severity === "info"
                                ? "Info"
                                : event.severity || "Info"}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground mb-3">
                            {formatDateTime(event.timestamp)}
                          </div>
                        </div>

                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/40 text-foreground text-[11px] font-medium">
                            {formatLabel(event.type)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!auditLoading && !auditError && visibleAudit.length === 0 && (
                  <div className="p-6 rounded-xl border border-border/50 bg-muted/10 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/50">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      No Security or Account Audit Events
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-sm">
                      No recent authentication or security activity logs were
                      recorded for this account email.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}

/* ---------------------------
   ROW COMPONENT
---------------------------- */
function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-border/40 last:border-b-0 min-h-[38px]">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground text-right break-words">
        {value}
      </span>
    </div>
  );
}
