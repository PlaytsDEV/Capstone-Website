/**
 * Canonical mobile session validation shared by /api/m HTTP adapters and
 * Socket.IO. Tenant identity always comes from the stored session record.
 */

import mongoose from "mongoose";
import mobileAuthCore from "../mobile/security/mobileAuthCore.js";

const { evaluateAccount } = mobileAuthCore;
const MOBILE_TENANT_ROLES = new Set(["tenant", "applicant"]);

function extractSessionToken(req) {
  const header = req.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.session_token || null;
}

function isAccountRestricted(user) {
  return !evaluateAccount(user).allowed;
}

export async function resolveMobileTenantSession(token, { db = mongoose.connection.db } = {}) {
  if (!token) return { ok: false, status: 401, detail: "Not authenticated" };

  const session = await db.collection("user_sessions").findOne({
    session_token: token,
    expires_at: { $gt: new Date() },
  });
  if (!session?.user_id) {
    return { ok: false, status: 401, detail: "Invalid or expired session" };
  }

  const user = await db.collection("users").findOne({ user_id: session.user_id });
  if (!user) {
    return { ok: false, status: 401, detail: "Invalid or expired session" };
  }
  if (!MOBILE_TENANT_ROLES.has(String(user.role || "").toLowerCase())) {
    return { ok: false, status: 403, detail: "Tenant access denied" };
  }

  if (isAccountRestricted(user)) {
    await db.collection("user_sessions").deleteMany({ user_id: session.user_id }).catch(() => {});
    return {
      ok: false,
      status: 403,
      code: "ACCOUNT_INACTIVE",
      detail: "Access denied. Your account is inactive. Please contact admin.",
    };
  }

  const currentVersion = Number(user.securityVersion ?? user.security_version ?? 0);
  const sessionVersion = Number(session.security_version ?? 0);
  const versionsValid = Number.isSafeInteger(currentVersion) && currentVersion >= 0
    && Number.isSafeInteger(sessionVersion) && sessionVersion >= 0;
  if (!versionsValid || sessionVersion !== currentVersion) {
    await db.collection("user_sessions").deleteMany({ user_id: session.user_id }).catch(() => {});
    return {
      ok: false,
      status: 401,
      code: "SESSION_REVOKED",
      detail: "Your session is no longer valid. Please sign in again.",
    };
  }

  return { ok: true, user, session };
}

export async function mobileTenantAuth(req, res, next) {
  try {
    const result = await resolveMobileTenantSession(extractSessionToken(req));
    if (!result.ok) {
      return res.status(result.status).json({
        ...(result.code ? { code: result.code } : {}),
        detail: result.detail,
      });
    }

    const { user } = result;
    req.mobileTenant = user;
    req.user = {
      mongoId: user._id,
      email: user.email,
      role: user.role,
      branch: user.branch || "",
    };
    return next();
  } catch {
    return res.status(401).json({ detail: "Authentication error" });
  }
}
