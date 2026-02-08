/**
 * Database Check Script - View all inquiry data
 *
 * Run with: node scripts/check-inquiry-data.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

async function checkData() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;

    // Check main inquiries collection
    console.log("═".repeat(60));
    console.log("📋 MAIN INQUIRIES COLLECTION");
    console.log("═".repeat(60));

    const inquiries = await db.collection("inquiries").find({}).toArray();
    console.log(`Total: ${inquiries.length}\n`);

    inquiries.forEach((inq, i) => {
      console.log(`[${i + 1}] ID: ${inq._id}`);
      console.log(`    Name: ${inq.name}`);
      console.log(`    Email: ${inq.email}`);
      console.log(`    Subject: ${inq.subject}`);
      console.log(`    Branch: ${inq.branch}`);
      console.log(`    Status: ${inq.status}`);
      console.log(`    Priority: ${inq.priority || "not set"}`);
      console.log(`    Archived: ${inq.archived}`);
      console.log(`    isRead: ${inq.isRead}`);
      console.log(
        `    Tags: ${inq.tags?.length ? inq.tags.join(", ") : "none"}`,
      );
      console.log(`    Created: ${inq.createdAt}`);
      console.log("");
    });

    // Check Gil Puyat archived inquiries
    console.log("═".repeat(60));
    console.log("📦 GIL PUYAT ARCHIVED INQUIRIES");
    console.log("═".repeat(60));

    const gpArchived = await db
      .collection("gilpuyatarchivedinquiries")
      .find({})
      .toArray();
    console.log(`Total: ${gpArchived.length}\n`);

    gpArchived.forEach((inq, i) => {
      console.log(`[${i + 1}] ID: ${inq._id} (Original: ${inq.originalId})`);
      console.log(`    Name: ${inq.name}`);
      console.log(`    Subject: ${inq.subject}`);
      console.log(`    Archived At: ${inq.archivedAt}`);
      console.log("");
    });

    // Check Guadalupe archived inquiries
    console.log("═".repeat(60));
    console.log("📦 GUADALUPE ARCHIVED INQUIRIES");
    console.log("═".repeat(60));

    const guadArchived = await db
      .collection("guadalupearchivedinquiries")
      .find({})
      .toArray();
    console.log(`Total: ${guadArchived.length}\n`);

    guadArchived.forEach((inq, i) => {
      console.log(`[${i + 1}] ID: ${inq._id} (Original: ${inq.originalId})`);
      console.log(`    Name: ${inq.name}`);
      console.log(`    Subject: ${inq.subject}`);
      console.log(`    Archived At: ${inq.archivedAt}`);
      console.log("");
    });

    // List all collections
    console.log("═".repeat(60));
    console.log("📚 ALL COLLECTIONS IN DATABASE");
    console.log("═".repeat(60));

    const collections = await db.listCollections().toArray();
    collections.forEach((c) => console.log(`   - ${c.name}`));
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkData();
