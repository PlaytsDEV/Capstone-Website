/**
 * Delete user accounts whose identity fields literally contain "unknown".
 *
 * Dry run:
 *   node scripts/delete_unknown_accounts.mjs
 *
 * Apply:
 *   node scripts/delete_unknown_accounts.mjs --write
 *
 * By default, accounts with linked records are reported but not deleted. Use
 * --force to delete those user records too, matching the app's hard-delete
 * behavior where historical references render as "Deleted account".
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  Bill,
  MaintenanceRequest,
  Reservation,
  Room,
  User,
  UtilityReading,
} from "../models/index.js";

dotenv.config();

const WRITE = process.argv.includes("--write");
const FORCE = process.argv.includes("--force");
const UNKNOWN_PATTERN = /unknown/i;
const PROTECTED_ROLES = new Set(["branch_admin", "owner"]);

function getMongoConnectOptions() {
  return process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
}

async function getSafeguards(userId) {
  const [
    reservations,
    bills,
    utilityReadings,
    maintenanceRequests,
    occupiedBeds,
  ] = await Promise.all([
    Reservation.countDocuments({ userId, isArchived: { $ne: true } }),
    Bill.countDocuments({ userId, isArchived: false }),
    UtilityReading.countDocuments({ tenantId: userId, isArchived: false }),
    MaintenanceRequest.countDocuments({
      $or: [{ userId }, { user_id: String(userId) }],
      isArchived: { $ne: true },
    }),
    Room.countDocuments({
      "beds.occupiedBy.userId": userId,
      isArchived: { $ne: true },
    }),
  ]);

  return {
    reservations,
    bills,
    utilityReadings,
    maintenanceRequests,
    occupiedBeds,
  };
}

function hasHistory(safeguards) {
  return Object.values(safeguards).some((value) => Number(value || 0) > 0);
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, getMongoConnectOptions());

  const users = await User.find({
    $or: [
      { email: UNKNOWN_PATTERN },
      { username: UNKNOWN_PATTERN },
      { firebaseUid: UNKNOWN_PATTERN },
      { firstName: UNKNOWN_PATTERN },
      { lastName: UNKNOWN_PATTERN },
      { user_id: UNKNOWN_PATTERN },
    ],
  })
    .select(
      "_id email username firebaseUid firstName lastName role tenantStatus branch isArchived accountStatus createdAt",
    )
    .sort({ createdAt: -1 });

  const entries = [];
  const deletableIds = [];

  for (const user of users) {
    const safeguards = await getSafeguards(user._id);
    const protectedRole = PROTECTED_ROLES.has(user.role);
    const blockedByHistory = hasHistory(safeguards) && !FORCE;
    const deletable = !protectedRole && !blockedByHistory;

    if (deletable) deletableIds.push(user._id);

    entries.push({
      id: String(user._id),
      email: user.email,
      username: user.username,
      firebaseUid: user.firebaseUid,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      role: user.role,
      tenantStatus: user.tenantStatus,
      branch: user.branch || "",
      isArchived: Boolean(user.isArchived),
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
      safeguards,
      action: protectedRole
        ? "skip: protected admin role"
        : blockedByHistory
          ? "skip: linked history; rerun with --force to delete user record"
          : WRITE
            ? "deleted"
            : "would delete",
    });
  }

  let deletedCount = 0;
  if (WRITE && deletableIds.length > 0) {
    const result = await User.deleteMany({ _id: { $in: deletableIds } });
    deletedCount = result.deletedCount || 0;
  }

  printSummary({
    mode: WRITE ? "write" : "dry-run",
    force: FORCE,
    matched: users.length,
    deletable: deletableIds.length,
    deleted: deletedCount,
    accounts: entries,
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`[delete-unknown-accounts] ERROR: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
