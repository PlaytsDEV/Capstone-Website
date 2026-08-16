/**
 * ============================================================================
 * AUDIT LOG CONTROLLER
 * ============================================================================
 *
 * Handles all audit log API endpoints.
 * Provides functionality for:
 * - Retrieving logs with filters
 * - Getting statistics
 * - Exporting logs
 * - Security monitoring (failed logins)
 * - Log cleanup
 *
 * ============================================================================
 */

import AuditLog from "../models/AuditLog.js";
import {
  sendSuccess,
  AppError,
} from "../middleware/errorHandler.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract client IP from request
 * @param {Object} req - Express request object
 * @returns {String} Client IP address
 */
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

const resolveAuditBranch = (req, requestedBranch) => {
  if (req.branchFilter !== undefined) {
    return req.branchFilter || requestedBranch;
  }

  return requestedBranch;
};

const normalizeAuditFilters = (req, rawFilters = {}) => {
  const filters = {
    type: rawFilters.type,
    severity: rawFilters.severity,
    user: rawFilters.user,
    role: rawFilters.role,
    branch: resolveAuditBranch(req, rawFilters.branch),
    startDate: rawFilters.startDate,
    endDate: rawFilters.endDate,
    search: rawFilters.search,
  };

  Object.keys(filters).forEach((key) => {
    if (filters[key] === undefined || filters[key] === null || filters[key] === "") {
      delete filters[key];
    }
  });

  return filters;
};

const parseAuditPagination = ({ limit, offset }) => ({
  limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
  offset: Math.max(parseInt(offset, 10) || 0, 0),
});

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/audit-logs
 * Get all audit logs with optional filters
 * @access Admin, Owner
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const filters = normalizeAuditFilters(req, req.query);
    const options = parseAuditPagination(req.query);

    const result = await AuditLog.getLogs(filters, options);

    sendSuccess(res, result.logs, 200, { pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 * @access Admin, Owner
 */
export const getAuditStats = async (req, res, next) => {
  try {
    // Regular admin: use their assigned branch. Owner: use query param or all.
    const branch = req.branchFilter !== undefined
      ? (req.branchFilter || req.query.branch)
      : req.query.branch;
    const stats = await AuditLog.getStats(branch);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-logs/:id
 * Get specific audit log entry
 * @access Admin, Owner
 */
export const getAuditLogById = async (req, res, next) => {
  try {
    const query = { logId: req.params.id };
    if (req.branchFilter) {
      query.branch = req.branchFilter;
    }

    const log = await AuditLog.findOne(query).lean();
    if (!log) throw new AppError("Audit log not found", 404, "AUDIT_LOG_NOT_FOUND");
    sendSuccess(res, log);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/audit-logs
 * Create new audit log entry (internal use)
 * @access System
 */
export const createAuditLog = async (req, res, next) => {
  try {
    const {
      type, action, severity, user, details,
      metadata, entityType, entityId, branch,
    } = req.body;

    if (!type || !action || !severity) {
      throw new AppError(
        "Missing required fields: type, action, severity",
        400,
        "MISSING_REQUIRED_FIELDS",
      );
    }

    const validTypes = [
      "login",
      "registration",
      "data_modification",
      "data_deletion",
      "error",
    ];
    const validSeverities = ["info", "warning", "high", "critical"];

    if (!validTypes.includes(type)) {
      throw new AppError("Invalid type", 400, "INVALID_TYPE");
    }
    if (!validSeverities.includes(severity)) {
      throw new AppError("Invalid severity", 400, "INVALID_SEVERITY");
    }

    const logEntry = await AuditLog.log({
      type, action, severity,
      user: user || req.user?.email || "system",
      userId: req.user?.mongoId,
      userRole: req.user?.role,
      ip: getClientIP(req),
      userAgent: req.headers["user-agent"],
      details, metadata, entityType, entityId, branch,
    });

    sendSuccess(res, logEntry, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/audit-logs/export
 * Export audit logs (filtered)
 * @access Admin, Owner
 */
export const exportAuditLogs = async (req, res, next) => {
  try {
    const filters = normalizeAuditFilters(req, req.body.filters || {});
    const format = (req.query?.format || req.body?.format || "json").toLowerCase();
    const result = await AuditLog.getLogs(filters, { limit: 10000, offset: 0 });

    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const filename = `audit-logs-${dateStr}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const headers = [
        "Log ID",
        "Timestamp",
        "Type",
        "Action / Event",
        "Severity",
        "User",
        "Role",
        "Branch",
        "IP Address",
        "Entity Type",
        "Entity ID",
        "Details",
      ];

      const rows = result.logs.map((log) => [
        escapeCsv(log.logId || ""),
        escapeCsv(log.timestamp ? new Date(log.timestamp).toISOString() : ""),
        escapeCsv(log.type || ""),
        escapeCsv(log.action || ""),
        escapeCsv(log.severity || ""),
        escapeCsv(log.user || ""),
        escapeCsv(log.userRole || ""),
        escapeCsv(log.branch || "general"),
        escapeCsv(log.ip || ""),
        escapeCsv(log.entityType || ""),
        escapeCsv(log.entityId || ""),
        escapeCsv(log.details || ""),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\r\n");

      return res.status(200).send(csvContent);
    }

    const filename = `audit-logs-${dateStr}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({
      exportDate: new Date().toISOString(),
      exportedBy: req.user?.email || "unknown",
      filters: filters,
      totalRecords: result.logs.length,
      logs: result.logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-logs/security/failed-logins
 * Get recent failed login attempts (security monitoring)
 * @access Admin, Owner
 */
export const getFailedLogins = async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const data = await AuditLog.getFailedLogins(hours);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/audit-logs/cleanup
 * Archive/delete old audit logs
 * @access Owner only
 */
export const cleanupAuditLogs = async (req, res, next) => {
  try {
    const daysToKeep = parseInt(req.query.daysToKeep) || 90;

    if (daysToKeep < 30) {
      throw new AppError("Cannot delete logs newer than 30 days", 400, "INVALID_RETENTION");
    }

    const result = await AuditLog.cleanupOldLogs(daysToKeep);

    await AuditLog.log({
      type: "data_deletion",
      action: "Audit log cleanup performed",
      severity: "high",
      user: req.user?.email || "system",
      userId: req.user?.mongoId,
      userRole: req.user?.role,
      ip: getClientIP(req),
      details: `Deleted ${result.deletedCount} logs older than ${daysToKeep} days`,
      entityType: "system",
    });

    sendSuccess(res, { message: "Cleanup completed", ...result });
  } catch (error) {
    next(error);
  }
};
