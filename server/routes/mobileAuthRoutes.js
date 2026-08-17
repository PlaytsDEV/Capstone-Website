/**
 * ============================================================================
 * MOBILE AUTH ROUTES (canonical reset request + session/reset bridges)
 * ============================================================================
 *
 * Closes two gaps the mobile/canonical reconciliation audit found in the
 * vendored mobile router (mobile/routes/auth.routes.js):
 *
 * 1. Session teardown — the shipped mobile app calls
 *    POST /api/m/auth/session-teardown (see
 *    frontend/src/services/api.js `teardownExpiredSession()`) whenever a 401
 *    (SESSION_REVOKED / generic expiry) or 403 ACCOUNT_INACTIVE response
 *    indicates the client's session is already dead — the vendored router
 *    never defined this path, so it 404'd for any client already pointed
 *    here.
 *
 * 2. Reset-token status — a read-only, non-consuming check of whether a
 *    password-reset token is still valid, so a client (e.g. a future
 *    canonical web/auth-action page) can show "this link is expired" before
 *    asking for a new password, without spending the token's one use. The
 *    vendored router only exposes the *consuming* POST /auth/reset-password;
 *    there was no way to check status without risking a wasted attempt.
 *
 * Mounted at /api/m BEFORE mobileRoutes (the vendored mobile backend copy)
 * — same pattern as mobileContractRoutes.js, mobileBillingRoutes.js, etc. —
 * so these definitions supersede the vendored router for their exact paths.
 * Forgot Password is deliberately intercepted here so old and new mobile
 * builds use the website's Firebase action-code authority. Login, OTP,
 * logout, password change, and legacy-token completion still fall through.
 *
 * Session teardown uses the dedicated middleware/mobileSessionTeardownAuth.js
 * resolver, NOT mobileTenantAuth — see that file's header for why a relaxed,
 * single-purpose check is required here and why it must never be reused
 * elsewhere. Reset-token status is unauthenticated (like forgot-password),
 * so it reuses the canonical authLimiter instead.
 *
 * Reset-token status reuses mobile/security/resetTokenEligibility.js (the
 * exact same hashResetToken + resetTokenEligibilityFilter the vendored
 * mobile/controllers/auth.controller.js's resetPassword uses) rather than
 * requiring the full vendored auth controller — that module is
 * dependency-free (only Node's crypto), so unlike the controller it carries
 * no config/database or config/firebase require-cache-shim ordering risk and
 * is safe to import eagerly, in tests or in production.
 */

import express from "express";
import mongoose from "mongoose";
import { createRequire } from "module";

import { mobileSessionTeardownAuth } from "../middleware/mobileSessionTeardownAuth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { requestMobileTenantPasswordReset } from "../controllers/passwordResetController.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const { hashResetToken, resetTokenEligibilityFilter } = createRequire(import.meta.url)(
  "../mobile/security/resetTokenEligibility.js",
);
const { evaluateTenant } = createRequire(import.meta.url)(
  "../security/mobileTenantEligibility.cjs",
);

// IMPORTANT: mobileSessionTeardownAuth is attached per-route below, NEVER
// via router.use() at the router level — see the identical note in
// routes/mobileBillingRoutes.js (a router-level router.use() would also
// incorrectly gate unrelated /api/m/* paths mounted after this router).

// Canonical reset-request alias for already-shipped mobile builds. This route
// deliberately dispatches to the exact web reset controller: Firebase owns
// the action code, and Lilycrest's shared Resend/SMTP pipeline owns delivery.
// It is mounted before the vendored mobile router, whose former handler
// created an incompatible password_reset_tokens credential.
router.post("/auth/forgot-password", authLimiter, requestMobileTenantPasswordReset);

router.post("/auth/session-teardown", mobileSessionTeardownAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const user = req.mobileTeardownUser;
  const session = req.mobileTeardownSession;

  const rawPushToken = typeof req.body?.push_token === "string" ? req.body.push_token.trim() : "";
  if (rawPushToken) {
    // Disable (never delete another user's data, never trust a token string
    // alone as ownership proof) — scoped by BOTH the teardown-resolved
    // user_id AND the exact token value, mirroring users.push_token /
    // users.push_tokens[] field names already used by mobile/services/
    // pushService.js and mobile/controllers/user.controller.js.
    await db.collection("users").updateOne(
      { user_id: user.user_id, push_token: rawPushToken },
      { $set: { push_token: null, push_provider: null, push_platform: null, push_token_updated: new Date() } },
    );
    await db.collection("users").updateOne(
      { user_id: user.user_id, "push_tokens.token": rawPushToken },
      { $set: { "push_tokens.$.enabled": false, push_token_updated: new Date() } },
    );
  }

  // Exactly the ONE session the presented token resolved to — never
  // deleteMany for the user, so other active devices/sessions are untouched.
  await db.collection("user_sessions").deleteOne({ _id: session._id });

  res.json({ status: "ok" });
}));

// Read-only, non-consuming reset-token status check. Reuses the exact same
// eligibility semantics as the real reset (hashResetToken +
// resetTokenEligibilityFilter from mobile/security/resetTokenEligibility.js)
// so this can never drift from what POST /auth/reset-password itself accepts.
//
// Response is deliberately ONLY { valid: boolean } on every path — malformed
// input, unknown/garbage token, expired, already-used, and internal errors
// are all indistinguishable "false" results. No email/user id/expiry/reason
// is ever returned, and the raw token is never logged.
router.post("/auth/reset-password/status", authLimiter, asyncRoute(async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== "string" || !token.trim()) {
    res.json({ valid: false });
    return;
  }

  try {
    const db = mongoose.connection.db;
    const hashedToken = hashResetToken(token);
    const record = await db.collection("password_reset_tokens").findOne(
      resetTokenEligibilityFilter(hashedToken),
    );
    const user = record?.user_id
      ? await db.collection("users").findOne({ user_id: record.user_id })
      : null;
    res.json({ valid: Boolean(record) && evaluateTenant(user).allowed });
  } catch (error) {
    console.error("[mobileAuthRoutes] reset-password/status check failed:", error?.message);
    res.status(500).json({ valid: false });
  }
}));

export default router;
