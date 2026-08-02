/**
 * ============================================================================
 * AUDIT LOGGER SERVICE
 * ============================================================================
 *
 * Service module for creating audit log entries throughout the application.
 * Provides convenient methods for logging different types of activities.
 */

import AuditLog from "../../models/AuditLog.js";
import crypto from "crypto";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract client IP from request
 * @param {Object} req - Express request object
 * @returns {String} Client IP address
 */
const getClientIP = (req) => {
  if (!req) return "unknown";
  return (
    req.headers?.["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

/**
 * Get user agent from request
 * @param {Object} req - Express request object
 * @returns {String} User agent string
 */
const getUserAgent = (req) => {
  if (!req) return "unknown";
  return req.headers?.["user-agent"] || "unknown";
};

const resolveAuditRole = (user) => {
  if (!user) return "applicant";
  if (user.role) return user.role;
  if (user.owner) return "owner";
  if (user.branch_admin) return "branch_admin";
  return "applicant";
};

const getUserInfo = (req) => {
  return {
    email: req?.user?.email || "anonymous",
    userId: req?.user?.mongoId || null,
    role: resolveAuditRole(req?.user),
    branch: req?.user?.branch || "",
  };
};

const fingerprintIdentity = (value) =>
  value && value !== "anonymous" && value !== "unknown"
    ? `sha256:${crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex").slice(0, 12)}`
    : value || "unknown";

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

class AuditLogger {
  /**
   * Log a login/logout event
   */
  async logLogin(req, user, success = true, action = null) {
    try {
      const email = typeof user === "string" ? user : user?.email || "unknown";
      const userRole =
        typeof user === "object" ? resolveAuditRole(user) : "unknown";
      const branch = typeof user === "object" ? user?.branch : null;

      let details;
      if (action) {
        details = action;
      } else if (success) {
        details = `Login from ${getUserAgent(req)}`;
      } else {
        details = "Invalid credentials or authentication failed";
      }

      await AuditLog.log({
        type: "login",
        action:
          action ||
          (success ? "User login successful" : "Failed login attempt"),
        severity: success ? "info" : "warning",
        user: fingerprintIdentity(email),
        userId: typeof user === "object" ? user?._id : null,
        userRole,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch,
        details,
      });
    } catch (_) {
      console.error("Failed to log login event.");
    }
  }

  /**
   * Log a logout event
   */
  async logLogout(req, user) {
    try {
      const userInfo = getUserInfo(req);
      const email =
        typeof user === "string" ? user : user?.email || userInfo.email;
      const userRole =
        typeof user === "object" ? resolveAuditRole(user) : userInfo.role;
      const branch = typeof user === "object" ? user?.branch : userInfo.branch;

      await AuditLog.log({
        type: "login",
        action: "User logout",
        severity: "info",
        user: fingerprintIdentity(email),
        userId: typeof user === "object" ? user?._id : userInfo.userId,
        userRole,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch,
        details: `${userRole || "user"} logged out`,
      });
    } catch (error) {
      console.error("❌ [AuditLogger] Failed to log logout event:", error);
    }
  }

  /**
   * Log a registration event
   */
  async logRegistration(req, user, success = true, details = null) {
    try {
      const email = typeof user === "string" ? user : user?.email || "unknown";
      const userRole =
        typeof user === "object" ? resolveAuditRole(user) : "applicant";
      const branch = typeof user === "object" ? user?.branch : null;
      const userId = typeof user === "object" ? user?._id : null;
      const emailFingerprint = fingerprintIdentity(email);

      await AuditLog.log({
        type: "registration",
        action: success
          ? "User Registration Successful"
          : "Registration Failed",
        severity: success ? "info" : "warning",
        user: emailFingerprint,
        userId,
        userRole,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch,
        entityType: "user",
        entityId: userId ? String(userId) : null,
        details:
          details ||
          (success
            ? `New user registered: ${emailFingerprint}`
            : `Registration attempt failed for ${emailFingerprint}`),
      });
    } catch (_) {
      console.error("Failed to log registration event.");
    }
  }

  /**
   * Log a data modification (create or update)
   */
  async logModification(
    req,
    entityType,
    entityId,
    oldData = null,
    newData = null,
    action = null,
  ) {
    try {
      const userInfo = getUserInfo(req);
      const isCreate = !oldData;

      let changedFields = [];
      if (oldData && newData) {
        changedFields = Object.keys(newData).filter(
          (key) =>
            JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
        );
      }

      await AuditLog.log({
        type: "data_modification",
        action:
          action ||
          (isCreate ? `Created ${entityType}` : `Updated ${entityType}`),
        severity:
          entityType === "user" && changedFields.includes("role")
            ? "high"
            : "info",
        user: fingerprintIdentity(userInfo.email),
        userId: userInfo.userId,
        userRole: userInfo.role,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch: userInfo.branch,
        entityType,
        entityId: String(entityId),
        details: isCreate
          ? `Created new ${entityType} record`
          : `Modified fields: ${changedFields.join(", ") || "unknown"}`,
        metadata: {
          isCreate,
          changedFields,
          before: oldData ? this.sanitizeData(oldData) : null,
          after: newData ? this.sanitizeData(newData) : null,
        },
      });
    } catch (_) {
      console.error("Failed to log modification event.");
    }
  }

  /**
   * Log a data deletion
   */
  async logDeletion(
    req,
    entityType,
    entityId,
    deletedData = null,
    reason = null,
  ) {
    try {
      const userInfo = getUserInfo(req);

      await AuditLog.log({
        type: "data_deletion",
        action: `Deleted ${entityType}`,
        severity: "critical",
        user: fingerprintIdentity(userInfo.email),
        userId: userInfo.userId,
        userRole: userInfo.role,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch: userInfo.branch,
        entityType,
        entityId: String(entityId),
        details: reason || `Permanently deleted ${entityType} record`,
        metadata: {
          deletedRecord: deletedData ? this.sanitizeData(deletedData) : null,
          reason,
        },
      });
    } catch (_) {
      console.error("Failed to log deletion event.");
    }
  }

  /**
   * Log an error
   */
  async logError(req, error, context = null) {
    try {
      const userInfo = getUserInfo(req);

      await AuditLog.log({
        type: "error",
        action: context || "Application error",
        severity: "critical",
        user: fingerprintIdentity(userInfo.email),
        userId: userInfo.userId,
        userRole: userInfo.role,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch: userInfo.branch,
        entityType: "system",
        details: error?.message || String(error),
        metadata: {
          errorName: error?.name,
          errorStack: error?.stack,
          path: req?.path,
          method: req?.method,
          body: req?.body ? this.sanitizeData(req.body) : null,
        },
      });
    } catch (_) {
      console.error("Failed to log error event.");
    }
  }

  /**
   * Log a custom event
   */
  async log(options) {
    try {
      const {
        req,
        type,
        action,
        severity = "info",
        entityType,
        entityId,
        details,
        metadata,
      } = options;

      const userInfo = getUserInfo(req);

      await AuditLog.log({
        type,
        action,
        severity,
        user: fingerprintIdentity(userInfo.email),
        userId: userInfo.userId,
        userRole: userInfo.role,
        ip: getClientIP(req),
        userAgent: getUserAgent(req),
        branch: userInfo.branch,
        entityType,
        entityId: entityId ? String(entityId) : undefined,
        details,
        metadata,
      });
    } catch (_) {
      console.error("Failed to log custom event.");
    }
  }

  /**
   * Sanitize data by removing sensitive fields
   */
  sanitizeData(data) {
    if (!data) return null;

    if (data instanceof Date) return data;
    if (Array.isArray(data)) return data.map((value) => this.sanitizeData(value));
    if (typeof data !== "object") return data;
    if (typeof data.toObject === "function") return this.sanitizeData(data.toObject());

    const sensitiveKey = /(password|otp|token|secret|authorization|sessionid|deviceid|firebaseuid|apikey)/i;
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        sensitiveKey.test(key.replace(/[^a-z0-9]/gi, ""))
          ? "[REDACTED]"
          : key === "_id"
            ? String(value)
            : this.sanitizeData(value),
      ]),
    );
  }
}

const auditLogger = new AuditLogger();
export default auditLogger;
