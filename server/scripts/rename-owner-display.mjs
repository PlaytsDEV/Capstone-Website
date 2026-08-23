/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "rename-owner-display.mjs" });

 * One-time script: update the display name of the owner account.
 *
 * The owner account was originally created with firstName="Super", lastName="Admin".
 * This script renames it to firstName="Dormitory", lastName="Owner" (or custom values).
 *
 * Run:
 *   node --env-file=.env scripts/rename-owner-display.mjs
 *
 * Override name:
 *   OWNER_FIRST="Alice" OWNER_LAST="Smith" node --env-file=.env scripts/rename-owner-display.mjs
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME     = process.env.DB_NAME || "lilycrest";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "superadmin@lilycrest.com";
const NEW_FIRST   = process.env.OWNER_FIRST || "Dormitory";
const NEW_LAST    = process.env.OWNER_LAST  || "Owner";
const NEW_USERNAME = process.env.OWNER_USERNAME || "owner";

if (!MONGODB_URI) { console.error("❌  MONGODB_URI not set."); process.exit(1); }

const client = new MongoClient(MONGODB_URI);
try {
  await client.connect();
  console.log("✅ MongoDB connected");

  const result = await client.db(DB_NAME).collection("users").updateOne(
    { email: OWNER_EMAIL },
    {
      $set: {
        firstName: NEW_FIRST,
        lastName:  NEW_LAST,
        username:  NEW_USERNAME,
      },
    }
  );

  if (result.matchedCount === 0) {
    console.warn(`⚠️  No user found with email "${OWNER_EMAIL}"`);
  } else {
    console.log(`✅ Updated: ${OWNER_EMAIL} → ${NEW_FIRST} ${NEW_LAST} (username: ${NEW_USERNAME})`);
    console.log("   The user must log out and back in for the change to appear in the UI.");
  }
} finally {
  await client.close();
}
