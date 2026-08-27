/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "fix_gp201_bed1_stale_pointer.mjs" });

 * fix_gp201_bed1_stale_pointer.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * GP-Room 201, bed-1 has a stale occupiedBy reference pointing to the same
 * reservation as bed-3 (RES-4OSD7G / For Anime). This causes the Configure
 * Room UI to show "For Anime" on two beds.
 *
 * Fix: clear bed-1's occupiedBy and mark it available. Leave bed-3 untouched
 * because the active reservation (RES-4OSD7G) correctly references bed-3
 * via selectedBed.
 *
 * Usage:
 *   node scripts/fix_gp201_bed1_stale_pointer.mjs           # live fix
 *   node scripts/fix_gp201_bed1_stale_pointer.mjs --dry-run # preview only
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Room, Reservation } from "../models/index.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const log = (msg) => console.log(msg);

await mongoose.connect(process.env.MONGODB_URI, {
  ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
});

log(`\n${"=".repeat(70)}`);
log(`fix_gp201_bed1_stale_pointer — MODE: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
log("=".repeat(70));

const room = await Room.findOne({ roomNumber: "GP-201", isArchived: { $ne: true } });
if (!room) {
  log("❌  Room GP-201 not found. Exiting.");
  await mongoose.disconnect();
  process.exit(1);
}

log(`\nRoom: ${room.name} (${room.roomNumber})`);
log(`Beds before fix:`);
for (const bed of room.beds) {
  log(`  [${bed.id}] ${bed.bunkBlock || "?"}-${bed.position} status=${bed.status}`);
  if (bed.occupiedBy?.userId) {
    log(`    └ userId: ${bed.occupiedBy.userId}, reservationId: ${bed.occupiedBy.reservationId}`);
  }
}

// Find the active reservation for For Anime to confirm bed-3 is correct
const activeRes = await Reservation.findOne({
  roomId: room._id,
  status: { $in: ["reserved", "moveIn"] },
  isArchived: { $ne: true },
}).lean();

if (activeRes) {
  log(`\nActive reservation found: ${activeRes.reservationCode || activeRes._id}`);
  log(`  selectedBed: ${activeRes.selectedBed?.id || "none"} (${activeRes.selectedBed?.bunkBlock || "?"}-${activeRes.selectedBed?.position || "?"})`);
}

const bed1 = room.beds.find((b) => b.id === "bed-1");
const bed3 = room.beds.find((b) => b.id === "bed-3");

if (!bed1) {
  log("\n❌  bed-1 not found in room. Exiting.");
  await mongoose.disconnect();
  process.exit(1);
}

// Safety check: only clear bed-1 if it's NOT the selectedBed of the active reservation
const activeBedId = activeRes?.selectedBed?.id;
if (activeBedId === "bed-1") {
  log("\n⚠  The active reservation actually points to bed-1 as selectedBed. No fix applied.");
  log("    Manually review the data before proceeding.");
  await mongoose.disconnect();
  process.exit(0);
}

log(`\n🔍  bed-1 current status: ${bed1.status}`);
log(`    bed-1 occupiedBy.reservationId: ${bed1.occupiedBy?.reservationId || "none"}`);
log(`    Active reservation selectedBed:  ${activeBedId || "none"}`);

if (bed1.status === "available" && !bed1.occupiedBy?.userId) {
  log("\n✅  bed-1 is already clean. Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

// Apply the fix
if (!DRY_RUN) {
  bed1.status = "available";
  bed1.lockedBy = null;
  bed1.lockExpiresAt = null;
  bed1.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };

  // Ensure bed-3 is marked reserved to match the active reservation
  if (bed3 && activeRes && activeBedId === "bed-3") {
    bed3.status = "reserved";
    if (!bed3.occupiedBy?.reservationId) {
      bed3.occupiedBy = {
        userId: activeRes.userId,
        reservationId: activeRes._id,
        occupiedSince: null,
      };
    }
    log(`\n🔧  bed-3 status set to "reserved" (matched to active reservation)`);
  }

  room.updateAvailability();
  await room.save();
  log(`\n✅  bed-1 cleared. Room saved.`);
} else {
  log(`\n[DRY RUN] Would clear bed-1 (status: ${bed1.status} → available, occupiedBy → null)`);
  if (bed3 && activeBedId === "bed-3") {
    log(`[DRY RUN] Would confirm bed-3 as "reserved" (active reservation ${activeRes?.reservationCode || activeRes?._id})`);
  }
}

log(`\n${"=".repeat(70)}\n`);
await mongoose.disconnect();
