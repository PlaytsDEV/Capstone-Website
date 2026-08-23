/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "seed_backup_data.mjs" });

 * Seed realistic backup mock data into the database.
 *
 * Usage:
 *   node scripts/seed_backup_data.mjs
 *   node scripts/seed_backup_data.mjs --clear   (clear existing + re-seed)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log(`Connected to ${mongoose.connection.name}`);

const { default: BackupConfig } = await import("../models/BackupConfig.js");
const { default: BackupRecord } = await import("../models/BackupRecord.js");

const clear = process.argv.includes("--clear");

if (clear) {
  await BackupRecord.deleteMany({});
  await BackupConfig.deleteMany({});
  console.log("Cleared existing backup data");
}

/* ── Seed config ──────────────────────────────────────────────────────────── */

let config = await BackupConfig.findOne({ key: "global" });
if (!config) {
  config = await BackupConfig.create({
    key: "global",
    autoBackupEnabled: true,
    intervalDays: 7,
    lastAutoBackupAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    updatedBy: {
      userId: "TKnPQEY9dgQUVi4Oo5t7RwBl0C63",
      email: "superadmin@lilycrest.com",
      role: "owner",
    },
  });
  console.log("Created BackupConfig");
} else {
  config.autoBackupEnabled = true;
  config.intervalDays = 7;
  config.lastAutoBackupAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await config.save();
  console.log("Updated existing BackupConfig");
}

/* ── Seed records ─────────────────────────────────────────────────────────── */

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const ownerUser = {
  userId: "TKnPQEY9dgQUVi4Oo5t7RwBl0C63",
  email: "superadmin@lilycrest.com",
  role: "owner",
};

const systemUser = {
  userId: null,
  email: "system",
  role: "scheduler",
};

const mockRecords = [
  // ── Most recent: completed auto backup (2 days ago) ──
  {
    type: "automatic",
    status: "completed",
    fileName: "lilycrest-backup-2026-05-14T03-00-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-05-14T03-00-00-000Z.gz",
    fileSize: 14_872_653,
    durationMs: 12_340,
    collections: 26,
    error: null,
    triggeredBy: systemUser,
    createdAt: new Date(now - 2 * DAY),
    completedAt: new Date(now - 2 * DAY + 12_340),
  },
  // ── Manual backup by owner (4 days ago) ──
  {
    type: "manual",
    status: "completed",
    fileName: "lilycrest-backup-2026-05-12T10-30-15-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-05-12T10-30-15-000Z.gz",
    fileSize: 14_561_280,
    durationMs: 11_870,
    collections: 26,
    error: null,
    triggeredBy: ownerUser,
    createdAt: new Date(now - 4 * DAY - 5 * HOUR),
    completedAt: new Date(now - 4 * DAY - 5 * HOUR + 11_870),
  },
  // ── Auto backup (9 days ago) ──
  {
    type: "automatic",
    status: "completed",
    fileName: "lilycrest-backup-2026-05-07T03-00-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-05-07T03-00-00-000Z.gz",
    fileSize: 13_945_712,
    durationMs: 10_530,
    collections: 25,
    error: null,
    triggeredBy: systemUser,
    createdAt: new Date(now - 9 * DAY),
    completedAt: new Date(now - 9 * DAY + 10_530),
  },
  // ── Failed auto backup (16 days ago — mongodump not found) ──
  {
    type: "automatic",
    status: "failed",
    fileName: "lilycrest-backup-2026-04-30T03-00-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-04-30T03-00-00-000Z.gz",
    fileSize: 0,
    durationMs: 245,
    collections: 0,
    error: "spawn mongodump ENOENT — mongodump is not installed or not in PATH",
    triggeredBy: systemUser,
    createdAt: new Date(now - 16 * DAY),
    completedAt: new Date(now - 16 * DAY + 245),
  },
  // ── Auto backup (16 days ago, after fix — succeeded) ──
  {
    type: "automatic",
    status: "completed",
    fileName: "lilycrest-backup-2026-04-30T04-00-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-04-30T04-00-00-000Z.gz",
    fileSize: 12_230_144,
    durationMs: 9_870,
    collections: 24,
    error: null,
    triggeredBy: systemUser,
    createdAt: new Date(now - 16 * DAY + HOUR),
    completedAt: new Date(now - 16 * DAY + HOUR + 9_870),
  },
  // ── Manual backup (23 days ago) ──
  {
    type: "manual",
    status: "completed",
    fileName: "lilycrest-backup-2026-04-23T14-22-08-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-04-23T14-22-08-000Z.gz",
    fileSize: 11_485_696,
    durationMs: 8_920,
    collections: 24,
    error: null,
    triggeredBy: ownerUser,
    createdAt: new Date(now - 23 * DAY),
    completedAt: new Date(now - 23 * DAY + 8_920),
  },
  // ── Auto backup (30 days ago) ──
  {
    type: "automatic",
    status: "completed",
    fileName: "lilycrest-backup-2026-04-16T03-00-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-04-16T03-00-00-000Z.gz",
    fileSize: 10_891_264,
    durationMs: 8_440,
    collections: 23,
    error: null,
    triggeredBy: systemUser,
    createdAt: new Date(now - 30 * DAY),
    completedAt: new Date(now - 30 * DAY + 8_440),
  },
  // ── Manual backup (37 days ago) — first ever backup ──
  {
    type: "manual",
    status: "completed",
    fileName: "lilycrest-backup-2026-04-09T09-15-00-000Z.gz",
    filePath: "backups/lilycrest-backup-2026-04-09T09-15-00-000Z.gz",
    fileSize: 9_437_184,
    durationMs: 7_210,
    collections: 22,
    error: null,
    triggeredBy: ownerUser,
    createdAt: new Date(now - 37 * DAY),
    completedAt: new Date(now - 37 * DAY + 7_210),
  },
];

const inserted = await BackupRecord.insertMany(mockRecords);
console.log(`Inserted ${inserted.length} backup records`);

/* ── Summary ──────────────────────────────────────────────────────────────── */

const completed = inserted.filter((r) => r.status === "completed").length;
const failed = inserted.filter((r) => r.status === "failed").length;
const manual = inserted.filter((r) => r.type === "manual").length;
const auto = inserted.filter((r) => r.type === "automatic").length;

console.log("\n── Backup Seed Summary ──");
console.log(`  Total records: ${inserted.length}`);
console.log(`  Completed: ${completed} | Failed: ${failed}`);
console.log(`  Manual: ${manual} | Automatic: ${auto}`);
console.log(`  Auto-backup enabled: ${config.autoBackupEnabled} (every ${config.intervalDays} days)`);
console.log(`  Last auto-backup: ${config.lastAutoBackupAt?.toISOString()}`);

await mongoose.disconnect();
console.log("\nDone.");
