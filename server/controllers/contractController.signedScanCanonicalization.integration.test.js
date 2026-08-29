/**
 * F5 — CANONICAL SIGNED CONTRACT VIEWER
 *
 * Real end-to-end coverage that the Admin "Official Digital Lease Contract ->
 * Signed Scan" viewer and the signed-version modal resolve the SAME wet-signed
 * file identity ({ contractId, version }), including the Room Transfer Addendum
 * case where the current canonical Contract has no scan of its own and the scan
 * is INHERITED from the original lease.
 *
 * Runs the real handlers (getTenantCurrentContract, getStayProofDataForAdmin)
 * against a real in-memory Mongo. Only auth is stood in (req.user.uid ->
 * User.firebaseUid), exactly as the sibling
 * tenantContractDocumentResolver.e2e.integration.test.js does.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

jest.setTimeout(120_000);

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { Contract, Reservation, Stay, User, Room } = await import("../models/index.js");
const { getTenantCurrentContract, getStayProofDataForAdmin } = await import("./contractController.js");

const ADMIN_UID = "admin-fb-uid";

let mongod;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "signed_scan_canon" });
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
beforeEach(async () => {
  await Promise.all([
    Contract.deleteMany({}),
    Reservation.deleteMany({}),
    Stay.deleteMany({}),
    User.deleteMany({}),
    Room.deleteMany({}),
  ]);
  await User.create({
    firebaseUid: ADMIN_UID,
    email: "admin@lilycrest.test",
    username: "admin_signed_scan",
    firstName: "Ad",
    lastName: "Min",
    role: "owner",
    branch: "gil-puyat",
  });
});

const res = () => ({
  statusCode: 200,
  body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

async function seedLineage({ withAddendum }) {
  const tenant = await User.create({
    firebaseUid: `t-${new mongoose.Types.ObjectId()}`,
    email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Val", lastName: "Tenant", role: "tenant", tenantStatus: "active",
  });
  const room = await Room.create({
    name: "GP-105", roomNumber: "105", branch: "gil-puyat",
    type: "private", capacity: 1, currentOccupancy: 1, price: 13500, beds: [],
  });
  const reservation = await Reservation.create({
    userId: tenant._id, roomId: room._id, status: "moveIn", leaseDuration: 12,
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: 13500, monthlyRent: 13500, moveInDate: new Date("2026-01-01"),
  });

  // Raw inserts — the Contract schema has many creation-time required fields
  // (createdBy, contractSequence, propertyAddress, per-doc fileHash/fileSize,
  // ...) that are irrelevant to what this test exercises (the signed-scan
  // lineage resolver + payload passthrough). Insert plain docs directly.
  const now = new Date("2026-01-05");
  const baseContract = () => ({
    tenantId: tenant._id,
    reservationId: reservation._id,
    roomId: room._id,
    branch: "gil-puyat",
    roomType: "private",
    roomNumber: "105",
    leaseType: "long_term",
    tenantLegalName: "Val Tenant",
    propertyName: "Lilycrest Dormitory",
    propertyAddress: "123 Gil Puyat Ave",
    contractYear: 2026,
    contractSequence: Math.floor(Math.random() * 1e6),
    createdBy: tenant._id,
    updatedBy: tenant._id,
    leaseStartDate: new Date("2026-01-01"),
    leaseEndDate: new Date("2026-12-31"),
    leaseDurationMonths: 12,
    approvedMonthlyRate: 13500,
    regularMonthlyRate: 15000,
    advanceRentAmount: 13500,
    securityDepositAmount: 13500,
    tenantVisible: true,
    createdAt: now,
    updatedAt: now,
  });

  const originalId = new mongoose.Types.ObjectId();
  await Contract.collection.insertOne({
    _id: originalId,
    ...baseContract(),
    contractNumber: "LIL-GP-2026-00091",
    contractPurpose: "initial",
    status: withAddendum ? "replaced" : "active",
    isCurrent: !withAddendum,
    signedDocuments: [
      {
        version: 1,
        fileName: "LIL-GP-2026-00091_signed_v1.pdf",
        mimeType: "application/pdf",
        storageKey: "contracts/signed/LIL-GP-2026-00091_v1.pdf",
        fileHash: "hash-v1",
        fileSize: 123456,
        preparedDocumentVersion: 1,
        uploadedBy: tenant._id,
        uploadedAt: now,
        superseded: false,
      },
    ],
    signedDocumentVersion: 1,
    finalDocument: {
      fileName: "LIL-GP-2026-00091_signed_v1.pdf",
      mimeType: "application/pdf",
      sourceType: "admin_scan",
      sourceVersion: 1,
      storageKey: "contracts/final/LIL-GP-2026-00091_v1.pdf",
      fileHash: "hash-v1",
      fileSize: 123456,
      pageCount: 3,
      publishedBy: tenant._id,
      publishedAt: now,
      sourceUploadedAt: now,
    },
    publishedAt: now,
  });
  const original = await Contract.findById(originalId);

  let current = original;
  if (withAddendum) {
    const addendumId = new mongoose.Types.ObjectId();
    await Contract.collection.insertOne({
      _id: addendumId,
      ...baseContract(),
      contractNumber: "LIL-GP-2026-00091-A1",
      contractPurpose: "amendment",
      status: "generated",
      isCurrent: true,
      parentContractId: originalId,
      replacesContractId: originalId,
      amendmentEffectiveDate: new Date("2026-06-01"),
      roomNumber: "301",
      approvedMonthlyRate: 5400,
    });
    current = await Contract.findById(addendumId);
  }

  await Stay.create({
    reservationId: reservation._id,
    tenantId: tenant._id,
    roomId: room._id,
    bedId: `room-${room._id}`,
    branch: "gil-puyat",
    status: "active",
    leaseStartDate: new Date("2026-01-01"),
    leaseEndDate: new Date("2026-12-31"),
    monthlyRent: withAddendum ? 5400 : 13500,
  });

  return { tenant, reservation, original, current };
}

describe("F5 — signed scan canonicalization", () => {
  test("current contract IS the wet-signed original -> signedScan points at it, not inherited", async () => {
    const { tenant, original } = await seedLineage({ withAddendum: false });
    const r = res();
    await getTenantCurrentContract(
      { params: { tenantId: String(tenant._id) }, user: { uid: ADMIN_UID }, branchFilter: null, id: "req" },
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(r.body.contract.signedScan).toMatchObject({
      contractId: String(original._id),
      version: 1,
      inherited: false,
      source: "admin_scan",
    });
    // `id` is present alongside `_id` for the viewer.
    expect(r.body.contract.id).toBe(String(original._id));
  });

  test("current contract is a Room Transfer Addendum -> signedScan INHERITED from the original lease", async () => {
    const { tenant, original, current } = await seedLineage({ withAddendum: true });
    const r = res();
    await getTenantCurrentContract(
      { params: { tenantId: String(tenant._id) }, user: { uid: ADMIN_UID }, branchFilter: null, id: "req" },
      r,
    );
    expect(r.statusCode).toBe(200);
    // The canonical current contract is the Addendum...
    expect(r.body.contract.id).toBe(String(current._id));
    // ...but the signed scan is resolved from the ORIGINAL lease and flagged.
    expect(r.body.contract.signedScan).toMatchObject({
      contractId: String(original._id),
      version: 1,
      inherited: true,
      inheritedFromContractId: String(original._id),
      inheritedFromContractNumber: "LIL-GP-2026-00091",
      source: "admin_scan",
    });
  });

  test("stay-proof-data returns the SAME signedScan identity as the current-contract payload", async () => {
    const { tenant, reservation, original } = await seedLineage({ withAddendum: true });

    const currentRes = res();
    await getTenantCurrentContract(
      { params: { tenantId: String(tenant._id) }, user: { uid: ADMIN_UID }, branchFilter: null, id: "req" },
      currentRes,
    );

    const proofRes = res();
    await getStayProofDataForAdmin(
      { params: { id: String(reservation._id) }, user: { uid: ADMIN_UID }, query: {}, id: "req" },
      proofRes,
    );

    expect(proofRes.statusCode).toBe(200);
    const proofScan = proofRes.body.stayProof.signedScan;
    const currentScan = currentRes.body.contract.signedScan;
    expect(proofScan).toBeTruthy();
    expect(proofScan.contractId).toBe(currentScan.contractId);
    expect(proofScan.contractId).toBe(String(original._id));
    expect(proofScan.version).toBe(currentScan.version);
    // stay-proof also carries a resolvable contractId for the viewer.
    expect(proofRes.body.stayProof.contractId).toBeTruthy();
  });

  test("Draft-only contract with no wet-signed scan anywhere -> signedScan is null", async () => {
    const tenant = await User.create({
      firebaseUid: `t-${new mongoose.Types.ObjectId()}`,
      email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
      username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "No", lastName: "Scan", role: "tenant", tenantStatus: "active",
    });
    const room = await Room.create({
      name: "GP-106", roomNumber: "106", branch: "gil-puyat",
      type: "private", capacity: 1, currentOccupancy: 1, price: 13500, beds: [],
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: room._id, status: "moveIn", leaseDuration: 12,
      agreedToPrivacy: true, agreedToCertification: true,
      totalPrice: 13500, monthlyRent: 13500, moveInDate: new Date("2026-01-01"),
    });
    const now = new Date("2026-01-05");
    await Contract.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenant._id, reservationId: reservation._id, roomId: room._id,
      branch: "gil-puyat", leaseType: "long_term",
      contractNumber: "LIL-GP-2026-00200", contractPurpose: "initial",
      status: "generated", isCurrent: true, tenantVisible: true,
      roomType: "private", roomNumber: "106",
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Gil Puyat Ave",
      contractYear: 2026, contractSequence: Math.floor(Math.random() * 1e6),
      createdBy: tenant._id, updatedBy: tenant._id,
      leaseStartDate: new Date("2026-01-01"), leaseEndDate: new Date("2026-12-31"),
      leaseDurationMonths: 12, approvedMonthlyRate: 13500, regularMonthlyRate: 15000,
      advanceRentAmount: 13500, securityDepositAmount: 13500,
      createdAt: now, updatedAt: now,
    });
    await Stay.create({
      reservationId: reservation._id, tenantId: tenant._id, roomId: room._id,
      bedId: `room-${room._id}`, branch: "gil-puyat", status: "active",
      leaseStartDate: new Date("2026-01-01"), leaseEndDate: new Date("2026-12-31"),
      monthlyRent: 13500,
    });

    const r = res();
    await getTenantCurrentContract(
      { params: { tenantId: String(tenant._id) }, user: { uid: ADMIN_UID }, branchFilter: null, id: "req" },
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(r.body.contract.signedScan).toBeNull();
  });
});
