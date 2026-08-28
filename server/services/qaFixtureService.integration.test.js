import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  exactFixtureFilter,
  getQaFixtureStatus,
  removeQaFixtures,
  seedQaFixtures,
  stableFixtureDigest,
} from "./qaFixtureService.js";

const definitions = [
  { name: "QA-ACTIVE", email: "active@qa.invalid", password: "not-logged", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-INACTIVE", email: "inactive@qa.invalid", password: "not-logged", role: "tenant", tenantStatus: "inactive", accountStatus: "deactivated" },
  { name: "QA-USERNAME", email: "username@qa.invalid", password: "not-logged", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-MAINTENANCE", email: "maintenance@qa.invalid", password: "not-logged", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-BILLING", email: "billing@qa.invalid", password: "not-logged", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-ADMIN", email: "admin@qa.invalid", password: "not-logged", role: "owner", tenantStatus: "applicant", accountStatus: "active" },
];

function makeAuth() {
  const records = new Map();
  return {
    getUser: jest.fn(async (uid) => {
      if (!records.has(uid)) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
      return records.get(uid);
    }),
    createUser: jest.fn(async (value) => { records.set(value.uid, value); return value; }),
    updateUser: jest.fn(async (uid, value) => { records.set(uid, { uid, ...value }); return records.get(uid); }),
    deleteUser: jest.fn(async (uid) => {
      if (!records.delete(uid)) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" });
    }),
  };
}

describe("isolated QA fixture service", () => {
  let mongod;
  let db;
  let auth;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("lilycrest_qa"));
    db = mongoose.connection.db;
    auth = makeAuth();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("seed is deterministic and idempotent", async () => {
    const now = new Date("2026-08-29T00:00:00.000Z");
    const first = await seedQaFixtures({ db, auth, definitions, now });
    const second = await seedQaFixtures({ db, auth, definitions, now });
    expect(stableFixtureDigest(second)).toBe(stableFixtureDigest(first));
    expect(await db.collection("users").countDocuments(exactFixtureFilter())).toBe(6);
    expect(await db.collection("maintenance_requests").countDocuments(exactFixtureFilter())).toBe(4);
    expect(await db.collection("bills").countDocuments(exactFixtureFilter())).toBe(1);
    expect(await db.collection("users").findOne(exactFixtureFilter("QA-INACTIVE"))).toMatchObject({
      isActive: false,
      is_active: false,
      firebaseUid: "qa-emulator-qa_inactive",
      firebase_uid: "qa-emulator-qa_inactive",
    });
    expect(await db.collection("maintenance_requests").findOne(
      exactFixtureFilter("QA-MAINT-COMPLETED-RATED"),
    )).toMatchObject({
      status: "completed",
      tenant_confirmed_resolved: true,
      resolutionConfirmation: { rating: 4 },
    });
  });

  test("reset removes only exact marked fixtures and can be repeated", async () => {
    await db.collection("users").insertOne({ user_id: "real-user", email: "resident@example.org" });
    await removeQaFixtures({ db, auth, definitions });
    await removeQaFixtures({ db, auth, definitions });
    expect(await db.collection("users").countDocuments(exactFixtureFilter())).toBe(0);
    expect(await db.collection("users").countDocuments({ user_id: "real-user" })).toBe(1);
    const status = await getQaFixtureStatus({ db, auth, definitions });
    expect(status.fixtures.every((entry) => !entry.database && !entry.firebase)).toBe(true);
  });
});
