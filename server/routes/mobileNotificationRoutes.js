/**
 * ============================================================================
 * MOBILE NOTIFICATION ROUTES (bridge — closes a Phase 4 cutover gap)
 * ============================================================================
 *
 * The Phase 4 cutover-readiness audit found NO canonical route answered
 * /api/m/notifications* at all — neither a bridge nor the vendored mobile
 * router (server/mobile/routes) defines it — even though it's an ACTIVE
 * mobile feature (home-screen feed, unread-count polling in AuthContext).
 * Against this backend it would 404 today.
 *
 * Mounted at /api/m BEFORE mobileRoutes (the vendored mobile backend copy) —
 * same pattern as every other bridge in this codebase — so these definitions
 * take priority. Business logic is a direct, unmodified port of the
 * currently-live standalone mobile backend's notification.controller.js
 * (see services/mobileNotificationBridge.js), reading the same shared
 * `notifications`/`announcements`/`notification_reads`/`notification_read_state`
 * collections, so there is no data-shape risk versus what the standalone
 * backend already serves.
 *
 * Every route derives tenant identity exclusively from the resolved mobile
 * session (req.mobileTenant.user_id, set by mobileTenantAuth) — never from a
 * client-supplied id.
 */

import express from "express";
import mongoose from "mongoose";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import {
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearNotifications,
} from "../services/mobileNotificationBridge.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// IMPORTANT: mobileTenantAuth is attached per-route below, NEVER via
// router.use() at the router level — see the identical note in
// routes/mobileBillingRoutes.js.

// Both identity values are server-resolved off req.mobileTenant (the full
// user document mobileTenantAuth loaded from the session) — never client
// input. userMongoId (the Mongo _id) is required to find notifications
// written by this backend's own Notification model (userId: ObjectId), as
// opposed to the legacy user_id-string shape — see mobileNotificationBridge.js.
router.get("/notifications", mobileTenantAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const notifications = await listUserNotifications(db, req.mobileTenant.user_id, req.mobileTenant._id);
  res.json(notifications);
}));

router.patch("/notifications/read-all", mobileTenantAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const result = await markAllNotificationsRead(db, req.mobileTenant.user_id, req.mobileTenant._id);
  res.json(result);
}));

router.patch("/notifications/:notificationId/read", mobileTenantAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const result = await markNotificationRead(db, req.mobileTenant.user_id, req.params.notificationId, req.mobileTenant._id);
  if (result.status !== 200) {
    return res.status(result.status).json({ detail: result.detail });
  }
  res.json(result.value);
}));

// Dismiss (per-tenant hide) a single notification or announcement — never
// deletes/mutates the shared document, so other tenants and admins are
// unaffected. 404s if the caller has no visibility into that id, so a
// client can't dismiss/probe another tenant's private notification.
router.delete("/notifications/:notificationId", mobileTenantAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const result = await dismissNotification(db, req.mobileTenant.user_id, req.params.notificationId, req.mobileTenant._id);
  if (result.status !== 200) {
    return res.status(result.status).json({ detail: result.detail });
  }
  res.json(result.value);
}));

// Clear the tenant's current feed (a cutoff, not a permanent hide-all) —
// new notifications/announcements created after this call still appear.
router.delete("/notifications", mobileTenantAuth, asyncRoute(async (req, res) => {
  const db = mongoose.connection.db;
  const result = await clearNotifications(db, req.mobileTenant.user_id);
  res.json(result);
}));

export default router;
