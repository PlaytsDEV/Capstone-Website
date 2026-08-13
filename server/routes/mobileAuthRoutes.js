/**
 * ============================================================================
 * MOBILE AUTH ROUTES (session-teardown bridge)
 * ============================================================================
 *
 * Closes the gap identified in the Phase 3 Auth/Session Consolidation audit:
 * the shipped mobile app calls POST /api/m/auth/session-teardown (see
 * frontend/src/services/api.js `teardownExpiredSession()`) whenever a 401
 * (SESSION_REVOKED / generic expiry) or 403 ACCOUNT_INACTIVE response
 * indicates the client's session is already dead — but the canonical
 * backend's vendored mobile router (mobile/routes/auth.routes.js) never
 * defined this path, so it 404'd for any client already pointed here.
 *
 * Mounted at /api/m BEFORE mobileRoutes (the vendored mobile backend copy)
 * — same pattern as mobileContractRoutes.js, mobileBillingRoutes.js, etc. —
 * so this definition fully supersedes the vendored router for this one path.
 * Every other /api/m/auth/* path (login, OTP, logout, ...) is untouched and
 * continues to fall through to the vendored router unchanged.
 *
 * Uses the dedicated middleware/mobileSessionTeardownAuth.js resolver, NOT
 * mobileTenantAuth — see that file's header for why a relaxed, single-purpose
 * check is required here and why it must never be reused elsewhere.
 */

import express from "express";
import mongoose from "mongoose";

import { mobileSessionTeardownAuth } from "../middleware/mobileSessionTeardownAuth.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// IMPORTANT: mobileSessionTeardownAuth is attached per-route below, NEVER
// via router.use() at the router level — see the identical note in
// routes/mobileBillingRoutes.js (a router-level router.use() would also
// incorrectly gate unrelated /api/m/* paths mounted after this router).

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

export default router;
