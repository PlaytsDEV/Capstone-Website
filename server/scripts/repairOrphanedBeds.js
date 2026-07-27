/**
 * =============================================================================
 * REPAIR SCRIPT: Orphaned Bed States
 * =============================================================================
 *
 * Finds all Room.beds[] entries that are in `locked`, `reserved`, or `occupied`
 * status but whose associated user (lockedBy / occupiedBy.userId) or reservation
 * (occupiedBy.reservationId) no longer exists in the database, and resets them
 * back to `available`.
 *
 * Also resets beds in `locked` state whose lockExpiresAt is in the past.
 *
 * USAGE:
 *   node scripts/repairOrphanedBeds.js            # live run (writes to DB)
 *   node scripts/repairOrphanedBeds.js --dry-run  # preview only, no writes
 *
 * =============================================================================
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const isDryRun = process.argv.includes("--dry-run");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env");
  await mongoose.connect(uri);
  console.log(`[repair] Connected to MongoDB: ${mongoose.connection.host}`);
};

const repairOrphanedBeds = async () => {
  const db = mongoose.connection.db;
  const rooms = db.collection("rooms");
  const users = db.collection("users");
  const reservations = db.collection("reservations");

  const allRooms = await rooms.find({ isArchived: { $ne: true } }).toArray();
  const now = new Date();

  let totalBedScanned = 0;
  let totalOrphanedFixed = 0;
  let totalExpiredLocksFixed = 0;
  let totalRoomsModified = 0;

  console.log(`[repair] ${isDryRun ? "DRY RUN -- " : ""}Scanning ${allRooms.length} active rooms...`);
  console.log("-".repeat(70));

  for (const room of allRooms) {
    const beds = room.beds || [];
    if (!beds.length) continue;

    let roomModified = false;
    const bedChanges = [];

    for (const bed of beds) {
      totalBedScanned++;

      // Case 1: expired locks
      if (
        bed.status === "locked" &&
        bed.lockExpiresAt &&
        new Date(bed.lockExpiresAt) < now
      ) {
        bedChanges.push({
          bedId: bed.id,
          code: bed.code,
          reason: `Expired lock (expired ${new Date(bed.lockExpiresAt).toISOString()})`,
        });
        bed.status = "available";
        bed.lockedBy = null;
        bed.lockExpiresAt = null;
        bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
        roomModified = true;
        totalExpiredLocksFixed++;
        continue;
      }

      // Case 2: locked bed — lockedBy user no longer exists
      if (bed.status === "locked" && bed.lockedBy) {
        let userExists = null;
        try {
          userExists = await users.findOne(
            { _id: new mongoose.Types.ObjectId(String(bed.lockedBy)) },
            { projection: { _id: 1 } },
          );
        } catch (_) { /* malformed id — treat as orphaned */ }

        if (!userExists) {
          bedChanges.push({
            bedId: bed.id,
            code: bed.code,
            reason: `lockedBy user ${bed.lockedBy} does not exist`,
          });
          bed.status = "available";
          bed.lockedBy = null;
          bed.lockExpiresAt = null;
          bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
          roomModified = true;
          totalOrphanedFixed++;
        }
        continue;
      }

      // Case 3: reserved/occupied — occupiedBy.userId no longer exists
      if (
        (bed.status === "reserved" || bed.status === "occupied") &&
        bed.occupiedBy?.userId
      ) {
        let userExists = null;
        try {
          userExists = await users.findOne(
            { _id: new mongoose.Types.ObjectId(String(bed.occupiedBy.userId)) },
            { projection: { _id: 1 } },
          );
        } catch (_) { /* malformed id */ }

        if (!userExists) {
          bedChanges.push({
            bedId: bed.id,
            code: bed.code,
            reason: `occupiedBy.userId ${bed.occupiedBy.userId} does not exist`,
          });
          bed.status = "available";
          bed.lockedBy = null;
          bed.lockExpiresAt = null;
          bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
          roomModified = true;
          totalOrphanedFixed++;
          continue;
        }
      }

      // Case 4: reserved/occupied — occupiedBy.reservationId no longer exists
      if (
        (bed.status === "reserved" || bed.status === "occupied") &&
        bed.occupiedBy?.reservationId
      ) {
        let resExists = null;
        try {
          resExists = await reservations.findOne(
            { _id: new mongoose.Types.ObjectId(String(bed.occupiedBy.reservationId)) },
            { projection: { _id: 1 } },
          );
        } catch (_) { /* malformed id */ }

        if (!resExists) {
          bedChanges.push({
            bedId: bed.id,
            code: bed.code,
            reason: `occupiedBy.reservationId ${bed.occupiedBy.reservationId} does not exist`,
          });
          bed.status = "available";
          bed.lockedBy = null;
          bed.lockExpiresAt = null;
          bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
          roomModified = true;
          totalOrphanedFixed++;
        }
      }
    }

    if (roomModified) {
      console.log(`\n  Room: ${room.name || room.roomNumber} (${room._id})`);
      for (const ch of bedChanges) {
        console.log(`    x Bed ${ch.code || ch.bedId}: ${ch.reason}`);
      }

      if (!isDryRun) {
        await rooms.updateOne({ _id: room._id }, { $set: { beds } });
        console.log(`    -> Beds reset to available (committed)`);
      } else {
        console.log(`    -> [DRY RUN] Would reset ${bedChanges.length} bed(s)`);
      }

      totalRoomsModified++;
    }
  }

  console.log("\n" + "-".repeat(70));
  console.log(`[repair] Summary:`);
  console.log(`  Rooms scanned       : ${allRooms.length}`);
  console.log(`  Beds scanned        : ${totalBedScanned}`);
  console.log(`  Expired locks fixed : ${totalExpiredLocksFixed}`);
  console.log(`  Orphaned beds fixed : ${totalOrphanedFixed}`);
  console.log(`  Rooms modified      : ${totalRoomsModified}`);
  if (isDryRun) {
    console.log(`\n  [DRY RUN] No changes written. Re-run without --dry-run to apply.`);
  } else {
    console.log(`\n  Repair complete.`);
  }
};

(async () => {
  try {
    await connectDB();
    await repairOrphanedBeds();
  } catch (err) {
    console.error("[repair] Fatal error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("[repair] Disconnected from MongoDB.");
  }
})();
