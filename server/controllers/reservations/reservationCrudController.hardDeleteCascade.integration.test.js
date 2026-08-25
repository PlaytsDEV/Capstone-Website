/**
 * PR 3 — Orphan Lifecycle / Cleanup Safety regression test.
 *
 * Root cause: deleteReservation's hard-delete branch (owner-only, requires
 * the reservation already be archived) permanently removed the Reservation
 * document without ever touching any Contract still referencing it —
 * exactly the mechanism a production audit found responsible for orphaned
 * Contract records (including one that had reached "generated" /
 * publicationStatus "ready_for_resident" with a real prepared PDF, pointing
 * at a Reservation/tenant that no longer existed).
 *
 * This proves: (1) an early-stage Contract is archived automatically before
 * the reservation is deleted, so no orphan is created; (2) a Contract with
 * real signed-document evidence blocks the hard delete entirely instead of
 * being silently archived or silently orphaned.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

jest.setTimeout(60_000);

await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: jest.fn(), logError: jest.fn(), logModification: jest.fn() },
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../../services/occupancy/occupancyManager.js", () => ({
  default: {},
  releaseOrphanedBeds: jest.fn().mockResolvedValue(undefined),
  recalculateRoomOccupancy: jest.fn().mockResolvedValue(undefined),
  updateOccupancyOnReservationChange: jest.fn().mockResolvedValue(undefined),
  deriveRoomOccupancyState: jest.fn(),
  getRoomOccupancyStatus: jest.fn(),
  getBranchOccupancyStats: jest.fn(),
  getDisplayStatusForReservation: jest.fn(),
}));

const { deleteReservation } = await import("./reservationCrudController.js");
const { Contract, Reservation, Room, User } = await import("../../models/index.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("deleteReservation hard-delete cascades to Contract instead of orphaning it", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "reservation_hard_delete_cascade" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      Reservation.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
      Contract.deleteMany({}),
    ]);
  });

  async function seed() {
    const owner = await User.create({
      firebaseUid: `owner-${new mongoose.Types.ObjectId()}`,
      email: `owner-${new mongoose.Types.ObjectId()}@example.test`,
      username: `owner_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Owner", lastName: "User", role: "owner",
    });
    const tenant = await User.create({
      firebaseUid: `tenant-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant",
    });
    const room = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, price: 6000,
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: room._id, status: "archived", isArchived: true,
      leaseDuration: 3, reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6000,
      monthlyRent: 6000,
    });
    return { owner, tenant, room, reservation };
  }

  const req = (owner, reservationId) => ({
    id: `hard-delete-${Math.random()}`,
    params: { reservationId: String(reservationId) },
    query: { hardDelete: "true" },
    user: { uid: owner.firebaseUid },
  });

  test("archives an early-stage Contract and proceeds with the delete — no orphan left", async () => {
    const { owner, tenant, room, reservation } = await seed();
    const contract = await Contract.create({
      contractNumber: `LIL-TEST-${Date.now()}`,
      branch: room.branch,
      reservationId: reservation._id,
      tenantId: tenant._id,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomType: room.type,
      propertyName: "Test Property",
      propertyAddress: "123 Test St",
      leaseType: "short_term",
      status: "draft",
      isCurrent: true,
      contractYear: 2026,
      contractSequence: 1,
      createdBy: tenant._id,
      updatedBy: tenant._id,
    });

    const res = response();
    await deleteReservation(req(owner, reservation._id), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.hardDeleted).toBe(true);

    const reloadedReservation = await Reservation.findById(reservation._id);
    expect(reloadedReservation).toBeNull();

    const reloadedContract = await Contract.findById(contract._id);
    expect(reloadedContract).not.toBeNull();
    expect(reloadedContract.archivedAt).not.toBeNull();
    expect(reloadedContract.status).toBe("voided");
    expect(reloadedContract.isCurrent).toBe(false);
    // The Contract survives, archived, with its reservationId intact — no
    // longer "current" or tenant-visible, but never a silent orphan either.
    expect(String(reloadedContract.reservationId)).toBe(String(reservation._id));
  });

  test("blocks the hard delete when a Contract has a signed document instead of silently orphaning it", async () => {
    const { owner, tenant, room, reservation } = await seed();
    const contract = await Contract.create({
      contractNumber: `LIL-TEST-${Date.now()}`,
      branch: room.branch,
      reservationId: reservation._id,
      tenantId: tenant._id,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomType: room.type,
      propertyName: "Test Property",
      propertyAddress: "123 Test St",
      leaseType: "short_term",
      status: "signed",
      isCurrent: true,
      contractYear: 2026,
      contractSequence: 2,
      createdBy: tenant._id,
      updatedBy: tenant._id,
      signedDocuments: [{
        version: 1,
        storageKey: "contracts/placeholder/signed.pdf",
        preparedDocumentVersion: 1,
        uploadedBy: tenant._id,
        uploadedAt: new Date(),
        mimeType: "application/pdf",
        fileSize: 1024,
        fileHash: "deadbeef",
        fileName: "signed.pdf",
      }],
    });

    const res = response();
    await deleteReservation(req(owner, reservation._id), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("RESERVATION_HARD_DELETE_BLOCKED_BY_CONTRACT");
    expect(res.body.blockers).toEqual([
      expect.objectContaining({ contractId: contract._id, reasons: expect.arrayContaining(["signedDocuments"]) }),
    ]);

    // Nothing was touched — reservation and contract both remain exactly as they were.
    const reloadedReservation = await Reservation.findById(reservation._id);
    expect(reloadedReservation).not.toBeNull();
    const reloadedContract = await Contract.findById(contract._id);
    expect(reloadedContract.archivedAt).toBeNull();
    expect(reloadedContract.status).toBe("signed");
  });
});
