/**
 * Cleanup Incomplete Rooms
 *
 * Usage: node scripts/cleanup-incomplete-rooms.js
 *
 * Removes rooms with missing required fields (name, type, or branch)
 */

import mongoose from "mongoose";
import { Room } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest";

async function cleanupIncompleteRooms() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find rooms with missing required fields
    const incompleteRooms = await Room.find({
      $or: [
        { name: { $in: [null, ""] } },
        { type: { $in: [null, ""] } },
        { branch: { $in: [null, ""] } },
      ],
    });

    if (incompleteRooms.length === 0) {
      console.log("✅ No incomplete rooms found. Database is clean!");
      return;
    }

    console.log(`⚠️  Found ${incompleteRooms.length} incomplete room(s):\n`);
    incompleteRooms.forEach((room) => {
      console.log(`   - ID: ${room._id}`);
      console.log(`     Name: "${room.name || "(empty)"}"`);
      console.log(`     Type: "${room.type || "(empty)"}"`);
      console.log(`     Branch: "${room.branch || "(empty)"}"`);
      console.log("");
    });

    // Delete incomplete rooms
    const result = await Room.deleteMany({
      $or: [
        { name: { $in: [null, ""] } },
        { type: { $in: [null, ""] } },
        { branch: { $in: [null, ""] } },
      ],
    });

    console.log(
      `🗑️  Deleted ${result.deletedCount} incomplete room(s) from database\n`,
    );

    // Verify remaining rooms
    const remainingRooms = await Room.find({});
    console.log(`📊 Remaining rooms: ${remainingRooms.length}`);
    console.log("\n✅ Cleanup completed successfully!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

cleanupIncompleteRooms();
