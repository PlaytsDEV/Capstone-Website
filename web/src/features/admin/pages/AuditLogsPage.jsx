import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Database,
  Download,
  FileText,
  Info,
  Shield,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
  useAuditStats,
  useCleanupAuditLogs,
  useExportAuditLogs,
  useFailedLoginSignals,
  usePaginatedAuditLogs,
} from "../../../shared/hooks/queries/useAuditLogs";
import { showNotification } from "../../../shared/utils/notification";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import {
  ActionBar,
  DataTable,
  DetailDrawer,
  PageShell,
  StatusBadge,
  SummaryBar,
} from "../components/shared";
import {
  AUDIT_BRANCH_OPTIONS,
  AUDIT_ROLE_OPTIONS,
  AUDIT_SEVERITY_OPTIONS,
  AUDIT_TRAIL_TAB,
  AUDIT_TYPE_OPTIONS,
  SECURITY_SIGNALS_TAB,
  buildAuditExportFilters,
  buildAuditLogQueryParams,
  createDefaultAuditFilters,
  formatAuditBranch,
  formatAuditLabel,
  getAllowedAuditTabs,
  mapAuditSeverityToBadgeStatus,
  normalizeAuditTab,
} from "./auditLogPageConfig.mjs";
import "../styles/design-tokens.css";
import "../styles/admin-audit-logs.css";

const ITEMS_PER_PAGE = 10;
const RETENTION_OPTIONS = [90, 180, 365];
const SECURITY_WINDOW_OPTIONS = [
  { value: "24", label: "Last 24 hours" },
  { value: "72", label: "Last 72 hours" },
  { value: "168", label: "Last 7 days" },
];

const formatDateTime = (value) => {
  if (!value) return "Not available";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderMetadata = (metadata) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No metadata recorded";
  }

  return JSON.stringify(metadata, null, 2);
};

const AuditLogsPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const auditTabs = useMemo(
    () =>
      getAllowedAuditTabs(isOwner).map((key) => ({
        key,
        label: key === AUDIT_TRAIL_TAB ? "Audit Trail" : "Security Signals",
        icon: key === AUDIT_TRAIL_TAB ? FileText : Shield,
      })),
    [isOwner],
  );

  const [activeTab, setActiveTab] = useState(AUDIT_TRAIL_TAB);
  const currentTab = normalizeAuditTab(activeTab, isOwner);
  const [currentPage, setCurrentPage] = useState(1);
  const [suspiciousIpPage, setSuspiciousIpPage] = useState(1);
  const [suspiciousIpPageSize, setSuspiciousIpPageSize] = useState(5);
  const [failedLoginPage, setFailedLoginPage] = useState(1);
  const [failedLoginPageSize, setFailedLoginPageSize] = useState(5);
  const [selectedLog, setSelectedLog] = useState(null);
  const [securityWindowHours, setSecurityWindowHours] = useState("24");
  const [cleanupDays, setCleanupDays] = useState(String(RETENTION_OPTIONS[0]));
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [filters, setFilters] = useState(() => createDefaultAuditFilters());

  const queryParams = useMemo(
    () =>
      buildAuditLogQueryParams(filters, {
        currentPage,
        itemsPerPage: ITEMS_PER_PAGE,
      }),
    [filters, currentPage],
  );
  const statsBranch =
    isOwner && filters.branch !== "all" ? filters.branch : undefined;

  const { data: logsEnvelope, isLoading: auditLoading } =
    usePaginatedAuditLogs(queryParams);
  const { data: auditStats } = useAuditStats(statsBranch);
  const { data: securitySignals, isLoading: securityLoading } =
    useFailedLoginSignals(Number(securityWindowHours), {
      enabled: isOwner && currentTab === SECURITY_SIGNALS_TAB,
    });
  const exportAuditLogs = useExportAuditLogs();
  const cleanupAuditLogs = useCleanupAuditLogs();

  const logs = Array.isArray(logsEnvelope?.data) ? logsEnvelope.data : [];
  const pagination = logsEnvelope?.meta?.pagination || {};
  const totalLogs = Number(
    pagination.total ?? pagination.totalItems ?? auditStats?.total ?? 0,
  );
  const stats = auditStats || {
    total: 0,
    critical: 0,
    today: 0,
    deletions: 0,
  };
  const failedLogins = securitySignals?.recentAttempts || [];
  const suspiciousIps = securitySignals?.suspiciousIPs || [];

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      const response = await exportAuditLogs.mutateAsync(
        buildAuditExportFilters(filters),
      );
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showNotification("Audit export generated successfully.", "success", 3000);
    } catch (error) {
      showNotification(
        error.message || "Failed to export audit logs.",
        "error",
        3500,
      );
    }
  };

  const handleConfirmCleanup = async () => {
    const daysToKeep = Number(cleanupDays);
    if (!daysToKeep) return;

    try {
      const result = await cleanupAuditLogs.mutateAsync(daysToKeep);
      setIsCleanupConfirmOpen(false);
      showNotification(
        `Retention cleanup completed. ${result.deletedCount || 0} log(s) removed.`,
        "success",
        3500,
      );
    } catch (error) {
      showNotification(
        error.message || "Failed to run audit retention cleanup.",
        "error",
        3500,
      );
    }
  };

  const auditSummaryItems = [
    { label: "Total Logs", value: (stats.total || 0).toLocaleString(), icon: FileText, color: "blue" },
    { label: "Critical", value: (stats.critical || 0).toLocaleString(), icon: AlertTriangle, color: "red" },
    { label: "Today", value: (stats.today || 0).toLocaleString(), icon: Clock, color: "green" },
    { label: "Deletions", value: (stats.deletions || 0).toLocaleString(), icon: Trash2, color: "orange" },
  ];

  const securitySummaryItems = [
    {
      label: "Failed Logins",
      value: (securitySignals?.totalFailedLogins || 0).toLocaleString(),
      icon: ShieldAlert,
      color: "orange",
    },
    {
      label: "Suspicious IPs",
      value: suspiciousIps.length,
      icon: Shield,
      color: "red",
    },
    {
      label: "Recent Attempts",
      value: failedLogins.length,
      icon: Clock,
      color: "blue",
    },
    {
      label: "Retention Default",
      value: `${cleanupDays}d`,
      icon: Database,
      color: "green",
    },
  ];

  const auditColumns = [
    {
      key: "type",
      label: "Type",
      width: "150px",
      render: (row) => (
        <span className="audit-type-badge">
          {formatAuditLabel(row.type, "Unknown")}
        </span>
      ),
    },
    {
      key: "action",
      label: "Event",
      render: (row) => (
        <span className="audit-message">
          {row.action || "No action recorded"}
        </span>
      ),
    },
    {
      key: "user",
      label: "User",
      render: (row) => row.user || "System",
    },
    {
      key: "branch",
      label: "Branch",
      width: "140px",
      render: (row) => formatAuditBranch(row.branch),
    },
    {
      key: "severity",
      label: "Severity",
      width: "110px",
      render: (row) => (
        <StatusBadge
          status={mapAuditSeverityToBadgeStatus(row.severity)}
          label={formatAuditLabel(row.severity, "Unknown")}
        />
      ),
    },
    {
      key: "timestamp",
      label: "Time",
      width: "165px",
      render: (row) => formatDateTime(row.timestamp),
    },
  ];

  const suspiciousIpColumns = [
    {
      key: "ip",
      label: "IP Address",
      render: (row) => row.ip || "Unknown",
    },
    {
      key: "attemptCount",
      label: "Attempts",
      width: "110px",
      render: (row) => row.attemptCount || 0,
    },
    {
      key: "lastAttempt",
      label: "Last Attempt",
      width: "180px",
      render: (row) => formatDateTime(row.lastAttempt),
    },
    {
      key: "targetedUsers",
      label: "Targeted Users",
      render: (row) =>
        Array.isArray(row.targetedUsers) && row.targetedUsers.length > 0
          ? row.targetedUsers.join(", ")
          : "No users recorded",
    },
  ];

  const failedLoginColumns = [
    {
      key: "user",
      label: "User",
      render: (row) => {
        const val = row.user || "Unknown";
        if (val.startsWith("sha256:")) {
          return (
            <span
              className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600"
              title={val}
            >
              {val.slice(0, 16)}...
            </span>
          );
        }
        return <span className="font-semibold text-slate-900">{val}</span>;
      },
    },
    {
      key: "ip",
      label: "IP",
      width: "120px",
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.ip || "Unknown"}</span>
      ),
    },
    {
      key: "branch",
      label: "Branch",
      width: "130px",
      render: (row) => formatAuditBranch(row.branch),
    },
    {
      key: "timestamp",
      label: "Attempted",
      width: "160px",
      render: (row) => formatDateTime(row.timestamp),
    },
    {
      key: "details",
      label: "Details",
      render: (row) => (
        <span className="block max-w-[260px] text-xs leading-relaxed text-slate-600">
          {row.details || "No details recorded"}
        </span>
      ),
    },
  ];

  const auditTrailFilters = [
    ...(isOwner
      ? [
          {
            key: "branch",
            options: AUDIT_BRANCH_OPTIONS,
            value: filters.branch,
            onChange: (value) => handleFilterChange("branch", value),
          },
        ]
      : []),
    {
      key: "role",
      options: AUDIT_ROLE_OPTIONS,
      value: filters.role,
      onChange: (value) => handleFilterChange("role", value),
    },
    {
      key: "severity",
      options: AUDIT_SEVERITY_OPTIONS,
      value: filters.severity,
      onChange: (value) => handleFilterChange("severity", value),
    },
    {
      key: "type",
      options: AUDIT_TYPE_OPTIONS,
      value: filters.type,
      onChange: (value) => handleFilterChange("type", value),
    },
  ];

  return (
    <PageShell
      tabs={isOwner ? auditTabs : []}
      activeTab={currentTab}
      onTabChange={(nextTab) => {
        setActiveTab(nextTab);
        setSelectedLog(null);
      }}
    >
      <PageShell.Summary>
        <SummaryBar
          items={
            currentTab === SECURITY_SIGNALS_TAB
              ? securitySummaryItems
              : auditSummaryItems
          }
        />
      </PageShell.Summary>

      <PageShell.Actions>
        {currentTab === AUDIT_TRAIL_TAB ? (
          <ActionBar
            search={{
              value: filters.search,
              onChange: (value) => handleFilterChange("search", value),
              placeholder: "Search actions, users, or details...",
            }}
            filters={auditTrailFilters}
            actions={[
              {
                label: exportAuditLogs.isPending ? "Exporting..." : "Export",
                icon: Download,
                onClick: handleExport,
                variant: "ghost",
                disabled: exportAuditLogs.isPending,
                title: exportAuditLogs.isPending
                  ? "Preparing audit logs JSON export..."
                  : "Export current audit logs matching active filters as JSON",
              },
            ]}
          >
            <div className="audit-logs__field-group">
              <label className="audit-logs__field">
                <span>User:</span>
                <input
                  type="text"
                  value={filters.user}
                  onChange={(event) =>
                    handleFilterChange("user", event.target.value)
                  }
                  placeholder="Filter by email"
                />
              </label>
              <label className="audit-logs__field audit-logs__field--date">
                <span>From:</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) =>
                    handleFilterChange("startDate", event.target.value)
                  }
                />
              </label>
              <label className="audit-logs__field audit-logs__field--date">
                <span>To:</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) =>
                    handleFilterChange("endDate", event.target.value)
                  }
                />
              </label>
            </div>
          </ActionBar>
        ) : (
          <ActionBar
            filters={[
              {
                key: "hours",
                options: SECURITY_WINDOW_OPTIONS,
                value: securityWindowHours,
                onChange: (value) => {
                  setSecurityWindowHours(value);
                  setSuspiciousIpPage(1);
                  setFailedLoginPage(1);
                },
              },
            ]}
          >
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-800">
              <Info size={14} className="flex-shrink-0 text-amber-600" />
              <span>Security signals monitor system-wide failed logins (Owner access required).</span>
            </div>
          </ActionBar>
        )}
      </PageShell.Actions>

      <PageShell.Content>
        {currentTab === AUDIT_TRAIL_TAB ? (
          <DataTable
            columns={auditColumns}
            data={logs}
            loading={auditLoading}
            serverPagination
            pagination={{
              page: currentPage,
              pageSize: ITEMS_PER_PAGE,
              total: totalLogs,
              onPageChange: setCurrentPage,
            }}
            onRowClick={setSelectedLog}
            emptyState={{
              icon: FileText,
              title: "No audit events found",
              description:
                "Try adjusting the branch, role, date, or severity filters.",
            }}
          />
        ) : (
          <div className="audit-security">
            <div className="audit-security__grid">
              <section className="audit-panel">
                <div className="audit-panel__header">
                  <div className="audit-panel__header-left">
                    <div className="audit-panel__header-icon audit-panel__header-icon--orange">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h3>Suspicious IPs</h3>
                      <p>
                        IPs with repeated failed login attempts in the selected
                        window.
                      </p>
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={suspiciousIpColumns}
                  data={suspiciousIps}
                  loading={securityLoading}
                  pagination={{
                    page: suspiciousIpPage,
                    pageSize: suspiciousIpPageSize,
                    total: suspiciousIps.length,
                    onPageChange: setSuspiciousIpPage,
                    onPageSizeChange: setSuspiciousIpPageSize,
                  }}
                  emptyState={{
                    icon: Shield,
                    title: "No suspicious IPs",
                    description:
                      "No IPs crossed the current suspicious-attempt threshold.",
                  }}
                />
              </section>

              <section className="audit-panel">
                <div className="audit-panel__header">
                  <div className="audit-panel__header-left">
                    <div className="audit-panel__header-icon audit-panel__header-icon--red">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3>Recent Failed Logins</h3>
                      <p>
                        Latest warning-level login failures returned by the
                        existing audit backend.
                      </p>
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={failedLoginColumns}
                  data={failedLogins}
                  loading={securityLoading}
                  pagination={{
                    page: failedLoginPage,
                    pageSize: failedLoginPageSize,
                    total: failedLogins.length,
                    onPageChange: setFailedLoginPage,
                    onPageSizeChange: setFailedLoginPageSize,
                  }}
                  emptyState={{
                    icon: AlertTriangle,
                    title: "No failed logins",
                    description:
                      "No failed login attempts were recorded in the selected window.",
                  }}
                />
              </section>
            </div>

            <section className="audit-panel audit-panel--retention">
              <div className="audit-panel__header">
                <div className="audit-panel__header-left">
                  <div className="audit-panel__header-icon audit-panel__header-icon--red">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <h3>Retention Cleanup</h3>
                    <p>
                      Delete non-critical audit logs older than the selected
                      retention window. Critical logs are always retained.
                    </p>
                  </div>
                </div>
                <span className="audit-retention__danger-label">
                  <AlertTriangle size={11} />
                  Destructive
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-200/90 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Retention Window:
                  </span>
                  <select
                    value={cleanupDays}
                    onChange={(event) => setCleanupDays(event.target.value)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {RETENTION_OPTIONS.map((days) => (
                      <option key={days} value={String(days)}>
                        {days} days
                      </option>
                    ))}
                  </select>
                  <span className="hidden text-xs text-slate-500 sm:inline">
                    • Safe defaults start at 90 days. Cleanup requires explicit confirmation.
                  </span>
                </div>

                <button
                  type="button"
                  className="audit-retention__button"
                  onClick={() => setIsCleanupConfirmOpen(true)}
                  disabled={cleanupAuditLogs.isPending}
                  title={
                    cleanupAuditLogs.isPending
                      ? "Retention cleanup job is currently executing..."
                      : `Permanently delete non-critical audit logs older than ${cleanupDays} days`
                  }
                >
                  <Trash2 size={15} />
                  {cleanupAuditLogs.isPending ? "Cleaning up..." : "Run Retention Cleanup"}
                </button>
              </div>
            </section>
          </div>
        )}
      </PageShell.Content>

      <DetailDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={
          selectedLog ? selectedLog.action || "Audit Event" : "Audit Event"
        }
        width={760}
      >
        {selectedLog ? (
          <>
            <div className="audit-log-detail__hero">
              <div className="audit-log-detail__hero-tags">
                <StatusBadge
                  status={mapAuditSeverityToBadgeStatus(selectedLog.severity)}
                  label={formatAuditLabel(selectedLog.severity, "Unknown")}
                />
                <span className="audit-log-detail__tag">
                  {formatAuditLabel(selectedLog.type, "Unknown")}
                </span>
                <span className="audit-log-detail__tag">
                  {formatAuditBranch(selectedLog.branch)}
                </span>
              </div>
              <p>{selectedLog.details || "No additional details recorded."}</p>
            </div>

            <DetailDrawer.Section label="Event Context">
              <DetailDrawer.Row
                label="User"
                value={selectedLog.user || "System"}
              />
              <DetailDrawer.Row
                label="Role"
                value={formatAuditLabel(selectedLog.userRole, "Unknown")}
              />
              <DetailDrawer.Row
                label="Recorded"
                value={formatDateTime(selectedLog.timestamp)}
              />
              <DetailDrawer.Row
                label="IP Address"
                value={selectedLog.ip || "Unknown"}
              />
              <DetailDrawer.Row
                label="User Agent"
                value={selectedLog.userAgent || "Unknown"}
              />
            </DetailDrawer.Section>

            <DetailDrawer.Section label="Entity Details">
              <DetailDrawer.Row
                label="Entity Type"
                value={formatAuditLabel(selectedLog.entityType, "Not linked")}
              />
              <DetailDrawer.Row
                label="Entity ID"
                value={selectedLog.entityId || "Not linked"}
              />
              <DetailDrawer.Row
                label="Log ID"
                value={selectedLog.logId || "Unavailable"}
              />
            </DetailDrawer.Section>

            <DetailDrawer.Section label="Metadata">
              <pre className="audit-log-detail__json">
                {renderMetadata(selectedLog.metadata)}
              </pre>
            </DetailDrawer.Section>
          </>
        ) : null}
      </DetailDrawer>

      <ConfirmModal
        isOpen={isCleanupConfirmOpen}
        onClose={() => setIsCleanupConfirmOpen(false)}
        onConfirm={handleConfirmCleanup}
        title="Confirm Retention Cleanup"
        message={`Are you sure you want to delete non-critical audit logs older than ${cleanupDays} days? Critical logs are always retained. This action cannot be undone.`}
        confirmText="Run Retention Cleanup"
        cancelText="Cancel"
        variant="danger"
        loading={cleanupAuditLogs.isPending}
      />
    </PageShell>
  );
};

export default AuditLogsPage;
