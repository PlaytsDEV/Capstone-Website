import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Room from '../models/Room.js';
import Reservation from '../models/Reservation.js';
import { ACTIVE_OCCUPANCY_STATUS_QUERY } from '../utils/lifecycleNaming.js';

await mongoose.connect(process.env.MONGODB_URI);

console.log('🔄  Syncing room occupancies with active reservations...\n');

const rooms = await Room.find({ isArchived: { $ne: true } });
let updatedCount = 0;
let bedsReleasedTotal = 0;

for (const room of rooms) {
  const activeReservations = await Reservation.find({
    roomId: room._id,
    isArchived: { $ne: true },
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY }
  }).lean();

  let bedsModified = false;
  const occupiedCount = activeReservations.length;

  // Build a set of active reservation IDs for fast lookup
  const activeResIds = new Set(activeReservations.map(r => String(r._id)));

  // ── Step 1: Release beds whose reservationId no longer exists in active reservations ──
  for (const bed of room.beds) {
    if (bed.status === 'maintenance' || bed.status === 'locked') continue;

    const hasDanglingRef =
      (bed.status === 'occupied' || bed.status === 'reserved') &&
      bed.occupiedBy?.reservationId &&
      !activeResIds.has(String(bed.occupiedBy.reservationId));

    const hasOrphanRef =
      (bed.status === 'occupied' || bed.status === 'reserved') &&
      !bed.occupiedBy?.reservationId;

    if (hasDanglingRef || hasOrphanRef) {
      const reason = hasDanglingRef ? `dangling reservationId ${bed.occupiedBy.reservationId}` : 'no reservationId';
      console.log(`   ↳ [${room.roomNumber || room.name}] Clearing stale bed "${bed.id}" (was: ${bed.status}, reason: ${reason})`);
      bed.status = 'available';
      bed.lockedBy = null;
      bed.lockExpiresAt = null;
      bed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
      bedsModified = true;
      bedsReleasedTotal++;
    }
  }

  // ── Step 2: Assign unmatched active reservations to available beds ──
  const matchedResIds = new Set();
  room.beds.forEach(bed => {
    if (bed.occupiedBy?.reservationId && activeResIds.has(String(bed.occupiedBy.reservationId))) {
      matchedResIds.add(String(bed.occupiedBy.reservationId));
    }
  });

  const unmatchedRes = activeReservations.filter(r => !matchedResIds.has(String(r._id)));
  for (const resDoc of unmatchedRes) {
    const freeBed = room.beds.find(b => b.status === 'available');
    if (freeBed) {
      freeBed.status = resDoc.status === 'moveIn' ? 'occupied' : 'reserved';
      freeBed.occupiedBy = {
        userId: resDoc.userId,
        reservationId: resDoc._id,
        occupiedSince: resDoc.moveInDate || resDoc.createdAt || new Date()
      };
      bedsModified = true;
    }
  }

  // ── Step 3: Recalculate occupancy counter from actual beds ──
  const bedsOccupiedCount = room.beds.filter(
    b => b.status === 'occupied' || b.status === 'reserved' || b.occupiedBy?.userId
  ).length;

  // Trust reservation count as authoritative; beds may lag when reservation has no bed assignment
  const targetOccupancy = Math.max(occupiedCount, bedsOccupiedCount);
  const targetAvailable = targetOccupancy < (room.capacity || 1);

  if (room.currentOccupancy !== targetOccupancy || room.available !== targetAvailable || bedsModified) {
    console.log(`🔧 [${room.roomNumber || room.name}] Occupancy: ${room.currentOccupancy} → ${targetOccupancy} | Available: ${room.available} → ${targetAvailable}`);
    room.currentOccupancy = targetOccupancy;
    room.available = targetAvailable;
    await room.save();
    updatedCount++;
  }
}

console.log(`\n✅ Completed. Updated ${updatedCount} room(s). Stale beds released: ${bedsReleasedTotal}.`);

await mongoose.disconnect();

