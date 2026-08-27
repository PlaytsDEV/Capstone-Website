/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "migrate-superadmin-to-owner.mjs" });

 * One-time migration: rename role "superadmin" → "owner" in MongoDB + Firebase.
 *
 * Background:
 *   The system previously used "superadmin" as the highest role.
 *   The canonical role is now "owner". Both values are accepted by the app
 *   (backward compatibility), but this script permanently migrates DB records
 *   so new tokens carry "owner" claims.
 *
 * Safe to run multiple times — only touches users with role === "superadmin".
 *
 * Run:
 *   node --env-file=.env scripts/migrate-superadmin-to-owner.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=1 node --env-file=.env scripts/migrate-superadmin-to-owner.mjs
 */

import { MongoClient } from "mongodb";

const DRY_RUN = process.env.DRY_RUN === "1";
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "lilycrest";

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// ── Optional Firebase sync ─────────────────────────────────────────────────
let firebaseAuth = null;
try {
  const { default: admin } = await import("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      }),
    });
  }
  firebaseAuth = admin.auth();
  console.log("🔥 Firebase Admin initialised — custom claims will be synced.");
} catch {
  console.warn("⚠️  Firebase Admin not available — skipping claims sync.");
}

// ── Main ───────────────────────────────────────────────────────────────────
const client = new MongoClient(MONGODB_URI);

try {
  await client.connect();
  console.log("✅ MongoDB connected");

  const db = client.db(DB_NAME);
  const users = db.collection("users");

  const targets = await users
    .find({ role: "superadmin" }, { projection: { _id: 1, user_id: 1, email: 1, firebase_uid: 1 } })
    .toArray();

  if (targets.length === 0) {
    console.log('ℹ️  No users with role "superadmin" found — nothing to migrate.');
    process.exit(0);
  }

  console.log(`\n📦 Found ${targets.length} user(s) with role "superadmin":`);
  for (const u of targets) {
    console.log(`   • ${u.email || u.user_id || String(u._id)}`);
  }

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN — no changes written. Remove DRY_RUN=1 to apply.");
    process.exit(0);
  }

  console.log('\n🔄 Migrating "superadmin" → "owner"…\n');

  let migrated = 0;
  let failed = 0;

  for (const u of targets) {
    try {
      await users.updateOne(
        { _id: u._id },
        { $set: { role: "owner", role_updated_at: new Date() } }
      );

      if (firebaseAuth && u.firebase_uid) {
        try {
          await firebaseAuth.setCustomUserClaims(u.firebase_uid, {
            role: "owner",
            owner: true,
          });
        } catch (fbErr) {
          console.warn(`  ⚠️  Firebase claims failed for ${u.email}: ${fbErr.message}`);
        }
      }

      console.log(`  ✅ ${u.email || u.user_id}: superadmin → owner`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${u.email || u.user_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Migration complete — migrated: ${migrated}, failed: ${failed}`);
  if (migrated > 0) {
    console.log("⚠️  Affected users must re-login to receive updated Firebase tokens.");
  }

  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
