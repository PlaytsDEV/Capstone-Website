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
} from "lucide-react";
import { formatTimestamp } from "../../utils/formatters";
import { TableSkeleton } from "../../../../shared/components/LoadingSkeletons";

function getActivityIcon(type) {
  switch (type) {
    case "login":
      return <LogIn size={15} />;
    case "registration":
      return <UserPlus size={15} />;
    case "data_modification":
      return <FileEdit size={15} />;
    case "data_deletion":
      return <Trash2 size={15} />;
    case "error":
      return <XCircle size={15} />;
    default:
      return <Activity size={15} />;
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
            <th>Activity</th>
            <th>User</th>
            <th>Role</th>
            <th>Severity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => {
            const key = log.logId || log._id || index;
            const severity = String(log.severity || "info").toLowerCase();
            const role = String(log.userRole || "unknown").toLowerCase();

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
                      <User size={13} />
                      <span>{log.user || "System"}</span>
                    </div>
                    {log.ip && <div className="log-user-ip">{log.ip}</div>}
                  </div>
                </td>
                <td>
                  <span className={`role-badge role-badge--${role}`}>
                    {log.userRole || "N/A"}
                  </span>
                </td>
                <td>
                  <span className={`severity-badge severity-badge--${severity}`}>
                    {log.severity || "info"}
                  </span>
                </td>
                <td>
                  <div className="log-details">{log.details || "-"}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

