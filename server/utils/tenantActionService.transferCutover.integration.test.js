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
import { Contract, Reservation, Room, User, Stay, BedHistory } from "../models/index.js";

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
      roomType: "quadruple-sharing", leaseType: "long_term", status: "active", isCurrent: true,
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

  test("successful integrated transfer: physical state moves to Room B AND Contract cutover happens in the same call", async () => {
    const { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, actorId } = await seedScenario();
    const successor = await seedSuccessor({ predecessor, tenant, roomB, reservation, actorId });

    const result = await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1" },
      actorId,
    });

    expect(result.contractCutover.successorStatus).toBe("active");
    expect(result.contractCutover.predecessorStatus).toBe("replaced");

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedPredecessor, reloadedSuccessor, reloadedBedHistory, reloadedReservation] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      Contract.findById(predecessor._id),
      Contract.findById(successor._id),
      BedHistory.findById(bedHistory._id),
      Reservation.findById(reservation._id),
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
