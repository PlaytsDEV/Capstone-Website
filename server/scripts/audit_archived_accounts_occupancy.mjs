/**
 * audit_archived_accounts_occupancy.mjs
 * ============================================================================
 * AUDIT + CLEANUP: Archived / Soft-Deleted Accounts Holding Rooms & Beds
 * ============================================================================
 *
 * What this script does:
 *  1. DIAGNOSE — Finds archived users (isArchived: true) and/or users with
 *     banned/suspended accountStatus whose reservations are still ACTIVE
 *     (status: reserved | moveIn) and are counting against bed occupancy.
 *
 *  2. CLEAN — Cancels those stale active reservations, releases the beds they
 *     hold, and recomputes each affected room's currentOccupancy counter from
 *     the remaining live reservations.
 *
 *  3. COMPARE — Cross-checks active reservations (reserved/moveIn) against
 *     Users who are actually active tenants (isArchived: false, role: tenant)
 *     and reports any mismatches.
 *
 * Safeguards:
 *  - Dry-run mode (--dry-run) previews all changes without writing.
 *  - Never touches beds belonging to genuinely active users.
 *  - Produces a detailed JSON report at the end.
 *
 * Usage:
 *   node scripts/audit_archived_accounts_occupancy.mjs            # live run
 *   node scripts/audit_archived_accounts_occupancy.mjs --dry-run  # preview
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Room, User, Reservation } from "../models/index.js";
import { ACTIVE_OCCUPANCY_STATUS_QUERY } from "../utils/lifecycleNaming.js";

// ============================================================================
// CONFIG
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const HR  = (c = "=") => c.repeat(72);
const log = (msg) => console.log(msg);
const ok  = (msg) => console.log(`  ✔  ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);
const warn = (msg) => console.log(`  ⚠  ${msg}`);
const err  = (msg) => console.log(`  ✖  ${msg}`);
const skip = (msg) => console.log(`  —  ${msg}`);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Recompute a room's currentOccupancy from the remaining live active
 * reservations (after cleanup).
 */
async function recomputeOccupancy(roomId) {
  return Reservation.countDocuments({
    roomId,
    isArchived: { $ne: true },
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY },
  });
}

// ============================================================================
// PHASE 1 — ARCHIVED / BANNED ACCOUNTS HOLDING BEDS
// ============================================================================

async function phase1_archivdAccountCleanup(report) {
  log(`\n${HR()}`);
  log("  PHASE 1 — Archived / Suspended Accounts Still Holding Beds");
  log(HR("-"));

  // Load ALL archived or banned users
  const problematicUsers = await User.find({
    $or: [
      { isArchived: true },
      { accountStatus: { $in: ["banned", "suspended"] } },
    ],
  })
    .select("_id firstName lastName email role tenantStatus isArchived accountStatus")
    .lean();

  info(`Found ${problematicUsers.size || problematicUsers.length} archived/banned/suspended user accounts`);

  if (!problematicUsers.length) {
    ok("No archived or banned users found.");
    return;
  }

  const problematicUserIds = new Set(problematicUsers.map((u) => String(u._id)));

  // Find all ACTIVE reservations belonging to these problem users
  const staleReservations = await Reservation.find({
    userId: { $in: [...problematicUserIds].map((id) => new mongoose.Types.ObjectId(id)) },
    isArchived: { $ne: true },
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY },
  })
    .select("_id reservationCode userId roomId status selectedBed")
    .lean();

  info(`Found ${staleReservations.length} active reservation(s) belonging to archived/banned users\n`);

  report.phase1.totalProblematicUsers = problematicUsers.length;
  report.phase1.staleReservationsFound = staleReservations.length;

  if (!staleReservations.length) {
    ok("No stale active reservations found. Beds are clean.");
    return;
  }

  // Build a per-user map for readable output
  const userMap = new Map(problematicUsers.map((u) => [String(u._id), u]));

  // Group stale reservations by room
  const reservationsByRoom = new Map();
  for (const res of staleReservations) {
    const key = String(res.roomId);
    if (!reservationsByRoom.has(key)) reservationsByRoom.set(key, []);
    reservationsByRoom.get(key).push(res);
  }

  const affectedRoomIds = [...reservationsByRoom.keys()];
  const rooms = await Room.find({ _id: { $in: affectedRoomIds } });

  for (const room of rooms) {
    const roomResArr = reservationsByRoom.get(String(room._id)) || [];
    warn(`\nRoom: ${room.name} (${room.roomNumber}) [${room.branch}]`);
    warn(`  → ${roomResArr.length} stale active reservation(s) to clean`);

    const roomReport = {
      roomId: String(room._id),
      roomName: room.name,
      roomNumber: room.roomNumber,
      branch: room.branch,
      occupancyBefore: room.currentOccupancy,
      occupancyAfter: null,
      reservationsCleaned: [],
      bedsReleased: [],
    };

    for (const res of roomResArr) {
      const user = userMap.get(String(res.userId));
      const userLabel = user
        ? `${user.firstName} ${user.lastName} (${user.email}) [archived=${user.isArchived}, status=${user.accountStatus}]`
        : String(res.userId);

      warn(`    Reservation ${res.reservationCode || res._id}`);
      warn(`      User    : ${userLabel}`);
      warn(`      Status  : ${res.status}`);
      warn(`      Bed     : ${res.selectedBed?.id || "none"} (${res.selectedBed?.position || "—"})`);

      roomReport.reservationsCleaned.push({
        reservationId: String(res._id),
        reservationCode: res.reservationCode || null,
        userId: String(res.userId),
        userEmail: user?.email || null,
        bedId: res.selectedBed?.id || null,
        statusBefore: res.status,
      });

      if (!DRY_RUN) {
        // Archive the stale reservation so it no longer counts as active
        await Reservation.findByIdAndUpdate(res._id, {
          $set: {
            isArchived: true,
            status: "archived",
          },
        });
        ok(`    Archived stale reservation ${res.reservationCode || res._id}`);
      } else {
        skip(`    [DRY-RUN] Would archive reservation ${res.reservationCode || res._id}`);
      }

      // Release the bed on the room document
      if (res.selectedBed?.id) {
        const bed = room.beds.find((b) => b.id === res.selectedBed.id);
        if (bed && (bed.status === "occupied" || bed.status === "reserved")) {
          roomReport.bedsReleased.push({ bedId: bed.id, statusBefore: bed.status });

          if (!DRY_RUN) {
            bed.status = "available";
            bed.lockedBy = null;
            bed.lockExpiresAt = null;
            bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
            ok(`    Released bed ${bed.id}`);
          } else {
            skip(`    [DRY-RUN] Would release bed ${bed.id} (was: ${bed.status})`);
          }
        }
      }
    }

    // Recompute occupancy AFTER cleanup
    const newOccupancy = DRY_RUN
      ? await recomputeOccupancy(room._id) // preview — current live count
      : await recomputeOccupancy(room._id); // live count after archiving

    roomReport.occupancyAfter = newOccupancy;

    if (!DRY_RUN) {
      room.currentOccupancy = newOccupancy;
      room.updateAvailability();
      await room.save();
      ok(`    Occupancy: ${roomReport.occupancyBefore} → ${newOccupancy}/${room.capacity}  |  Available: ${room.available}`);
    } else {
      skip(`    [DRY-RUN] Occupancy after cleanup would be: ${newOccupancy}/${room.capacity}`);
    }

    report.phase1.roomsFixed.push(roomReport);
  }

  report.phase1.totalReservationsArchived = DRY_RUN ? 0 : staleReservations.length;
  report.phase1.totalBedsReleased = DRY_RUN
    ? 0
    : report.phase1.roomsFixed.reduce((acc, r) => acc + r.bedsReleased.length, 0);
}

// ============================================================================
// PHASE 2 — CROSS-COMPARE ACTIVE RESERVATIONS VS ACTIVE TENANTS
//           + CLEANUP: ORPHANED RESERVATIONS (User Hard-Deleted)
// ============================================================================

async function phase2_crossCompare(report) {
  log(`\n${HR()}`);
  log("  PHASE 2 — Cross-Compare: Active Reservations vs Active Tenants");
  log("            + Cleanup: Orphaned Reservations (User Hard-Deleted)");
  log(HR("-"));

  // Build a Set of all existing User _ids for fast lookup
  const existingUsers = await User.find({}).select("_id").lean();
  const existingUserIdSet = new Set(existingUsers.map((u) => String(u._id)));

  // All non-archived active reservations (reserved or moveIn)
  const activeReservations = await Reservation.find({
    isArchived: { $ne: true },
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY },
  })
    .populate("userId", "firstName lastName email role tenantStatus isArchived accountStatus")
    .populate("roomId", "name roomNumber branch")
    .lean();

  info(`Active reservations (reserved/moveIn): ${activeReservations.length}`);

  const mismatches = {
    noUserRecord: [],          // reservation userId does not exist in User collection
    archivedUser: [],          // user exists but isArchived = true
    bannedUser: [],            // accountStatus = banned/suspended
    wrongRole: [],             // user is not role:tenant (still applicant, etc.)
    wrongTenantStatus: [],     // tenantStatus is inactive / moved_out / evicted
    reservationWithNoRoom: [], // roomId cannot be populated
  };

  // Separate orphaned (hard-deleted user) reservations for cleanup
  const orphanedReservations = [];

  for (const res of activeReservations) {
    const user = res.userId;
    const rawUserId = res.userId?._id || res.userId;
    const resLabel = res.reservationCode || String(res._id);
    const roomLabel = res.roomId
      ? `${res.roomId.roomNumber} (${res.roomId.branch})`
      : "UNKNOWN ROOM";

    // Populate returned null OR the raw ObjectId doesn't exist in User collection
    const userIsGone = !user || !user._id ||
      (rawUserId && !existingUserIdSet.has(String(rawUserId)));

    if (userIsGone) {
      mismatches.noUserRecord.push({ reservationId: String(res._id), resLabel, roomLabel });
      orphanedReservations.push(res);
      continue;
    }

    if (user.isArchived) {
      mismatches.archivedUser.push({
        reservationId: String(res._id), resLabel, roomLabel,
        userId: String(user._id), email: user.email,
        status: res.status,
      });
    }

    if (user.accountStatus === "banned" || user.accountStatus === "suspended") {
      mismatches.bannedUser.push({
        reservationId: String(res._id), resLabel, roomLabel,
        userId: String(user._id), email: user.email,
        accountStatus: user.accountStatus, status: res.status,
      });
    }

    if (res.status === "moveIn" && user.role !== "tenant") {
      mismatches.wrongRole.push({
        reservationId: String(res._id), resLabel, roomLabel,
        userId: String(user._id), email: user.email,
        role: user.role, status: res.status,
      });
    }

    if (
      res.status === "moveIn" &&
      ["inactive", "moved_out", "evicted", "blacklisted"].includes(user.tenantStatus)
    ) {
      mismatches.wrongTenantStatus.push({
        reservationId: String(res._id), resLabel, roomLabel,
        userId: String(user._id), email: user.email,
        tenantStatus: user.tenantStatus, status: res.status,
      });
    }

    if (!res.roomId || !res.roomId._id) {
      mismatches.reservationWithNoRoom.push({
        reservationId: String(res._id), resLabel,
        userId: user ? String(user._id) : null,
      });
    }
  }

  // ── Phase 2B: Clean up orphaned reservations (user was hard-deleted) ───────
  if (orphanedReservations.length) {
    log(`\n${HR("-")}`);
    log(`  Phase 2B — Cleaning ${orphanedReservations.length} orphaned reservation(s)`);
    log(HR("-"));

    // Group by room for bed release + occupancy recalc
    const orphansByRoom = new Map();
    for (const res of orphanedReservations) {
      const roomId = String(res.roomId?._id || res.roomId);
      if (!roomId || roomId === "null" || roomId === "undefined") continue;
      if (!orphansByRoom.has(roomId)) orphansByRoom.set(roomId, []);
      orphansByRoom.get(roomId).push(res);
    }

    const affectedRoomIds = [...orphansByRoom.keys()];
    // Load full Room docs (with beds, writeable) for mutation
    const affectedRooms = await Room.find({ _id: { $in: affectedRoomIds } });

    for (const room of affectedRooms) {
      const roomResArr = orphansByRoom.get(String(room._id)) || [];
      warn(`\n  Room: ${room.name} (${room.roomNumber}) [${room.branch}]`);
      warn(`    → ${roomResArr.length} orphaned reservation(s) to archive`);

      const occupancyBefore = room.currentOccupancy;
      let bedsReleased = 0;

      // Build set of orphaned reservation IDs for cross-referencing beds
      const orphanedResIds = new Set(roomResArr.map((r) => String(r._id)));

      for (const res of roomResArr) {
        const resLabel = res.reservationCode || String(res._id);
        warn(`    Reservation ${resLabel} | status: ${res.status} | bed: ${res.selectedBed?.id || "none"}`);

        if (!DRY_RUN) {
          await Reservation.findByIdAndUpdate(res._id, {
            $set: { isArchived: true, status: "archived" },
          });
          ok(`      Archived orphaned reservation ${resLabel}`);
        } else {
          skip(`      [DRY-RUN] Would archive reservation ${resLabel}`);
        }

        // Release the bed directly assigned to this reservation
        if (res.selectedBed?.id) {
          const bed = room.beds.find((b) => b.id === res.selectedBed.id);
          if (bed && ["occupied", "reserved", "locked"].includes(bed.status)) {
            if (!DRY_RUN) {
              bed.status = "available";
              bed.lockedBy = null;
              bed.lockExpiresAt = null;
              bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
              bedsReleased++;
              ok(`      Released bed ${bed.id}`);
            } else {
              skip(`      [DRY-RUN] Would release bed ${bed.id} (was: ${bed.status})`);
            }
          }
        }
      }

      // Also sweep for any beds whose occupiedBy.reservationId references
      // one of these orphaned reservations (cross-reference cleanup)
      for (const bed of room.beds) {
        if (
          bed.occupiedBy?.reservationId &&
          orphanedResIds.has(String(bed.occupiedBy.reservationId)) &&
          ["occupied", "reserved"].includes(bed.status)
        ) {
          if (!DRY_RUN) {
            bed.status = "available";
            bed.lockedBy = null;
            bed.lockExpiresAt = null;
            bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
            bedsReleased++;
            ok(`      Released dangling bed ${bed.id} (by reservationId cross-reference)`);
          } else {
            skip(`      [DRY-RUN] Would release dangling bed ${bed.id}`);
          }
        }
      }

      // Recompute occupancy from remaining live reservations
      const newOccupancy = await recomputeOccupancy(room._id);
      if (!DRY_RUN) {
        room.currentOccupancy = newOccupancy;
        room.updateAvailability();
        await room.save();
        ok(`    Occupancy: ${occupancyBefore} → ${newOccupancy}/${room.capacity}  |  Available: ${room.available}  |  Beds released: ${bedsReleased}`);
      } else {
        skip(`    [DRY-RUN] Occupancy after fix: ${newOccupancy}/${room.capacity}  |  Beds to release: ${bedsReleased}`);
      }

      report.phase2.orphanRoomsFixed.push({
        roomId: String(room._id),
        roomNumber: room.roomNumber,
        branch: room.branch,
        occupancyBefore,
        occupancyAfter: newOccupancy,
        reservationsArchived: DRY_RUN ? 0 : roomResArr.length,
        bedsReleased: DRY_RUN ? 0 : bedsReleased,
      });
    }

    report.phase2.orphanReservationsArchived = DRY_RUN ? 0 : orphanedReservations.length;
  } else {
    ok("No orphaned reservations found (all active reservations have valid user records).");
  }

  // ── Print cross-compare mismatch report ───────────────────────────────────
  log(`\n${HR("-")}`);
  log("  Cross-Compare Results:");
  const printSection = (label, items, fields) => {
    if (!items.length) {
      ok(`  ${label}: None ✓`);
      return;
    }
    warn(`\n  ${label} — ${items.length} issue(s):`);
    for (const item of items) {
      const detail = fields.map((f) => `${f}: ${item[f] ?? "—"}`).join(" | ");
      warn(`    • ${detail}`);
    }
  };

  printSection("Reservations with deleted user (orphaned)", mismatches.noUserRecord, ["resLabel", "roomLabel"]);
  printSection("Reservations by ARCHIVED users", mismatches.archivedUser, ["resLabel", "email", "roomLabel", "status"]);
  printSection("Reservations by BANNED/SUSPENDED users", mismatches.bannedUser, ["resLabel", "email", "accountStatus", "roomLabel"]);
  printSection("moveIn reservations where user role ≠ tenant", mismatches.wrongRole, ["resLabel", "email", "role", "roomLabel"]);
  printSection("moveIn reservations where tenantStatus is inactive/evicted", mismatches.wrongTenantStatus, ["resLabel", "email", "tenantStatus", "roomLabel"]);
  printSection("Active reservations pointing to missing rooms", mismatches.reservationWithNoRoom, ["resLabel"]);

  report.phase2.activeReservationsScanned = activeReservations.length;
  report.phase2.mismatches = {
    noUserRecord: mismatches.noUserRecord.length,
    archivedUser: mismatches.archivedUser.length,
    bannedUser: mismatches.bannedUser.length,
    wrongRole: mismatches.wrongRole.length,
    wrongTenantStatus: mismatches.wrongTenantStatus.length,
    reservationWithNoRoom: mismatches.reservationWithNoRoom.length,
  };
  report.phase2.details = mismatches;
}

// ============================================================================
// PHASE 3 — ROOM-BY-ROOM OCCUPANCY INTEGRITY CHECK
// ============================================================================

async function phase3_roomIntegrityCheck(report) {
  log(`\n${HR()}`);
  log("  PHASE 3 — Room-by-Room Occupancy Integrity Check");
  log(HR("-"));

  const rooms = await Room.find({ isArchived: { $ne: true } }).lean();
  info(`Scanning ${rooms.length} active rooms…\n`);

  const driftRooms = [];

  for (const room of rooms) {
    const liveCount = await recomputeOccupancy(room._id);
    const storedCount = room.currentOccupancy;
    const activeBeds = (room.beds || []).filter(
      (b) => b.status === "occupied" || b.status === "reserved"
    ).length;

    const hasDrift = storedCount !== liveCount;
    const hasBedMismatch = activeBeds !== liveCount;

    if (hasDrift || hasBedMismatch) {
      warn(`Room ${room.roomNumber} (${room.branch}): stored=${storedCount}, live=${liveCount}, activeBeds=${activeBeds}`);
      driftRooms.push({
        roomId: String(room._id),
        roomNumber: room.roomNumber,
        branch: room.branch,
        storedOccupancy: storedCount,
        liveOccupancy: liveCount,
        activeBeds,
      });
    } else {
      ok(`Room ${room.roomNumber} — occupancy OK (${storedCount}/${room.capacity})`);
    }
  }

  if (!driftRooms.length) {
    ok("\nAll rooms have consistent occupancy counters.");
  } else {
    warn(`\n${driftRooms.length} room(s) have occupancy drift. Run repair_all_rooms_occupancy.mjs to fix remaining counters.`);
  }

  report.phase3.roomsScanned = rooms.length;
  report.phase3.roomsWithDrift = driftRooms.length;
  report.phase3.driftDetails = driftRooms;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(`\n${HR()}`);
  log("  Lilycrest DMS — Archived Account Occupancy Audit & Cleanup");
  log(DRY_RUN ? "  MODE: DRY RUN — no changes will be saved" : "  MODE: LIVE — changes will be written to the database");
  log(`  Timestamp: ${new Date().toISOString()}`);
  log(HR());

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured in .env");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
  });
  info("Connected to MongoDB\n");

  const report = {
    dryRun: DRY_RUN,
    timestamp: new Date().toISOString(),
    phase1: {
      totalProblematicUsers: 0,
      staleReservationsFound: 0,
      totalReservationsArchived: 0,
      totalBedsReleased: 0,
      roomsFixed: [],
    },
    phase2: {
      activeReservationsScanned: 0,
      orphanReservationsArchived: 0,
      orphanRoomsFixed: [],
      mismatches: {},
      details: {},
    },
    phase3: {
      roomsScanned: 0,
      roomsWithDrift: 0,
      driftDetails: [],
    },
  };

  await phase1_archivdAccountCleanup(report);
  await phase2_crossCompare(report);
  await phase3_roomIntegrityCheck(report);

  // ── Final Summary ──────────────────────────────────────────────────────────
  log(`\n${HR()}`);
  log("  FINAL SUMMARY");
  log(HR("-"));
  log(`  [Phase 1] Problematic users found      : ${report.phase1.totalProblematicUsers}`);
  log(`  [Phase 1] Stale reservations found     : ${report.phase1.staleReservationsFound}`);
  log(`  [Phase 1] Reservations archived        : ${DRY_RUN ? "(dry-run)" : report.phase1.totalReservationsArchived}`);
  log(`  [Phase 1] Beds released                : ${DRY_RUN ? "(dry-run)" : report.phase1.totalBedsReleased}`);
  log(`  [Phase 1] Rooms fixed                  : ${DRY_RUN ? "(dry-run)" : report.phase1.roomsFixed.length}`);
  log(`  [Phase 2] Active reservations scanned  : ${report.phase2.activeReservationsScanned}`);
  log(`  [Phase 2] Orphaned res archived        : ${DRY_RUN ? "(dry-run — preview only)" : report.phase2.orphanReservationsArchived}`);
  log(`  [Phase 2] Rooms recalculated           : ${DRY_RUN ? "(dry-run)" : report.phase2.orphanRoomsFixed.length}`);
  log(`  [Phase 2] Mismatches (archived user)   : ${report.phase2.mismatches.archivedUser ?? 0}`);
  log(`  [Phase 2] Mismatches (banned user)     : ${report.phase2.mismatches.bannedUser ?? 0}`);
  log(`  [Phase 2] Mismatches (missing user)    : ${report.phase2.mismatches.noUserRecord ?? 0}`);
  log(`  [Phase 2] Mismatches (role wrong)      : ${report.phase2.mismatches.wrongRole ?? 0}`);
  log(`  [Phase 2] Mismatches (status mismatch) : ${report.phase2.mismatches.wrongTenantStatus ?? 0}`);
  log(`  [Phase 3] Rooms with occupancy drift   : ${report.phase3.roomsWithDrift}/${report.phase3.roomsScanned}`);
  log(HR());

  if (DRY_RUN) {
    warn("DRY RUN complete. No changes were saved.");
    warn("Re-run WITHOUT --dry-run to apply all fixes.");
  } else {
    ok("Cleanup complete.");
    if (report.phase3.roomsWithDrift > 0) {
      warn(`${report.phase3.roomsWithDrift} room(s) still have counter drift.`);
      warn("Run:  node scripts/repair_all_rooms_occupancy.mjs");
    } else {
      ok("All room occupancy counters are clean.");
    }
  }

  log(`\n${HR()}`);

  await mongoose.disconnect();
  info("Disconnected from MongoDB");
}

main().catch(async (error) => {
  err(`FATAL: ${error.message || String(error)}`);
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
