/**
 * Proves the transactional rollback guarantee for the physical + Contract
 * cutover integration: if activateRoomTransferSuccessor fails AFTER
 * transferStayWorkflow's physical mutations have already been staged in
 * the same transaction, every one of those physical mutations is rolled
 * back — never a partial success.
 *
 * transferStayWorkflow's own pre-mutation validation (see
 * tenantActionService.transferCutover.integration.test.js) is deliberately
 * thorough enough that every realistic corrupt-data scenario is already
 * caught BEFORE physical mutation — which is correct/desirable, but means
 * a genuine post-mutation failure can't be reached through ordinary data
 * setup. This file mocks activateRoomTransferSuccessor itself (module
 * mock, not a stub of a fake — the exported function name and shape) to
 * force exactly that scenario, while resolveRoomTransferSuccessor stays
 * real so the legitimate pre-mutation validation still runs unchanged.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const mockActivateRoomTransferSuccessor = jest.fn(async () => {
  throw Object.assign(new Error("Forced Contract activation failure for rollback test"), {
    code: "FORCED_TEST_FAILURE",
    statusCode: 500,
  });
});

// jest's ESM mock factory cannot partially import from the module it's
// replacing, so resolveRoomTransferSuccessor's query is re-implemented
// here directly (kept in sync with the real implementation's semantics —
// abandoned-status exclusion + zero/one/many handling) so the legitimate
// pre-mutation validation in transferStayWorkflow still runs for real,
// while only activateRoomTransferSuccessor itself is forced to fail.
await jest.unstable_mockModule("../services/contractRoomTransferActivationService.js", () => ({
  activateRoomTransferSuccessor: mockActivateRoomTransferSuccessor,
  resolveRoomTransferSuccessor: async ({ predecessorContractId, session = null }) => {
    const { Contract } = await import("../models/index.js");
    const { ABANDONED_TRANSFER_SUCCESSOR_STATUSES } = await import("../services/contractService.js");
    const successors = await Contract.find({
      replacesContractId: predecessorContractId,
      contractPurpose: "replacement",
      status: { $nin: [...ABANDONED_TRANSFER_SUCCESSOR_STATUSES] },
    }).session(session);
    if (successors.length !== 1) {
      throw Object.assign(new Error("Unexpected successor count in rollback test"), { code: "TEST_SETUP_ERROR" });
    }
    return successors[0];
  },
}));

const { transferStayWorkflow } = await import("./tenantActionService.js");
const { generateContractNumber } = await import("../services/contractService.js");
const { Contract, Reservation, Room, User, Stay, BedHistory } = await import("../models/index.js");

jest.setTimeout(120_000);

describe("transferStayWorkflow rolls back physical mutations when Contract activation fails mid-transaction", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_cutover_rollback" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    mockActivateRoomTransferSuccessor.mockClear();
    await Promise.all([
      Reservation.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
      Contract.deleteMany({}),
      Stay.deleteMany({}),
      BedHistory.deleteMany({}),
    ]);
  });

  test("Room/Bed/Stay/BedHistory/Reservation all remain unchanged when Contract activation throws", async () => {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant", tenantStatus: "active",
    });
    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, currentOccupancy: 1, price: 6300,
      beds: [{ id: "bed-a1", position: "single", status: "occupied", occupiedBy: { userId: tenant._id, reservationId: null } }],
    });
    const roomB = await Room.create({
      name: "Room 101", roomNumber: "101", branch: "gil-puyat",
      type: "private", capacity: 1, currentOccupancy: 0, price: 14400,
      beds: [{ id: "bed-b1", position: "single", status: "available" }],
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      selectedBed: { id: "bed-a1" }, moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    roomA.beds[0].occupiedBy.reservationId = reservation._id;
    await roomA.save();
    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: "bed-a1",
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), monthlyRent: 6300, status: "active",
    });
    const bedHistory = await BedHistory.create({
      bedId: "bed-a1", roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: roomA.branch, moveInDate: new Date("2026-08-01T00:00:00.000Z"), status: "active",
    });
    const actorId = new mongoose.Types.ObjectId();
    const numberA = await generateContractNumber(roomA.branch, new Date());
    const predecessor = await Contract.create({
      ...numberA, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: "quadruple-sharing", leaseType: "long_term", status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });
    const numberB = await generateContractNumber(roomB.branch, new Date());
    await Contract.create({
      ...numberB, contractPurpose: "replacement", replacesContractId: predecessor._id,
      parentContractId: predecessor._id, tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, roomId: roomB._id, branch: roomB.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomB.roomNumber,
      roomType: "private", leaseType: "long_term", approvedMonthlyRate: 14400,
      status: "published", isCurrent: false,
      statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
      finalDocument: {
        storageKey: "gil-puyat/2026/transfer/final_v1.pdf", fileName: "final_v1.pdf",
        fileHash: "hash1", fileSize: 1024, mimeType: "application/pdf", pageCount: 4,
        sourceType: "admin_scan", sourceVersion: 1, sourceUploadedAt: new Date(),
        publishedAt: new Date(), publishedBy: actorId, tenantVisible: true,
      },
      createdBy: actorId, updatedBy: actorId,
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "FORCED_TEST_FAILURE" });

    expect(mockActivateRoomTransferSuccessor).toHaveBeenCalledTimes(1);

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedBedHistory, reloadedReservation, reloadedPredecessor] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      BedHistory.findById(bedHistory._id),
      Reservation.findById(reservation._id),
      Contract.findById(predecessor._id),
    ]);

    expect(String(reloadedStay.roomId)).toBe(String(roomA._id));
    expect(reloadedStay.bedId).toBe("bed-a1");
    expect(reloadedRoomA.beds[0].status).toBe("occupied");
    expect(reloadedRoomB.beds[0].status).toBe("available");
    expect(String(reloadedReservation.roomId)).toBe(String(roomA._id));
    expect(reloadedBedHistory.status).toBe("active");
    expect(reloadedPredecessor.status).toBe("active");
    expect(reloadedPredecessor.isCurrent).toBe(true);
  });
});
