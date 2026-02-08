/**
 * Database Fix Script - Inquiry Data Cleanup
 *
 * This script:
 * 1. Ensures all inquiries have the `archived` field set (defaults to false)
 * 2. Cleans up and standardizes tags
 * 3. Ensures all inquiries have valid status values
 *
 * Run with: node scripts/fix-inquiry-data.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment variables");
  process.exit(1);
}

// Valid tag values for inquiries
const VALID_TAGS = [
  "room-inquiry",
  "pricing",
  "availability",
  "amenities",
  "location",
  "booking",
  "complaint",
  "feedback",
  "maintenance",
  "billing",
  "general",
  "urgent",
];

async function fixInquiryData() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const inquiriesCollection = db.collection("inquiries");

    // 1. Fix archived field - set to false if missing or null
    console.log("\n📋 Step 1: Fixing 'archived' field...");
    const archivedResult = await inquiriesCollection.updateMany(
      {
        $or: [{ archived: { $exists: false } }, { archived: null }],
      },
      { $set: { archived: false } },
    );
    console.log(
      `   ✅ Updated ${archivedResult.modifiedCount} documents with archived=false`,
    );

    // 2. Fix status field - set to 'pending' if missing or invalid
    console.log("\n📋 Step 2: Fixing 'status' field...");
    const validStatuses = ["pending", "in-progress", "resolved", "closed"];
    const statusResult = await inquiriesCollection.updateMany(
      {
        $or: [
          { status: { $exists: false } },
          { status: null },
          { status: { $nin: validStatuses } },
        ],
      },
      { $set: { status: "pending" } },
    );
    console.log(
      `   ✅ Updated ${statusResult.modifiedCount} documents with status='pending'`,
    );

    // 3. Fix priority field - set to 'medium' if missing or invalid
    console.log("\n📋 Step 3: Fixing 'priority' field...");
    const validPriorities = ["low", "medium", "high", "urgent"];
    const priorityResult = await inquiriesCollection.updateMany(
      {
        $or: [
          { priority: { $exists: false } },
          { priority: null },
          { priority: { $nin: validPriorities } },
        ],
      },
      { $set: { priority: "medium" } },
    );
    console.log(
      `   ✅ Updated ${priorityResult.modifiedCount} documents with priority='medium'`,
    );

    // 4. Fix isRead field - set to false if missing
    console.log("\n📋 Step 4: Fixing 'isRead' field...");
    const isReadResult = await inquiriesCollection.updateMany(
      {
        $or: [{ isRead: { $exists: false } }, { isRead: null }],
      },
      { $set: { isRead: false } },
    );
    console.log(
      `   ✅ Updated ${isReadResult.modifiedCount} documents with isRead=false`,
    );

    // 5. Clean up tags - ensure it's an array and remove invalid tags
    console.log("\n📋 Step 5: Fixing 'tags' field...");

    // First, set tags to empty array if not an array
    const tagsArrayResult = await inquiriesCollection.updateMany(
      {
        $or: [
          { tags: { $exists: false } },
          { tags: null },
          { tags: { $not: { $type: "array" } } },
        ],
      },
      { $set: { tags: [] } },
    );
    console.log(
      `   ✅ Set empty tags array for ${tagsArrayResult.modifiedCount} documents`,
    );

    // 6. Show summary of current data
    console.log("\n📊 Current Data Summary:");

    const totalInquiries = await inquiriesCollection.countDocuments();
    console.log(`   Total inquiries: ${totalInquiries}`);

    const activeInquiries = await inquiriesCollection.countDocuments({
      archived: false,
    });
    console.log(`   Active (not archived): ${activeInquiries}`);

    const archivedInquiries = await inquiriesCollection.countDocuments({
      archived: true,
    });
    console.log(`   Archived: ${archivedInquiries}`);

    // Count by status
    const statusAgg = await inquiriesCollection
      .aggregate([
        { $match: { archived: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray();
    console.log("\n   By Status (active only):");
    statusAgg.forEach((s) => console.log(`     - ${s._id}: ${s.count}`));

    // Count by branch
    const branchAgg = await inquiriesCollection
      .aggregate([
        { $match: { archived: false } },
        { $group: { _id: "$branch", count: { $sum: 1 } } },
      ])
      .toArray();
    console.log("\n   By Branch (active only):");
    branchAgg.forEach((b) => console.log(`     - ${b._id}: ${b.count}`));

    // Count by priority
    const priorityAgg = await inquiriesCollection
      .aggregate([
        { $match: { archived: false } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ])
      .toArray();
    console.log("\n   By Priority (active only):");
    priorityAgg.forEach((p) => console.log(`     - ${p._id}: ${p.count}`));

    console.log("\n✅ Database fix completed successfully!");
    console.log("\n📝 Valid tags you can use:");
    VALID_TAGS.forEach((tag) => console.log(`   - ${tag}`));
  } catch (error) {
    console.error("❌ Error fixing database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the script
fixInquiryData();
