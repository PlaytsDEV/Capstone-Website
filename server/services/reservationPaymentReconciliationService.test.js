import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const findOneAndUpdate = jest.fn();
const findById = jest.fn();
await jest.unstable_mockModule("../models/index.js", () => ({
  Reservation: { findOneAndUpdate, findById },
}));
await jest.unstable_mockModule("./occupancy/occupancyManager.js", () => ({
  updateOccupancyOnReservationChange: jest.fn(),
}));

const { reconcileReservationPayment } =
  await import("./reservationPaymentReconciliationService.js");

const record = () => ({
  _id: "reservation-1",
  occupancySyncStatus: "pending",
  save: jest.fn(async function save() { return this; }),
});
describe("reconcileReservationPayment", () => {
  beforeEach(() => jest.clearAllMocks());

  test("records a retryable failure after payment confirmation", async () => {
    const reservation = record();
    findOneAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(reservation),
    });
    const result = await reconcileReservationPayment("reservation-1", {
      occupancyUpdater: jest.fn().mockRejectedValue(new Error("temporary failure")),
    });
    expect(result.status).toBe("failed");
    expect(reservation.paymentReconciliationStatus).toBe("failed");
    expect(reservation.occupancySyncStatus).toBe("failed");
    expect(reservation.save).toHaveBeenCalled();
  });

  test("a later retry completes occupancy exactly once", async () => {
    const reservation = record();
    reservation.occupancySyncStatus = "failed";
    findOneAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(reservation),
    });
    const occupancyUpdater = jest.fn().mockResolvedValue(undefined);
    const result = await reconcileReservationPayment("reservation-1", {
      occupancyUpdater,
    });
    expect(result.status).toBe("completed");
    expect(occupancyUpdater).toHaveBeenCalledTimes(1);
    expect(reservation.occupancySyncStatus).toBe("completed");
  });
});
