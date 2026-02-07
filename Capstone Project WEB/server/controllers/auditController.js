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

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/audit-logs
 * Get all audit logs with optional filters
 * @access Admin, SuperAdmin
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      type,
      severity,
      user,
      role,
      branch,
      startDate,
      endDate,
      search,
      limit,
      offset,
    } = req.query;

    // Build filters
    const filters = {
      type,
      severity,
      user,
      role,
      branch,
      startDate,
      endDate,
      search,
    };

    // Remove undefined filters
    Object.keys(filters).forEach(
      (key) => filters[key] === undefined && delete filters[key],
    );

    // Build options
    const options = {
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    };

    // Get logs
    const result = await AuditLog.getLogs(filters, options);

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit logs",
    });
  }
};

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 * @access Admin, SuperAdmin
 */
export const getAuditStats = async (req, res) => {
  try {
    const { branch } = req.query;
    const stats = await AuditLog.getStats(branch);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching audit stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
};

/**
 * GET /api/audit-logs/:id
 * Get specific audit log entry
 * @access Admin, SuperAdmin
 */
export const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findOne({ logId: req.params.id }).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        error: "Audit log not found",
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit log",
    });
  }
};

/**
 * POST /api/audit-logs
 * Create new audit log entry (internal use)
 * @access System
 */
export const createAuditLog = async (req, res) => {
  try {
    const {
      type,
      action,
      severity,
      user,
      details,
      metadata,
      entityType,
      entityId,
      branch,
    } = req.body;

    // Validation
    if (!type || !action || !severity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: type, action, severity",
      });
    }

    const validTypes = ["login", "data_modification", "data_deletion", "error"];
    const validSeverities = ["info", "warning", "high", "critical"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid type",
      });
    }

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: "Invalid severity",
      });
    }

    const logEntry = await AuditLog.log({
      type,
      action,
      severity,
      user: user || req.user?.email || "system",
      userId: req.user?.mongoId,
      userRole: req.user?.role,
      ip: getClientIP(req),
      userAgent: req.headers["user-agent"],
      details,
      metadata,
      entityType,
      entityId,
      branch,
    });

    // Log critical events to console
    if (severity === "critical") {
      console.log("🚨 CRITICAL AUDIT LOG:", logEntry);
    }

    res.status(201).json({
      success: true,
      data: logEntry,
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create audit log",
    });
  }
};

/**
 * POST /api/audit-logs/export
 * Export audit logs (filtered)
 * @access Admin, SuperAdmin
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const filters = req.body.filters || {};
    const result = await AuditLog.getLogs(filters, { limit: 10000, offset: 0 });

    const filename = `audit-logs-${new Date().toISOString().split("T")[0]}.json`;

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
    console.error("Error exporting audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export audit logs",
    });
  }
};

/**
 * GET /api/audit-logs/security/failed-logins
 * Get recent failed login attempts (security monitoring)
 * @access Admin, SuperAdmin
 */
export const getFailedLogins = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const data = await AuditLog.getFailedLogins(hours);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching failed logins:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch security data",
    });
  }
};

/**
 * DELETE /api/audit-logs/cleanup
 * Archive/delete old audit logs
 * @access SuperAdmin only
 */
export const cleanupAuditLogs = async (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.daysToKeep) || 90;

    if (daysToKeep < 30) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete logs newer than 30 days",
      });
    }

    const result = await AuditLog.cleanupOldLogs(daysToKeep);

    // Log the cleanup operation itself
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

    res.json({
      success: true,
      message: "Cleanup completed",
      data: result,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup audit logs",
    });
  }
};
