import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Clock,
  Database,
  Download,
  FileText,
  FileSpreadsheet,
  Code2,
  Info,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Search,
  X,
  Copy,
  RotateCcw,
  ChevronDown,
  Loader2,
  Laptop,
  Smartphone,
  Users,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
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
  DataTable,
  DetailDrawer,
  PageShell,
  StatusBadge,
  SummaryBar,
} from "../components/shared";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";
import {
  AUDIT_BRANCH_OPTIONS,
  AUDIT_ROLE_OPTIONS,
  AUDIT_SEVERITY_OPTIONS,
  AUDIT_TRAIL_TAB,
  AUDIT_TYPE_OPTIONS,
  AUDIT_DATE_PRESETS,
  AUDIT_PAGE_SIZES,
  SECURITY_SIGNALS_TAB,
  buildAuditExportFilters,
  buildAuditLogQueryParams,
  createDefaultAuditFilters,
  hasActiveAuditFilters,
  isAuditQueryFiltered,
  countActiveAuditFilters,
  formatAuditBranch,
  formatAuditLabel,
  getAllowedAuditTabs,
  getAuditTypeBadgeClass,
  mapAuditSeverityToBadgeStatus,
  normalizeAuditTab,
  formatDateInputValue,
  getRelativeDateInputValue,
  formatIdentityDisplay,
  formatSecurityFailureDetail,
  formatAuditActionDetails,
  formatDisplayIp,
  parseUserAgent,
  getSecurityFailureBadge,
} from "./auditLogPageConfig.mjs";
import "../styles/design-tokens.css";
import "../styles/admin-audit-logs.css";

const RETENTION_OPTIONS = [
  { value: "90", label: "90 Days", sublabel: "Standard" },
  { value: "180", label: "180 Days", sublabel: "6 Months" },
  { value: "365", label: "365 Days", sublabel: "1 Year" },
];
const SECURITY_WINDOW_OPTIONS = [
  { value: "1", label: "Last 1 hour" },
  { value: "6", label: "Last 6 hours" },
  { value: "12", label: "Last 12 hours" },
  { value: "24", label: "Last 24 hours" },
  { value: "72", label: "Last 72 hours" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" },
];

const FAILED_LOGIN_REASON_OPTIONS = [
  { value: "all", label: "All Failure Types" },
  { value: "user_not_found", label: "User Not Found / Unregistered" },
  { value: "invalid_password", label: "Incorrect Credentials" },
  { value: "locked", label: "Account Locked / Disabled" },
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
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab =
    rawTab === "signals" || rawTab === "security-signals" || rawTab === SECURITY_SIGNALS_TAB
      ? SECURITY_SIGNALS_TAB
      : AUDIT_TRAIL_TAB;
  const currentTab = normalizeAuditTab(activeTab, isOwner);

  const handleTabChange = (nextTab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === AUDIT_TRAIL_TAB || nextTab === "trail" || nextTab === "audit-trail") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", "signals");
    }
    setSearchParams(nextParams, { replace: true });
    setSelectedLog(null);
    setShowRawUserAgent(false);
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [securitySubTab, setSecuritySubTab] = useState("suspicious_ips");
  const [suspiciousIpPage, setSuspiciousIpPage] = useState(1);
  const [suspiciousIpPageSize, setSuspiciousIpPageSize] = useState(5);
  const [targetedAccountPage, setTargetedAccountPage] = useState(1);
  const [targetedAccountPageSize, setTargetedAccountPageSize] = useState(5);
  const [failedLoginPage, setFailedLoginPage] = useState(1);
  const [failedLoginPageSize, setFailedLoginPageSize] = useState(5);
  const [failedLoginSearch, setFailedLoginSearch] = useState("");
  const [failedLoginReasonFilter, setFailedLoginReasonFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);
  const [showRawUserAgent, setShowRawUserAgent] = useState(false);

  const handleOpenLogDetail = (log) => {
    setShowRawUserAgent(false);
    setSelectedLog(log);
  };

  const handleCloseLogDetail = () => {
    setShowRawUserAgent(false);
    setSelectedLog(null);
  };
  const [securityWindowHours, setSecurityWindowHours] = useState("24");
  const [cleanupDays, setCleanupDays] = useState(RETENTION_OPTIONS[0].value);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [filters, setFilters] = useState(() => createDefaultAuditFilters());
  const [searchTerm, setSearchTerm] = useState(() => filters.search || "");
  const [userTerm, setUserTerm] = useState(() => filters.user || "");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Debounce search input to avoid refetching on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchTerm) return prev;
        return { ...prev, search: searchTerm };
      });
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce user filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.user === userTerm) return prev;
        return { ...prev, user: userTerm };
      });
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [userTerm]);

  const handleInvestigateInAuditTrail = (targetQuery) => {
    if (!targetQuery) return;
    setSearchTerm(targetQuery);
    setUserTerm("");
    setFilters({
      type: "all",
      severity: "all",
      branch: "all",
      role: "all",
      user: "",
      startDate: null,
      endDate: null,
      search: targetQuery,
      preset: "all",
    });
    setCurrentPage(1);
    setSelectedLog(null);
    handleTabChange(AUDIT_TRAIL_TAB);
    showNotification(`Filtered Audit Trail for "${targetQuery}".`, "info", 2500);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setFilters((prev) => ({ ...prev, search: "" }));
    setCurrentPage(1);
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target)
      ) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [exportMenuOpen]);

  const queryParams = useMemo(
    () =>
      buildAuditLogQueryParams(filters, {
        currentPage,
        itemsPerPage: pageSize,
      }),
    [filters, currentPage, pageSize],
  );
  const statsBranch =
    isOwner && filters.branch !== "all" ? filters.branch : undefined;

  const {
    data: logsEnvelope,
    isLoading: auditLoading,
    isFetching: auditFetching,
  } = usePaginatedAuditLogs(queryParams);
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

  const rawTargetedAccounts = securitySignals?.targetedAccounts || [];
  const targetedAccounts = useMemo(() => {
    if (rawTargetedAccounts.length > 0) return rawTargetedAccounts;
    const byUser = failedLogins.reduce((acc, log) => {
      const user = log.user || "unknown";
      if (!acc[user]) acc[user] = [];
      acc[user].push(log);
      return acc;
    }, {});
    return Object.entries(byUser)
      .map(([user, attempts]) => ({
        user,
        attemptCount: attempts.length,
        lastAttempt: attempts[0]?.timestamp,
        sourceIps: [...new Set(attempts.map((a) => a.ip).filter(Boolean))],
        latestFailureReason: attempts[0]?.details || "Authentication failed",
        userRole: attempts.find((a) => a.userRole)?.userRole || null,
      }))
      .sort(
        (a, b) =>
          b.attemptCount - a.attemptCount ||
          new Date(b.lastAttempt) - new Date(a.lastAttempt),
      );
  }, [rawTargetedAccounts, failedLogins]);

  const filteredFailedLogins = useMemo(() => {
    return failedLogins.filter((log) => {
      if (failedLoginReasonFilter !== "all") {
        const badge = getSecurityFailureBadge(log.details);
        const detailStr = (log.details || "").toLowerCase();
        if (
          failedLoginReasonFilter === "user_not_found" &&
          !detailStr.includes("not found") &&
          badge.variant !== "neutral"
        ) {
          return false;
        }
        if (
          failedLoginReasonFilter === "invalid_password" &&
          !detailStr.includes("password") &&
          !detailStr.includes("credentials")
        ) {
          return false;
        }
        if (
          failedLoginReasonFilter === "locked" &&
          !detailStr.includes("locked") &&
          !detailStr.includes("disabled")
        ) {
          return false;
        }
      }

      if (failedLoginSearch) {
        const q = failedLoginSearch.toLowerCase().trim();
        const user = String(log.user || "").toLowerCase();
        const ip = String(log.ip || "").toLowerCase();
        const details = String(log.details || "").toLowerCase();
        const client = parseUserAgent(log.userAgent).label.toLowerCase();
        return (
          user.includes(q) ||
          ip.includes(q) ||
          details.includes(q) ||
          client.includes(q)
        );
      }

      return true;
    });
  }, [failedLogins, failedLoginSearch, failedLoginReasonFilter]);

  const auditTabs = useMemo(() => {
    const allowed = getAllowedAuditTabs(isOwner);
    // Count active security threat indicators (suspicious IPs exceeding threshold)
    const signalCount = suspiciousIps.length;
    return allowed.map((key) => {
      const isSignals = key === SECURITY_SIGNALS_TAB;
      return {
        id: key,
        key,
        label: key === AUDIT_TRAIL_TAB ? "Audit Trail" : "Security Signals",
        icon: key === AUDIT_TRAIL_TAB ? FileText : ShieldAlert,
        iconClassName:
          key === AUDIT_TRAIL_TAB
            ? "text-sky-500 dark:text-sky-400"
            : "text-rose-500 dark:text-rose-400",
        badge: isSignals && signalCount > 0 ? signalCount : undefined,
        badgeVariant: "danger",
      };
    });
  }, [isOwner, suspiciousIps.length]);

  const activeFiltersForCheck = useMemo(
    () => ({
      ...filters,
      search: searchTerm,
      user: userTerm,
    }),
    [filters, searchTerm, userTerm],
  );
  const activeFiltersCount = countActiveAuditFilters(activeFiltersForCheck);
  const isFilterActive = hasActiveAuditFilters(activeFiltersForCheck);
  const isQueryFiltered = isAuditQueryFiltered(activeFiltersForCheck);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "startDate" || key === "endDate") {
        next.preset = "custom";
      }
      return next;
    });
    setCurrentPage(1);
  };

  const handlePresetSelect = (presetId) => {
    const now = new Date();
    if (presetId === "today") {
      setFilters((prev) => ({
        ...prev,
        preset: "today",
        startDate: formatDateInputValue(now),
        endDate: formatDateInputValue(now),
      }));
    } else if (presetId === "7d") {
      setFilters((prev) => ({
        ...prev,
        preset: "7d",
        startDate: getRelativeDateInputValue(7, now),
        endDate: formatDateInputValue(now),
      }));
    } else if (presetId === "30d") {
      setFilters((prev) => ({
        ...prev,
        preset: "30d",
        startDate: getRelativeDateInputValue(30, now),
        endDate: formatDateInputValue(now),
      }));
    } else if (presetId === "90d") {
      setFilters((prev) => ({
        ...prev,
        preset: "90d",
        startDate: getRelativeDateInputValue(90, now),
        endDate: formatDateInputValue(now),
      }));
    } else if (presetId === "all") {
      setFilters((prev) => ({
        ...prev,
        preset: "all",
        startDate: "",
        endDate: "",
      }));
    } else {
      setFilters((prev) => ({ ...prev, preset: "custom" }));
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setUserTerm("");
    setFilters(createDefaultAuditFilters());
    setCurrentPage(1);
    showNotification("Filters have been reset to default.", "info", 2000);
  };

  const handleExport = async (format = "csv") => {
    setExportMenuOpen(false);
    try {
      const exportFilters = buildAuditExportFilters(filters);
      const response = await exportAuditLogs.mutateAsync({
        filters: exportFilters,
        format,
      });

      const dateStr = new Date().toISOString().split("T")[0];
      let blob;
      let filename;

      if (format === "csv") {
        blob = new Blob([response], { type: "text/csv;charset=utf-8;" });
        filename = `audit-logs-${dateStr}.csv`;
      } else {
        blob = new Blob([JSON.stringify(response, null, 2)], {
          type: "application/json",
        });
        filename = `audit-logs-${dateStr}.json`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      showNotification(
        `Audit logs exported successfully as ${format.toUpperCase()}.`,
        "success",
        3000,
      );
    } catch (error) {
      showNotification(
        error.message || `Failed to export audit logs as ${format.toUpperCase()}.`,
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
        `Old activity logs cleaned up successfully. ${result.deletedCount || 0} record(s) removed.`,
        "success",
        3500,
      );
    } catch (error) {
      showNotification(
        error.message || "Failed to clean up old logs.",
        "error",
        3500,
      );
    }
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showNotification(`Copied ${label || "text"} to clipboard.`, "success", 2000);
  };

  const auditSummaryItems = [
    { label: "Total Logs", value: (stats.total || 0).toLocaleString(), icon: FileText, color: "blue" },
    { label: "Critical", value: (stats.critical || 0).toLocaleString(), icon: AlertTriangle, color: "red" },
    { label: "Today", value: (stats.today || 0).toLocaleString(), icon: Clock, color: "green" },
    { label: "Deletions", value: (stats.deletions || 0).toLocaleString(), icon: Trash2, color: "orange" },
  ];

  const totalFailedAttempts =
    (securitySignals?.totalFailedLogins ?? failedLogins.length) || 0;
  const suspiciousIpCount = suspiciousIps.length;
  const uniqueAccountsCount =
    securitySignals?.uniqueTargetedAccountsCount ?? targetedAccounts.length;
  const isThreatElevated = suspiciousIpCount > 0 || totalFailedAttempts >= 10;

  const securitySummaryItems = [
    {
      label: "Failed Logins",
      value: totalFailedAttempts.toLocaleString(),
      icon: ShieldAlert,
      color: totalFailedAttempts > 0 ? "orange" : "blue",
    },
    {
      label: "Suspicious IPs",
      value: suspiciousIpCount.toLocaleString(),
      icon: Shield,
      color: suspiciousIpCount > 0 ? "red" : "green",
    },
    {
      label: "Targeted Accounts",
      value: uniqueAccountsCount.toLocaleString(),
      icon: Users,
      color: "blue",
    },
    {
      label: "Threat Posture",
      value: isThreatElevated ? "Elevated Alert" : "Normal",
      icon: isThreatElevated ? AlertTriangle : ShieldCheck,
      color: isThreatElevated ? "red" : "green",
    },
  ];



  const auditColumns = [
    {
      key: "type",
      label: "Type",
      width: "12%",
      render: (row) => {
        const badgeClass = getAuditTypeBadgeClass(row.type);
        const label = formatAuditLabel(row.type, "Unknown");
        return (
          <span className={`audit-type-badge ${badgeClass}`}>
            {label}
          </span>
        );
      },
    },
    {
      key: "action",
      label: "Event",
      width: "34%",
      render: (row) => {
        const subtitle = formatAuditActionDetails(row);
        return (
          <div className="flex flex-col gap-0.5 max-w-full">
            <span className="font-semibold text-slate-900 text-xs leading-snug break-words">
              {row.action || "No action recorded"}
            </span>
            {subtitle && (
              <span className="text-[11px] text-slate-500 line-clamp-1 break-words" title={subtitle}>
                {subtitle}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "user",
      label: "User",
      width: "18%",
      render: (row) => {
        const info = formatIdentityDisplay(row.user, "System");
        const role = row.userRole || "";

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {info.isHash ? (
                <span
                  className="audit-user-hash-chip"
                  title={`Anonymized identity: ${info.raw}`}
                >
                  <span className="audit-user-hash-prefix">#</span>
                  <span className="font-mono">{info.short}</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-900 text-xs">{info.display}</span>
              )}
              <button
                type="button"
                className="audit-copy-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(info.raw, "user identity");
                }}
                title="Copy user identity"
              >
                <Copy size={11} />
              </button>
            </div>
            {role && (
              <span
                className={`role-badge role-badge--${role.toLowerCase().replaceAll("-", "_")} w-fit`}
              >
                {formatAuditLabel(role)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "branch",
      label: "Branch",
      width: "14%",
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {formatAuditBranch(row.branch)}
        </span>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      width: "10%",
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
      width: "12%",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {formatDateTime(row.timestamp)}
        </span>
      ),
    },
  ];

  const suspiciousIpColumns = [
    {
      key: "ip",
      label: "IP Address",
      width: "20%",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-slate-900">
            {formatDisplayIp(row.ip)}
          </span>
          <button
            type="button"
            className="audit-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(row.ip, "IP address");
            }}
            title="Copy IP address"
          >
            <Copy size={11} />
          </button>
        </div>
      ),
    },
    {
      key: "attemptCount",
      label: "Threat Level",
      width: "18%",
      render: (row) => {
        const count = row.attemptCount || 0;
        const isHigh = count >= 5;
        return (
          <span
            className={`audit-threat-pill ${
              isHigh ? "audit-threat-pill--high" : "audit-threat-pill--medium"
            }`}
          >
            {isHigh ? "High Threat" : "Suspicious"} ({count} fails)
          </span>
        );
      },
    },
    {
      key: "lastAttempt",
      label: "Last Attempt",
      width: "18%",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {formatDateTime(row.lastAttempt)}
        </span>
      ),
    },
    {
      key: "targetedUsers",
      label: "Targeted Accounts",
      width: "32%",
      render: (row) => {
        const users = Array.isArray(row.targetedUsers)
          ? row.targetedUsers.filter(Boolean)
          : [];
        if (users.length === 0) {
          return <span className="text-xs text-slate-400 italic">No accounts recorded</span>;
        }

        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-[360px]">
            {users.map((target, idx) => {
              const info = formatIdentityDisplay(target);
              return (
                <div key={`${target}-${idx}`} className="inline-flex items-center gap-1">
                  {info.isHash ? (
                    <span
                      className="audit-user-hash-chip"
                      title={`Anonymized identity: ${info.raw}`}
                    >
                      <span className="audit-user-hash-prefix">#</span>
                      <span className="font-mono">{info.short}</span>
                    </span>
                  ) : (
                    <span
                      className="text-xs font-semibold text-slate-800 truncate max-w-[140px]"
                      title={info.raw}
                    >
                      {info.masked || info.display}
                    </span>
                  )}
                  <button
                    type="button"
                    className="audit-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(info.raw, "target identity");
                    }}
                    title="Copy target identity"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Forensics",
      width: "12%",
      align: "right",
      render: (row) => (
        <button
          type="button"
          className="audit-forensic-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleInvestigateInAuditTrail(row.ip);
          }}
          title={`Filter Audit Trail for IP ${row.ip}`}
        >
          <Search size={12} />
          <span>Investigate</span>
        </button>
      ),
    },
  ];

  const targetedAccountColumns = [
    {
      key: "user",
      label: "Target Account",
      width: "25%",
      render: (row) => {
        const info = formatIdentityDisplay(row.user, "Unknown");
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {info.isHash ? (
                <span
                  className="audit-user-hash-chip"
                  title={`Anonymized identity: ${info.raw}`}
                >
                  <span className="audit-user-hash-prefix">#</span>
                  <span className="font-mono">{info.short}</span>
                </span>
              ) : (
                <span
                  className="font-semibold text-slate-900 text-xs truncate max-w-[170px]"
                  title={info.raw}
                >
                  {info.masked || info.display}
                </span>
              )}
              <button
                type="button"
                className="audit-copy-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(info.raw, "account identifier");
                }}
                title="Copy account identifier"
              >
                <Copy size={11} />
              </button>
            </div>
            {row.userRole && (
              <span
                className={`role-badge role-badge--${row.userRole.toLowerCase().replaceAll("-", "_")} w-fit`}
              >
                {formatAuditLabel(row.userRole)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "attemptCount",
      label: "Threat Level",
      width: "18%",
      render: (row) => {
        const count = row.attemptCount || 0;
        const isHigh = count >= 5;
        return (
          <span
            className={`audit-threat-pill ${
              isHigh ? "audit-threat-pill--high" : "audit-threat-pill--medium"
            }`}
          >
            {isHigh ? "High Threat" : "Suspicious"} ({count} fails)
          </span>
        );
      },
    },
    {
      key: "sourceIps",
      label: "Attacking Source IPs",
      width: "28%",
      render: (row) => {
        const ips = Array.isArray(row.sourceIps) ? row.sourceIps.filter(Boolean) : [];
        if (ips.length === 0) {
          return <span className="text-xs text-slate-400 italic">No IP recorded</span>;
        }

        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-[340px]">
            {ips.map((ip, idx) => (
              <div key={`${ip}-${idx}`} className="inline-flex items-center gap-1">
                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {formatDisplayIp(ip)}
                </span>
                <button
                  type="button"
                  className="audit-copy-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(ip, "IP address");
                  }}
                  title="Copy IP address"
                >
                  <Copy size={11} />
                </button>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "lastAttempt",
      label: "Last Attempt",
      width: "17%",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {formatDateTime(row.lastAttempt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Forensics",
      width: "12%",
      align: "right",
      render: (row) => (
        <button
          type="button"
          className="audit-forensic-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleInvestigateInAuditTrail(row.user);
          }}
          title={`Filter Audit Trail for targeted account ${row.user}`}
        >
          <Search size={12} />
          <span>Investigate</span>
        </button>
      ),
    },
  ];

  const failedLoginColumns = [
    {
      key: "user",
      label: "Target Account",
      width: "20%",
      render: (row) => {
        const info = formatIdentityDisplay(row.user, "Unknown");
        return (
          <div className="flex items-center gap-1.5">
            {info.isHash ? (
              <span
                className="audit-user-hash-chip"
                title={`Anonymized identity: ${info.raw}`}
              >
                <span className="audit-user-hash-prefix">#</span>
                <span className="font-mono">{info.short}</span>
              </span>
            ) : (
              <span
                className="font-semibold text-slate-900 text-xs truncate max-w-[150px]"
                title={info.raw}
              >
                {info.masked || info.display}
              </span>
            )}
            <button
              type="button"
              className="audit-copy-btn"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(info.raw, "account identifier");
              }}
              title="Copy account identifier"
            >
              <Copy size={11} />
            </button>
          </div>
        );
      },
    },
    {
      key: "ip",
      label: "IP Address",
      width: "18%",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-slate-700">
            {formatDisplayIp(row.ip)}
          </span>
          <button
            type="button"
            className="audit-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(row.ip, "IP address");
            }}
            title="Copy IP"
          >
            <Copy size={11} />
          </button>
        </div>
      ),
    },
    {
      key: "device",
      label: "Device / Client",
      width: "20%",
      render: (row) => {
        const client = parseUserAgent(row.userAgent);
        return (
          <div className="flex items-center gap-1.5" title={row.userAgent || client.label}>
            {client.isMobile ? (
              <Smartphone size={13} className="text-slate-500 flex-shrink-0" />
            ) : (
              <Laptop size={13} className="text-slate-500 flex-shrink-0" />
            )}
            <span className="text-xs font-medium text-slate-700 truncate max-w-[145px]">
              {client.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "timestamp",
      label: "Attempted",
      width: "16%",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {formatDateTime(row.timestamp)}
        </span>
      ),
    },
    {
      key: "details",
      label: "Failure Reason",
      width: "16%",
      render: (row) => {
        const badge = getSecurityFailureBadge(row.details);
        return (
          <span
            className={`audit-failure-badge audit-failure-badge--${badge.variant}`}
            title={badge.tooltip}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      width: "10%",
      align: "right",
      render: (row) => (
        <button
          type="button"
          className="audit-forensic-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLogDetail(row);
          }}
          title="Inspect full forensic details of this failed login attempt"
        >
          <Search size={12} />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  const renderFieldDiffTable = (metadata) => {
    if (
      !metadata ||
      (!metadata.before && !metadata.after && !metadata.changedFields)
    ) {
      return null;
    }

    const before = metadata.before || {};
    const after = metadata.after || {};
    const keys = Array.from(
      new Set([
        ...(Array.isArray(metadata.changedFields) ? metadata.changedFields : []),
        ...Object.keys(before),
        ...Object.keys(after),
      ]),
    ).filter(
      (k) =>
        k !== "_id" &&
        k !== "updatedAt" &&
        k !== "createdAt" &&
        k !== "__v",
    );

    if (keys.length === 0) return null;

    const formatDiffValue = (v) => {
      if (v === undefined || v === null) {
        return <span className="text-slate-400 italic">None / Unset</span>;
      }
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };

    return (
      <div className="audit-diff-card">
        <div className="audit-diff-card__header">
          <h4>Field Comparison (Before vs After)</h4>
          <span className="audit-diff-card__badge">
            {keys.length} field{keys.length !== 1 ? "s" : ""} modified
          </span>
        </div>
        <div className="audit-diff-table-wrapper">
          <table className="audit-diff-table">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Field</th>
                <th style={{ width: "37%" }}>Previous (Before)</th>
                <th style={{ width: "37%" }}>Updated (After)</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const prevVal = before[key];
                const nextVal = after[key];
                const isChanged =
                  JSON.stringify(prevVal) !== JSON.stringify(nextVal);

                return (
                  <tr
                    key={key}
                    className={isChanged ? "audit-diff-row--changed" : ""}
                  >
                    <td className="audit-diff-cell__field">{key}</td>
                    <td className="audit-diff-cell__before">
                      {formatDiffValue(prevVal)}
                    </td>
                    <td className="audit-diff-cell__after">
                      {formatDiffValue(nextVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (auditLoading && !logsEnvelope) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <PageShell
      title="Audit & Security"
      subtitle="Review audit events, trace administrative changes, and inspect security-relevant activity."
      tabs={isOwner ? auditTabs : []}
      activeTab={currentTab}
      onTabChange={handleTabChange}
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
          <div className="audit-toolbar-container">
            {/* Tier 1: Search, Date Presets, and Dual Export */}
            <div className="audit-toolbar-tier1">
              <div className="audit-toolbar-tier1__left">
                <div className="audit-search-wrapper">
                  <Search size={15} className="audit-search-icon" />
                  <input
                    type="text"
                    className="audit-search-input"
                    placeholder="Search actions, users, or details..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="audit-search-clear"
                      onClick={handleClearSearch}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Segmented Date Presets */}
                <div className="audit-presets-group">
                  {AUDIT_DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`audit-preset-btn ${
                        filters.preset === preset.id
                          ? "audit-preset-btn--active"
                          : ""
                      }`}
                      onClick={() => handlePresetSelect(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="audit-toolbar-tier1__right">
                {/* Export Dropdown */}
                <div
                  className="audit-export-dropdown-wrapper"
                  ref={exportDropdownRef}
                >
                  <button
                    type="button"
                    className="audit-export-trigger-btn"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    disabled={exportAuditLogs.isPending}
                    title="Export audit logs"
                  >
                    {exportAuditLogs.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    <span>
                      {exportAuditLogs.isPending ? "Exporting..." : "Export Logs"}
                    </span>
                    <ChevronDown size={14} />
                  </button>

                  {exportMenuOpen && (
                    <div className="audit-export-menu">
                      <button
                        type="button"
                        className="audit-export-menu-item"
                        onClick={() => handleExport("csv")}
                      >
                        <FileSpreadsheet
                          size={18}
                          className="audit-export-menu-item__icon text-emerald-600"
                        />
                        <div>
                          <span className="audit-export-menu-item__title">
                            Export as CSV (.csv)
                          </span>
                          <span className="audit-export-menu-item__desc">
                            Formatted table for Excel & compliance
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="audit-export-menu-item"
                        onClick={() => handleExport("json")}
                      >
                        <Code2
                          size={18}
                          className="audit-export-menu-item__icon text-blue-600"
                        />
                        <div>
                          <span className="audit-export-menu-item__title">
                            Export as JSON (.json)
                          </span>
                          <span className="audit-export-menu-item__desc">
                            Raw audit log objects for forensics
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tier 2: Granular Filter Controls */}
            <div className="audit-toolbar-tier2">
              {isOwner && (
                <select
                  className="audit-select-filter"
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  title="Filter by Branch"
                >
                  {AUDIT_BRANCH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="audit-select-filter"
                value={filters.role}
                onChange={(e) => handleFilterChange("role", e.target.value)}
                title="Filter by User Role"
              >
                {AUDIT_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                className="audit-select-filter"
                value={filters.severity}
                onChange={(e) => handleFilterChange("severity", e.target.value)}
                title="Filter by Severity"
              >
                {AUDIT_SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                className="audit-select-filter"
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                title="Filter by Activity Type"
              >
                {AUDIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="audit-input-filter"
                placeholder="Filter by email / user..."
                value={userTerm}
                onChange={(e) => setUserTerm(e.target.value)}
              />

              <label className="audit-date-label">
                <span>From:</span>
                <input
                  type="date"
                  className="audit-date-input"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </label>

              <label className="audit-date-label">
                <span>To:</span>
                <input
                  type="date"
                  className="audit-date-input"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </label>

              {isFilterActive && (
                <button
                  type="button"
                  className="audit-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all filters to defaults"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                  <span className="audit-active-filter-badge">
                    {activeFiltersCount}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="inline-flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Window:
              </span>
              <select
                value={securityWindowHours}
                onChange={(e) => {
                  setSecurityWindowHours(e.target.value);
                  setSuspiciousIpPage(1);
                  setTargetedAccountPage(1);
                  setFailedLoginPage(1);
                }}
                className="audit-select-filter"
              >
                {SECURITY_WINDOW_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-800">
              <Info size={14} className="flex-shrink-0 text-amber-600" />
              <span>Real-time security signals and failed sign-in monitoring across all branches.</span>
            </div>
          </div>
        )}
      </PageShell.Actions>

      <PageShell.Content>
        {currentTab === AUDIT_TRAIL_TAB ? (
          <DataTable
            columns={auditColumns}
            data={logs}
            loading={auditLoading || auditFetching}
            serverPagination
            pagination={{
              page: currentPage,
              pageSize,
              total: totalLogs,
              totalLabel: isQueryFiltered
                ? `${totalLogs.toLocaleString()} filtered result${totalLogs !== 1 ? "s" : ""}`
                : `${totalLogs.toLocaleString()} total logs`,
              onPageChange: setCurrentPage,
              onPageSizeChange: (newPageSize) => {
                setPageSize(newPageSize);
                setCurrentPage(1);
              },
            }}
            onRowClick={handleOpenLogDetail}
            emptyState={{
              icon: FileText,
              title: "No audit events found",
              description:
                "Try adjusting the branch, role, date, search, or severity filters.",
            }}
          />
        ) : (
          <div className="audit-security">
            {/* Sub-Navigation Tabs */}
            <div className="audit-security-nav">
              <div className="audit-security-nav__tabs">
                <button
                  type="button"
                  className={`audit-security-nav__tab ${
                    securitySubTab === "suspicious_ips"
                      ? "audit-security-nav__tab--active"
                      : ""
                  }`}
                  onClick={() => setSecuritySubTab("suspicious_ips")}
                >
                  <ShieldAlert size={15} />
                  <span>Suspicious IPs</span>
                  <span className="audit-security-nav__badge">
                    {suspiciousIps.length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`audit-security-nav__tab ${
                    securitySubTab === "targeted_accounts"
                      ? "audit-security-nav__tab--active"
                      : ""
                  }`}
                  onClick={() => setSecuritySubTab("targeted_accounts")}
                >
                  <Users size={15} />
                  <span>Targeted Accounts</span>
                  <span className="audit-security-nav__badge">
                    {targetedAccounts.length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`audit-security-nav__tab ${
                    securitySubTab === "failed_logins"
                      ? "audit-security-nav__tab--active"
                      : ""
                  }`}
                  onClick={() => setSecuritySubTab("failed_logins")}
                >
                  <AlertTriangle size={15} />
                  <span>All Failed Logins</span>
                  <span className="audit-security-nav__badge">
                    {failedLogins.length}
                  </span>
                </button>
              </div>
            </div>

            {/* View 1: Suspicious IPs */}
            {securitySubTab === "suspicious_ips" && (
              <section className="audit-panel">
                <div className="audit-panel__header">
                  <div className="audit-panel__header-left">
                    <div className="audit-panel__header-icon audit-panel__header-icon--orange">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h3>Suspicious IPs</h3>
                      <p>
                        IP addresses with repeated unsuccessful sign-in attempts within the selected timeframe.
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
                    title: "No suspicious IP activity",
                    description:
                      "No IP addresses have exceeded the failed sign-in threshold in this timeframe.",
                  }}
                />
              </section>
            )}

            {/* View 2: Targeted Accounts */}
            {securitySubTab === "targeted_accounts" && (
              <section className="audit-panel">
                <div className="audit-panel__header">
                  <div className="audit-panel__header-left">
                    <div className="audit-panel__header-icon audit-panel__header-icon--blue">
                      <Users size={18} />
                    </div>
                    <div>
                      <h3>Targeted Accounts</h3>
                      <p>
                        User accounts and identities targeted by repeated authentication failures.
                      </p>
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={targetedAccountColumns}
                  data={targetedAccounts}
                  loading={securityLoading}
                  pagination={{
                    page: targetedAccountPage,
                    pageSize: targetedAccountPageSize,
                    total: targetedAccounts.length,
                    onPageChange: setTargetedAccountPage,
                    onPageSizeChange: setTargetedAccountPageSize,
                  }}
                  emptyState={{
                    icon: Users,
                    title: "No targeted accounts",
                    description:
                      "No user accounts have been targeted by failed sign-in attempts in this timeframe.",
                  }}
                />
              </section>
            )}

            {/* View 3: All Failed Logins Stream */}
            {securitySubTab === "failed_logins" && (
              <section className="audit-panel">
                <div className="audit-panel__header">
                  <div className="audit-panel__header-left">
                    <div className="audit-panel__header-icon audit-panel__header-icon--red">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3>All Failed Logins Stream</h3>
                      <p>
                        Comprehensive forensic timeline of failed sign-in attempts with search, status filters, and detailed payload inspection.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="audit-security-stream-toolbar">
                  <div className="audit-security-stream-toolbar__left">
                    <div className="audit-search-wrapper">
                      <Search size={14} className="audit-search-icon" />
                      <input
                        type="text"
                        className="audit-search-input"
                        placeholder="Search account, IP, device, or reason..."
                        value={failedLoginSearch}
                        onChange={(e) => {
                          setFailedLoginSearch(e.target.value);
                          setFailedLoginPage(1);
                        }}
                      />
                      {failedLoginSearch && (
                        <button
                          type="button"
                          className="audit-search-clear"
                          onClick={() => {
                            setFailedLoginSearch("");
                            setFailedLoginPage(1);
                          }}
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <select
                      value={failedLoginReasonFilter}
                      onChange={(e) => {
                        setFailedLoginReasonFilter(e.target.value);
                        setFailedLoginPage(1);
                      }}
                      className="audit-select-filter"
                    >
                      {FAILED_LOGIN_REASON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {(failedLoginSearch || failedLoginReasonFilter !== "all") && (
                      <button
                        type="button"
                        className="audit-reset-btn"
                        onClick={() => {
                          setFailedLoginSearch("");
                          setFailedLoginReasonFilter("all");
                          setFailedLoginPage(1);
                        }}
                        title="Clear filters"
                      >
                        <RotateCcw size={12} />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  <div className="audit-security-stream-toolbar__right">
                    <span className="text-xs font-semibold text-slate-500">
                      Showing {filteredFailedLogins.length} of {failedLogins.length} attempts
                    </span>
                  </div>
                </div>

                <DataTable
                  columns={failedLoginColumns}
                  data={filteredFailedLogins}
                  loading={securityLoading}
                  onRowClick={handleOpenLogDetail}
                  pagination={{
                    page: failedLoginPage,
                    pageSize: failedLoginPageSize,
                    total: filteredFailedLogins.length,
                    onPageChange: setFailedLoginPage,
                    onPageSizeChange: setFailedLoginPageSize,
                  }}
                  emptyState={{
                    icon: AlertTriangle,
                    title: "No failed sign-ins match your search",
                    description:
                      "Try adjusting your search query, failure type filter, or the time window.",
                  }}
                />
              </section>
            )}

            <section className="audit-panel audit-retention-panel">
              <div className="audit-retention-panel__header">
                <div className="audit-retention-panel__icon">
                  <Database size={18} />
                </div>
                <div className="audit-retention-panel__heading">
                  <h3 className="audit-retention-panel__title">Log History & Storage Cleanup</h3>
                  <p className="audit-retention-panel__description">
                    Keep your database fast and organized by clearing routine activity history older than your selected timeframe. Important security alerts and sign-in records are always saved safely.
                  </p>
                </div>
              </div>

              <div className="audit-retention-panel__body">
                <div className="audit-retention-panel__control-row">
                  <div className="audit-retention-panel__picker">
                    <span className="audit-retention-panel__picker-label">
                      Keep Logs For
                    </span>
                    <div
                      className="audit-retention-panel__segmented-control"
                      role="radiogroup"
                      aria-label="Retention period options"
                    >
                      {RETENTION_OPTIONS.map((option) => {
                        const isSelected = cleanupDays === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setCleanupDays(option.value)}
                            className={`audit-retention-panel__segment ${
                              isSelected ? "audit-retention-panel__segment--active" : ""
                            }`}
                          >
                            <span className="audit-retention-panel__segment-title">{option.label}</span>
                            {option.sublabel && (
                              <span className="audit-retention-panel__segment-sub">{option.sublabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="audit-retention-panel__cta">
                    <button
                      type="button"
                      className="audit-retention-panel__purge-btn"
                      onClick={() => setIsCleanupConfirmOpen(true)}
                      disabled={cleanupAuditLogs.isPending}
                      title={
                        cleanupAuditLogs.isPending
                          ? "Log cleanup in progress..."
                          : `Clean up routine activity logs older than ${cleanupDays} days`
                      }
                    >
                      {cleanupAuditLogs.isPending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      <span>
                        {cleanupAuditLogs.isPending
                          ? "Cleaning Up Logs..."
                          : "Clean Up Old Logs"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="audit-retention-panel__guardrail">
                  <Shield size={14} className="audit-retention-panel__guardrail-icon" />
                  <span className="audit-retention-panel__guardrail-text">
                    <strong>Safe & Protected:</strong> Important security events (such as failed sign-ins, account changes, and security alerts) are permanently saved and will never be removed.
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
      </PageShell.Content>

      <DetailDrawer
        open={Boolean(selectedLog)}
        onClose={handleCloseLogDetail}
        title={
          selectedLog ? selectedLog.action || "System Activity Event" : "System Activity Event"
        }
        subtitle={
          selectedLog
            ? `${formatAuditLabel(selectedLog.type, "System")} Event · Recorded ${formatDateTime(selectedLog.timestamp)}`
            : undefined
        }
        width={720}
        footer={
          selectedLog ? (
            <div className="flex items-center justify-between w-full gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Log ID:</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {selectedLog.logId || "—"}
                </span>
                {selectedLog.logId && (
                  <button
                    type="button"
                    className="audit-copy-btn ml-1"
                    onClick={() => copyToClipboard(selectedLog.logId, "Log ID")}
                    title="Copy Log ID"
                  >
                    <Copy size={11} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedLog.user &&
                  !selectedLog.user.startsWith("sha256:") &&
                  selectedLog.user.toLowerCase() !== "system" && (
                    <button
                      type="button"
                      className="audit-modal-btn audit-modal-btn--secondary"
                      onClick={() => {
                        const userQuery = selectedLog.user.trim();
                        handleCloseLogDetail();
                        handleInvestigateInAuditTrail(userQuery);
                      }}
                      title={`Filter Audit Trail for user ${selectedLog.user}`}
                    >
                      <Users size={13} />
                      <span>Filter User Logs</span>
                    </button>
                  )}
                {selectedLog.ip && selectedLog.ip !== "Unknown" && (
                  <button
                    type="button"
                    className="audit-modal-btn audit-modal-btn--primary"
                    onClick={() => {
                      const ipQuery = selectedLog.ip.trim();
                      handleCloseLogDetail();
                      handleInvestigateInAuditTrail(ipQuery);
                    }}
                    title={`Filter Audit Trail for IP ${selectedLog.ip}`}
                  >
                    <Search size={13} />
                    <span>Investigate IP ({formatDisplayIp(selectedLog.ip)})</span>
                  </button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selectedLog ? (
          <>
            {/* Event Overview Summary */}
            <div className="audit-log-detail__summary">
              <div className="audit-log-detail__summary-tags">
                <StatusBadge
                  status={mapAuditSeverityToBadgeStatus(selectedLog.severity)}
                  label={formatAuditLabel(selectedLog.severity, "Unknown")}
                />
                <span
                  className={`audit-type-badge ${getAuditTypeBadgeClass(
                    selectedLog.type,
                  )}`}
                >
                  {formatAuditLabel(selectedLog.type, "Unknown")}
                </span>
                <span className="audit-log-detail__branch-tag">
                  {formatAuditBranch(selectedLog.branch)}
                </span>
              </div>
              <div className="audit-log-detail__summary-desc">
                <p>
                  {formatAuditActionDetails(selectedLog) ||
                    formatSecurityFailureDetail(selectedLog.details) ||
                    selectedLog.details ||
                    "Direct system activity recorded with no additional parameters."}
                </p>
              </div>
            </div>

            {/* Structured Field Changes Comparison (if modification log) */}
            {renderFieldDiffTable(selectedLog.metadata)}

            {/* Actor & Network Origin Forensics */}
            <DetailDrawer.Section label="Actor & Network Forensics">
              <DetailDrawer.Row
                label="User / Actor"
                value={
                  (() => {
                    const info = formatIdentityDisplay(selectedLog.user, "System Process");
                    return (
                      <div className="flex items-center gap-2">
                        {info.isHash ? (
                          <span
                            className="audit-user-hash-chip"
                            title={`Anonymized identity: ${info.raw}`}
                          >
                            <span className="audit-user-hash-prefix">#</span>
                            <span className="font-mono">{info.short}</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {info.display}
                          </span>
                        )}
                        {selectedLog.user && selectedLog.user.toLowerCase() !== "system" && (
                          <button
                            type="button"
                            className="audit-copy-btn"
                            onClick={() =>
                              copyToClipboard(info.raw, "user identity")
                            }
                            title="Copy user identity"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })()
                }
              />
              <DetailDrawer.Row
                label="Role / Access"
                value={
                  (() => {
                    const roleStr = (selectedLog.userRole || "").trim().toLowerCase();
                    const isKnownRole =
                      roleStr &&
                      roleStr !== "unknown" &&
                      roleStr !== "unspecified" &&
                      roleStr !== "none";

                    return isKnownRole ? (
                      <span
                        className={`role-badge role-badge--${roleStr.replaceAll("-", "_")}`}
                      >
                        {formatAuditLabel(selectedLog.userRole)}
                      </span>
                    ) : (
                      <span className="role-badge role-badge--unregistered">
                        Unregistered Account
                      </span>
                    );
                  })()
                }
              />
              <DetailDrawer.Row
                label="Recorded"
                value={formatDateTime(selectedLog.timestamp)}
              />
              <DetailDrawer.Row
                label="IP Address"
                value={
                  selectedLog.ip ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDisplayIp(selectedLog.ip)}
                      </span>
                      <button
                        type="button"
                        className="audit-copy-btn"
                        onClick={() =>
                          copyToClipboard(selectedLog.ip, "IP Address")
                        }
                        title="Copy IP Address"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  ) : (
                    "Not Recorded"
                  )
                }
              />
              <DetailDrawer.Row
                label="Client & Device"
                value={
                  (() => {
                    const client = parseUserAgent(selectedLog.userAgent);
                    const hasRawUa = selectedLog.userAgent && selectedLog.userAgent !== "unknown";
                    return (
                      <div className="flex flex-col items-end gap-1 text-right">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200 text-xs">
                          {client.isMobile ? (
                            <Smartphone size={13} className="text-slate-500 flex-shrink-0" />
                          ) : (
                            <Laptop size={13} className="text-slate-500 flex-shrink-0" />
                          )}
                          <span>{client.label}</span>
                        </div>
                        {hasRawUa && (
                          <div className="flex flex-col items-end">
                            <button
                              type="button"
                              className="audit-ua-toggle-btn"
                              onClick={() => setShowRawUserAgent((prev) => !prev)}
                            >
                              {showRawUserAgent ? "Hide Raw User-Agent" : "View Raw User-Agent"}
                            </button>
                            {showRawUserAgent && (
                              <div
                                className="audit-ua-raw-box font-mono text-[11px]"
                                title={selectedLog.userAgent}
                              >
                                {selectedLog.userAgent}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()
                }
              />
            </DetailDrawer.Section>

            {/* Target Entity Details (Strictly Conditional) */}
            {(selectedLog.entityId || (selectedLog.entityType && selectedLog.entityType !== "general")) && (
              <DetailDrawer.Section label="Target Resource">
                <DetailDrawer.Row
                  label="Entity Type"
                  value={formatAuditLabel(selectedLog.entityType, "Direct Entity")}
                />
                {selectedLog.entityId && (
                  <DetailDrawer.Row
                    label="Entity ID"
                    value={
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-bold">
                          {selectedLog.entityId}
                        </span>
                        <button
                          type="button"
                          className="audit-copy-btn"
                          onClick={() =>
                            copyToClipboard(selectedLog.entityId, "Entity ID")
                          }
                          title="Copy Entity ID"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    }
                  />
                )}
              </DetailDrawer.Section>
            )}

            {/* Metadata & Payload (Strictly Conditional) */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <DetailDrawer.Section label="Additional Metadata">
                <div className="audit-json-header">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    JSON Payload
                  </span>
                  <button
                    type="button"
                    className="audit-copy-json-btn"
                    onClick={() =>
                      copyToClipboard(
                        renderMetadata(selectedLog.metadata),
                        "Metadata JSON",
                      )
                    }
                    title="Copy full JSON metadata"
                  >
                    <Copy size={12} />
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="audit-log-detail__json">
                  {renderMetadata(selectedLog.metadata)}
                </pre>
              </DetailDrawer.Section>
            )}
          </>
        ) : null}
      </DetailDrawer>

      <ConfirmModal
        isOpen={isCleanupConfirmOpen}
        onClose={() => setIsCleanupConfirmOpen(false)}
        onConfirm={handleConfirmCleanup}
        title="Clean Up Old Logs"
        message={`Are you sure you want to clean up routine activity logs older than ${cleanupDays} days? Critical security alerts and sign-in records will stay safely saved in your system.`}
        confirmText="Clean Up Logs"
        cancelText="Cancel"
        variant="danger"
        loading={cleanupAuditLogs.isPending}
      />
    </PageShell>
  );
};

export default AuditLogsPage;
