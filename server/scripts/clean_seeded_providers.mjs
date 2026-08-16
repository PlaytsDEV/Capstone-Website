import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import ServiceProvider from "../models/ServiceProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI environment variable is not defined.");
  process.exit(1);
}

const SEED_CREATED_BY = "system-maintenance-provider-seed";
const KNOWN_MOCK_NAMES = [
  "Tubero Experts Makati",
  "Rose Malabanan Siphoning Makati",
  "John & Jacob Pest Control Services Makati",
  "BOAZ Pest Management Corp.",
  "Cleaning Lady PH",
  "Teko Aircon Services Makati",
  "R.A. Mojica and Partners",
];

async function cleanSeededProviders() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully.");

    const filter = {
      $or: [
        { createdBy: SEED_CREATED_BY },
        { providerName: { $in: KNOWN_MOCK_NAMES } },
      ],
    };

    const countBefore = await ServiceProvider.countDocuments(filter);
    console.log(`Found ${countBefore} pre-seeded mock service providers to remove.`);

    if (countBefore > 0) {
      const result = await ServiceProvider.deleteMany(filter);
      console.log(`✅ Successfully deleted ${result.deletedCount} pre-seeded service providers.`);
    } else {
      console.log("ℹ️ No pre-seeded service providers found in the database.");
    }

    const remainingCount = await ServiceProvider.countDocuments({});
    console.log(`Remaining total service providers in directory: ${remainingCount}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning seeded service providers:", error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

cleanSeededProviders();
