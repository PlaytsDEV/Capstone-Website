/**
 * Integration test for the physical room-transfer + Contract cutover
 * integration: transferStayWorkflow (server/utils/tenantActionService.js)
 * now resolves and validates the room-transfer replacement Contract BEFORE
 * any physical mutation, and calls
 * contractRoomTransferActivationService.activateRoomTransferSuccessor as
 * the last step of its own transaction — so physical transfer and Contract
 * cutover succeed or fail together, never independently.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet —
 * transferStayWorkflow runs inside a genuine Mongo transaction.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { transferStayWorkflow } from "./tenantActionService.js";
import { generateContractNumber } from "../services/contractService.js";
import { Contract, Reservation, Room, User, Stay, BedHistory, Bill } from "../models/index.js";

jest.setTimeout(120_000);

describe("transferStayWorkflow + Contract cutover integration", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_cutover_integration" });
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
      Stay.deleteMany({}),
      BedHistory.deleteMany({}),
    ]);
  });

  async function seedScenario() {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant", tenantStatus: "active",
    });
    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, currentOccupancy: 1,
      price: 6300,
      beds: [{ id: "bed-a1", position: "single", status: "occupied", occupiedBy: { userId: tenant._id, reservationId: null } }],
    });
    const roomB = await Room.create({
      name: "Room 101", roomNumber: "101", branch: "gil-puyat",
      type: "private", capacity: 1, currentOccupancy: 0,
      price: 14400,
      beds: [{ id: "bed-b1", position: "single", status: "available" }],
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      selectedBed: { id: "bed-a1" },
      moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    // occupyBed on roomA references the reservation now that it exists.
    roomA.beds[0].occupiedBy.reservationId = reservation._id;
    await roomA.save();

    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: "bed-a1",
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      monthlyRent: 6300, status: "active",
    });
    const bedHistory = await BedHistory.create({
      bedId: "bed-a1", roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: roomA.branch, moveInDate: new Date("2026-08-01T00:00:00.000Z"),
      status: "active",
    });

    const actorId = new mongoose.Types.ObjectId();
    const numberA = await generateContractNumber(roomA.branch, new Date());
    const predecessor = await Contract.create({
      ...numberA, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: "quadruple-sharing", leaseType: "long_term", approvedMonthlyRate: 6300,
      status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });

    return { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, actorId };
  }

  const minimalFinalDocument = (actorId) => ({
    storageKey: "gil-puyat/2026/transfer/final_v1.pdf", fileName: "final_v1.pdf",
    fileHash: "hash1", fileSize: 1024, mimeType: "application/pdf", pageCount: 4,
    sourceType: "admin_scan", sourceVersion: 1, sourceUploadedAt: new Date(),
    publishedAt: new Date(), publishedBy: actorId, tenantVisible: true,
  });

  async function seedSuccessor({ predecessor, tenant, roomB, reservation, actorId, overrides = {} }) {
    const number = await generateContractNumber(roomB.branch, new Date());
    return Contract.create({
      ...number, contractPurpose: "replacement", replacesContractId: predecessor._id,
      parentContractId: predecessor._id, tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, roomId: roomB._id, branch: roomB.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomB.roomNumber,
      roomType: "private", leaseType: "long_term", approvedMonthlyRate: 14400,
      status: "published", isCurrent: false,
      statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
      finalDocument: minimalFinalDocument(actorId),
      createdBy: actorId, updatedBy: actorId,
      ...overrides,
    });
  }

  test("successful integrated transfer: physical state moves to Room B, Contract cutover happens, and the rent settlement is correct", async () => {
    const { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, actorId } = await seedScenario();
    const successor = await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    const result = await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    expect(result.contractCutover.successorStatus).toBe("active");
    expect(result.contractCutover.predecessorStatus).toBe("replaced");

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedPredecessor, reloadedSuccessor, reloadedBedHistory, reloadedReservation, transferBill] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      Contract.findById(predecessor._id),
      Contract.findById(successor._id),
      BedHistory.findById(bedHistory._id),
      Reservation.findById(reservation._id),
      Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" }),
    ]);

    expect(String(reloadedStay.roomId)).toBe(String(roomB._id));
    expect(reloadedStay.bedId).toBe("bed-b1");
    expect(reloadedRoomA.beds[0].status).toBe("available");
    expect(reloadedRoomB.beds[0].status).toBe("occupied");
    expect(String(reloadedReservation.roomId)).toBe(String(roomB._id));

    expect(reloadedPredecessor.status).toBe("replaced");
    expect(reloadedPredecessor.isCurrent).toBe(false);
    expect(reloadedSuccessor.status).toBe("active");
    expect(reloadedSuccessor.isCurrent).toBe(true);
    expect(String(reloadedPredecessor.supersededByContractId)).toBe(String(successor._id));

    expect(reloadedBedHistory.status).toBe("transferred");

    // Future rent must bill the destination room's approved rate.
    expect(reloadedReservation.monthlyRent).toBe(14400);

    // moveIn Aug 1, transfer Aug 15 -> the current rent cycle is Aug1-Sep1
    // (31 days): 14 source days, 17 destination days — same numbers as the
    // pure-function unit test's worked example.
    expect(transferBill).toBeTruthy();
    expect(transferBill.proRataDays).toBe(14);
    expect(transferBill.transferSnapshot.totalCoverageDays).toBe(31);
    expect(transferBill.transferSnapshot.destinationDays).toBe(17);
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(6300);
    expect(transferBill.transferSnapshot.destinationApprovedRate).toBe(14400);
    // sourceConsumedValue (proRataRent) + unusedPrepaidCredit reconciles to 6300.
    expect(transferBill.transferSnapshot.proRataRent + transferBill.transferSnapshot.unusedPrepaidCredit)
      .toBeCloseTo(6300, 2);
    // Higher-priced destination -> additional amount due, no excess credit.
    expect(transferBill.charges.rent).toBeGreaterThan(0);
    expect(transferBill.charges.rent).toBe(transferBill.transferSnapshot.additionalAmountDue);
    expect(transferBill.transferSnapshot.excessCredit).toBe(0);
    expect(transferBill.status).toBe("pending");
  });

  test("a Room master-price change between Contract-B approval and execution does not alter the settlement", async () => {
    const { tenant, roomA, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId }); // approvedMonthlyRate: 14400

    await Room.updateOne({ _id: roomB._id }, { $set: { price: 20000 } });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.destinationApprovedRate).toBe(14400);
  });

  test("lower-priced destination room: excess credit is recorded, no additional amount due, no charges.rent", async () => {
    const { tenant, roomA, reservation, predecessor, actorId } = await seedScenario();
    const roomC = await Room.create({
      name: "Room 202", roomNumber: "202", branch: "gil-puyat",
      type: "double-sharing", capacity: 2, currentOccupancy: 0,
      price: 4000, beds: [{ id: "bed-c1", position: "single", status: "available" }],
    });
    await seedSuccessor({
      predecessor, tenant, roomB: roomC, reservation, actorId,
      overrides: { approvedMonthlyRate: 4000 },
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomC._id, targetBedId: "bed-c1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.charges.rent).toBe(0);
    expect(transferBill.transferSnapshot.excessCredit).toBeGreaterThan(0);
    expect(transferBill.transferSnapshot.additionalAmountDue).toBe(0);
  });

  test("preserves an existing outstanding balance and does not rewrite a prior historical Bill", async () => {
    const { tenant, roomA, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    const priorBill = await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: tenant._id,
      branch: roomA.branch, roomId: roomA._id, billingMonth: new Date("2026-07-01T00:00:00.000Z"),
      billingCycleStart: new Date("2026-07-01T00:00:00.000Z"), billingCycleEnd: new Date("2026-08-01T00:00:00.000Z"),
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 6300, grossAmount: 6300, remainingAmount: 6300, paidAmount: 0, status: "pending",
    });
    const priorBillSnapshotBefore = priorBill.toObject();

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z", forceOverride: true,
      },
      actorId,
    });

    const reloadedPriorBill = await Bill.findById(priorBill._id);
    expect(reloadedPriorBill.charges.rent).toBe(priorBillSnapshotBefore.charges.rent);
    expect(reloadedPriorBill.totalAmount).toBe(priorBillSnapshotBefore.totalAmount);
    expect(reloadedPriorBill.remainingAmount).toBe(priorBillSnapshotBefore.remainingAmount);
    expect(reloadedPriorBill.status).toBe(priorBillSnapshotBefore.status);
  });

  test("does not reset the tenant's recurring due-date/billing-cycle anchor (moveInDate unchanged)", async () => {
    const { roomB, reservation, predecessor, tenant, actorId } = await seedScenario();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });
    const moveInDateBefore = new Date(reservation.moveInDate).toISOString();

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-18T00:00:00.000Z",
      },
      actorId,
    });

    const reloadedReservation = await Reservation.findById(reservation._id);
    expect(new Date(reloadedReservation.moveInDate).toISOString()).toBe(moveInDateBefore);
  });

  test("retrying the same transfer request after success does not create a second transfer-settlement Bill", async () => {
    const { tenant, roomA, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    // Existing physical-transfer idempotency guard (SAME_TRANSFER_TARGET,
    // proven in Phase 3B) rejects an immediate retry to the same room/bed —
    // preserved here, not re-implemented. forceOverride bypasses the (also
    // pre-existing, unrelated) outstanding-balance guard, which would
    // otherwise fire first since the just-created settlement Bill is itself
    // an outstanding balance.
    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z", forceOverride: true,
      },
      actorId,
    })).rejects.toMatchObject({ code: "SAME_TRANSFER_TARGET" });

    const settlementBills = await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(settlementBills).toHaveLength(1);
  });

  test("blocks the transfer with zero physical mutation when the replacement Contract has no final document", async () => {
    const { tenant, roomA, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({
      predecessor, tenant, roomB, reservation, actorId,
      overrides: { status: "awaiting_signatures", finalDocument: null },
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_NOT_FINAL" });

    const [reloadedRoomA, reloadedRoomB, reloadedPredecessor] = await Promise.all([
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      Contract.findById(predecessor._id),
    ]);
    expect(reloadedRoomA.beds[0].status).toBe("occupied");
    expect(reloadedRoomB.beds[0].status).toBe("available");
    expect(reloadedPredecessor.status).toBe("active");
    expect(reloadedPredecessor.isCurrent).toBe(true);
  });

  test("blocks the transfer when no replacement Contract was ever prepared", async () => {
    const { roomB, reservation, actorId } = await seedScenario();

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_NOT_PREPARED" });
  });

  test("blocks the transfer when the prepared Contract is cancelled", async () => {
    const { tenant, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({
      predecessor, tenant, roomB, reservation, actorId,
      overrides: { status: "cancelled" },
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_NOT_PREPARED" });
  });

  test("blocks the transfer when the predecessor Contract is no longer active/current", async () => {
    const { tenant, roomB, reservation, predecessor, actorId } = await seedScenario();
    predecessor.status = "replaced";
    predecessor.isCurrent = false;
    await predecessor.save();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_PREDECESSOR_NOT_ACTIVE" });
  });

  test("blocks the transfer with MULTIPLE_TRANSFER_SUCCESSORS when more than one prepared Contract exists", async () => {
    const { tenant, roomB, reservation, predecessor, actorId } = await seedScenario();
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });
    await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "MULTIPLE_TRANSFER_SUCCESSORS" });
  });

  test("blocks the transfer when the prepared Contract's room does not match the requested destination", async () => {
    const { tenant, roomB, reservation, predecessor, actorId } = await seedScenario();
    const roomC = await Room.create({
      name: "Room 202", roomNumber: "202", branch: "gil-puyat",
      type: "double-sharing", capacity: 2, currentOccupancy: 0,
      price: 8000, beds: [{ id: "bed-c1", position: "single", status: "available" }],
    });
    // Prepared Contract targets Room C, but the admin executes a transfer to Room B.
    await seedSuccessor({ predecessor, tenant, roomB: roomC, reservation, actorId });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_ROOM_MISMATCH" });
  });
});
