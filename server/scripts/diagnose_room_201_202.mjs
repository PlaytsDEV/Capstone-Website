/**
 * diagnose_room_201_202.mjs
 * One-shot diagnostic: inspect all reservations & bed states for GP-201 and GP-202.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Room, Reservation, User } from "../models/index.js";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI, {
  ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
});

const rooms = await Room.find({ roomNumber: { $in: ["GP-201", "GP-202"] }, isArchived: { $ne: true } }).lean();

for (const room of rooms) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Room: ${room.name} (${room.roomNumber}) — capacity: ${room.capacity}, currentOccupancy: ${room.currentOccupancy}`);
  console.log(`Available: ${room.available}`);
  console.log(`\nBED STATES:`);
  for (const bed of room.beds || []) {
    console.log(`  [${bed.id}] ${bed.bunkBlock}-${bed.position} — status: ${bed.status}`);
    if (bed.occupiedBy?.userId) console.log(`    └ occupiedBy userId: ${bed.occupiedBy.userId}, reservationId: ${bed.occupiedBy.reservationId}`);
  }

  const reservations = await Reservation.find({
    roomId: room._id,
    isArchived: { $ne: true },
  }).populate("userId", "firstName lastName email role status").lean();

  console.log(`\nALL ACTIVE RESERVATIONS (${reservations.length}):`);
  for (const res of reservations) {
    const u = res.userId;
    const userName = u ? `${u.firstName || ""} ${u.lastName || ""} (${u.email}) [role=${u.role}, status=${u.status}]` : "DELETED USER";
    console.log(`  - ResID: ${res._id}`);
    console.log(`    Code: ${res.reservationCode || "N/A"} | Status: ${res.status} | Payment: ${res.paymentStatus}`);
    console.log(`    User: ${userName}`);
    console.log(`    SelectedBed: ${res.selectedBed?.id || "none"} (${res.selectedBed?.bunkBlock || ""}-${res.selectedBed?.position || ""})`);
    console.log(`    Reserved At: ${res.reservedAt || "N/A"} | Cancelled At: ${res.cancelledAt || "N/A"}`);
  }
}

await mongoose.disconnect();
