import dotenv from "dotenv";
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "delete_non_admin_users.mjs" });

import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest-dormitory";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const Room = mongoose.model("Room", new mongoose.Schema({}, { strict: false }));
  const Reservation = mongoose.model("Reservation", new mongoose.Schema({}, { strict: false }));
  const Bill = mongoose.model("Bill", new mongoose.Schema({}, { strict: false }));
  const Stay = mongoose.model("Stay", new mongoose.Schema({}, { strict: false }));

  // Find non-admin users (roles other than owner and branch_admin)
  const usersToDelete = await User.find({
    role: { $nin: ["owner", "branch_admin"] },
  }).lean();

  const deleteIds = usersToDelete.map((u) => u._id);
  const deleteIdStrings = new Set(deleteIds.map((id) => String(id)));

  console.log(`Found ${usersToDelete.length} accounts to delete (excluding owner and branch_admin):\n`);
  usersToDelete.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} | Role: ${u.role} | Name: ${u.firstName || ""} ${u.lastName || ""}`);
  });

  if (usersToDelete.length === 0) {
    console.log("\nNo accounts to delete.");
    await mongoose.disconnect();
    return;
  }

  // 1. Vacate beds occupied by targeted users in rooms
  const rooms = await Room.find({});
  let clearedBeds = 0;
  for (const room of rooms) {
    let roomModified = false;
    if (Array.isArray(room.beds)) {
      for (const bed of room.beds) {
        const occUserId = bed.occupiedBy?.userId ? String(bed.occupiedBy.userId) : null;
        const occTenantId = bed.occupiedBy?.tenantId ? String(bed.occupiedBy.tenantId) : null;

        if ((occUserId && deleteIdStrings.has(occUserId)) || (occTenantId && deleteIdStrings.has(occTenantId))) {
          bed.status = "available";
          bed.occupiedBy = null;
          clearedBeds++;
          roomModified = true;
        }
      }
    }

    if (roomModified) {
      const activeBedsCount = (room.beds || []).filter((b) => b.status === "occupied").length;
      room.currentOccupancy = activeBedsCount;
      room.availableBeds = Math.max(0, (room.capacity || 0) - activeBedsCount);
      room.isFullyBooked = room.currentOccupancy >= room.capacity;

      await Room.updateOne(
        { _id: room._id },
        {
          $set: {
            beds: room.beds,
            currentOccupancy: room.currentOccupancy,
            availableBeds: room.availableBeds,
            isFullyBooked: room.isFullyBooked,
          },
        }
      );
    }
  }
  console.log(`\nCleared ${clearedBeds} bed assignments in room documents.`);

  // 2. Delete user accounts
  const deleteResult = await User.deleteMany({ _id: { $in: deleteIds } });
  console.log(`Successfully deleted ${deleteResult.deletedCount} user accounts.`);

  // 3. List remaining accounts
  const remainingUsers = await User.find({}).lean();
  console.log("\n================ REMAINING ACCOUNTS ================");
  remainingUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} | Role: ${u.role} | Name: ${u.firstName || ""} ${u.lastName || ""}`);
  });
  console.log("====================================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Deletion error:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
