import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  COLLECTIONS,
  CONFIRM_TOKEN,
  EXPECTED_HISTORICAL_GAP_INDEXES,
  EXPECTED_LIFECYCLE_ACTIVE_INDEX,
  describeExpectedIndexes,
  parseMigrationArgs,
  runUtilityLifecycleIndexMigration,
  sameIndexDefinition,
} from "./migrate_utility_lifecycle_indexes.mjs";

let mongo;
let client;
let db;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db("utility_lifecycle_index_migration");
}, 120_000);

beforeEach(async () => {
  await db.dropDatabase();
  await db.createCollection(COLLECTIONS.utilityPeriods);
});

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

describe("utility lifecycle index migration safeguards", () => {
  test("defaults to read-only inspect mode", () => {
    expect(parseMigrationArgs([])).toEqual({ write: false, confirmToken: null });
  });

  test("write mode requires the dedicated confirmation token", () => {
    expect(() => parseMigrationArgs(["--write"])).toThrow("Write mode requires");
    expect(parseMigrationArgs(["--write", "--confirm-token", CONFIRM_TOKEN])).toEqual({
      write: true,
      confirmToken: CONFIRM_TOKEN,
    });
  });

  test("declares the exact lifecycle-active partial unique index", () => {
    expect(EXPECTED_LIFECYCLE_ACTIVE_INDEX).toEqual({
      name: "unique_lifecycle_active_utility_period",
      key: { utilityType: 1, roomId: 1 },
      unique: true,
      partialFilterExpression: {
        isArchived: false,
        status: { $in: ["open", "manual_review_required"] },
      },
    });
  });

  test("declares every UtilityHistoricalGap index", () => {
    expect(EXPECTED_HISTORICAL_GAP_INDEXES.map(({ name }) => name)).toEqual([
      "_id_",
      "repairKey_1",
      "roomId_1",
      "isArchived_1",
      "repairKey_1_roomId_1_utilityType_1",
      "reservationId_1_blocksTransfer_1_reviewState_1_isArchived_1",
    ]);
  });

  test("requires exact names and definitions without treating a conflicting name as ready", () => {
    const expected = EXPECTED_LIFECYCLE_ACTIVE_INDEX;
    const exact = { ...expected };
    const wrongFilter = {
      ...expected,
      partialFilterExpression: { isArchived: false, status: "open" },
    };
    expect(sameIndexDefinition(exact, expected)).toBe(true);
    expect(sameIndexDefinition(wrongFilter, expected)).toBe(false);
    expect(describeExpectedIndexes([wrongFilter], [expected])[0].state).toBe("NAME_CONFLICT");
    expect(describeExpectedIndexes([{ ...exact, name: "other_name" }], [expected])[0].state)
      .toBe("EQUIVALENT_DIFFERENT_NAME");
  });

  test("inspect mode is mutation-free and explicit write mode is idempotent", async () => {
    const inspected = await runUtilityLifecycleIndexMigration({ db });
    expect(inspected.mode).toBe("inspect");
    expect(inspected.databaseMutations).toBe(0);
    expect(inspected.before.collections[COLLECTIONS.historicalGaps].exists).toBe(false);
    expect(await db.listCollections({ name: COLLECTIONS.historicalGaps }).toArray()).toHaveLength(0);

    const applied = await runUtilityLifecycleIndexMigration({ db, write: true });
    expect(applied.collectionCreated).toBe(true);
    expect(applied.createdIndexes).toEqual([
      "repairKey_1",
      "roomId_1",
      "isArchived_1",
      "repairKey_1_roomId_1_utilityType_1",
      "reservationId_1_blocksTransfer_1_reviewState_1_isArchived_1",
      "unique_lifecycle_active_utility_period",
    ]);

    const repeated = await runUtilityLifecycleIndexMigration({ db, write: true });
    expect(repeated).toMatchObject({
      mode: "write",
      databaseMutations: 0,
      collectionCreated: false,
      createdIndexes: [],
    });
    expect(await db.collection(COLLECTIONS.utilityPeriods).countDocuments()).toBe(0);
    expect(await db.collection(COLLECTIONS.historicalGaps).countDocuments()).toBe(0);
  }, 120_000);

  test("write mode aborts before schema mutation when lifecycle-active duplicates exist", async () => {
    const roomId = new ObjectId();
    await db.collection(COLLECTIONS.utilityPeriods).insertMany([
      { utilityType: "electricity", roomId, status: "open", isArchived: false },
      { utilityType: "electricity", roomId, status: "manual_review_required", isArchived: false },
    ]);

    await expect(runUtilityLifecycleIndexMigration({ db, write: true }))
      .rejects.toMatchObject({ code: "LIFECYCLE_ACTIVE_CONFLICTS" });
    expect(await db.listCollections({ name: COLLECTIONS.historicalGaps }).toArray()).toHaveLength(0);
    const indexNames = (await db.collection(COLLECTIONS.utilityPeriods).listIndexes().toArray())
      .map(({ name }) => name);
    expect(indexNames).not.toContain("unique_lifecycle_active_utility_period");
  }, 120_000);
});
