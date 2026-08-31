import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Bill, Reservation } from "../models/index.js";
import { verifyCompletionDepositHeld } from "./scheduledRoomTransferService.js";

jest.setTimeout(120_000);

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "room_transfer_deposit_verification" });
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all([Reservation.deleteMany({}), Bill.deleteMany({})]);
});

async function insertReservation(extra = {}) {
  const _id = new mongoose.Types.ObjectId();
  await Reservation.collection.insertOne({
    _id,
    securityDepositHeld: null,
    securityDepositLedger: [],
    ...extra,
  });
  return Reservation.findById(_id);
}

const record = (reservationId) => ({
  _id: new mongoose.Types.ObjectId(),
  reservationId,
});

describe("Complete Transfer deposit verification gate", () => {
  test("unknown held deposit blocks completion before settlement creation", async () => {
    const reservation = await insertReservation();
    await expect(verifyCompletionDepositHeld({
      reservation,
      record: record(reservation._id),
      payload: {},
      actorId: new mongoose.Types.ObjectId(),
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_DEPOSIT_HELD_UNVERIFIED", statusCode: 409 });
    expect((await Reservation.findById(reservation._id)).securityDepositHeld).toBeNull();
  });

  test("manual verification requires explicit confirmation and audit metadata", async () => {
    const reservation = await insertReservation();
    await expect(verifyCompletionDepositHeld({
      reservation,
      record: record(reservation._id),
      payload: { depositHeldOverride: 6300 },
      actorId: new mongoose.Types.ObjectId(),
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_DEPOSIT_OVERRIDE_CONFIRMATION_REQUIRED" });
  });

  test("verified Admin override persists exact value and idempotent audit metadata", async () => {
    const reservation = await insertReservation();
    const scheduled = record(reservation._id);
    const actorId = new mongoose.Types.ObjectId();
    const payload = {
      depositHeldOverride: 6300,
      depositHeldVerificationConfirmed: true,
      depositVerificationSource: "Paid initial Bill and official receipt",
      depositVerificationReason: "Legacy Reservation field was never populated",
    };
    await expect(verifyCompletionDepositHeld({ reservation, record: scheduled, payload, actorId }))
      .resolves.toBe(6300);
    const after = await Reservation.findById(reservation._id);
    expect(after.securityDepositHeld).toBe(6300);
    expect(after.securityDepositLedger).toHaveLength(1);
    expect(after.securityDepositLedger[0]).toMatchObject({
      kind: "manual_correction",
      previousHeld: null,
      adjustmentAmount: 6300,
      resultingHeld: 6300,
      createdBy: actorId,
      scheduledRoomTransferId: scheduled._id,
    });

    await expect(verifyCompletionDepositHeld({ reservation: after, record: scheduled, payload: {}, actorId }))
      .resolves.toBe(6300);
    expect((await Reservation.findById(reservation._id)).securityDepositLedger).toHaveLength(1);
  });

  test("fully paid initial_payment evidence resolves and records held cash without an Admin guess", async () => {
    const reservation = await insertReservation();
    const billId = new mongoose.Types.ObjectId();
    await Bill.collection.insertOne({
      _id: billId,
      reservationId: reservation._id,
      billType: "initial_payment",
      isArchived: false,
      status: "paid",
      totalAmount: 12600,
      paidAmount: 12600,
      remainingAmount: 0,
      initialPaymentBreakdown: { advanceRent: 6300, securityDeposit: 6300 },
    });
    const scheduled = record(reservation._id);
    await expect(verifyCompletionDepositHeld({
      reservation,
      record: scheduled,
      payload: {},
      actorId: new mongoose.Types.ObjectId(),
    })).resolves.toBe(6300);
    const after = await Reservation.findById(reservation._id);
    expect(after.securityDepositHeld).toBe(6300);
    expect(after.securityDepositLedger[0]).toMatchObject({ kind: "backfill", billId });
  });

  test("an existing canonical held value cannot be manually overridden", async () => {
    const reservation = await insertReservation({ securityDepositHeld: 6300 });
    await expect(verifyCompletionDepositHeld({
      reservation,
      record: record(reservation._id),
      payload: {
        depositHeldOverride: 7000,
        depositHeldVerificationConfirmed: true,
        depositVerificationSource: "record",
        depositVerificationReason: "reason",
      },
      actorId: new mongoose.Types.ObjectId(),
    })).rejects.toMatchObject({ code: "ROOM_TRANSFER_DEPOSIT_OVERRIDE_NOT_ALLOWED" });
  });
});
