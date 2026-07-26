/**
 * ============================================================================
 * CLEANUP DEPRECATED MONGOOSE MODELS DIAGNOSTIC SCRIPT
 * ============================================================================
 *
 * Checks document counts in legacy MongoDB collections:
 *   - billingperiods
 *   - billingresults
 *   - meterreadings
 *   - waterbillingrecords
 *
 * Usage:
 *   node server/scripts/cleanup_deprecated_models.mjs
 * ============================================================================
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest_dms";

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.\n");

  const db = mongoose.connection.db;

  const legacyCollections = [
    "billingperiods",
    "billingresults",
    "meterreadings",
    "waterbillingrecords",
  ];

  console.log("=================================================");
  console.log("LEGACY COLLECTIONS AUDIT REPORT");
  console.log("=================================================");

  for (const colName of legacyCollections) {
    try {
      const collection = db.collection(colName);
      const count = await collection.countDocuments();
      console.log(`Collection: '${colName}' -> Count: ${count} documents`);
    } catch (err) {
      console.log(`Collection: '${colName}' -> Not found or empty (${err.message})`);
    }
  }

  console.log("\n=================================================");
  console.log("ACTIVE DOMAIN MODELS (Modular Utility System)");
  console.log("=================================================");
  const activeCollections = [
    "utilityperiods",
    "utilityreadings",
    "bills",
    "payments",
    "rooms",
    "reservations",
    "users",
  ];

  for (const colName of activeCollections) {
    try {
      const collection = db.collection(colName);
      const count = await collection.countDocuments();
      console.log(`Active Collection: '${colName}' -> Count: ${count} documents`);
    } catch (err) {
      console.log(`Active Collection: '${colName}' -> Not found or empty`);
    }
  }

  console.log("\nAudit finished successfully.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
