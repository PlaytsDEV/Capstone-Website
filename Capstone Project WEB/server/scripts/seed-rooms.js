/**
 * Seed Rooms into Database
 *
 * Usage: node scripts/seed-rooms.js
 *
 * This script creates room documents in the database for both branches.
 *
 * Structure:
 * - Gil Puyat: 3 Private, 3 Double-Sharing, 3 Quadruple = 9 rooms
 * - Guadalupe: 3 Quadruple = 3 rooms
 * - Total: 12 rooms
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
const bedPositionsByType = {
  private: ["single", "single"],
  "double-sharing": ["upper", "lower"],
  "quadruple-sharing": ["upper", "lower", "upper", "lower"],
};

const buildBeds = (roomNumber, type, occupiedCount = 0) => {
  const positions = bedPositionsByType[type] || [];
  return positions.map((position, index) => ({
    id: `${roomNumber}-B${index + 1}`,
    position,
    available: index >= occupiedCount,
  }));
};

const roomsData = [
  // ============= Gil Puyat - Private Rooms (GP-P-XXX) =============
  {
    name: "GP-P-001",
    roomNumber: "GP-P-001",
    description:
      "Spacious private room with own toilet & shower and kitchenette. Maximum of 2 persons per room. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "private",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 13500,
    monthlyPrice: 13500,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Private Toilet & Shower",
      "Kitchenette",
      "Secure Lock",
      "Hot & Cold Shower",
      "Power Backup",
      "Common Lounge",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "Maximum 2 students or professionals per room",
    images: ["standard-room", "deluxe-room"],
    beds: buildBeds("GP-P-001", "private", 0),
    available: true,
  },
  {
    name: "GP-P-002",
    roomNumber: "GP-P-002",
    description:
      "Spacious private room with own toilet & shower and kitchenette. Maximum of 2 persons per room. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "private",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 13500,
    monthlyPrice: 13500,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Private Toilet & Shower",
      "Kitchenette",
      "Secure Lock",
      "Hot & Cold Shower",
      "Power Backup",
      "Common Lounge",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "Maximum 2 students or professionals per room",
    images: ["standard-room", "gallery1"],
    beds: buildBeds("GP-P-002", "private", 0),
    available: true,
  },
  {
    name: "GP-P-003",
    roomNumber: "GP-P-003",
    description:
      "Spacious private room with own toilet & shower and kitchenette. Maximum of 2 persons per room. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "private",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 13500,
    monthlyPrice: 13500,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Private Toilet & Shower",
      "Kitchenette",
      "Secure Lock",
      "Hot & Cold Shower",
      "Power Backup",
      "Common Lounge",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "Maximum 2 students or professionals per room",
    images: ["standard-room"],
    beds: buildBeds("GP-P-003", "private", 0),
    available: true,
  },

  // ============= Gil Puyat - Double/Shared Rooms (GP-D-XXX) =============
  {
    name: "GP-D-001",
    roomNumber: "GP-D-001",
    description:
      "Comfortable double-sharing room with 20% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "double-sharing",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 7200,
    monthlyPrice: 7200,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Secure Lock",
      "Hot & Cold Shower",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "2 students or young professionals",
    images: ["premium-room", "gallery1"],
    beds: buildBeds("GP-D-001", "double-sharing", 0),
    available: true,
  },
  {
    name: "GP-D-002",
    roomNumber: "GP-D-002",
    description:
      "Comfortable double-sharing room with 20% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "double-sharing",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 7200,
    monthlyPrice: 7200,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Secure Lock",
      "Hot & Cold Shower",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "2 students or young professionals",
    images: ["premium-room", "deluxe-room"],
    beds: buildBeds("GP-D-002", "double-sharing", 0),
    available: true,
  },
  {
    name: "GP-D-003",
    roomNumber: "GP-D-003",
    description:
      "Comfortable double-sharing room with 20% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "double-sharing",
    floor: 1,
    capacity: 2,
    currentOccupancy: 0,
    price: 7200,
    monthlyPrice: 7200,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Secure Lock",
      "Hot & Cold Shower",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "2 students or young professionals",
    images: ["deluxe-room", "standard-room"],
    beds: buildBeds("GP-D-003", "double-sharing", 0),
    available: true,
  },

  // ============= Gil Puyat - Quadruple Rooms (GP-Q-XXX) =============
  {
    name: "GP-Q-001",
    roomNumber: "GP-Q-001",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    floor: 2,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["gallery1", "standard-room"],
    beds: buildBeds("GP-Q-001", "quadruple-sharing", 0),
    available: true,
  },
  {
    name: "GP-Q-002",
    roomNumber: "GP-Q-002",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    floor: 2,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["gallery1", "deluxe-room"],
    beds: buildBeds("GP-Q-002", "quadruple-sharing", 0),
    available: true,
  },
  {
    name: "GP-Q-003",
    roomNumber: "GP-Q-003",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "gil-puyat",
    type: "quadruple-sharing",
    floor: 2,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["standard-room", "premium-room"],
    beds: buildBeds("GP-Q-003", "quadruple-sharing", 0),
    available: true,
  },

  // ============= Guadalupe - Quadruple Rooms Only (GD-Q-XXX) =============
  {
    name: "GD-Q-001",
    roomNumber: "GD-Q-001",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "guadalupe",
    type: "quadruple-sharing",
    floor: 1,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["standard-room", "gallery1"],
    beds: buildBeds("GD-Q-001", "quadruple-sharing", 0),
    available: true,
  },
  {
    name: "GD-Q-002",
    roomNumber: "GD-Q-002",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "guadalupe",
    type: "quadruple-sharing",
    floor: 1,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["premium-room", "gallery1"],
    beds: buildBeds("GD-Q-002", "quadruple-sharing", 0),
    available: true,
  },
  {
    name: "GD-Q-003",
    roomNumber: "GD-Q-003",
    description:
      "Budget-friendly quadruple room with 10% discount. Common areas per floor include lounge area and shared toilet & shower. Long-term lease (6+ months) rate.",
    branch: "guadalupe",
    type: "quadruple-sharing",
    floor: 1,
    capacity: 4,
    currentOccupancy: 0,
    price: 5400,
    monthlyPrice: 5400,
    amenities: [
      "High-Speed WiFi",
      "Air Conditioning",
      "Shared Kitchen",
      "Study Desk",
      "Common Bathroom",
      "Locker",
      "Common Lounge",
      "24/7 Security",
    ],
    policies: [
      "Long-term lease: minimum 6 months",
      "Short-term lease: 1-5 months available at higher rate",
      "No pets allowed",
      "Quiet hours 10 PM - 8 AM",
    ],
    intendedTenant: "4 students or young professionals",
    images: ["standard-room", "gallery1"],
    beds: buildBeds("GD-Q-003", "quadruple-sharing", 0),
    available: true,
  },
];

async function seedRooms() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Upsert rooms (add new or update existing without deleting)
    console.log("\n📝 Seeding rooms (preserving existing data)...");
    let createdCount = 0;
    let updatedCount = 0;
    const insertedRooms = [];

    for (const roomData of roomsData) {
      const result = await Room.findOneAndUpdate(
        { roomNumber: roomData.roomNumber }, // Find by room number
        roomData, // Update with new data
        {
          new: true, // Return updated document
          upsert: true, // Create if doesn't exist
          setDefaultsOnInsert: true, // Set defaults for new docs
        },
      );

      insertedRooms.push(result);

      // Check if this was a new insert or an update
      const existing = await Room.findOne({
        roomNumber: roomData.roomNumber,
        updatedAt: { $lt: new Date(Date.now() - 1000) }, // Check if existed before
      });

      if (existing) {
        updatedCount++;
      } else {
        createdCount++;
      }
    }

    console.log(
      `✅ Created ${createdCount} new rooms, updated ${updatedCount} existing rooms\n`,
    );

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
