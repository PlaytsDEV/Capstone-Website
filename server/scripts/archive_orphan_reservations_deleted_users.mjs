/**
 * archive_orphan_reservations_deleted_users.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: archives all non-archived reservations (any status) whose
 * userId no longer exists in the User collection. These accumulate when accounts
 * are hard-deleted without the full reservation lifecycle running first.
 *
 * Safe to run repeatedly — idempotent (already-archived records are skipped).
 *
 * Usage:
 *   node scripts/archive_orphan_reservations_deleted_users.mjs           # live
 *   node scripts/archive_orphan_reservations_deleted_users.mjs --dry-run # preview
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { User, Reservation } from "../models/index.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const line = (c = "=") => c.repeat(70);
const log = (msg) => console.log(msg);

await mongoose.connect(process.env.MONGODB_URI, {
  ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
});

log(`\n${line()}`);
log(`archive_orphan_reservations_deleted_users`);
log(`MODE: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
log(line());

// 1. Build current user ID set
const existingUsers = await User.find({}).select("_id").lean();
const existingUserIdSet = new Set(existingUsers.map((u) => String(u._id)));
log(`\n✔  Found ${existingUsers.length} existing user accounts`);

// 2. Find ALL non-archived reservations (any status) for deleted users
const nonArchivedReservations = await Reservation.find({
  isArchived: { $ne: true },
}).select("_id userId status reservationCode").lean();

const orphans = nonArchivedReservations.filter(
  (r) => r.userId && !existingUserIdSet.has(String(r.userId)),
);

log(`✔  Found ${nonArchivedReservations.length} non-archived reservations`);
log(`✔  Found ${orphans.length} orphaned reservations for deleted users\n`);

if (orphans.length === 0) {
  log("✅  Nothing to archive. Database is clean.");
  await mongoose.disconnect();
  process.exit(0);
}

// 3. Group by status for reporting
const byStatus = {};
for (const r of orphans) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1;
}

log("Orphaned reservations by status:");
for (const [status, count] of Object.entries(byStatus)) {
  log(`  ${status.padEnd(35)} ${count}`);
}

log(line("-"));

if (!DRY_RUN) {
  const result = await Reservation.updateMany(
    { _id: { $in: orphans.map((r) => r._id) } },
    { $set: { isArchived: true } },
  );

  log(`\n✅  Archived ${result.modifiedCount} orphaned reservation(s).`);
} else {
  log(`\n[DRY RUN] Would archive ${orphans.length} reservation(s) (no changes made).`);
}

log(`${line()}\n`);
await mongoose.disconnect();
