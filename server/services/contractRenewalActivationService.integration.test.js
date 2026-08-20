/**
 * Integration test for contractRenewalActivationService.activateDueRenewalContracts.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet because the
 * activation transitions run inside a genuine Mongo transaction
 * (mongoSession.withTransaction), which a standalone MongoMemoryServer
 * cannot support.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { activateDueRenewalContracts } from "./contractRenewalActivationService.js";
import { generateContractNumber } from "./contractService.js";
import { Contract, Reservation, Room, User } from "../models/index.js";

jest.setTimeout(120_000);

describe("contractRenewalActivationService.activateDueRenewalContracts", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "renewal_activation" });
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

  async function seedTenantRoomReservation() {
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
    return { tenant, room, reservation };
  }

  async function createContract({ tenant, room, reservation, actorId, overrides = {} }) {
    const number = await generateContractNumber(room.branch, new Date());
    return Contract.create({
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
      status: "active",
      isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId,
      updatedBy: actorId,
      ...overrides,
    });
  }

  const minimalFinalDocument = (actorId) => ({
    storageKey: "gil-puyat/2026/renewal/final_v1.pdf",
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

  test("activates a due renewal successor and supersedes the predecessor in one transaction", async () => {
    const { tenant, room, reservation } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();

    const oldContract = await createContract({ tenant, room, reservation, actorId });
    const successor = await createContract({
      tenant, room, reservation, actorId,
      overrides: {
        contractPurpose: "renewal",
        replacesContractId: oldContract._id,
        parentContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        leaseStartDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        leaseEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        finalDocument: minimalFinalDocument(actorId),
        finalStorageKey: "gil-puyat/2026/renewal/final_v1.pdf",
        publishedAt: new Date(),
        tenantVisible: true,
      },
    });

    const report = await activateDueRenewalContracts();

    expect(report.scanned).toBe(1);
    expect(report.activated).toBe(1);
    expect(report.errors).toBe(0);

    const [reloadedOld, reloadedSuccessor] = await Promise.all([
      Contract.findById(oldContract._id),
      Contract.findById(successor._id),
    ]);

    expect(reloadedSuccessor.status).toBe("active");
    expect(reloadedSuccessor.isCurrent).toBe(true);
    expect(reloadedOld.status).toBe("replaced");
    expect(reloadedOld.isCurrent).toBe(false);
    expect(String(reloadedOld.supersededByContractId)).toBe(String(successor._id));
  });

  test("does not activate a successor whose leaseStartDate is still in the future", async () => {
    const { tenant, room, reservation } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();

    const oldContract = await createContract({ tenant, room, reservation, actorId });
    await createContract({
      tenant, room, reservation, actorId,
      overrides: {
        contractPurpose: "renewal",
        replacesContractId: oldContract._id,
        status: "published",
        isCurrent: false,
        leaseStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const report = await activateDueRenewalContracts();
    expect(report.scanned).toBe(0);
    expect(report.activated).toBe(0);

    const reloadedOld = await Contract.findById(oldContract._id);
    expect(reloadedOld.status).toBe("active");
    expect(reloadedOld.isCurrent).toBe(true);
  });

  test("re-running activation is idempotent — no duplicate transitions", async () => {
    const { tenant, room, reservation } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();

    const oldContract = await createContract({ tenant, room, reservation, actorId });
    const successor = await createContract({
      tenant, room, reservation, actorId,
      overrides: {
        contractPurpose: "renewal",
        replacesContractId: oldContract._id,
        status: "published",
        statusHistory: [{ status: "published", changedBy: actorId, reason: "seed" }],
        isCurrent: false,
        leaseStartDate: new Date(Date.now() - 60 * 60 * 1000),
        finalDocument: minimalFinalDocument(actorId),
      },
    });

    const first = await activateDueRenewalContracts();
    expect(first.activated).toBe(1);

    const second = await activateDueRenewalContracts();
    expect(second.scanned).toBe(0);
    expect(second.activated).toBe(0);

    const reloadedSuccessor = await Contract.findById(successor._id);
    expect(reloadedSuccessor.statusHistory.filter((h) => h.status === "active")).toHaveLength(1);
  });
});
