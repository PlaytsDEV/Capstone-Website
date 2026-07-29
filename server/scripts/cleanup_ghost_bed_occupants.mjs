/**
 * cleanup_ghost_bed_occupants.mjs
 * ============================================================================
 * Finds all room beds whose occupiedBy.userId does NOT exist in the User
 * collection (deleted / orphaned accounts) and vacates them.
 *
 * Safe-guards:
 *  - Loads the full set of existing User _ids before touching any room.
 *  - Only vacates beds where the referenced userId is truly missing.
 *  - Recomputes currentOccupancy from live active reservations (not counters).
 *  - Skips beds whose userId is in the User collection (existing accounts).
 *  - Dry-run mode available: pass --dry-run flag to preview without saving.
 *
 * Usage:
 *   node scripts/cleanup_ghost_bed_occupants.mjs            # live run
 *   node scripts/cleanup_ghost_bed_occupants.mjs --dry-run  # preview only
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import { Room, User, Reservation } from "../models/index.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const line = (char = "=") => char.repeat(72);
const ok   = (msg) => console.log(`  ✔  ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);
const skip = (msg) => console.log(`  —  ${msg}`);
const warn = (msg) => console.log(`  ⚠  ${msg}`);

// ============================================================================
// HELPERS
// ============================================================================

async function loadExistingUserIds() {
  const users = await User.find({}).select("_id").lean();
  return new Set(users.map((u) => String(u._id)));
}

/**
 * Recompute a room's currentOccupancy from live non-archived reservations
 * that are in a status that counts as "occupying" a bed.
 */
async function recomputeOccupancy(roomId) {
  const count = await Reservation.countDocuments({
    roomId,
    isArchived: { $ne: true },
    status: { $in: ["reserved", "moveIn"] },
  });
  return count;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`\n${line()}`);
  console.log("  Cleanup Ghost Bed Occupants");
  console.log(DRY_RUN ? "  MODE: DRY RUN — no changes will be saved" : "  MODE: LIVE — changes will be written to the database");
  console.log(line());

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
  });
  info("Connected to MongoDB");

  // 1. Load all existing user IDs into a fast lookup Set
  info("Loading all existing user IDs…");
  const existingUserIds = await loadExistingUserIds();
  info(`Found ${existingUserIds.size} existing user records`);

  // 2. Fetch all non-archived rooms
  const rooms = await Room.find({ isArchived: { $ne: true } });
  info(`Scanning ${rooms.length} active room(s) for ghost bed occupants…\n`);

  const report = {
    roomsScanned: rooms.length,
    roomsAffected: 0,
    bedsVacated: 0,
    occupancyRecalculated: 0,
    details: [],
  };

  for (const room of rooms) {
    const ghostBeds = (room.beds || []).filter((bed) => {
      const uid = bed.occupiedBy?.userId;
      return uid && !existingUserIds.has(String(uid));
    });

    if (ghostBeds.length === 0) {
      continue; // clean room — skip
    }

    console.log(`\n${line("-")}`);
    warn(`Room: ${room.name} (${room.roomNumber}) [${room.branch}]`);
    warn(`  → Found ${ghostBeds.length} ghost bed occupant(s)`);

    const roomDetail = {
      roomId: String(room._id),
      roomName: room.name,
      roomNumber: room.roomNumber,
      branch: room.branch,
      ghostBeds: [],
      occupancyBefore: room.currentOccupancy,
      occupancyAfter: null,
    };

    for (const bed of ghostBeds) {
      const ghostUserId   = String(bed.occupiedBy.userId);
      const ghostResId    = bed.occupiedBy?.reservationId
        ? String(bed.occupiedBy.reservationId)
        : null;

      warn(`     Bed "${bed.id}" (${bed.position}) — ghost userId: ${ghostUserId}`);
      if (ghostResId) warn(`       linked reservationId: ${ghostResId}`);

      roomDetail.ghostBeds.push({
        bedId: bed.id,
        position: bed.position,
        statusBefore: bed.status,
        ghostUserId,
        ghostReservationId: ghostResId,
      });

      if (!DRY_RUN) {
        // Vacate the bed — reset to available
        bed.status = "available";
        bed.lockedBy = null;
        bed.lockExpiresAt = null;
        bed.occupiedBy = {
          userId: null,
          reservationId: null,
          occupiedSince: null,
        };
        ok(`    Vacated bed "${bed.id}"`);
        report.bedsVacated++;
      } else {
        skip(`    [DRY RUN] Would vacate bed "${bed.id}"`);
      }
    }

    // 3. Recompute occupancy from live reservations
    const newOccupancy = await recomputeOccupancy(room._id);
    roomDetail.occupancyAfter = newOccupancy;

    if (!DRY_RUN) {
      room.currentOccupancy = newOccupancy;
      room.updateAvailability();
      await room.save();
      ok(`    Occupancy recalculated: ${roomDetail.occupancyBefore} → ${newOccupancy}/${room.capacity}`);
      ok(`    Available: ${room.available ? "yes" : "no"}`);
      report.occupancyRecalculated++;
    } else {
      skip(`    [DRY RUN] Would set occupancy: ${roomDetail.occupancyBefore} → ${newOccupancy}/${room.capacity}`);
    }

    report.roomsAffected++;
    report.details.push(roomDetail);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log(`\n${line()}`);
  console.log("  SUMMARY");
  console.log(line("-"));
  console.log(`  Rooms scanned        : ${report.roomsScanned}`);
  console.log(`  Rooms affected       : ${report.roomsAffected}`);
  console.log(`  Ghost beds vacated   : ${DRY_RUN ? `(preview: ${report.details.reduce((acc, r) => acc + r.ghostBeds.length, 0)})` : report.bedsVacated}`);
  console.log(`  Occupancy recalculated: ${DRY_RUN ? `(preview: ${report.roomsAffected})` : report.occupancyRecalculated}`);

  if (report.details.length > 0) {
    console.log(`\n  Affected Rooms:`);
    for (const r of report.details) {
      console.log(`    • ${r.roomName} (${r.roomNumber}) — ${r.ghostBeds.length} ghost bed(s)`);
      for (const b of r.ghostBeds) {
        console.log(`        Bed ${b.bedId} [${b.position}]: ${b.statusBefore} → ${DRY_RUN ? "available (preview)" : "available"}`);
        console.log(`        Ghost user : ${b.ghostUserId}`);
      }
    }
  } else {
    ok("No ghost bed occupants found. All rooms are clean!");
  }

  console.log(`\n${line()}`);

  await mongoose.disconnect();
  info("Disconnected from MongoDB");
}

main().catch(async (error) => {
  console.error("[cleanup-ghost-bed-occupants] ERROR:", error.message || String(error));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
