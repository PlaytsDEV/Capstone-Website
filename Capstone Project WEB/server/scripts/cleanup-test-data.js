/**
 * Database Cleanup Script - Remove test data
 *
 * Run with: node scripts/cleanup-test-data.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

async function cleanup() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;

    // Remove test inquiries (with obvious test data patterns)
    console.log("🧹 Cleaning up test data...\n");

    // Delete inquiries that look like test data
    const result = await db.collection("inquiries").deleteMany({
      $or: [
        { name: /^asdasd/i },
        { email: /^asdasd/i },
        { subject: /^test/i },
        { message: /^test/i },
      ],
    });
    console.log(
      `   Deleted ${result.deletedCount} test inquiries from main collection`,
    );

    // Clean archived collections too
    const gpResult = await db
      .collection("gilpuyatarchivedinquiries")
      .deleteMany({
        $or: [
          { name: /^asdasd/i },
          { email: /^asdasd/i },
          { subject: /^test/i },
        ],
      });
    console.log(
      `   Deleted ${gpResult.deletedCount} test inquiries from gil-puyat archive`,
    );

    const guadResult = await db
      .collection("guadalupearchivedinquiries")
      .deleteMany({
        $or: [
          { name: /^asdasd/i },
          { email: /^asdasd/i },
          { subject: /^test/i },
        ],
      });
    console.log(
      `   Deleted ${guadResult.deletedCount} test inquiries from guadalupe archive`,
    );

    // Show remaining data
    console.log("\n📊 Remaining Data:");
    const remaining = await db.collection("inquiries").countDocuments();
    const gpRemaining = await db
      .collection("gilpuyatarchivedinquiries")
      .countDocuments();
    const guadRemaining = await db
      .collection("guadalupearchivedinquiries")
      .countDocuments();

    console.log(`   Main inquiries: ${remaining}`);
    console.log(`   Gil Puyat archived: ${gpRemaining}`);
    console.log(`   Guadalupe archived: ${guadRemaining}`);

    console.log("\n✅ Cleanup completed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

cleanup();
