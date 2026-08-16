import React from "react";
import {
  Clock,
  User,
  LogIn,
  UserPlus,
  FileEdit,
  Trash2,
  XCircle,
  Activity,
  FileText,
  Copy,
} from "lucide-react";
import { formatTimestamp } from "../../utils/formatters";
import { TableSkeleton } from "../../../../shared/components/LoadingSkeletons";
import {
  formatAuditLabel,
  getAuditTypeBadgeClass,
  mapAuditSeverityToBadgeStatus,
} from "../../pages/auditLogPageConfig.mjs";
import { StatusBadge } from "../shared";

function getActivityIcon(type) {
  switch (String(type).toLowerCase()) {
    case "login":
      return <LogIn size={14} />;
    case "registration":
      return <UserPlus size={14} />;
    case "data_modification":
    case "data_modifcation":
      return <FileEdit size={14} />;
    case "data_deletion":
      return <Trash2 size={14} />;
    case "error":
      return <XCircle size={14} />;
    default:
      return <Activity size={14} />;
  }
}

export default function AuditLogsTable({ logs = [], loading = false, onRowClick }) {
  if (loading) {
    return <TableSkeleton rows={7} columns={6} />;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="audit-empty-state">
        <FileText size={36} className="audit-empty-state__icon" />
        <h4>No logs match your filters</h4>
        <p>Try adjusting your search term, date range, branch, or severity filters.</p>
      </div>
    );
  }

  return (
    <div className="audit-table-wrapper">
      <table className="audit-logs-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Type</th>
            <th>Event</th>
            <th>User</th>
            <th>Role</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => {
            const key = log.logId || log._id || index;
            const role = String(log.userRole || "unknown").toLowerCase().replaceAll("-", "_");
            const val = log.user || "System";
            const isHash = val.startsWith("sha256:");
            const displayVal = isHash ? val.replace("sha256:", "") : val;

            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(log)}
                className={onRowClick ? "audit-table-row--clickable" : ""}
              >
                <td>
                  <div className="log-timestamp">
                    <Clock size={14} />
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                </td>
                <td>
                  <span className={`audit-type-badge ${getAuditTypeBadgeClass(log.type)}`}>
                    {formatAuditLabel(log.type)}
                  </span>
                </td>
                <td>
                  <div className="log-activity">
                    <div className={`log-activity-icon log-activity-icon--${log.type || "default"}`}>
                      {getActivityIcon(log.type)}
                    </div>
                    <span className="log-activity-text">{log.action || "No action recorded"}</span>
                  </div>
                </td>
                <td>
                  <div className="log-user">
                    <div className="log-user-email">
                      {isHash ? (
                        <span className="audit-user-hash-chip font-mono">
                          #{displayVal.slice(0, 10)}
                        </span>
                      ) : (
                        <span>{val}</span>
                      )}
                    </div>
                    {log.ip && <div className="log-user-ip">{log.ip}</div>}
                  </div>
                </td>
                <td>
                  <span className={`role-badge role-badge--${role}`}>
                    {formatAuditLabel(log.userRole || "N/A")}
                  </span>
                </td>
                <td>
                  <StatusBadge
                    status={mapAuditSeverityToBadgeStatus(log.severity)}
                    label={formatAuditLabel(log.severity, "Unknown")}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
