/**
 * Integration test for contractRoomTransferActivationService.activateRoomTransferSuccessor.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet because the
 * activation transitions run inside a genuine Mongo transaction.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  activateRoomTransferSuccessor,
  resolveRoomTransferSuccessor,
} from "./contractRoomTransferActivationService.js";
import { generateContractNumber } from "./contractService.js";
import { Contract, Reservation, Room, User, Stay, BedHistory } from "../models/index.js";

jest.setTimeout(120_000);

describe("contractRoomTransferActivationService.activateRoomTransferSuccessor", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "room_transfer_activation" });
    await Contract.syncIndexes();
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

  async function seedTenantRoomReservation() {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant",
    });
    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, price: 6300,
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: "bed-1",
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      monthlyRent: 6300, status: "active",
    });
    const bedHistory = await BedHistory.create({
      bedId: "bed-1", roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: roomA.branch, moveInDate: new Date("2026-08-01T00:00:00.000Z"),
      status: "active",
    });
    return { tenant, roomA, reservation, stay, bedHistory };
  }

  async function createContract({ tenant, room, reservation, stay, actorId, overrides = {} }) {
    const number = await generateContractNumber(room.branch, new Date());
    return Contract.create({
      ...number,
      contractPurpose: "initial",
      tenantId: tenant._id,
      applicationId: reservation._id,
      reservationId: reservation._id,
      stayId: stay._id,
      roomId: room._id,
      branch: room.branch,
      propertyName: "Lilycrest Dormitory",
      propertyAddress: "123 Test St.",
      roomNumber: room.roomNumber,
      roomType: "quadruple-sharing",
      leaseType: "long_term",
      status: "active",
      isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId,
      updatedBy: actorId,
      ...overrides,
    });
  }

  const minimalFinalDocument = (actorId) => ({
    storageKey: "gil-puyat/2026/transfer/final_v1.pdf",
    fileName: "final_v1.pdf",
    fileHash: "hash1",
    fileSize: 1024,
    mimeType: "application/pdf",
    pageCount: 4,
    sourceType: "admin_scan",
    sourceVersion: 1,
    sourceUploadedAt: new Date(),
    publishedAt: new Date(),
    publishedBy: actorId,
    tenantVisible: true,
  });

  test("activates a final, published successor and supersedes the predecessor atomically, leaving Stay/Room/Bed untouched", async () => {
    const { tenant, roomA, reservation, stay, bedHistory } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        parentContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        approvedMonthlyRate: 14400,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const result = await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId });
    expect(result.activated).toBe(true);

    const [reloadedOld, reloadedSuccessor, reloadedStay, reloadedBedHistory] = await Promise.all([
      Contract.findById(oldContract._id),
      Contract.findById(successor._id),
      Stay.findById(stay._id),
      BedHistory.findById(bedHistory._id),
    ]);

    expect(reloadedSuccessor.status).toBe("active");
    expect(reloadedSuccessor.isCurrent).toBe(true);
    expect(reloadedOld.status).toBe("replaced");
    expect(reloadedOld.isCurrent).toBe(false);
    expect(String(reloadedOld.supersededByContractId)).toBe(String(successor._id));

    // Contract-only: physical occupancy state is never touched.
    expect(reloadedStay.status).toBe("active");
    expect(String(reloadedStay.roomId)).toBe(String(roomA._id));
    expect(reloadedBedHistory.status).toBe("active");
  });

  test("activates a successor when the predecessor has published status (final wet-signed contract)", async () => {
    const { tenant, roomA, reservation, stay, bedHistory } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        status: "published",
        isCurrent: true,
        finalDocument: minimalFinalDocument(actorId),
      },
    });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        parentContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        approvedMonthlyRate: 14400,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const result = await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId });
    expect(result.activated).toBe(true);

    const [reloadedOld, reloadedSuccessor] = await Promise.all([
      Contract.findById(oldContract._id),
      Contract.findById(successor._id),
    ]);

    expect(reloadedSuccessor.status).toBe("active");
    expect(reloadedSuccessor.isCurrent).toBe(true);
    expect(reloadedOld.status).toBe("replaced");
    expect(reloadedOld.isCurrent).toBe(false);
  });

  test("is idempotent — re-running on an already-active successor is a safe no-op", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "published",
        statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const first = await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId });
    expect(first.activated).toBe(true);

    const second = await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId });
    expect(second.activated).toBe(false);
    expect(second.alreadyActive).toBe(true);

    const reloadedSuccessor = await Contract.findById(successor._id);
    expect(reloadedSuccessor.statusHistory.filter((h) => h.status === "active")).toHaveLength(1);
    const reloadedOld = await Contract.findById(oldContract._id);
    expect(reloadedOld.statusHistory.filter((h) => h.status === "replaced")).toHaveLength(1);
  });

  test("refuses to activate a successor with no final wet-signed document", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "awaiting_signatures",
        isCurrent: false,
        finalDocument: null,
      },
    });

    await expect(activateRoomTransferSuccessor({ successorContractId: successor._id, actorId }))
      .rejects.toMatchObject({ code: "TRANSFER_SUCCESSOR_NOT_FINAL" });

    const reloadedOld = await Contract.findById(oldContract._id);
    expect(reloadedOld.status).toBe("active");
    expect(reloadedOld.isCurrent).toBe(true);
  });

  test("refuses to activate a cancelled successor", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "cancelled",
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    await expect(activateRoomTransferSuccessor({ successorContractId: successor._id, actorId }))
      .rejects.toMatchObject({ code: "TRANSFER_SUCCESSOR_NOT_FINAL" });

    const reloadedOld = await Contract.findById(oldContract._id);
    expect(reloadedOld.status).toBe("active");
  });

  test("refuses to activate when the predecessor relationship is missing or invalid", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const orphanSuccessor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: null,
        status: "published",
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    await expect(activateRoomTransferSuccessor({ successorContractId: orphanSuccessor._id, actorId }))
      .rejects.toMatchObject({ code: "TRANSFER_PREDECESSOR_REQUIRED" });
  });

  test("refuses to activate when the predecessor is no longer active/current", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: { status: "replaced", isCurrent: false },
    });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    await expect(activateRoomTransferSuccessor({ successorContractId: successor._id, actorId }))
      .rejects.toMatchObject({ code: "TRANSFER_PREDECESSOR_NOT_ACTIVE" });
  });

  test("rejects a Contract that is not a room-transfer replacement successor", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const renewalSuccessor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: { contractPurpose: "renewal", status: "published", isCurrent: false },
    });

    await expect(activateRoomTransferSuccessor({ successorContractId: renewalSuccessor._id, actorId }))
      .rejects.toMatchObject({ code: "NOT_A_TRANSFER_SUCCESSOR" });
  });

  test("participates in a caller-supplied session — an outer transaction rollback undoes the Contract cutover too", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const callerSession = await mongoose.startSession();
    try {
      await expect(callerSession.withTransaction(async () => {
        const result = await activateRoomTransferSuccessor({
          successorContractId: successor._id, actorId, session: callerSession,
        });
        expect(result.activated).toBe(true);
        // Force the outer transaction to abort after the cutover already
        // ran — proves activateRoomTransferSuccessor did not independently
        // commit its own session when one was supplied.
        throw new Error("forced-outer-rollback");
      })).rejects.toThrow("forced-outer-rollback");
    } finally {
      await callerSession.endSession();
    }

    const [reloadedOld, reloadedSuccessor] = await Promise.all([
      Contract.findById(oldContract._id),
      Contract.findById(successor._id),
    ]);
    expect(reloadedOld.status).toBe("active");
    expect(reloadedOld.isCurrent).toBe(true);
    expect(reloadedSuccessor.status).toBe("published");
    expect(reloadedSuccessor.isCurrent).toBe(false);
  });

  test("with a session supplied, still activates successfully when the caller commits", async () => {
    const { tenant, roomA, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createContract({ tenant, room: roomA, reservation, stay, actorId });
    const successor = await createContract({
      tenant, room: roomA, reservation, stay, actorId,
      overrides: {
        contractPurpose: "replacement",
        replacesContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const callerSession = await mongoose.startSession();
    try {
      await callerSession.withTransaction(async () => {
        await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId, session: callerSession });
      });
    } finally {
      await callerSession.endSession();
    }

    const reloadedSuccessor = await Contract.findById(successor._id);
    expect(reloadedSuccessor.status).toBe("active");
    expect(reloadedSuccessor.isCurrent).toBe(true);
  });
});

describe("resolveRoomTransferSuccessor", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "room_transfer_resolver" });
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

  async function seed() {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant",
    });
    const room = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, price: 6300,
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: room._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: room.branch,
      roomId: room._id, bedId: "bed-1", leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), monthlyRent: 6300, status: "active",
    });
    const actorId = new mongoose.Types.ObjectId();
    const number = await generateContractNumber(room.branch, new Date());
    const predecessor = await Contract.create({
      ...number, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: room._id, branch: room.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: room.roomNumber,
      roomType: "quadruple-sharing", leaseType: "long_term", status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });
    return { tenant, room, reservation, stay, predecessor, actorId };
  }

  test("throws ROOM_TRANSFER_CONTRACT_NOT_PREPARED when no successor exists", async () => {
    const { predecessor } = await seed();
    await expect(resolveRoomTransferSuccessor({ predecessorContractId: predecessor._id }))
      .rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_NOT_PREPARED" });
  });

  test("returns the single successor when exactly one exists", async () => {
    const { predecessor, tenant, room, reservation, stay, actorId } = await seed();
    const number = await generateContractNumber(room.branch, new Date());
    const successor = await Contract.create({
      ...number, contractPurpose: "replacement", replacesContractId: predecessor._id,
      tenantId: tenant._id, applicationId: reservation._id, reservationId: reservation._id,
      stayId: stay._id, roomId: room._id, branch: room.branch, propertyName: "Lilycrest Dormitory",
      propertyAddress: "123 Test St.", roomNumber: room.roomNumber, roomType: "quadruple-sharing",
      leaseType: "long_term", status: "published", isCurrent: false,
      statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });

    const resolved = await resolveRoomTransferSuccessor({ predecessorContractId: predecessor._id });
    expect(String(resolved._id)).toBe(String(successor._id));
  });

  test("throws MULTIPLE_TRANSFER_SUCCESSORS when more than one non-abandoned successor exists", async () => {
    const { predecessor, tenant, room, reservation, stay, actorId } = await seed();
    for (let i = 0; i < 2; i += 1) {
      const number = await generateContractNumber(room.branch, new Date());
      await Contract.create({
        ...number, contractPurpose: "replacement", replacesContractId: predecessor._id,
        tenantId: tenant._id, applicationId: reservation._id, reservationId: reservation._id,
        stayId: stay._id, roomId: room._id, branch: room.branch, propertyName: "Lilycrest Dormitory",
        propertyAddress: "123 Test St.", roomNumber: room.roomNumber, roomType: "quadruple-sharing",
        leaseType: "long_term", status: "published", isCurrent: false,
        statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
        createdBy: actorId, updatedBy: actorId,
      });
    }

    await expect(resolveRoomTransferSuccessor({ predecessorContractId: predecessor._id }))
      .rejects.toMatchObject({ code: "MULTIPLE_TRANSFER_SUCCESSORS" });
  });

  test("ignores a cancelled successor — treated the same as no successor", async () => {
    const { predecessor, tenant, room, reservation, stay, actorId } = await seed();
    const number = await generateContractNumber(room.branch, new Date());
    await Contract.create({
      ...number, contractPurpose: "replacement", replacesContractId: predecessor._id,
      tenantId: tenant._id, applicationId: reservation._id, reservationId: reservation._id,
      stayId: stay._id, roomId: room._id, branch: room.branch, propertyName: "Lilycrest Dormitory",
      propertyAddress: "123 Test St.", roomNumber: room.roomNumber, roomType: "quadruple-sharing",
      leaseType: "long_term", status: "cancelled", isCurrent: false,
      statusHistory: [{ status: "cancelled", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });

    await expect(resolveRoomTransferSuccessor({ predecessorContractId: predecessor._id }))
      .rejects.toMatchObject({ code: "ROOM_TRANSFER_CONTRACT_NOT_PREPARED" });
  });
});
