import "dotenv/config";
import mongoose from "mongoose";
import { Room } from "../models/index.js";
import { syncRealtimeBedStatuses } from "../controllers/roomsController.js";

async function main() {
  const isWrite = process.argv.includes("--write");
  console.log(`=== REPAIR ROOM BED OCCUPANCY (Mode: ${isWrite ? "WRITE" : "DRY-RUN"}) ===`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const rooms = await Room.find({ isArchived: false }).lean();
  console.log(`Found ${rooms.length} active rooms to inspect.`);

  const syncedRooms = await syncRealtimeBedStatuses(rooms);

  let repairCount = 0;

  for (let i = 0; i < rooms.length; i++) {
    const original = rooms[i];
    const synced = syncedRooms[i];

    const bedsChanged =
      !original.beds ||
      original.beds.length !== (synced.beds || []).length ||
      synced.beds.some((uBed, idx) => {
        const oBed = original.beds[idx];
        if (!oBed) return true;
        const uStatus = uBed.status || (uBed.available === false ? "occupied" : "available");
        const oStatus = oBed.status || (oBed.available === false ? "occupied" : "available");
        const uUserId = String(uBed.occupiedBy?.userId || "");
        const oUserId = String(oBed.occupiedBy?.userId || "");
        const uResId = String(uBed.occupiedBy?.reservationId || "");
        const oResId = String(oBed.occupiedBy?.reservationId || "");
        return uStatus !== oStatus || uUserId !== oUserId || uResId !== oResId;
      });

    const occChanged = original.currentOccupancy !== synced.currentOccupancy;

    if (bedsChanged || occChanged) {
      repairCount++;
      console.log(`\nRoom ${original.roomNumber || original.name} (${original.branch}):`);
      console.log(`  Occupancy: ${original.currentOccupancy} -> ${synced.currentOccupancy}`);
      console.log(`  Original Beds:`, JSON.stringify(original.beds.map(b => ({ id: b.id, pos: b.position, status: b.status, user: b.occupiedBy?.userId }))));
      console.log(`  Synced Beds:  `, JSON.stringify(synced.beds.map(b => ({ id: b.id, pos: b.position, status: b.status, user: b.occupiedBy?.userId }))));

      if (isWrite) {
        await Room.updateOne(
          { _id: original._id },
          {
            $set: {
              beds: synced.beds,
              currentOccupancy: synced.currentOccupancy,
              available: synced.currentOccupancy < (original.capacity || 1),
            },
          }
        );
        console.log(`  -> Saved to database.`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total Rooms Inspected: ${rooms.length}`);
  console.log(`Rooms Needing Repair:  ${repairCount}`);
  if (!isWrite && repairCount > 0) {
    console.log(`\nTo persist these changes to the database, re-run with:`);
    console.log(`node scripts/repair_desynced_room_beds.mjs --write`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await mongoose.disconnect();
}

main().catch(console.error);
