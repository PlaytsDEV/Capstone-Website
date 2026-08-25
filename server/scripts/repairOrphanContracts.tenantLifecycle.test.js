/**
 * Hardening regression: the orphan repair tool's classifier previously only
 * checked references by reservationId/contractId, which missed evidence
 * that survives ONLY under the tenant's own id — e.g. utilityreadings,
 * which are keyed by tenantId, not reservationId. The 2026-08-25 production
 * audit found exactly this case (LIL-GP-2026-00005 / LIL-GUAD-2026-00008)
 * via manual follow-up; classifyOrphan must now catch it automatically.
 *
 * This exercises classifyOrphan/countTenantLifecycleReferences directly
 * against a real in-memory MongoDB — no mocks — so a regression here would
 * be caught the same way the original gap was: a document that "looks"
 * orphaned but has real tenant history attached must never be classified
 * DETERMINISTIC_ARCHIVABLE.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

jest.setTimeout(60_000);

const { classifyOrphan, countTenantLifecycleReferences } = await import("./repairOrphanContracts.mjs");
const {
  Contract, Room, User, UtilityReading, TenantViolation, MaintenanceRequest,
} = await import("../models/index.js");

describe("repairOrphanContracts: tenantId/userId lifecycle reference hardening", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "repair_orphan_tenant_lifecycle" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      Contract.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
      UtilityReading.deleteMany({}),
      TenantViolation.deleteMany({}),
      MaintenanceRequest.deleteMany({}),
    ]);
  });

  async function seedOrphanContract(overrides = {}) {
    const room = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, price: 6000,
    });
    // tenantId intentionally does NOT reference a real, existing User —
    // reproduces "Reservation and tenant User both deleted" orphans.
    const tenantId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();
    const contract = await Contract.create({
      contractNumber: `LIL-TEST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      branch: room.branch,
      reservationId,
      tenantId,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomType: room.type,
      propertyName: "Test Property",
      propertyAddress: "123 Test St",
      leaseType: "short_term",
      status: "draft",
      isCurrent: true,
      contractYear: 2026,
      contractSequence: Math.floor(Math.random() * 100000),
      createdBy: tenantId,
      updatedBy: tenantId,
      ...overrides,
    });
    return { contract, room, tenantId, reservationId };
  }

  test("an orphan Contract with NO tenant-lifecycle evidence is DETERMINISTIC_ARCHIVABLE", async () => {
    const { contract } = await seedOrphanContract();
    const { classification, reasons } = await classifyOrphan(contract);
    expect(classification).toBe("DETERMINISTIC_ARCHIVABLE");
    expect(reasons).toEqual([]);
  });

  test("an orphan Contract with a UtilityReading tied to its tenantId is NOT DETERMINISTIC_ARCHIVABLE", async () => {
    const { contract, room, tenantId } = await seedOrphanContract();
    const recorder = await User.create({
      firebaseUid: `admin-${new mongoose.Types.ObjectId()}`,
      email: `admin-${new mongoose.Types.ObjectId()}@example.test`,
      username: `admin_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Admin", lastName: "User", role: "branch_admin",
    });
    await UtilityReading.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      reading: 1234,
      date: new Date(),
      eventType: "regularBilling",
      tenantId, // the only surviving link — reservationId/contractId never appear here
      recordedBy: recorder._id,
    });

    const { classification, reasons } = await classifyOrphan(contract);
    expect(classification).toBe("AMBIGUOUS_MANUAL_REVIEW");
    expect(reasons.some((r) => r.startsWith("tenantLifecycle(") && r.includes("utilityReadings"))).toBe(true);
  });

  test("countTenantLifecycleReferences reports every matching curated collection, not just one", async () => {
    const { tenantId } = await seedOrphanContract();
    await TenantViolation.create({
      tenantId,
      branch: "gil-puyat",
      violationType: "smoking_inside",
      description: "Test violation for regression coverage",
      status: "reported",
      reportedAt: new Date(),
      reportedBy: tenantId,
      dateOfIncident: new Date(),
    });
    await MaintenanceRequest.create({
      userId: tenantId,
      user_id: tenantId,
      title: "Leaky faucet",
      description: "Test maintenance request for regression coverage",
      category: "plumbing",
      request_type: "plumbing",
      priority: "low",
      status: "pending",
    });

    const refs = await countTenantLifecycleReferences(tenantId);
    expect(refs.some((r) => r.startsWith("tenantViolations("))).toBe(true);
    expect(refs.some((r) => r.startsWith("maintenanceRequests("))).toBe(true);
  });

  test("an unrelated tenantId is not falsely flagged (no cross-tenant leakage)", async () => {
    const { contract, room } = await seedOrphanContract();
    const recorder = await User.create({
      firebaseUid: `admin-${new mongoose.Types.ObjectId()}`,
      email: `admin-${new mongoose.Types.ObjectId()}@example.test`,
      username: `admin_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Admin", lastName: "User", role: "branch_admin",
    });
    // A UtilityReading for a DIFFERENT tenant must not taint this contract's classification.
    await UtilityReading.create({
      utilityType: "electricity",
      roomId: room._id,
      branch: room.branch,
      reading: 1234,
      date: new Date(),
      eventType: "regularBilling",
      tenantId: new mongoose.Types.ObjectId(),
      recordedBy: recorder._id,
    });

    const { classification } = await classifyOrphan(contract);
    expect(classification).toBe("DETERMINISTIC_ARCHIVABLE");
  });
});
