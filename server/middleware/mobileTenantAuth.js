/**
 * ============================================================================
 * MOBILE TENANT AUTH — canonical mobile session-validation authority
 * ============================================================================
 *
 * This is now the ONE shared session validator for every canonical /api/m
 * bridge router (billing, PayMongo, documents, contracts, surveys). It used
 * to only check session-token expiry + role, while the vendored mobile
 * backend's own validator (server/mobile/security/mobileAuthCore.js,
 * `evaluateAccount` + the securityVersion comparison in `resolve()`) also
 * enforced account-restriction state and session revocation — meaning a
 * disabled/restricted tenant, or a tenant whose sessions were revoked
 * (password change, security incident), could still reach billing/contracts/
 * surveys/documents through this shallower check even though the exact same
 * disabled/revoked session was already correctly rejected by the vendored
 * router. This function now performs the SAME account-restriction and
 * securityVersion checks as mobileAuthCore.js's `resolve()`, against the
 * same `user_sessions`/`users` collections, so both families of routers
 * enforce identical revocation/disabled-account semantics — see
 * docs/reports for the audit that identified this drift.
 *
 * The 'ACCOUNT_INACTIVE' code below is deliberately NOT mobileAuthCore.js's
 * own 'ACCOUNT_ACCESS_RESTRICTED' string — it matches the currently-live
 * standalone mobile backend's exact wire contract (backend/middleware/auth.js),
 * which the shipped React Native app's response interceptor already special-
 * cases (src/services/api.js checks `error.response.data.code ===
 * 'ACCOUNT_INACTIVE'` to show a specific "account deactivated" message and
 * immediately clear the session, ahead of the generic 401 handling). Using
 * the same string here means that behavior keeps working unchanged whenever
 * the mobile app is eventually pointed at this canonical backend.
 *
 * Tenant identity is derived exclusively from the resolved session record —
 * never from any client-supplied id — so every route using this middleware
 * automatically gets tenant-ownership-safe identity in req.mobileTenant.
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

// Delegates to mobileAuthCore.js's evaluateAccount() — the SAME function the
// vendored mobile backend's authMiddleware uses — instead of a separately
// maintained copy, so the two families of routers can no longer drift on
// what counts as a restricted account (isActive/is_active, isArchived/
// is_archived, accountStatus/account_status).
function isAccountRestricted(user) {
  return !evaluateAccount(user).allowed;
}

export async function mobileTenantAuth(req, res, next) {
  try {
    const token = extractSessionToken(req);
    if (!token) return res.status(401).json({ detail: "Not authenticated" });

    const db = mongoose.connection.db;
    const session = await db.collection("user_sessions").findOne({
      session_token: token,
      expires_at: { $gt: new Date() },
    });
    if (!session?.user_id) {
      return res.status(401).json({ detail: "Invalid or expired session" });
    }

    const user = await db.collection("users").findOne({ user_id: session.user_id });
    if (!user) {
      return res.status(401).json({ detail: "Invalid or expired session" });
    }
    if (!MOBILE_TENANT_ROLES.has(String(user.role || "").toLowerCase())) {
      return res.status(403).json({ detail: "Tenant access denied" });
    }

    if (isAccountRestricted(user)) {
      // Self-heal: a restricted account's outstanding sessions are no
      // longer valid credentials — clear them so a later re-enable doesn't
      // resurrect a pre-restriction session. Matches the standalone mobile
      // backend's authMiddleware, which does the same on this exact path.
      await db.collection("user_sessions").deleteMany({ user_id: session.user_id }).catch(() => {});
      return res.status(403).json({
        code: "ACCOUNT_INACTIVE",
        detail: "Access denied. Your account is inactive. Please contact admin.",
      });
    }

    // securityVersion revocation: a session minted before a password change /
    // security incident carries the securityVersion that was current at
    // issuance (see mobile/security/mobileSession.js createSession()); if the
    // user's current version has since moved on, this session was explicitly
    // superseded and must not be honored even though it hasn't expired yet.
    const currentVersion = Number(user.securityVersion ?? user.security_version ?? 0);
    const sessionVersion = Number(session.security_version ?? 0);
    const versionsValid = Number.isSafeInteger(currentVersion) && currentVersion >= 0
      && Number.isSafeInteger(sessionVersion) && sessionVersion >= 0;
    if (!versionsValid || sessionVersion !== currentVersion) {
      await db.collection("user_sessions").deleteMany({ user_id: session.user_id }).catch(() => {});
      return res.status(401).json({
        code: "SESSION_REVOKED",
        detail: "Your session is no longer valid. Please sign in again.",
      });
    }

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
