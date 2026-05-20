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
const UNSAFE_PARALLEL_ARRAY_INDEX_KEY = {
  status: 1,
  branchCoverage: 1,
  serviceCategoryKeys: 1,
};

const providers = [
  {
    providerName: "Tubero Experts Makati",
    contactNumber: "0962 561 7112",
    serviceCategories: [
      "Plumbing",
      "Water Leak",
      "Declogging",
      "General Maintenance",
    ],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Public Makati plumbing lead for plumbing, leak repair, and declogging services. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "Rose Malabanan Siphoning Makati",
    contactNumber: "87037328 / 85134422",
    serviceCategories: [
      "Plumbing",
      "Siphoning",
      "Declogging",
      "Sanitation",
    ],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Public Makati lead for emergency plumbing, siphoning, and declogging. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "John & Jacob Pest Control Services Makati",
    contactNumber: "09561753937 / (02) 8650 3819",
    serviceCategories: [
      "Pest Control",
      "Disinfection",
      "Cleaning/Sanitation",
    ],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Public Makati pest control lead. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "BOAZ Pest Management Corp.",
    contactNumber: "7744-4068 / 0922 865 5906 / sales.boazcorp@gmail.com / boazpestcontrol@gmail.com",
    serviceCategories: [
      "Pest Control",
      "Disinfection",
      "Termite Control",
    ],
    branchCoverage: ["guadalupe"],
    status: "active",
    notes: "Public Guadalupe Nuevo, Makati pest control lead. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "Cleaning Lady PH",
    contactNumber: "+63 917 625 9784 / info@cleaninglady.ph",
    serviceCategories: [
      "Cleaning",
      "Cleaning/Sanitation",
      "Deep Cleaning",
      "Disinfection",
    ],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Public cleaning and sanitation service lead for Metro Manila. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "Teko Aircon Services Makati",
    contactNumber: "Use official booking/contact page",
    serviceCategories: [
      "Air Conditioning",
      "Appliance Repair",
    ],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Public Makati aircon cleaning/repair service lead. Contact should be confirmed through Teko official booking/contact page. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "R.A. Mojica and Partners",
    contactNumber: "Verify from official/public listing",
    serviceCategories: [
      "General Maintenance",
      "Building Maintenance",
      "Electrical",
      "Plumbing",
      "Cleaning",
      "Cleaning/Sanitation",
    ],
    branchCoverage: ["guadalupe"],
    status: "active",
    notes: "Public Guadalupe Nuevo listing for general, building, electrical, plumbing, and cleaning maintenance. Contact should be verified before production use. Provider lead only; not a confirmed Lilycrest partner.",
  },
  {
    providerName: "Lilycrest General Maintenance Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Maintenance", "General Maintenance"],
    branchCoverage: ["guadalupe", "gil-puyat"],
    status: "active",
    notes: "Temporary general fallback provider for generic maintenance requests. Replace with verified real contact later.",
  },
  {
    providerName: "Lilycrest Internet/WiFi Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Internet/WiFi"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for internet and WiFi service requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest Door/Lock Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Door/Lock"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for lock, key, hinge, and door repair requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest Furniture Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Furniture"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for bed, cabinet, table, and furniture repair requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest General Handyman Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["General Handyman"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for general handyman requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest Carpentry Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Carpentry"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for carpentry requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest Glass/Window Repair Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Glass/Window Repair"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for glass and window repair requests. Replace with a verified provider contact before production use.",
  },
  {
    providerName: "Lilycrest Painting/Wall Repair Provider Placeholder",
    contactNumber: "To be updated by Owner",
    serviceCategories: ["Painting/Wall Repair"],
    branchCoverage: ["gil-puyat", "guadalupe"],
    status: "active",
    notes: "Temporary placeholder for painting and wall repair requests. Replace with a verified provider contact before production use.",
  },
];

const retiredPlaceholderNames = [
  "Lilycrest Plumbing Provider Placeholder",
  "Lilycrest Electrical Provider Placeholder",
  "Lilycrest Air Conditioning Provider Placeholder",
  "Lilycrest Pest Control Provider Placeholder",
  "Lilycrest Cleaning/Sanitation Provider Placeholder",
];

if (!MONGODB_URI) {
  console.error("[seed-service-providers] MONGODB_URI or MONGO_URI is required.");
  process.exit(1);
}

const isUnsafeParallelArrayIndex = (index = {}) => {
  const key = index.key || {};
  const unsafeEntries = Object.entries(UNSAFE_PARALLEL_ARRAY_INDEX_KEY);
  const keyEntries = Object.entries(key);
  return (
    keyEntries.length === unsafeEntries.length &&
    unsafeEntries.every(([field, direction]) => key[field] === direction)
  );
};

const dropUnsafeParallelArrayIndexes = async () => {
  let indexes = [];
  try {
    indexes = await ServiceProvider.collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") {
      return;
    }
    throw error;
  }
  const unsafeIndexes = indexes.filter(isUnsafeParallelArrayIndex);

  if (unsafeIndexes.length === 0) return;

  for (const index of unsafeIndexes) {
    if (!index.name) continue;
    if (!shouldWrite) {
      console.log(
        `[seed-service-providers] Would drop unsafe parallel-array index: ${index.name}`,
      );
      continue;
    }

    console.log(
      `[seed-service-providers] Dropping unsafe parallel-array index: ${index.name}`,
    );
    try {
      await ServiceProvider.collection.dropIndex(index.name);
    } catch (error) {
      if (error?.code === 27 || error?.codeName === "IndexNotFound") {
        continue;
      }
      throw error;
    }
  }
};

const normalizeComparableList = (value) =>
  [...new Set((Array.isArray(value) ? value : [value]).map((entry) => String(entry || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

const listsMatch = (left, right) => {
  const leftList = normalizeComparableList(left);
  const rightList = normalizeComparableList(right);
  return leftList.length === rightList.length && leftList.every((entry, index) => entry === rightList[index]);
};

const buildProviderChanges = (existing, provider) => {
  const changes = {};
  const scalarFields = [
    "contactNumber",
    "status",
    "notes",
    "averageResponseTime",
    "internalRating",
  ];

  for (const field of scalarFields) {
    if (provider[field] === undefined) continue;
    const currentValue = existing[field] ?? null;
    const nextValue = provider[field] ?? null;
    if (currentValue !== nextValue) {
      changes[field] = nextValue;
    }
  }

  if (!listsMatch(existing.serviceCategories, provider.serviceCategories)) {
    changes.serviceCategories = provider.serviceCategories;
  }
  if (!listsMatch(existing.branchCoverage, provider.branchCoverage)) {
    changes.branchCoverage = provider.branchCoverage;
  }

  return changes;
};

const seedProvider = async (provider) => {
  const existing = await ServiceProvider.findOne({
    providerName: provider.providerName,
  });

  if (existing) {
    const changes = buildProviderChanges(existing, provider);

    if (Object.keys(changes).length === 0) {
      console.log(`[seed-service-providers] Existing: ${provider.providerName}`);
      return { action: "existing" };
    }

    console.log(
      `[seed-service-providers] ${shouldWrite ? "Updating" : "Would update"}: ${provider.providerName}`,
    );

    if (!shouldWrite) {
      return { action: "previewed" };
    }

    Object.assign(existing, {
      ...changes,
      updatedBy: SEED_CREATED_BY,
    });
    await existing.save();
    return { action: "updated" };
  }

  console.log(
    `[seed-service-providers] ${shouldWrite ? "Creating" : "Would create"}: ${provider.providerName}`,
  );

  if (!shouldWrite) {
    return { action: "previewed" };
  }

  await ServiceProvider.create({
    ...provider,
    createdBy: SEED_CREATED_BY,
    updatedBy: SEED_CREATED_BY,
  });

  return { action: "created" };
};

const retirePlaceholderProvider = async (providerName) => {
  const existing = await ServiceProvider.findOne({ providerName });

  if (!existing) {
    return { action: "missing" };
  }

  if (existing.status === "inactive") {
    console.log(`[seed-service-providers] Already inactive: ${providerName}`);
    return { action: "existing" };
  }

  console.log(
    `[seed-service-providers] ${shouldWrite ? "Retiring" : "Would retire"}: ${providerName}`,
  );

  if (!shouldWrite) {
    return { action: "previewed" };
  }

  existing.status = "inactive";
  existing.notes = "Retired by service provider seed because verified public leads now cover this category. Kept for admin history; reactivate only after Owner review.";
  existing.updatedBy = SEED_CREATED_BY;
  await existing.save();
  return { action: "retired" };
};

const main = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`[seed-service-providers] Connected to ${mongoose.connection.name}`);
  console.log(
    `[seed-service-providers] Mode: ${shouldWrite ? "WRITE" : "DRY-RUN"}`,
  );
  await dropUnsafeParallelArrayIndexes();

  const counts = {
    created: 0,
    updated: 0,
    retired: 0,
    existing: 0,
    previewed: 0,
  };

  for (const provider of providers) {
    const result = await seedProvider(provider);
    if (counts[result.action] !== undefined) counts[result.action] += 1;
  }

  for (const providerName of retiredPlaceholderNames) {
    const result = await retirePlaceholderProvider(providerName);
    if (counts[result.action] !== undefined) counts[result.action] += 1;
  }

  console.log(
    `[seed-service-providers] Summary: ${counts.created} created, ${counts.updated} updated, ${counts.retired} retired, ${counts.existing} already current, ${counts.previewed} previewed.`,
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
