/**
 * ============================================================================
 * BILLING AUDIT SERVICE
 * ============================================================================
 *
 * Audit logging helper specifically for billing operations.
 */

import AuditLog from "../../models/AuditLog.js";
import crypto from "crypto";

function toAuditType(severity, action = "") {
  const act = String(action).toLowerCase();
  if (severity === "critical" || act.includes("delete") || act.includes("purge")) {
    return "data_deletion";
  }
  return "data_modification";
}

const fingerprintIdentity = (value) =>
  value && value !== "anonymous" && value !== "unknown"
    ? `sha256:${crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex").slice(0, 12)}`
    : value || "unknown";

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

const getUserAgent = (req) => {
  if (!req) return "unknown";
  return req.headers?.["user-agent"] || (typeof req.get === "function" ? req.get("user-agent") : "unknown") || "unknown";
};

export async function logBillingAudit(reqOrOptions, maybeOptions = {}) {
  let req = null;
  let options = {};

  // Normalize single-argument vs dual-argument calls
  if (
    reqOrOptions &&
    (reqOrOptions.headers || reqOrOptions.ip || reqOrOptions.user || typeof reqOrOptions.get === "function")
  ) {
    req = reqOrOptions;
    options = maybeOptions || {};
  } else if (reqOrOptions && typeof reqOrOptions === "object") {
    options = reqOrOptions;
    req = maybeOptions?.headers ? maybeOptions : null;
  }

  const {
    admin,
    actorId: directActorId,
    action,
    severity = "info",
    details = "",
    metadata = {},
    entityId = "",
    entityType = "billing",
    branch = null,
  } = options;

  if (!action) {
    return null;
  }

  const actor = admin || req?.user || null;
  const actorId = directActorId || actor?._id || actor?.mongoId || null;
  const actorEmail = actor?.email || actor?.displayName || (actorId ? String(actorId) : "system");
  const actorRole = actor?.role || (actor?.owner ? "owner" : actor?.branch_admin ? "branch_admin" : "branch_admin");

  let formattedDetails = "";
  let combinedMetadata = { ...metadata };

  if (typeof details === "object" && details !== null) {
    combinedMetadata = { ...combinedMetadata, ...details };
    formattedDetails = Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  } else {
    formattedDetails = String(details || action);
  }

  return AuditLog.log({
    type: toAuditType(severity, action),
    action: action.replaceAll("_", " "),
    severity,
    user: fingerprintIdentity(actorEmail),
    userId: actorId,
    userRole: actorRole,
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    branch: branch ?? actor?.branch ?? "",
    details: formattedDetails,
    metadata: combinedMetadata,
    entityType: entityType || "billing",
    entityId: entityId ? String(entityId) : (options.targetUserId ? String(options.targetUserId) : ""),
  });
}
