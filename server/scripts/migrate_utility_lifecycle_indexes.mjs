/**
 * Controlled schema/index deployment for the utility lifecycle recovery.
 *
 * Default mode is read-only inspection. Write mode only creates the missing
 * UtilityHistoricalGap collection/indexes and the lifecycle-active
 * UtilityPeriod index. It never drops indexes or modifies business documents.
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

export const CONFIRM_TOKEN = "UTILITY-LIFECYCLE-INDEXES-APPLY";
export const COLLECTIONS = Object.freeze({
  historicalGaps: "utilityhistoricalgaps",
  utilityPeriods: "utilityperiods",
});

export const EXPECTED_HISTORICAL_GAP_INDEXES = Object.freeze([
  { name: "_id_", key: { _id: 1 }, unique: true, implicit: true },
  { name: "repairKey_1", key: { repairKey: 1 } },
  { name: "roomId_1", key: { roomId: 1 } },
  { name: "isArchived_1", key: { isArchived: 1 } },
  {
    name: "repairKey_1_roomId_1_utilityType_1",
    key: { repairKey: 1, roomId: 1, utilityType: 1 },
    unique: true,
  },
  {
    name: "reservationId_1_blocksTransfer_1_reviewState_1_isArchived_1",
    key: { reservationId: 1, blocksTransfer: 1, reviewState: 1, isArchived: 1 },
  },
]);

export const EXPECTED_LIFECYCLE_ACTIVE_INDEX = Object.freeze({
  name: "unique_lifecycle_active_utility_period",
  key: { utilityType: 1, roomId: 1 },
  unique: true,
  partialFilterExpression: {
    isArchived: false,
    status: { $in: ["open", "manual_review_required"] },
  },
});

function fail(code, message, details = {}) {
  throw Object.assign(new Error(message), { code, details });
}

export function parseMigrationArgs(argv = []) {
  let write = false;
  let confirmToken = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index]);
    if (token === "--write") {
      if (write) fail("INVALID_ARGUMENT", "Duplicate --write argument.");
      write = true;
      continue;
    }
    if (token === "--confirm-token") {
      if (confirmToken !== null) fail("INVALID_ARGUMENT", "Duplicate --confirm-token argument.");
      if (argv[index + 1] == null || String(argv[index + 1]).startsWith("--")) {
        fail("INVALID_ARGUMENT", "--confirm-token requires a value.");
      }
      confirmToken = String(argv[++index]);
      continue;
    }
    fail("INVALID_ARGUMENT", `Unsupported argument ${token}.`);
  }
  if (!write && confirmToken !== null) {
    fail("INVALID_ARGUMENT", "--confirm-token is only valid with --write.");
  }
  if (write && confirmToken !== CONFIRM_TOKEN) {
    fail("WRITE_CONFIRMATION_REQUIRED", `Write mode requires --confirm-token ${CONFIRM_TOKEN}.`);
  }
  return Object.freeze({ write, confirmToken });
}

function normalizeDocument(value) {
  if (Array.isArray(value)) return value.map(normalizeDocument);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, normalizeDocument(value[key])]),
  );
}

function indexOptions(index) {
  return {
    unique: Boolean(index.unique),
    sparse: Boolean(index.sparse),
    partialFilterExpression: normalizeDocument(index.partialFilterExpression || null),
    expireAfterSeconds: index.expireAfterSeconds ?? null,
  };
}

export function sameIndexDefinition(existing, expected) {
  if (expected?.implicit && expected.name === "_id_") {
    return existing?.name === "_id_"
      && JSON.stringify(existing?.key || null) === JSON.stringify(expected.key);
  }
  return JSON.stringify(existing?.key || null) === JSON.stringify(expected?.key || null)
    && JSON.stringify(indexOptions(existing || {})) === JSON.stringify(indexOptions(expected || {}));
}

export function describeExpectedIndexes(existingIndexes, expectedIndexes) {
  return expectedIndexes.map((expected) => {
    const named = existingIndexes.find((index) => index.name === expected.name) || null;
    const equivalent = existingIndexes.find((index) => sameIndexDefinition(index, expected)) || null;
    let state = "MISSING";
    if (named && sameIndexDefinition(named, expected)) state = "MATCH";
    else if (named) state = "NAME_CONFLICT";
    else if (equivalent) state = "EQUIVALENT_DIFFERENT_NAME";
    return {
      name: expected.name,
      state,
      expected,
      existing: named || equivalent,
    };
  });
}

async function collectionExists(db, name) {
  const matches = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return matches.length === 1;
}

async function listIndexes(db, name, exists) {
  return exists ? db.collection(name).listIndexes().toArray() : [];
}

async function findLifecycleConflicts(db, utilityPeriodsExist) {
  if (!utilityPeriodsExist) return [];
  return db.collection(COLLECTIONS.utilityPeriods).aggregate([
    {
      $match: {
        isArchived: false,
        status: { $in: ["open", "manual_review_required"] },
      },
    },
    {
      $group: {
        _id: { utilityType: "$utilityType", roomId: "$roomId" },
        count: { $sum: 1 },
        periodIds: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id.utilityType": 1, "_id.roomId": 1 } },
  ]).toArray();
}

async function findHistoricalGapConflicts(db, historicalGapsExist) {
  if (!historicalGapsExist) return [];
  return db.collection(COLLECTIONS.historicalGaps).aggregate([
    {
      $group: {
        _id: {
          repairKey: "$repairKey",
          roomId: "$roomId",
          utilityType: "$utilityType",
        },
        count: { $sum: 1 },
        gapIds: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id.repairKey": 1, "_id.roomId": 1, "_id.utilityType": 1 } },
  ]).toArray();
}

export async function inspectUtilityLifecycleIndexes(db) {
  const [historicalGapsExist, utilityPeriodsExist] = await Promise.all([
    collectionExists(db, COLLECTIONS.historicalGaps),
    collectionExists(db, COLLECTIONS.utilityPeriods),
  ]);
  const [historicalGapIndexes, utilityPeriodIndexes, lifecycleConflicts, historicalGapConflicts] = await Promise.all([
    listIndexes(db, COLLECTIONS.historicalGaps, historicalGapsExist),
    listIndexes(db, COLLECTIONS.utilityPeriods, utilityPeriodsExist),
    findLifecycleConflicts(db, utilityPeriodsExist),
    findHistoricalGapConflicts(db, historicalGapsExist),
  ]);
  return {
    collections: {
      [COLLECTIONS.historicalGaps]: { exists: historicalGapsExist },
      [COLLECTIONS.utilityPeriods]: { exists: utilityPeriodsExist },
    },
    conflicts: {
      lifecycleActive: lifecycleConflicts,
      historicalGapRepairKeys: historicalGapConflicts,
    },
    indexes: {
      [COLLECTIONS.historicalGaps]: {
        existing: historicalGapIndexes,
        expected: describeExpectedIndexes(historicalGapIndexes, EXPECTED_HISTORICAL_GAP_INDEXES),
      },
      [COLLECTIONS.utilityPeriods]: {
        existing: utilityPeriodIndexes,
        expected: describeExpectedIndexes(utilityPeriodIndexes, [EXPECTED_LIFECYCLE_ACTIVE_INDEX]),
      },
    },
  };
}

function assertSafeToCreate(report) {
  if (!report.collections[COLLECTIONS.utilityPeriods].exists) {
    fail("UTILITY_PERIOD_COLLECTION_MISSING", "The utilityperiods collection must already exist.");
  }
  if (report.conflicts.lifecycleActive.length) {
    fail("LIFECYCLE_ACTIVE_CONFLICTS", "Lifecycle-active UtilityPeriod conflicts block index creation.", {
      conflicts: report.conflicts.lifecycleActive,
    });
  }
  if (report.conflicts.historicalGapRepairKeys.length) {
    fail("HISTORICAL_GAP_DUPLICATES", "Duplicate UtilityHistoricalGap repair keys block index creation.", {
      conflicts: report.conflicts.historicalGapRepairKeys,
    });
  }
  const expectedStates = [
    ...report.indexes[COLLECTIONS.historicalGaps].expected,
    ...report.indexes[COLLECTIONS.utilityPeriods].expected,
  ];
  const incompatible = expectedStates.filter(({ state }) =>
    state === "NAME_CONFLICT" || state === "EQUIVALENT_DIFFERENT_NAME");
  if (incompatible.length) {
    fail("INDEX_DEFINITION_CONFLICT", "Existing index definitions require manual review; no indexes were dropped.", {
      indexes: incompatible,
    });
  }
}

function createOptions(expected) {
  return Object.fromEntries([
    ["name", expected.name],
    ...(expected.unique ? [["unique", true]] : []),
    ...(expected.partialFilterExpression
      ? [["partialFilterExpression", expected.partialFilterExpression]]
      : []),
  ]);
}

async function createMissingIndexes(collection, expectedStates) {
  const created = [];
  for (const item of expectedStates) {
    if (item.state === "MATCH" || item.expected.implicit) continue;
    await collection.createIndex(item.expected.key, createOptions(item.expected));
    created.push(item.expected.name);
  }
  return created;
}

export async function runUtilityLifecycleIndexMigration({ db, write = false } = {}) {
  const before = await inspectUtilityLifecycleIndexes(db);
  if (!write) {
    return { mode: "inspect", databaseMutations: 0, before };
  }
  assertSafeToCreate(before);

  let collectionCreated = false;
  if (!before.collections[COLLECTIONS.historicalGaps].exists) {
    await db.createCollection(COLLECTIONS.historicalGaps);
    collectionCreated = true;
  }
  const historicalGapCollection = db.collection(COLLECTIONS.historicalGaps);
  const utilityPeriodCollection = db.collection(COLLECTIONS.utilityPeriods);
  const createdIndexes = [
    ...await createMissingIndexes(
      historicalGapCollection,
      before.indexes[COLLECTIONS.historicalGaps].expected,
    ),
    ...await createMissingIndexes(
      utilityPeriodCollection,
      before.indexes[COLLECTIONS.utilityPeriods].expected,
    ),
  ];

  const after = await inspectUtilityLifecycleIndexes(db);
  const unverified = [
    ...after.indexes[COLLECTIONS.historicalGaps].expected,
    ...after.indexes[COLLECTIONS.utilityPeriods].expected,
  ].filter(({ state }) => state !== "MATCH");
  if (unverified.length) {
    fail("POST_MIGRATION_VERIFICATION_FAILED", "One or more expected indexes did not verify after creation.", {
      indexes: unverified,
    });
  }
  return {
    mode: "write",
    databaseMutations: Number(collectionCreated) + createdIndexes.length,
    collectionCreated,
    createdIndexes,
    before,
    after,
  };
}

async function main() {
  const args = parseMigrationArgs(process.argv.slice(2));
  const uri = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  if (!uri) fail("CONFIGURATION_ERROR", "MONGODB_URI or MONGO_URI is required.");
  await mongoose.connect(uri, {
    ...(process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}),
    autoCreate: false,
    autoIndex: false,
    retryWrites: args.write,
    readPreference: args.write ? "primary" : "primaryPreferred",
    appName: "lilycrest-utility-lifecycle-index-migration",
  });
  try {
    const result = await runUtilityLifecycleIndexMigration({
      db: mongoose.connection.db,
      write: args.write,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(async (error) => {
    process.stderr.write(`${JSON.stringify({
      status: "ABORTED",
      code: error.code || "UTILITY_LIFECYCLE_INDEX_MIGRATION_FAILED",
      message: error.message,
      details: error.details || {},
    }, null, 2)}\n`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
