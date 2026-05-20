import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import ServiceProvider from "../models/ServiceProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const shouldWrite = process.argv.includes("--write");

const SEED_CREATED_BY = "system-maintenance-provider-seed";

const providers = [
  {
    providerName: "Lilycrest Plumbing Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Plumbing", "Water Leak"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for plumbing and water leak requests. Replace with the preferred production provider contact.",
  },
  {
    providerName: "Lilycrest Electrical Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Electrical"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for outlet, lighting, and electrical repair requests.",
  },
  {
    providerName: "Lilycrest Air Conditioning Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Air Conditioning"],
    branchCoverage: ["gil-puyat"],
    status: "active",
    notes: "Initial placeholder for Gil Puyat air conditioning requests.",
  },
  {
    providerName: "Lilycrest Internet/WiFi Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Internet/WiFi", "Maintenance", "Other"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for internet, WiFi, and connectivity concerns.",
  },
  {
    providerName: "Lilycrest Door/Lock Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Door/Lock", "Maintenance", "Other"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for lock, key, hinge, and door repair requests.",
  },
  {
    providerName: "Lilycrest Furniture Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Furniture"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for bed, cabinet, table, and furniture repair requests.",
  },
  {
    providerName: "Lilycrest Pest Control Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Pest Control"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Initial placeholder for pest inspection and treatment requests.",
  },
  {
    providerName: "Lilycrest Cleaning/Sanitation Provider Placeholder",
    contactNumber: "09XX XXX XXXX",
    serviceCategories: ["Cleaning", "Cleaning/Sanitation"],
    branchCoverage: ["guadalupe", "gil-puyat"],
    status: "active",
    notes: "Initial placeholder for cleaning, sanitation, and hygiene-related maintenance requests.",
  },
];

if (!MONGODB_URI) {
  console.error("[seed-service-providers] MONGODB_URI or MONGO_URI is required.");
  process.exit(1);
}

const seedProvider = async (provider) => {
  const existing = await ServiceProvider.findOne({
    providerName: provider.providerName,
  }).lean();

  if (existing) {
    console.log(`[seed-service-providers] Existing: ${provider.providerName}`);
    return { created: false, existing: true };
  }

  console.log(
    `[seed-service-providers] ${shouldWrite ? "Creating" : "Would create"}: ${provider.providerName}`,
  );

  if (!shouldWrite) {
    return { created: false, existing: false };
  }

  await ServiceProvider.create({
    ...provider,
    createdBy: SEED_CREATED_BY,
    updatedBy: SEED_CREATED_BY,
  });

  return { created: true, existing: false };
};

const main = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-service-providers] Connected to ${mongoose.connection.name}`);
  console.log(
    `[seed-service-providers] Mode: ${shouldWrite ? "WRITE" : "DRY-RUN"}`,
  );

  let createdCount = 0;
  let existingCount = 0;

  for (const provider of providers) {
    const result = await seedProvider(provider);
    if (result.created) createdCount += 1;
    if (result.existing) existingCount += 1;
  }

  console.log(
    `[seed-service-providers] Summary: ${createdCount} created, ${existingCount} already existed, ${providers.length - createdCount - existingCount} previewed.`,
  );

  if (!shouldWrite) {
    console.log("[seed-service-providers] Dry run complete. Re-run with --write to create missing providers.");
  }
};

main()
  .catch((error) => {
    console.error("[seed-service-providers] ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
