/**
 * Room Database Management Script
 *
 * This script helps you manage rooms in your MongoDB database:
 * - View all rooms
 * - Delete specific rooms by ID
 * - Delete rooms by criteria (room_id, room_number, etc.)
 * - Clear all rooms (use with caution!)
 *
 * Usage:
 *   node scripts/manage-rooms.js list                    - List all rooms
 *   node scripts/manage-rooms.js delete <id>             - Delete room by MongoDB _id
 *   node scripts/manage-rooms.js delete-by-room-id <id>  - Delete by room_id field
 *   node scripts/manage-rooms.js delete-by-number <num>  - Delete by room_number
 *   node scripts/manage-rooms.js clear-all               - Delete ALL rooms (careful!)
 */

import mongoose from "mongoose";
import { Room } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest";

// ============================================================================
// LIST ALL ROOMS
// ============================================================================

async function listRooms() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const rooms = await Room.find({}).lean();

    if (rooms.length === 0) {
      console.log("📭 No rooms found in database.");
      return;
    }

    console.log(`📊 Found ${rooms.length} rooms in database:\n`);
    console.log("=====================================");

    rooms.forEach((room, index) => {
      console.log(`\n[${index + 1}] Room Details:`);
      console.log(`  MongoDB ID: ${room._id}`);
      console.log(`  Room ID: ${room.room_id || "N/A"}`);
      console.log(
        `  Room Number: ${room.roomNumber || room.room_number || "N/A"}`,
      );
      console.log(`  Name: ${room.name || "N/A"}`);
      console.log(`  Type: ${room.type || room.room_type || "N/A"}`);
      console.log(`  Branch: ${room.branch || "N/A"}`);
      console.log(`  Price: ₱${room.price || "N/A"}`);
      console.log(
        `  Status: ${room.status || (room.available ? "available" : "occupied")}`,
      );
      console.log(`  Created: ${room.created_at || room.createdAt || "N/A"}`);
    });

    console.log("\n=====================================");
    console.log(`\nTotal: ${rooms.length} rooms`);
  } catch (error) {
    console.error("❌ Error listing rooms:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// ============================================================================
// DELETE ROOM BY MONGODB _id
// ============================================================================

async function deleteById(id) {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const room = await Room.findByIdAndDelete(id);

    if (!room) {
      console.log(`❌ No room found with ID: ${id}`);
      return;
    }

    console.log(`✅ Successfully deleted room:`);
    console.log(`   ID: ${room._id}`);
    console.log(`   Name: ${room.name || room.roomNumber}`);
    console.log(`   Type: ${room.type}`);
  } catch (error) {
    console.error("❌ Error deleting room:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// ============================================================================
// DELETE ROOM BY room_id FIELD
// ============================================================================

async function deleteByRoomId(roomId) {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const room = await Room.findOneAndDelete({ room_id: roomId });

    if (!room) {
      console.log(`❌ No room found with room_id: ${roomId}`);
      return;
    }

    console.log(`✅ Successfully deleted room:`);
    console.log(`   MongoDB ID: ${room._id}`);
    console.log(`   Room ID: ${room.room_id}`);
    console.log(`   Name: ${room.name || room.roomNumber}`);
  } catch (error) {
    console.error("❌ Error deleting room:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// ============================================================================
// DELETE ROOM BY ROOM NUMBER
// ============================================================================

async function deleteByRoomNumber(roomNumber) {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Try both possible field names
    const room = await Room.findOneAndDelete({
      $or: [{ roomNumber: roomNumber }, { room_number: roomNumber }],
    });

    if (!room) {
      console.log(`❌ No room found with room number: ${roomNumber}`);
      return;
    }

    console.log(`✅ Successfully deleted room:`);
    console.log(`   MongoDB ID: ${room._id}`);
    console.log(`   Room Number: ${room.roomNumber || room.room_number}`);
    console.log(`   Name: ${room.name}`);
  } catch (error) {
    console.error("❌ Error deleting room:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// ============================================================================
// CLEAR ALL ROOMS (DANGEROUS!)
// ============================================================================

async function clearAllRooms() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("⚠️  WARNING: This will delete ALL rooms from the database!");
    console.log("⚠️  This action cannot be undone!\n");

    // In a production environment, you might want to add a confirmation prompt here
    // For now, we'll just proceed
    const result = await Room.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} rooms from database`);
  } catch (error) {
    console.error("❌ Error clearing rooms:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const command = process.argv[2];
const argument = process.argv[3];

switch (command) {
  case "list":
    listRooms();
    break;

  case "delete":
    if (!argument) {
      console.error("❌ Please provide a MongoDB ID to delete");
      console.log("Usage: node scripts/manage-rooms.js delete <mongodb_id>");
      process.exit(1);
    }
    deleteById(argument);
    break;

  case "delete-by-room-id":
    if (!argument) {
      console.error("❌ Please provide a room_id to delete");
      console.log(
        "Usage: node scripts/manage-rooms.js delete-by-room-id <room_id>",
      );
      process.exit(1);
    }
    deleteByRoomId(argument);
    break;

  case "delete-by-number":
    if (!argument) {
      console.error("❌ Please provide a room number to delete");
      console.log(
        "Usage: node scripts/manage-rooms.js delete-by-number <room_number>",
      );
      process.exit(1);
    }
    deleteByRoomNumber(argument);
    break;

  case "clear-all":
    clearAllRooms();
    break;

  default:
    console.log("Room Database Management Script");
    console.log("================================\n");
    console.log("Available commands:");
    console.log("  list                         - List all rooms in database");
    console.log("  delete <id>                  - Delete room by MongoDB _id");
    console.log(
      "  delete-by-room-id <id>       - Delete room by room_id field",
    );
    console.log("  delete-by-number <number>    - Delete room by room_number");
    console.log(
      "  clear-all                    - Delete ALL rooms (USE WITH CAUTION!)",
    );
    console.log("\nExamples:");
    console.log("  node scripts/manage-rooms.js list");
    console.log(
      "  node scripts/manage-rooms.js delete 698637519138e1a7defbf8ed",
    );
    console.log(
      "  node scripts/manage-rooms.js delete-by-room-id room_quad_001",
    );
    console.log("  node scripts/manage-rooms.js delete-by-number Q101");
    process.exit(0);
}
