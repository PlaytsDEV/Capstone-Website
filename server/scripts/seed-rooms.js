/**
 * Seed Rooms into Database
 *
 * Usage: node scripts/seed-rooms.js
 *
 * This script creates room documents in the database for both branches.
 *
 * Structure:
 * - Gil Puyat: 3 Private, 2 Shared, 2 Quadruple = 7 rooms
 * - Guadalupe: 3 Quadruple = 3 rooms
 */

import mongoose from "mongoose";
import { Room } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest";

// Room data to seed
// Format: BRANCH-TYPE-NUMBER
// Branches: GP = Gil Puyat, GD = Guadalupe
// Types: P = Private, D = Double/Shared, Q = Quadruple
const roomsData = [
  // ============= Gil Puyat - Private Rooms (GP-P-XXX) =============
  {
    name: "GP-P-001",
    roomNumber: "GP-P-001",
    description: "Standard Private Room with study desk and air conditioning",
    branch: "gil-puyat",
    type: "private",
    capacity: 1,
    currentOccupancy: 0,
    price: 8000,
    monthlyPrice: 8000,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    available: true,
  },
  {
    name: "GP-P-002",
    roomNumber: "GP-P-002",
    description: "Standard Private Room with study desk and air conditioning",
    branch: "gil-puyat",
    type: "private",
    capacity: 1,
    currentOccupancy: 0,
    price: 8000,
    monthlyPrice: 8000,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    available: true,
  },
  {
    name: "GP-P-003",
    roomNumber: "GP-P-003",
    description: "Standard Private Room with study desk and air conditioning",
    branch: "gil-puyat",
    type: "private",
    capacity: 1,
    currentOccupancy: 1,
    price: 8000,
    monthlyPrice: 8000,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Window"],
    available: false,
  },

  // ============= Gil Puyat - Double/Shared Rooms (GP-D-XXX) =============
  {
    name: "GP-D-001",
    roomNumber: "GP-D-001",
    description: "Double Sharing Room with shared amenities and study area",
    branch: "gil-puyat",
    type: "double-sharing",
    capacity: 2,
    currentOccupancy: 1,
    price: 5500,
    monthlyPrice: 5500,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Shared Bathroom"],
    available: true,
  },
  {
    name: "GP-D-002",
    roomNumber: "GP-D-002",
    description: "Double Sharing Room with shared amenities and study area",
    branch: "gil-puyat",
    type: "double-sharing",
    capacity: 2,
    currentOccupancy: 0,
    price: 5500,
    monthlyPrice: 5500,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Shared Bathroom"],
    available: true,
  },

  // ============= Gil Puyat - Quadruple Rooms (GP-Q-XXX) =============
  {
    name: "GP-Q-001",
    roomNumber: "GP-Q-001",
    description:
      "Quadruple Sharing Room ideal for group living and collaboration",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    capacity: 4,
    currentOccupancy: 2,
    price: 4500,
    monthlyPrice: 4500,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    available: true,
  },
  {
    name: "GP-Q-002",
    roomNumber: "GP-Q-002",
    description:
      "Quadruple Sharing Room ideal for group living and collaboration",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    capacity: 4,
    currentOccupancy: 0,
    price: 4500,
    monthlyPrice: 4500,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    available: true,
  },

  // ============= Guadalupe - Quadruple Rooms Only (GD-Q-XXX) =============
  {
    name: "GD-Q-001",
    roomNumber: "GD-Q-001",
    description:
      "Quadruple Sharing Room ideal for group living and collaboration",
    branch: "guadalupe",
    type: "quadruple-sharing",
    capacity: 4,
    currentOccupancy: 0,
    price: 4800,
    monthlyPrice: 4800,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    available: true,
  },
  {
    name: "GD-Q-002",
    roomNumber: "GD-Q-002",
    description:
      "Quadruple Sharing Room ideal for group living and collaboration",
    branch: "guadalupe",
    type: "quadruple-sharing",
    capacity: 4,
    currentOccupancy: 1,
    price: 4800,
    monthlyPrice: 4800,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    available: true,
  },
  {
    name: "GD-Q-003",
    roomNumber: "GD-Q-003",
    description:
      "Quadruple Sharing Room ideal for group living and collaboration",
    branch: "guadalupe",
    type: "quadruple-sharing",
    capacity: 4,
    currentOccupancy: 2,
    price: 4300,
    monthlyPrice: 4300,
    amenities: ["Wi-Fi", "Air Conditioning", "Study Desk", "Common Area"],
    available: true,
  },
];

async function seedRooms() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing rooms
    console.log("\n🗑️  Clearing existing rooms...");
    const deleteResult = await Room.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} rooms`);

    // Insert new rooms
    console.log("\n📝 Seeding rooms...");
    const insertedRooms = await Room.insertMany(roomsData);
    console.log(`✅ Successfully created ${insertedRooms.length} rooms\n`);

    // Show summary
    console.log("📊 Room Summary:");
    console.log("================");

    const gilPuyatRooms = insertedRooms.filter((r) => r.branch === "gil-puyat");
    const guadalupeRooms = insertedRooms.filter(
      (r) => r.branch === "guadalupe",
    );

    console.log(`\n🏢 Gil Puyat (${gilPuyatRooms.length} rooms):`);
    gilPuyatRooms.forEach((room) => {
      console.log(
        `   - ${room.name} (${room.type}) - Price: ₱${room.price} - Occupancy: ${room.currentOccupancy}/${room.capacity}`,
      );
    });

    console.log(`\n🏢 Guadalupe (${guadalupeRooms.length} rooms):`);
    guadalupeRooms.forEach((room) => {
      console.log(
        `   - ${room.name} (${room.type}) - Price: ₱${room.price} - Occupancy: ${room.currentOccupancy}/${room.capacity}`,
      );
    });

    console.log("\n✨ Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding rooms:", error);
    process.exit(1);
  }
}

seedRooms();
