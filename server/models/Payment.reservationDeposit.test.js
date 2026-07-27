import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import Payment from "./Payment.js";

const id = () => new mongoose.Types.ObjectId();

const base = {
  tenantId: id(),
  branch: "gil-puyat",
  amount: 2000,
  method: "bank",
};

describe("Payment reservation-deposit parent validation", () => {
  test("accepts a Reservation deposit without a bill", async () => {
    const payment = new Payment({
      ...base,
      reservationId: id(),
      purpose: "reservation_deposit",
      source: "manual_proof",
      status: "under_review",
    });
    await expect(payment.validate()).resolves.toBeUndefined();
  });

  test("rejects a ledger entry without a bill or Reservation", async () => {
    const payment = new Payment(base);
    await expect(payment.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ billId: expect.anything() }),
    });
  });

  test("rejects an ambiguous entry with both financial parents", async () => {
    const payment = new Payment({
      ...base,
      billId: id(),
      reservationId: id(),
    });
    await expect(payment.validate()).rejects.toMatchObject({
      errors: expect.objectContaining({ reservationId: expect.anything() }),
    });
  });
});
