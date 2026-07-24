import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Room from '../models/Room.js';
import Reservation from '../models/Reservation.js';
import User from '../models/User.js';

await mongoose.connect(process.env.MONGODB_URI);

console.log('--- INSPECTING ROOM GP-305 / 305 ---');

const rooms = await Room.find({
  $or: [
    { roomNumber: { $regex: '305', $options: 'i' } },
    { name: { $regex: '305', $options: 'i' } }
  ]
}).lean();

console.log(`Found ${rooms.length} matching room(s)`);

for (const room of rooms) {
  console.log(`\nRoom: ${room.name} | roomNumber: ${room.roomNumber} | _id: ${room._id}`);
  console.log(`  currentOccupancy: ${room.currentOccupancy} | capacity: ${room.capacity}`);
  console.log(`  beds count: ${room.beds?.length}`);
  (room.beds || []).forEach(b => {
    console.log(`    Bed ${b.id || b.bedNumber || b._id} | status: ${b.status} | occupiedBy:`, JSON.stringify(b.occupiedBy));
  });

  const res = await Reservation.find({
    roomId: room._id,
    isArchived: { $ne: true }
  }).populate('userId', 'firstName lastName email role').lean();

  console.log(`  Reservations count: ${res.length}`);
  res.forEach(r => {
    console.log(`    Res ${r._id} | status: ${r.status} | user: ${r.userId?.firstName} ${r.userId?.lastName} (${r.userId?.email})`);
  });

  const usersInRoom = await User.find({
    $or: [
      { assignedRoom: room._id },
      { 'tenantProfile.assignedRoom': room._id },
      { roomId: room._id }
    ]
  }).select('firstName lastName email role').lean();
  console.log(`  Users assigned directly: ${usersInRoom.length}`);
  usersInRoom.forEach(u => console.log(`    User ${u._id} | ${u.firstName} ${u.lastName} (${u.email})`));
}

await mongoose.disconnect();
