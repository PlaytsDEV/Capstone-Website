/**
 * Integration test for moveOutClearanceService — wires the previously
 * vestigial MoveOutClearance model into the real move-out workflow as a
 * durable receipt (not a second financial calculator).
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet because
 * moveOutStayWorkflow runs inside a genuine Mongo transaction.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  openMoveOutClearance,
  markInspectionComplete,
  completeMoveOutClearance,
} from "./moveOutClearanceService.js";
import {
  MoveOutClearance,
  Reservation,
  Room,
  User,
  Stay,
  Bill,
} from "../models/index.js";

jest.setTimeout(120_000);

describe("moveOutClearanceService", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "move_out_clearance" });
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
      Stay.deleteMany({}),
      Bill.deleteMany({}),
      MoveOutClearance.deleteMany({}),
    ]);
  });

  async function seedActiveTenancy() {
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
      leaseDuration: 12,
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: new Date("2026-01-01T00:00:00.000Z"),
      monthlyRent: 6300,
    });
    const stay = await Stay.create({
      tenantId: tenant._id,
      reservationId: reservation._id,
      branch: room.branch,
      roomId: room._id,
      bedId: "bed-1",
      leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-01T00:00:00.000Z"),
      monthlyRent: 6300,
      status: "active",
      createdBy: actorId,
      updatedBy: actorId,
    });
    return { actorId, tenant, room, reservation, stay };
  }

  test("Start Move-Out is idempotent — calling twice returns the same clearance", async () => {
    const { tenant, reservation, actorId } = await seedActiveTenancy();

    const first = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2026-06-01T00:00:00.000Z"),
      actorId,
    });
    const second = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2026-06-01T00:00:00.000Z"),
      actorId,
    });

    expect(String(second._id)).toBe(String(first._id));
    const count = await MoveOutClearance.countDocuments({ reservationId: reservation._id });
    expect(count).toBe(1);
    expect(first.status).toBe("initiated");
  });

  test("Mark Inspected transitions initiated -> inspection_complete", async () => {
    const { tenant, reservation, actorId } = await seedActiveTenancy();
    const clearance = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2026-06-01T00:00:00.000Z"),
      actorId,
    });

    const inspected = await markInspectionComplete({
      clearanceId: clearance._id,
      actorId,
      inspectionNotes: "No damage found.",
    });

    expect(inspected.status).toBe("inspection_complete");
    expect(inspected.inspectionCompletedAt).toBeTruthy();
    expect(inspected.inspectionCompletedBy).toBeTruthy();
  });

  test("Complete Move-Out delegates to moveOutStayWorkflow and records the outcome as a receipt", async () => {
    const { tenant, room, reservation, stay, actorId } = await seedActiveTenancy();
    const clearance = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2027-01-01T00:00:00.000Z"),
      actorId,
    });
    await markInspectionComplete({ clearanceId: clearance._id, actorId });

    const { clearance: completed, reservation: updatedReservation, depositSettlement } =
      await completeMoveOutClearance({
        clearanceId: clearance._id,
        payload: {
          moveOutDate: "2027-01-01T00:00:00.000Z",
          finalUtilityReading: 1000,
        },
        actorId,
      });

    // Financial outcome must exactly match what moveOutStayWorkflow computed
    // — not a second, independently-calculated value.
    expect(depositSettlement.isEarlyVacancy).toBe(false);
    expect(completed.refundableBalance).toBe(depositSettlement.depositRefundAmount);
    expect(completed.depositOutcome).not.toBeNull();
    expect(["approved", "forfeited"]).toContain(completed.status);
    expect(completed.approvedBy).toBeTruthy();
    expect(completed.approvalReason).toBeTruthy();

    expect(updatedReservation.status).toBe("moveOut");

    // Stay and Room actually changed — this is not a parallel no-op record.
    const closedStay = await Stay.findById(stay._id);
    expect(closedStay.status).toBe("completed");
    const releasedRoom = await Room.findById(room._id);
    expect(releasedRoom.currentOccupancy).toBe(0);
  });

  test("Complete Move-Out on an early departure records a forfeited outcome matching isEarlyVacancy", async () => {
    const { tenant, reservation, actorId } = await seedActiveTenancy();
    const clearance = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2026-06-01T00:00:00.000Z"),
      actorId,
    });

    const { clearance: completed, depositSettlement } = await completeMoveOutClearance({
      clearanceId: clearance._id,
      payload: {
        moveOutDate: "2026-06-01T00:00:00.000Z", // well before leaseEndDate 2027-01-01
        finalUtilityReading: 500,
      },
      actorId,
    });

    expect(depositSettlement.isEarlyVacancy).toBe(true);
    expect(completed.depositOutcome).toBe("forfeited");
    expect(completed.status).toBe("forfeited");
  });

  test("re-completing an already-completed clearance throws CLEARANCE_ALREADY_COMPLETE", async () => {
    const { tenant, reservation, actorId } = await seedActiveTenancy();
    const clearance = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2027-01-01T00:00:00.000Z"),
      actorId,
    });

    await completeMoveOutClearance({
      clearanceId: clearance._id,
      payload: { moveOutDate: "2027-01-01T00:00:00.000Z", finalUtilityReading: 1000 },
      actorId,
    });

    await expect(
      completeMoveOutClearance({
        clearanceId: clearance._id,
        payload: { moveOutDate: "2027-01-01T00:00:00.000Z", finalUtilityReading: 1000 },
        actorId,
      }),
    ).rejects.toMatchObject({ code: "CLEARANCE_ALREADY_COMPLETE", statusCode: 409 });
  });

  test("marking inspection complete twice from an already-inspected status throws INVALID_CLEARANCE_STATUS", async () => {
    const { tenant, reservation, actorId } = await seedActiveTenancy();
    const clearance = await openMoveOutClearance({
      reservationId: reservation._id,
      tenantId: tenant._id,
      intendedMoveOutDate: new Date("2026-06-01T00:00:00.000Z"),
      actorId,
    });
    await markInspectionComplete({ clearanceId: clearance._id, actorId });

    await expect(
      markInspectionComplete({ clearanceId: clearance._id, actorId }),
    ).rejects.toMatchObject({ code: "INVALID_CLEARANCE_STATUS", statusCode: 409 });
  });
});
