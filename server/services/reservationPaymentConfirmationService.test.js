import { beforeEach, describe, expect, jest, test } from "@jest/globals";

let webhookEvent;
let failTransaction = false;
const webhookCreate = jest.fn(async (data) => {
  if (webhookEvent) throw Object.assign(new Error("duplicate"), { code: 11000 });
  webhookEvent = { _id: "event-record-1", attemptCount: 0, ...data };
  return webhookEvent;
});
const webhookFindOne = jest.fn(async () => webhookEvent);
const webhookFindOneAndUpdate = jest.fn(async (_query, update) => {
  if (!webhookEvent ||
      !["received", "retryable_failed", "processing"].includes(webhookEvent.status)) {
    return null;
  }
  Object.assign(webhookEvent, update.$set);
  webhookEvent.attemptCount += update.$inc?.attemptCount || 0;
  return webhookEvent;
});
const webhookUpdateOne = jest.fn(async (_query, update) => {
  Object.assign(webhookEvent, update.$set);
  return { modifiedCount: 1 };
});
const attempt = {
  _id: "attempt-1",
  reservationId: "reservation-1",
  expectedAmount: 11600,
  currency: "PHP",
  status: "checkout_created",
  save: jest.fn(async function save() { return this; }),
};
const attemptFindOne = jest.fn(async () => attempt);
const attemptUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const reservation = {
  _id: "reservation-1",
  status: "payment_pending",
  paymentStatus: "pending",
  paymentVerificationSource: null,
  occupancySyncStatus: "pending",
  populate: jest.fn(async function populate() { return this; }),
};
const reservationFindById = jest.fn(() => reservation);
const reservationFindOneAndUpdate = jest.fn(async () => reservation);
const session = {
  withTransaction: jest.fn(async (callback) => {
    if (failTransaction) {
      failTransaction = false;
      throw Object.assign(new Error("temporary transaction failure"), {
        code: "TRANSIENT_TRANSACTION",
      });
    }
    await callback();
  }),
  endSession: jest.fn(async () => {}),
};

await jest.unstable_mockModule("mongoose", () => ({
  default: { startSession: jest.fn(async () => session) },
}));
await jest.unstable_mockModule("../models/PaymongoWebhookEvent.js", () => ({
  default: {
    create: webhookCreate,
    findOne: webhookFindOne,
    findOneAndUpdate: webhookFindOneAndUpdate,
    updateOne: webhookUpdateOne,
  },
}));
await jest.unstable_mockModule("../models/ReservationPaymentAttempt.js", () => ({
  default: { findOne: attemptFindOne, updateOne: attemptUpdateOne },
}));
await jest.unstable_mockModule("../models/Reservation.js", () => ({
  default: {
    findById: reservationFindById,
    findOneAndUpdate: reservationFindOneAndUpdate,
  },
}));
await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  hasReservationStatus: (status, ...expected) => expected.includes(status),
}));
await jest.unstable_mockModule("./reservationPaymentReconciliationService.js", () => ({
  reconcileReservationPayment: jest.fn(),
}));

const { confirmReservationPaymentFromWebhook } =
  await import("./reservationPaymentConfirmationService.js");

const payload = () => ({
  eventId: "evt-1",
  eventType: "checkout_session.payment.paid",
  reservationId: "reservation-1",
  paymentAttemptId: "attempt-1",
  checkoutSessionId: "checkout-1",
  paymentId: "payment-1",
  amountMinor: 1160000,
  currency: "PHP",
  reconciliation: jest.fn().mockResolvedValue({ status: "completed" }),
});
describe("confirmReservationPaymentFromWebhook", () => {
  beforeEach(() => {
    webhookEvent = null;
    failTransaction = false;
    reservation.status = "payment_pending";
    reservation.paymentStatus = "pending";
    reservation.paymentVerificationSource = null;
    reservation.occupancySyncStatus = "pending";
    jest.clearAllMocks();
  });

  test("a transaction failure becomes retryable and the same event succeeds later", async () => {
    failTransaction = true;
    await expect(confirmReservationPaymentFromWebhook(payload()))
      .rejects.toMatchObject({ code: "TRANSIENT_TRANSACTION" });
    expect(webhookEvent.status).toBe("retryable_failed");
    expect(webhookEvent.attemptCount).toBe(1);

    const retry = await confirmReservationPaymentFromWebhook(payload());
    expect(retry.status).toBe("payment_confirmed");
    expect(webhookEvent.status).toBe("processed");
    expect(webhookEvent.attemptCount).toBe(2);
  });

  test("an active processing lease is not double-processed", async () => {
    webhookEvent = {
      _id: "event-record-1",
      eventId: "evt-1",
      status: "processing",
      processingExpiresAt: new Date(Date.now() + 60_000),
      attemptCount: 1,
    };
    webhookFindOneAndUpdate.mockResolvedValueOnce(null);
    const response = await confirmReservationPaymentFromWebhook(payload());
    expect(response.status).toBe("processing");
    expect(session.withTransaction).not.toHaveBeenCalled();
  });

  test("a stale processing lease can be reclaimed", async () => {
    webhookEvent = {
      _id: "event-record-1",
      eventId: "evt-1",
      status: "processing",
      processingExpiresAt: new Date(Date.now() - 60_000),
      attemptCount: 1,
    };
    const response = await confirmReservationPaymentFromWebhook(payload());
    expect(response.status).toBe("payment_confirmed");
    expect(webhookEvent.status).toBe("processed");
    expect(webhookEvent.attemptCount).toBe(2);
  });
});
