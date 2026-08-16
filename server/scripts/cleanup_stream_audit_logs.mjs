/**
 * ============================================================================
 * CLEANUP STREAM AUDIT LOGS SCRIPT
 * ============================================================================
 *
 * Purges historical duplicate/redundant read-stream logs generated when users
 * opened or previewed contract PDFs in browser viewers.
 *
 * Usage:
 *   node scripts/cleanup_stream_audit_logs.mjs [--dry-run]
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import AuditLog from "../models/AuditLog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest";
const isDryRun = process.argv.includes("--dry-run");

async function run() {
  try {
    console.log(`🔌 Connecting to MongoDB: ${MONGODB_URI.split("@").pop()}...`);
    await mongoose.connect(MONGODB_URI);
    console.log(" Connected to MongoDB.");

    const query = {
      type: "data_modification",
      $or: [
        { action: { $regex: /previewed|downloaded signed contract/i } },
        { action: { $regex: /previewed|downloaded notarized contract/i } },
        { action: { $regex: /previewed|downloaded final contract/i } },
      ],
    };

    const count = await AuditLog.countDocuments(query);
    console.log(`📊 Found ${count} historical read-stream audit log record(s) to clean up.`);

    if (count === 0) {
      console.log("✨ No redundant stream logs found.");
      await mongoose.disconnect();
      return;
    }

    if (isDryRun) {
      console.log(" Dry run active. No records were deleted.");
    } else {
      const result = await AuditLog.deleteMany(query);
      console.log(`🗑️ Deleted ${result.deletedCount} redundant stream audit log record(s).`);
    }

    await mongoose.disconnect();
    console.log("👋 Done.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

run();
