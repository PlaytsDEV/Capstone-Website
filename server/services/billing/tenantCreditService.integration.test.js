/**
 * TenantCredit service — create + consume + idempotency, against a real
 * (single-node) replica set so unique indexes and sessions behave for real.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  recordRoomTransferRentCredit,
  getAvailableRentCredit,
  applyRentCreditToBill,
  reverseRentCreditForBill,
} from "./tenantCreditService.js";
import { TenantCredit } from "../../models/index.js";

jest.setTimeout(120_000);

describe("tenantCreditService", () => {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "tenant_credit" });
  }, 120_000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);
  beforeEach(async () => {
    await TenantCredit.deleteMany({});
  });

  const userId = () => new mongoose.Types.ObjectId();

  test("recordRoomTransferRentCredit is idempotent on idempotencyKey", async () => {
    const u = userId();
    const key = "room_transfer_rent_credit:pred-1";
    const a = await recordRoomTransferRentCredit({ userId: u, amount: 2500, transferReference: new mongoose.Types.ObjectId(), idempotencyKey: key });
    const b = await recordRoomTransferRentCredit({ userId: u, amount: 9999, transferReference: new mongoose.Types.ObjectId(), idempotencyKey: key });
    expect(String(a._id)).toBe(String(b._id));
    expect(b.originalAmount).toBe(2500); // second call did NOT change it
    expect(await TenantCredit.countDocuments({ userId: u })).toBe(1);
  });

  test("zero / negative amount records nothing", async () => {
    const u = userId();
    expect(await recordRoomTransferRentCredit({ userId: u, amount: 0, idempotencyKey: "k0" })).toBeNull();
    expect(await recordRoomTransferRentCredit({ userId: u, amount: -5, idempotencyKey: "kneg" })).toBeNull();
    expect(await TenantCredit.countDocuments({ userId: u })).toBe(0);
  });

  test("getAvailableRentCredit sums active remaining balances only", async () => {
    const u = userId();
    await recordRoomTransferRentCredit({ userId: u, amount: 1000, idempotencyKey: "k1" });
    await recordRoomTransferRentCredit({ userId: u, amount: 250, idempotencyKey: "k2" });
    const voided = await recordRoomTransferRentCredit({ userId: u, amount: 999, idempotencyKey: "k3" });
    voided.status = "void";
    await voided.save();
    expect(await getAvailableRentCredit(u)).toBe(1250);
  });

  test("applyRentCreditToBill consumes oldest-first, only up to the eligible rent amount", async () => {
    const u = userId();
    const billId = new mongoose.Types.ObjectId();
    const c1 = await recordRoomTransferRentCredit({ userId: u, amount: 1000, idempotencyKey: "k1" });
    await new Promise((r) => setTimeout(r, 5));
    const c2 = await recordRoomTransferRentCredit({ userId: u, amount: 1000, idempotencyKey: "k2" });

    const { applied } = await applyRentCreditToBill({ billId, userId: u, eligibleRentAmount: 1500 });
    expect(applied).toBe(1500);

    const [r1, r2] = await Promise.all([TenantCredit.findById(c1._id), TenantCredit.findById(c2._id)]);
    expect(r1.remainingBalance).toBe(0);
    expect(r1.status).toBe("consumed");
    expect(r2.remainingBalance).toBe(500);
    expect(r2.status).toBe("active");
    expect(r1.applications).toHaveLength(1);
    expect(String(r1.applications[0].billId)).toBe(String(billId));
  });

  test("applyRentCreditToBill is idempotent for the same (credit, billId) pair", async () => {
    const u = userId();
    const billId = new mongoose.Types.ObjectId();
    const c = await recordRoomTransferRentCredit({ userId: u, amount: 800, idempotencyKey: "k1" });

    const first = await applyRentCreditToBill({ billId, userId: u, eligibleRentAmount: 800 });
    const second = await applyRentCreditToBill({ billId, userId: u, eligibleRentAmount: 800 });
    expect(first.applied).toBe(800);
    expect(second.applied).toBe(800); // reports the same, does not re-consume

    const after = await TenantCredit.findById(c._id);
    expect(after.consumedAmount).toBe(800);
    expect(after.applications).toHaveLength(1);
  });

  test("applyRentCreditToBill never exceeds the eligible RENT amount even with plenty of credit", async () => {
    const u = userId();
    const billId = new mongoose.Types.ObjectId();
    await recordRoomTransferRentCredit({ userId: u, amount: 10000, idempotencyKey: "k1" });
    const { applied } = await applyRentCreditToBill({ billId, userId: u, eligibleRentAmount: 5400 });
    expect(applied).toBe(5400);
    expect(await getAvailableRentCredit(u)).toBe(4600);
  });

  test("reverseRentCreditForBill undoes a prior application", async () => {
    const u = userId();
    const billId = new mongoose.Types.ObjectId();
    const c = await recordRoomTransferRentCredit({ userId: u, amount: 1000, idempotencyKey: "k1" });
    await applyRentCreditToBill({ billId, userId: u, eligibleRentAmount: 600 });
    expect((await TenantCredit.findById(c._id)).consumedAmount).toBe(600);

    const { reversed } = await reverseRentCreditForBill({ billId, userId: u });
    expect(reversed).toBe(600);
    const after = await TenantCredit.findById(c._id);
    expect(after.consumedAmount).toBe(0);
    expect(after.remainingBalance).toBe(1000);
    expect(after.applications).toHaveLength(0);

    // Reversing again is a no-op.
    const { reversed: again } = await reverseRentCreditForBill({ billId, userId: u });
    expect(again).toBe(0);
  });
});
