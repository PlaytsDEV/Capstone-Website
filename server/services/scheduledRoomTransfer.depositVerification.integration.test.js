import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Bill, Reservation } from "../models/index.js";
import { applyBillPayment } from "./billing/paymentLedger.js";
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

  test("fully paid initial_payment evidence resolves without automatically backfilling the legacy Reservation", async () => {
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
    expect(after.securityDepositHeld).toBeNull();
    expect(after.securityDepositLedger).toHaveLength(0);
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

  test("a later deposit top-up uses the verified settlement snapshot instead of treating legacy null as zero", async () => {
    const reservation = await insertReservation({
      userId: new mongoose.Types.ObjectId(),
      roomId: new mongoose.Types.ObjectId(),
      totalPrice: 6300,
    });
    const bill = {
      _id: new mongoose.Types.ObjectId(),
      reservationId: reservation._id,
      userId: new mongoose.Types.ObjectId(),
      branch: "gil-puyat",
      billType: "transfer_settlement",
      charges: {
        rent: 0,
        electricity: 0,
        water: 0,
        applianceFees: 0,
        corkageFees: 0,
        penalty: 0,
        securityDeposit: 1800,
        discount: 0,
      },
      totalAmount: 1800,
      paidAmount: 0,
      remainingAmount: 1800,
      status: "pending",
      transferSnapshot: { depositPreviouslyHeld: 6300 },
      save: async function save() { return this; },
    };
    const paymentModel = {
      findOne: async () => null,
      create: async (payload) => ({ _id: new mongoose.Types.ObjectId(), ...payload }),
    };

    await applyBillPayment({
      bill,
      amount: 1800,
      method: "cash",
      source: "admin-manual",
      actorId: new mongoose.Types.ObjectId(),
      paymentModel,
    });

    const after = await Reservation.findById(reservation._id);
    expect(after.securityDepositHeld).toBe(8100);
    expect(after.securityDepositLedger[0]).toMatchObject({
      kind: "transfer_deposit_settlement",
      previousHeld: 6300,
      adjustmentAmount: 1800,
      resultingHeld: 8100,
    });
  });
});
