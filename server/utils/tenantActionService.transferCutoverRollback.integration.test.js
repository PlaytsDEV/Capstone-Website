/**
 * Proves the transactional rollback guarantee for the one-step room
 * transfer: if the Contract cutover (activateRoomTransferSuccessorDraft)
 * fails AFTER transferStayWorkflow's physical mutations have already been
 * staged in the same transaction, every one of those physical mutations is
 * rolled back — never a partial success.
 *
 * The replacement Contract Draft is prepared in Stage A BEFORE the
 * transaction; a rollback of the transaction below correctly leaves that
 * prepared-but-not-current Draft in place (the retry-reuse case), so the
 * predecessor stays the tenant's active/current Contract and no physical
 * state moved.
 *
 * activateRoomTransferSuccessorDraft is module-mocked to force the
 * post-mutation failure; resolveRoomTransferSuccessor stays real so the
 * legitimate pre-cutover validation still runs unchanged.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const mockActivateDraft = jest.fn(async () => {
  throw Object.assign(new Error("Forced Contract activation failure for rollback test"), {
    code: "FORCED_TEST_FAILURE",
    statusCode: 500,
  });
});

await jest.unstable_mockModule("../services/contractRoomTransferActivationService.js", () => ({
  activateRoomTransferSuccessor: jest.fn(),
  activateRoomTransferSuccessorDraft: mockActivateDraft,
  resolveRoomTransferSuccessor: async ({ predecessorContractId, session = null }) => {
    const { Contract } = await import("../models/index.js");
    const { ABANDONED_TRANSFER_SUCCESSOR_STATUSES } = await import("../services/contractService.js");
    const successors = await Contract.find({
      replacesContractId: predecessorContractId,
      contractPurpose: { $in: ["amendment", "replacement"] },
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
const { Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings } = await import("../models/index.js");

jest.setTimeout(120_000);

describe("transferStayWorkflow rolls back physical mutations when the Contract cutover fails mid-transaction", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_cutover_rollback_v2" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    mockActivateDraft.mockClear();
    await Promise.all([
      Reservation.deleteMany({}), Room.deleteMany({}), User.deleteMany({}),
      Contract.deleteMany({}), Stay.deleteMany({}), BedHistory.deleteMany({}), Bill.deleteMany({}),
      BusinessSettings.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global", isDiscountEnabled: true, longTermLeaseMinMonths: 6,
      officeHoursStartMinutes: 0, officeHoursEndMinutes: 1440, officeDaysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    });
  });

  // Seed a moved-in tenant + a pre-prepared "generated" replacement Draft
  // for the given source/destination room types (so Stage A reuses the
  // Draft and no PDF generation is needed here).
  async function seedForRollback({ sourceType, destType, sourceBed, destBed }) {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant", tenantStatus: "active",
    });
    const needsBed = (t) => t === "double-sharing" || t === "quadruple-sharing";
    const cap = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };

    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: sourceType, capacity: cap[sourceType], currentOccupancy: 1, price: 6300,
      beds: needsBed(sourceType)
        ? [{ id: sourceBed, position: "lower", status: "occupied", occupiedBy: { userId: tenant._id, reservationId: null } }]
        : [],
    });
    const roomB = await Room.create({
      name: "Room 305", roomNumber: "305", branch: "gil-puyat",
      type: destType, capacity: cap[destType], currentOccupancy: 0, price: 14400,
      beds: needsBed(destType) ? [{ id: destBed, position: "lower", status: "available" }] : [],
    });

    const srcStayBedId = needsBed(sourceType) ? sourceBed : `room-${roomA._id}`;
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: sourceType,
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      selectedBed: { id: needsBed(sourceType) ? sourceBed : "" },
      moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    if (needsBed(sourceType)) {
      roomA.beds[0].occupiedBy.reservationId = reservation._id;
      await roomA.save();
    }
    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: srcStayBedId,
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), monthlyRent: 6300, status: "active",
    });
    let bedHistory = null;
    if (needsBed(sourceType)) {
      bedHistory = await BedHistory.create({
        bedId: sourceBed, roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
        stayId: stay._id, branch: roomA.branch, moveInDate: new Date("2026-08-01T00:00:00.000Z"), status: "active",
      });
    }
    const actorId = new mongoose.Types.ObjectId();
    const numberA = await generateContractNumber(roomA.branch, new Date());
    const predecessor = await Contract.create({
      ...numberA, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: sourceType, leaseType: "long_term", approvedMonthlyRate: 6300,
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), leaseDurationMonths: 6,
      status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });
    const numberB = await generateContractNumber(roomB.branch, new Date());
    const successor = await Contract.create({
      ...numberB, contractPurpose: "amendment", replacesContractId: predecessor._id,
      parentContractId: predecessor._id, tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomB._id, branch: roomB.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomB.roomNumber,
      roomType: destType, leaseType: "long_term", approvedMonthlyRate: 14400,
      bedId: needsBed(destType) ? destBed : "",
      leaseStartDate: new Date("2026-08-15T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), leaseDurationMonths: 6,
      status: "generated", isCurrent: false, tenantVisible: true,
      statusHistory: [{ status: "generated", changedBy: actorId, reason: "seed prepared draft" }],
      createdBy: actorId, updatedBy: actorId,
    });

    return { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, successor, actorId, srcStayBedId };
  }

  test("cross-type Double -> Private: cutover failure rolls back every physical mutation", async () => {
    const { roomA, roomB, reservation, stay, bedHistory, predecessor, successor, actorId } =
      await seedForRollback({ sourceType: "double-sharing", destType: "private", sourceBed: "bed-a1" });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "FORCED_TEST_FAILURE" });

    expect(mockActivateDraft).toHaveBeenCalledTimes(1);

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedBedHistory, reloadedReservation, reloadedPredecessor, reloadedSuccessor, settlementBills, activeBedHistories] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      BedHistory.findById(bedHistory._id),
      Reservation.findById(reservation._id),
      Contract.findById(predecessor._id),
      Contract.findById(successor._id),
      Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" }),
      BedHistory.find({ stayId: stay._id, status: "active" }),
    ]);

    expect(String(reloadedStay.roomId)).toBe(String(roomA._id));
    expect(reloadedStay.bedId).toBe("bed-a1");
    expect(reloadedRoomA.beds.find((b) => b.id === "bed-a1").status).toBe("occupied");
    expect(reloadedRoomA.currentOccupancy).toBe(1);
    expect(reloadedRoomB.currentOccupancy).toBe(0);
    expect(String(reloadedReservation.roomId)).toBe(String(roomA._id));
    expect(reloadedBedHistory.status).toBe("active");
    expect(activeBedHistories).toHaveLength(1);
    expect(settlementBills).toHaveLength(0);
    expect(reloadedPredecessor.status).toBe("active");
    expect(reloadedPredecessor.isCurrent).toBe(true);
    expect(reloadedSuccessor.status).toBe("generated");
    expect(reloadedSuccessor.isCurrent).toBe(false);
  });

  test("cross-type Private -> Double: cutover failure rolls back every physical mutation", async () => {
    const { roomA, roomB, reservation, stay, predecessor, successor, actorId, srcStayBedId } =
      await seedForRollback({ sourceType: "private", destType: "double-sharing", destBed: "bed-b1" });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "FORCED_TEST_FAILURE" });

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedReservation, reloadedPredecessor, reloadedSuccessor, settlementBills] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      Reservation.findById(reservation._id),
      Contract.findById(predecessor._id),
      Contract.findById(successor._id),
      Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" }),
    ]);

    expect(String(reloadedStay.roomId)).toBe(String(roomA._id));
    expect(reloadedStay.bedId).toBe(srcStayBedId); // private sentinel, unchanged
    expect(reloadedRoomA.currentOccupancy).toBe(1);
    expect(reloadedRoomB.beds.find((b) => b.id === "bed-b1").status).toBe("available");
    expect(reloadedRoomB.currentOccupancy).toBe(0);
    expect(String(reloadedReservation.roomId)).toBe(String(roomA._id));
    expect(settlementBills).toHaveLength(0);
    expect(reloadedPredecessor.status).toBe("active");
    expect(reloadedPredecessor.isCurrent).toBe(true);
    expect(reloadedSuccessor.status).toBe("generated");
    expect(reloadedSuccessor.isCurrent).toBe(false);
  });
});
