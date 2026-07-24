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

console.log('🔄  Syncing room occupancies with active reservations...');

const rooms = await Room.find({ isArchived: { $ne: true } });
let updatedCount = 0;

for (const room of rooms) {
  const activeReservations = await Reservation.find({
    roomId: room._id,
    isArchived: { $ne: true },
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY }
  }).lean();

  let bedsModified = false;
  const occupiedCount = activeReservations.length;

  // Sync beds for unmatched active reservations
  const activeResIds = new Set(activeReservations.map(r => String(r._id)));

  // First check beds already assigned
  const matchedResIds = new Set();
  room.beds.forEach(bed => {
    if (bed.occupiedBy?.reservationId && activeResIds.has(String(bed.occupiedBy.reservationId))) {
      matchedResIds.add(String(bed.occupiedBy.reservationId));
    }
  });

  // Assign unmatched active reservations to available beds
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

  // Count occupied/reserved beds
  const bedsOccupiedCount = room.beds.filter(b => b.status === 'occupied' || b.status === 'reserved' || b.occupiedBy?.userId).length;
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

console.log(`\n✅ Completed. Updated ${updatedCount} room(s).`);

await mongoose.disconnect();
