/**
 * ============================================================================
 * MOBILE APP ROUTE BRIDGE — /api/m
 * ============================================================================
 *
 * Mounts the LilyCrest-Clean mobile backend routes into the Capstone-Website
 * server under the /api/m prefix.
 *
 * The mobile backend is CommonJS and uses the native MongoDB driver via
 * getDb().collection(...).  This bridge pre-loads shims for `database.js`
 * and `firebase.js` into Node's require cache so that when mobile controllers
 * call require('../config/database'), they get the Mongoose-backed adapter.
 *
 * The mobile source (controllers, routes, services, middleware) is copied
 * into this directory so it ships with the Capstone-Website repo.
 * ============================================================================
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import admin from "firebase-admin";
import { emitToChatAdmins } from "../utils/socket.js";
import { resolveFirebaseStorageBucket } from "../config/firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── The mobile source lives INSIDE this directory ──────────────────────────
const MOBILE_ROOT = __dirname;

// ─── Create a require function scoped to the mobile source ──────────────────
const mobileRequire = createRequire(path.join(MOBILE_ROOT, "mobileRoutes.mjs"));

// ─── Shim: mobile config/database → use Mongoose's native connection ────────
const databaseModulePath = path.join(MOBILE_ROOT, "config", "database.js");
const databaseShim = {
  getDb() {
    const conn = mongoose.connection;
    if (!conn || conn.readyState !== 1) {
      throw new Error("[mobile-bridge] Mongoose not connected");
    }
    return conn.db;
  },
  connectToMongo() {
    return Promise.resolve(this.getDb());
  },
};
// Inject shim BEFORE any mobile module is loaded
mobileRequire.cache[databaseModulePath] = {
  id: databaseModulePath,
  filename: databaseModulePath,
  loaded: true,
  exports: databaseShim,
};

// ─── Shim: mobile config/firebase → reuse existing Firebase Admin app ───────
const firebaseModulePath = path.join(MOBILE_ROOT, "config", "firebase.js");
const firebaseShim = {
  initializeFirebase() {
    return admin.apps[0] || null;
  },
  async verifyFirebaseIdToken(idToken) {
    return admin.auth().verifyIdToken(idToken);
  },
  async verifyTenantInFirebase(email) {
    try {
      const rec = await admin.auth().getUserByEmail(email);
      return {
        firebase_id: rec.uid,
        email: rec.email,
        name: rec.displayName || null,
        phone: rec.phoneNumber || null,
        picture: rec.photoURL || null,
      };
    } catch (_) {
      return null;
    }
  },
  getFirebaseApp() {
    return admin.apps[0] || null;
  },
  admin,
  // Added so vendored controllers (e.g. maintenance.controller.js's
  // attachment-size re-verification against real Firebase Storage object
  // metadata) can resolve the same bucket mobileUploadRoutes.js uses,
  // without duplicating the canonical bucket-resolution logic.
  resolveFirebaseStorageBucket,
};
mobileRequire.cache[firebaseModulePath] = {
  id: firebaseModulePath,
  filename: firebaseModulePath,
  loaded: true,
  exports: firebaseShim,
};

// ─── Shim: mobile middleware/auth → use the local ESM-compatible copy ────────
const authMiddlewarePath = path.join(MOBILE_ROOT, "middleware", "auth.js");
const authShim = mobileRequire("./middleware/auth.js");
mobileRequire.cache[authMiddlewarePath] = {
  id: authMiddlewarePath,
  filename: authMiddlewarePath,
  loaded: true,
  exports: authShim,
};

// ─── Shim: mobile utils/socket → delegate to the Capstone socket module ─────
// Lets remaining vendored mobile domains emit real-time events through the
// canonical Socket.IO server.
const socketShimPath = path.join(MOBILE_ROOT, "utils", "socket.js");
mobileRequire.cache[socketShimPath] = {
  id: socketShimPath,
  filename: socketShimPath,
  loaded: true,
  exports: { emitToChatAdmins },
};

// ─── Now load the mobile route tree (it will pick up our shims) ─────────────
const mobileApiRoutes = mobileRequire("./routes/index.js");

// ─── Export as default Express Router ───────────────────────────────────────
export default mobileApiRoutes;
