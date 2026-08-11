/**
 * fix_cleaning_in_progress_beds.mjs
 * One-time script: resets all beds stuck in "cleaning_in_progress" → "available".
 * Run once after deploying the new move-out logic that removes this intermediate state.
 *
 *   node scripts/fix_cleaning_in_progress_beds.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { console.error("❌ No MONGO_URI in .env"); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log("✅ Connected to MongoDB\n");

const Room = mongoose.model("Room", new mongoose.Schema({}, { strict: false }));

const result = await Room.updateMany(
  { "beds.status": "cleaning_in_progress" },
  { $set: { "beds.$[bed].status": "available" } },
  { arrayFilters: [{ "bed.status": "cleaning_in_progress" }] }
);

console.log(`✅ Fixed ${result.modifiedCount} room(s) — all cleaning_in_progress beds reset to available.`);
await mongoose.disconnect();
