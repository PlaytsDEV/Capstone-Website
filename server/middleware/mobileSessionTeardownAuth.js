/**
 * ============================================================================
 * MOBILE SESSION TEARDOWN AUTH — narrow, single-purpose resolver
 * ============================================================================
 *
 * Backs ONLY POST /api/m/auth/session-teardown (routes/mobileAuthRoutes.js).
 * Deliberately NOT mobileTenantAuth (middleware/mobileTenantAuth.js): that
 * middleware requires a currently-active, non-expired, non-revoked session —
 * exactly the case teardown does NOT have. Teardown exists so the mobile app
 * can clean up (delete its own dead session row, disable its own push token)
 * right after the client discovered its session is already expired/revoked
 * via a 401/403 from a real protected route. Requiring a fully valid session
 * here would make the endpoint unusable for the one case it exists for.
 *
 * Mirrors the currently-live standalone mobile backend's contract exactly
 * (LilyCrest-Clean/backend/middleware/auth.js `authMiddlewareRecentSession` +
 * TEARDOWN_GRACE_PERIOD_MS, backend/controllers/auth.controller.js
 * `sessionTeardown`), since the shipped app's frontend/src/services/api.js
 * `teardownExpiredSession()` POSTs the presented (now-dead) token's
 * Authorization header verbatim and expects this exact wire behavior:
 *
 *   - session tokens here are opaque DB-row lookups (`user_sessions`
 *     collection), never JWTs — there is no "signature" to verify; identity
 *     is proven exclusively by an EXACT match against a real, previously
 *     issued session_token string. A guessed/forged/random token can never
 *     match a real row, so it can never resolve to any user.
 *   - the ONLY relaxation versus a normal session check is the expiry
 *     window: a session that expired up to TEARDOWN_GRACE_PERIOD_MS ago is
 *     still accepted, so the client's very next request (this one) after
 *     seeing the expiry can still clean itself up. Older or already-deleted
 *     sessions simply fail to match and fall through to the same safe,
 *     idempotent 401 path.
 *   - account-active / securityVersion revocation are deliberately NOT
 *     re-checked here (unlike mobileTenantAuth). A revoked or deactivated
 *     account's session row has already been deleted by whichever path
 *     revoked it (mobileTenantAuth's self-heal deleteMany, or the standalone
 *     backend's equivalent) by the time teardown runs, so it naturally
 *     resolves to "no matching session" (idempotent 401) rather than needing
 *     a special-case bypass — there is nothing left to authorize around.
 *
 * Tenant identity is derived exclusively from the resolved session row
 * (`session.user_id`) — never from any client-supplied id in the body/query
 * — so a request can only ever tear down the session that its own presented
 * token maps to. This resolver is intentionally NOT exported for reuse by
 * any other route; keep every unrelated route on mobileTenantAuth so this
 * relaxed check never becomes a general-purpose "weak auth" shortcut.
 */

import mongoose from "mongoose";

const TEARDOWN_GRACE_PERIOD_MS = 5 * 60 * 1000;

function extractSessionToken(req) {
  const header = req.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.session_token || null;
}

export async function mobileSessionTeardownAuth(req, res, next) {
  try {
    const token = extractSessionToken(req);
    if (!token) return res.status(401).json({ detail: "Not authenticated" });

    const db = mongoose.connection.db;
    const session = await db.collection("user_sessions").findOne({
      session_token: token,
      expires_at: { $gt: new Date(Date.now() - TEARDOWN_GRACE_PERIOD_MS) },
    });
    if (!session?.user_id) {
      // Idempotent by design: already-deleted, past-grace, or never-real
      // tokens all land here identically — no signal is leaked about which.
      return res.status(401).json({ detail: "Invalid or expired session" });
    }

    const user = await db.collection("users").findOne({ user_id: session.user_id });
    if (!user) return res.status(401).json({ detail: "Invalid or expired session" });

    req.mobileTeardownUser = user;
    req.mobileTeardownSession = session;
    return next();
  } catch {
    return res.status(401).json({ detail: "Authentication error" });
  }
}
