/**
 * Integration test for createReplacementContractForTransfer
 * (server/services/contractService.js) — the room-transfer Contract
 * successor creation helper. Proves the three confirmed bugs are fixed
 * (predecessor mutated immediately, wrong leaseStartDate, successor created
 * isCurrent: true) and the new idempotency guard behaves correctly,
 * including after the successor has already been activated via
 * contractRoomTransferActivationService.activateRoomTransferSuccessor.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet — the
 * idempotency guard and activation both run inside genuine Mongo
 * transactions in the full flow.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { createReplacementContractForTransfer, generateContractNumber, transitionContract } from "./contractService.js";
import { activateRoomTransferSuccessor } from "./contractRoomTransferActivationService.js";
import { Contract, Reservation, Room, User, Stay, BusinessSettings } from "../models/index.js";

jest.setTimeout(120_000);

describe("createReplacementContractForTransfer", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_replacement" });
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
      BusinessSettings.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global",
      quadrupleDiscountPercent: 10,
      isDiscountEnabled: true,
      longTermLeaseMinMonths: 6,
    });
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
    const roomB = await Room.create({
      name: "Room 101", roomNumber: "101", branch: "gil-puyat",
      type: "private", capacity: 1, price: 14400,
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
    return { tenant, roomA, roomB, reservation, stay };
  }

  async function createPredecessorContract({ tenant, room, reservation, stay, actorId }) {
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
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      leaseDurationMonths: 6,
      approvedMonthlyRate: 6300,
      status: "active",
      isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  test("creates a successor using the destination room/rate, the transfer date, and the predecessor's original end date — without mutating the predecessor", async () => {
    const { tenant, roomA, roomB, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createPredecessorContract({ tenant, room: roomA, reservation, stay, actorId });
    const transferDate = new Date("2026-09-15T00:00:00.000Z");

    const successor = await createReplacementContractForTransfer({
      reservationId: reservation._id,
      stayId: stay._id,
      oldContract,
      targetRoom: { _id: roomB._id, branch: roomB.branch, type: roomB.type, roomNumber: roomB.roomNumber, monthlyPrice: roomB.price, price: roomB.price },
      targetBed: { id: "bed-2", label: "Bed 2" },
      effectiveTransferDate: transferDate,
      actorId,
    });

    // Successor: destination room, approved destination rate, transfer date,
    // predecessor's original end date preserved by default (§4/§6).
    // The predecessor's leaseDurationMonths (6, inherited by the successor)
    // is LONG-TERM per longTermLeaseMinMonths — so the destination rate is
    // resolved from the room-type+term table (Private long-term final =
    // ₱13,500), NOT the destination Room's raw price field (₱14,400, which
    // happens to be Private SHORT-term — a stale/mismatched master price is
    // exactly what approved-pricing resolution must not blindly inherit).
    expect(String(successor.roomId)).toBe(String(roomB._id));
    expect(successor.roomNumber).toBe("101");
    expect(successor.approvedMonthlyRate).toBe(13500);
    expect(successor.regularMonthlyRate).toBe(15000);
    expect(successor.leaseStartDate.toISOString()).toBe(transferDate.toISOString());
    expect(successor.leaseEndDate.toISOString()).toBe(oldContract.leaseEndDate.toISOString());
    expect(successor.contractPurpose).toBe("replacement");
    expect(String(successor.replacesContractId)).toBe(String(oldContract._id));
    expect(String(successor.parentContractId)).toBe(String(oldContract._id));
    expect(successor.isCurrent).toBe(false);

    // Predecessor: completely untouched.
    const reloadedOld = await Contract.findById(oldContract._id);
    expect(reloadedOld.status).toBe("active");
    expect(reloadedOld.isCurrent).toBe(true);
    expect(String(reloadedOld.roomId)).toBe(String(roomA._id));
    expect(reloadedOld.approvedMonthlyRate).toBe(6300);
    expect(reloadedOld.leaseStartDate.toISOString()).toBe(new Date("2026-08-01T00:00:00.000Z").toISOString());
    expect(reloadedOld.leaseEndDate.toISOString()).toBe(new Date("2027-01-31T00:00:00.000Z").toISOString());
    expect(reloadedOld.supersededByContractId).toBeFalsy();
  });

  test("snapshots the approved destination rate — a later room master-price change does not alter it", async () => {
    const { tenant, roomA, roomB, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createPredecessorContract({ tenant, room: roomA, reservation, stay, actorId });

    const successor = await createReplacementContractForTransfer({
      reservationId: reservation._id,
      stayId: stay._id,
      oldContract,
      targetRoom: { _id: roomB._id, branch: roomB.branch, type: roomB.type, roomNumber: roomB.roomNumber, monthlyPrice: roomB.price, price: roomB.price },
      targetBed: { id: "bed-2" },
      effectiveTransferDate: new Date("2026-09-15T00:00:00.000Z"),
      actorId,
    });

    await Room.updateOne({ _id: roomB._id }, { $set: { price: 20000 } });

    const reloadedSuccessor = await Contract.findById(successor._id);
    // Private long-term final (₱13,500) — unaffected by the later Room-price edit.
    expect(reloadedSuccessor.approvedMonthlyRate).toBe(13500);
  });

  test("calling again before activation returns the same successor — no duplicate", async () => {
    const { tenant, roomA, roomB, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createPredecessorContract({ tenant, room: roomA, reservation, stay, actorId });
    const params = {
      reservationId: reservation._id,
      stayId: stay._id,
      oldContract,
      targetRoom: { _id: roomB._id, branch: roomB.branch, type: roomB.type, roomNumber: roomB.roomNumber, monthlyPrice: roomB.price, price: roomB.price },
      targetBed: { id: "bed-2" },
      effectiveTransferDate: new Date("2026-09-15T00:00:00.000Z"),
      actorId,
    };

    const first = await createReplacementContractForTransfer(params);
    const second = await createReplacementContractForTransfer({ ...params, oldContract });

    expect(String(second._id)).toBe(String(first._id));
    const count = await Contract.countDocuments({ replacesContractId: oldContract._id, contractPurpose: "replacement" });
    expect(count).toBe(1);
  });

  test("calling again AFTER the successor has already been activated still returns the same successor, not a third Contract", async () => {
    const { tenant, roomA, roomB, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createPredecessorContract({ tenant, room: roomA, reservation, stay, actorId });
    const params = {
      reservationId: reservation._id,
      stayId: stay._id,
      oldContract,
      targetRoom: { _id: roomB._id, branch: roomB.branch, type: roomB.type, roomNumber: roomB.roomNumber, monthlyPrice: roomB.price, price: roomB.price },
      targetBed: { id: "bed-2" },
      effectiveTransferDate: new Date("2026-09-15T00:00:00.000Z"),
      actorId,
    };

    const successor = await createReplacementContractForTransfer(params);
    // Simulate finalization (Phase 1 wet-signed finality) and activation.
    successor.status = "published";
    successor.finalDocument = {
      storageKey: "gil-puyat/2026/transfer/final_v1.pdf", fileName: "final_v1.pdf",
      fileHash: "hash1", fileSize: 1024, mimeType: "application/pdf", pageCount: 4,
      sourceType: "admin_scan", sourceVersion: 1, sourceUploadedAt: new Date(),
      publishedAt: new Date(), publishedBy: actorId, tenantVisible: true,
    };
    successor.statusHistory.push({ status: "published", changedBy: actorId, reason: "seed final" });
    await successor.save();
    await activateRoomTransferSuccessor({ successorContractId: successor._id, actorId });

    const retried = await createReplacementContractForTransfer({ ...params, oldContract });
    expect(String(retried._id)).toBe(String(successor._id));

    const count = await Contract.countDocuments({ replacesContractId: oldContract._id, contractPurpose: "replacement" });
    expect(count).toBe(1);
  });

  test("a predecessor whose only prior successor was cancelled is allowed a fresh legitimate successor", async () => {
    const { tenant, roomA, roomB, reservation, stay } = await seedTenantRoomReservation();
    const actorId = new mongoose.Types.ObjectId();
    const oldContract = await createPredecessorContract({ tenant, room: roomA, reservation, stay, actorId });
    const params = {
      reservationId: reservation._id,
      stayId: stay._id,
      oldContract,
      targetRoom: { _id: roomB._id, branch: roomB.branch, type: roomB.type, roomNumber: roomB.roomNumber, monthlyPrice: roomB.price, price: roomB.price },
      targetBed: { id: "bed-2" },
      effectiveTransferDate: new Date("2026-09-15T00:00:00.000Z"),
      actorId,
    };

    const cancelled = await createReplacementContractForTransfer(params);
    await transitionContract(cancelled, "cancelled", actorId, "Transfer cancelled");

    const fresh = await createReplacementContractForTransfer({ ...params, oldContract });
    expect(String(fresh._id)).not.toBe(String(cancelled._id));

    const count = await Contract.countDocuments({ replacesContractId: oldContract._id, contractPurpose: "replacement" });
    expect(count).toBe(2);
  });
});
