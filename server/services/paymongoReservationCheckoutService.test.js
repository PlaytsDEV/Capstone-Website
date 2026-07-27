import { beforeEach, describe, expect, jest, test } from "@jest/globals";

let storedAttempt = null;
const attemptCreate = jest.fn(async (data) => {
  if (storedAttempt) throw Object.assign(new Error("duplicate"), { code: 11000 });
  storedAttempt = { _id: "attempt-1", ...data };
  return storedAttempt;
});
const attemptFindOne = jest.fn(async () => storedAttempt);
const attemptFindOneAndUpdate = jest.fn(async () => null);
const attemptUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const evaluateReservationPaymentReadiness = jest.fn();
const getReservationCheckoutBlockers = jest.fn();

await jest.unstable_mockModule("../models/ReservationPaymentAttempt.js", () => ({
  default: {
    create: attemptCreate,
    findOne: attemptFindOne,
    findOneAndUpdate: attemptFindOneAndUpdate,
    updateOne: attemptUpdateOne,
  },
}));
await jest.unstable_mockModule("./reservationPaymentReadinessService.js", () => ({
  evaluateReservationPaymentReadiness,
  paymentReadinessError: (readiness) =>
    Object.assign(new Error("not ready"), {
      code: readiness.legacy
        ? "LEGACY_PAYMENT_DATA_INCOMPLETE"
        : "PAYMENT_READINESS_INCOMPLETE",
      statusCode: 422,
    }),
}));
await jest.unstable_mockModule("./reservationPaymentPolicy.js", () => ({
  getReservationCheckoutBlockers,
}));
await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  hasReservationStatus: (status, ...expected) => expected.includes(status),
}));

const { createReservationCheckout } = await import("./paymongoReservationCheckoutService.js");

const quote = {
  monthlyRent: 6300,
  advanceRent: 6300,
  securityDeposit: 6300,
  reservationFeeCredit: 1000,
  amountDue: 11600,
  currency: "PHP",
  pricingVersion: 1,
  quoteHash: "hash-1",
  approvedAt: new Date(),
};

const reservation = () => ({
  _id: "reservation-1",
  userId: "user-1",
  roomId: { branch: "gil-puyat" },
  status: "approved_for_payment",
  paymentStatus: "pending",
  paymentExpiresAt: new Date(Date.now() + 60_000),
  save: jest.fn(async function save() { return this; }),
});

describe("createReservationCheckout", () => {
  beforeEach(() => {
    storedAttempt = null;
    jest.clearAllMocks();
    attemptFindOneAndUpdate.mockImplementation(async (query, update) => {
      if (query?._id === storedAttempt?._id && query.creationOwner) {
        Object.assign(storedAttempt, update.$set);
        return storedAttempt;
      }
      return null;
    });
    evaluateReservationPaymentReadiness.mockResolvedValue({
      ready: true,
      legacy: false,
      missingFields: [],
    });
    getReservationCheckoutBlockers.mockReturnValue({ blockers: [], quote });
  });

  test("two concurrent requests create only one provider session", async () => {
    let releaseGateway;
    const gateway = jest.fn(() => new Promise((resolve) => {
      releaseGateway = () => resolve({
        sessionId: "checkout-1",
        checkoutUrl: "https://checkout.example/1",
      });
    }));
    const first = createReservationCheckout({
      reservation: reservation(),
      applicantId: "user-1",
      frontendUrl: "https://app.example",
      gateway,
    });
    await Promise.resolve();
    const second = createReservationCheckout({
      reservation: reservation(),
      applicantId: "user-1",
      frontendUrl: "https://app.example",
      gateway,
    });
    await expect(second).rejects.toMatchObject({
      code: "PAYMENT_CHECKOUT_IN_PROGRESS",
      statusCode: 409,
    });
    releaseGateway();
    await expect(first).resolves.toEqual(expect.objectContaining({
      sessionId: "checkout-1",
      reused: false,
    }));
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(attemptCreate).toHaveBeenCalledTimes(2);
    expect(storedAttempt.activeAttemptKey)
      .toBe("reservation:reservation-1:initial-payment");
  });

  test("expired approval never creates an attempt", async () => {
    getReservationCheckoutBlockers.mockReturnValue({
      blockers: ["PAYMENT_DEADLINE_EXPIRED"],
      quote,
    });
    await expect(createReservationCheckout({
      reservation: reservation(),
      applicantId: "user-1",
      frontendUrl: "https://app.example",
      gateway: jest.fn(),
    })).rejects.toMatchObject({ code: "PAYMENT_DEADLINE_EXPIRED" });
    expect(attemptCreate).not.toHaveBeenCalled();
  });

  test("legacy incomplete data returns a controlled 422", async () => {
    evaluateReservationPaymentReadiness.mockResolvedValue({
      ready: false,
      legacy: true,
      missingFields: ["approvedAdvanceRent"],
    });
    await expect(createReservationCheckout({
      reservation: reservation(),
      applicantId: "user-1",
      frontendUrl: "https://app.example",
      gateway: jest.fn(),
    })).rejects.toMatchObject({
      code: "LEGACY_PAYMENT_DATA_INCOMPLETE",
      statusCode: 422,
    });
  });
});
