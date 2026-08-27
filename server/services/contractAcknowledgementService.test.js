/**
 * Integration test for contractAcknowledgementService.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet because
 * ContractAcknowledgement's idempotency guarantee is backed by a unique
 * compound index — the test needs real Mongo index enforcement, not a mock.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

await jest.unstable_mockModule("./audit/auditLogger.js", () => ({
  default: { log: jest.fn().mockResolvedValue(undefined) },
}));

const auditLoggerModule = await import("./audit/auditLogger.js");
const mockAuditLog = auditLoggerModule.default.log;

const {
  acknowledgeContract,
  getAcknowledgementStatus,
} = await import("./contractAcknowledgementService.js");
const { generateContractNumber } = await import("./contractService.js");
const { Contract, ContractAcknowledgement, Reservation, Room, User } = await import(
  "../models/index.js"
);

jest.setTimeout(120_000);

describe("contractAcknowledgementService", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "contract_acknowledgement" });
    await ContractAcknowledgement.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    jest.clearAllMocks();
    await Promise.all([
      Contract.deleteMany({}),
      ContractAcknowledgement.deleteMany({}),
      Reservation.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  const minimalPreparedDocument = (actorId, overrides = {}) => ({
    documentType: "prepared",
    version: 1,
    storageProvider: "local",
    storageKey: "gil-puyat/2026/prepared_v1.pdf",
    fileName: "prepared_v1.pdf",
    fileHash: "draft-hash-v1",
    fileSize: 2048,
    pageCount: 3,
    generatedAt: new Date(),
    generatedBy: actorId,
    templateId: "official-v1",
    templateVersion: "1.0.0",
    coordinateVersion: "1.0.0",
    ...overrides,
  });

  const minimalFinalDocument = (actorId, overrides = {}) => ({
    version: 1,
    storageKey: "gil-puyat/2026/final_v1.pdf",
    fileName: "final_v1.pdf",
    fileHash: "hash-v1",
    fileSize: 1024,
    mimeType: "application/pdf",
    pageCount: 4,
    sourceType: "admin_scan",
    sourceVersion: 1,
    sourceUploadedAt: new Date(),
    publishedAt: new Date(),
    publishedBy: actorId,
    tenantVisible: true,
    ...overrides,
  });

  async function seedTenantAndContract({
    finalDocumentOverrides = {},
    hasFinalDocument = true,
    status = "active",
    preparedDocuments = null,
  } = {}) {
    const actorId = new mongoose.Types.ObjectId();
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test",
      lastName: "Tenant",
      role: "tenant",
    });
    const room = await Room.create({
      name: "Room 301",
      roomNumber: "301",
      branch: "gil-puyat",
      type: "quadruple-sharing",
      capacity: 4,
      price: 6300,
    });
    const reservation = await Reservation.create({
      userId: tenant._id,
      roomId: room._id,
      status: "moveIn",
      leaseDuration: 6,
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    const number = await generateContractNumber(room.branch, new Date());
    const contract = await Contract.create({
      ...number,
      contractPurpose: "initial",
      tenantId: tenant._id,
      applicationId: reservation._id,
      reservationId: reservation._id,
      roomId: room._id,
      branch: room.branch,
      propertyName: "Lilycrest Dormitory",
      propertyAddress: "123 Test St.",
      roomNumber: room.roomNumber,
      roomType: "quadruple-sharing",
      leaseType: "long_term",
      status,
      isCurrent: true,
      statusHistory: [{ status, changedBy: actorId, reason: "seed" }],
      createdBy: actorId,
      updatedBy: actorId,
      preparedDocuments: preparedDocuments === null
        ? []
        : preparedDocuments.map((overrides) => minimalPreparedDocument(actorId, overrides)),
      finalDocument: hasFinalDocument ? minimalFinalDocument(actorId, finalDocumentOverrides) : null,
    });
    return { actorId, tenant, room, reservation, contract };
  }

  const fakeReq = () => ({ ip: "127.0.0.1", get: () => "jest-test-agent" });

  test("first acknowledge succeeds and logs an audit entry", async () => {
    const { tenant, contract } = await seedTenantAndContract();

    const record = await acknowledgeContract({
      contractId: contract._id,
      tenantId: tenant._id,
      req: fakeReq(),
    });

    expect(record.documentVersion).toBe(1);
    expect(record.documentFileHash).toBe("hash-v1");
    expect(record.acknowledgedAt).toBeTruthy();

    const stored = await ContractAcknowledgement.findOne({ contractId: contract._id, tenantId: tenant._id });
    expect(stored).toBeTruthy();

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.mock.calls[0][0]).toMatchObject({
      entityType: "contract_acknowledgement",
      action: "acknowledge_contract",
    });
  });

  test("duplicate acknowledge (same version+hash) returns the same record, no duplicate audit entry, no 11000 surfaced", async () => {
    const { tenant, contract } = await seedTenantAndContract();

    const first = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    const second = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });

    expect(String(second._id)).toBe(String(first._id));
    expect(second.acknowledgedAt.getTime()).toBe(first.acknowledgedAt.getTime());

    const count = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(count).toBe(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });

  test("concurrent double-click produces exactly one record and one audit entry", async () => {
    const { tenant, contract } = await seedTenantAndContract();

    const [a, b] = await Promise.all([
      acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() }),
      acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() }),
    ]);

    expect(String(a._id)).toBe(String(b._id));
    const count = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(count).toBe(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });

  test("after the final document is replaced (new version/hash), status flips to acknowledged:false and the old record is preserved", async () => {
    const { actorId, tenant, contract } = await seedTenantAndContract();

    const original = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    let status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ required: true, acknowledged: true, documentVersion: 1 });

    // Simulate a final-document replacement (contractFinalDocumentReplacementService's
    // real effect on the Contract document) without going through the full
    // replacement service pipeline — only the version/hash bump matters here.
    await Contract.updateOne(
      { _id: contract._id },
      {
        $set: {
          finalDocument: minimalFinalDocument(actorId, {
            version: 2,
            fileHash: "hash-v2",
            storageKey: "gil-puyat/2026/final_v2.pdf",
          }),
        },
      },
    );

    status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ required: true, acknowledged: false, documentVersion: 2 });

    // The original v1 acknowledgement record must still exist, untouched.
    const stillThere = await ContractAcknowledgement.findById(original._id);
    expect(stillThere).toBeTruthy();
    expect(stillThere.documentVersion).toBe(1);
    expect(stillThere.documentFileHash).toBe("hash-v1");

    // Acknowledging again creates a NEW record for v2, distinct from v1.
    const secondAck = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    expect(String(secondAck._id)).not.toBe(String(original._id));
    expect(secondAck.documentVersion).toBe(2);

    const totalRecords = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(totalRecords).toBe(2);
  });

  test("acknowledging with no final document throws NO_ACKNOWLEDGEABLE_DOCUMENT", async () => {
    const { tenant, contract } = await seedTenantAndContract({ hasFinalDocument: false });

    await expect(
      acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() }),
    ).rejects.toMatchObject({ code: "NO_ACKNOWLEDGEABLE_DOCUMENT", statusCode: 409 });
  });

  test("getAcknowledgementStatus reports required:false when no final document exists", async () => {
    const { tenant, contract } = await seedTenantAndContract({ hasFinalDocument: false });

    const status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ required: false, acknowledged: false, documentVersion: null });
  });

  test("a tenant cannot acknowledge another tenant's contract", async () => {
    const { contract } = await seedTenantAndContract();
    const otherTenantId = new mongoose.Types.ObjectId();

    await expect(
      acknowledgeContract({ contractId: contract._id, tenantId: otherTenantId, req: fakeReq() }),
    ).rejects.toMatchObject({ code: "CONTRACT_ACCESS_DENIED", statusCode: 403 });
  });

  // ── Generated Draft acknowledgement ────────────────────────────────────

  const seedDraft = () => seedTenantAndContract({
    status: "generated",
    hasFinalDocument: false,
    preparedDocuments: [{}], // one prepared v1, hash "draft-hash-v1"
  });

  test("an eligible generated Draft is acknowledgeable (required:true, kind draft)", async () => {
    const { tenant, contract } = await seedDraft();

    const status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({
      required: true,
      acknowledged: false,
      documentKind: "draft",
      documentVersion: 1,
    });
  });

  test("tenant can acknowledge a generated Draft and it persists, bound to the draft version+hash", async () => {
    const { tenant, contract } = await seedDraft();

    const record = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    expect(record.documentKind).toBe("draft");
    expect(record.documentVersion).toBe(1);
    expect(record.documentFileHash).toBe("draft-hash-v1");

    const after = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(after).toMatchObject({ required: true, acknowledged: true, documentKind: "draft", documentVersion: 1 });

    const stored = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(stored).toBe(1);
  });

  test("acknowledging a generated Draft is idempotent on repeated calls", async () => {
    const { tenant, contract } = await seedDraft();

    const a = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    const b = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    expect(String(a._id)).toBe(String(b._id));

    const count = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(count).toBe(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });

  test("acknowledging a generated Draft does NOT change the Contract's legal status/isCurrent", async () => {
    const { tenant, contract } = await seedDraft();

    await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });

    const fresh = await Contract.findById(contract._id).lean();
    expect(fresh.status).toBe("generated");
    expect(fresh.isCurrent).toBe(true);
    expect(fresh.tenantVisible).not.toBe(true);
    expect(fresh.finalDocument == null).toBe(true);
  });

  test("another tenant cannot acknowledge someone else's generated Draft", async () => {
    const { contract } = await seedDraft();
    await expect(
      acknowledgeContract({ contractId: contract._id, tenantId: new mongoose.Types.ObjectId(), req: fakeReq() }),
    ).rejects.toMatchObject({ code: "CONTRACT_ACCESS_DENIED", statusCode: 403 });
  });

  test("regenerating the Draft (new prepared version+hash) reverts status to Pending; old record preserved", async () => {
    const { actorId, tenant, contract } = await seedDraft();

    const original = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    let status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ acknowledged: true, documentKind: "draft", documentVersion: 1 });

    // Regenerate: supersede v1, add v2 with a new hash (what
    // generatePreparedContract does).
    await Contract.updateOne(
      { _id: contract._id },
      { $set: { "preparedDocuments.0.superseded": true } },
    );
    await Contract.updateOne(
      { _id: contract._id },
      {
        $push: {
          preparedDocuments: minimalPreparedDocument(actorId, {
            version: 2,
            fileHash: "draft-hash-v2",
            storageKey: "gil-puyat/2026/prepared_v2.pdf",
            fileName: "prepared_v2.pdf",
          }),
        },
      },
    );

    status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ required: true, acknowledged: false, documentKind: "draft", documentVersion: 2 });

    // Original v1 record still present, untouched.
    const stillThere = await ContractAcknowledgement.findById(original._id);
    expect(stillThere).toBeTruthy();
    expect(stillThere.documentVersion).toBe(1);

    // Acknowledging again creates a distinct v2 record.
    const second = await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });
    expect(String(second._id)).not.toBe(String(original._id));
    expect(second.documentVersion).toBe(2);
    const total = await ContractAcknowledgement.countDocuments({ contractId: contract._id, tenantId: tenant._id });
    expect(total).toBe(2);
  });

  test("once a final document exists it outranks the draft (kind flips to final, fresh acknowledgement)", async () => {
    // Draft acknowledged, then admin uploads the wet-signed final.
    const { actorId, tenant, contract } = await seedDraft();
    await acknowledgeContract({ contractId: contract._id, tenantId: tenant._id, req: fakeReq() });

    await Contract.updateOne(
      { _id: contract._id },
      { $set: { status: "published", tenantVisible: true, finalDocument: minimalFinalDocument(actorId) } },
    );

    const status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: tenant._id });
    expect(status).toMatchObject({ required: true, acknowledged: false, documentKind: "final", documentVersion: 1 });
  });
});
