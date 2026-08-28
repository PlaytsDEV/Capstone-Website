import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const syncBillAmounts = jest.fn((bill, { now } = {}) => {
  bill.releasedAt = now;
  return bill;
});
const saveBill = jest.fn(async function save() {
  return this;
});
const Bill = jest.fn().mockImplementation((data) => ({ ...data, isNew: true, save: saveBill }));
Bill.findOne = jest.fn();

const AuditLog = { create: jest.fn() };
const Payment = { findOne: jest.fn() };
const Reservation = { findById: jest.fn(), updateOne: jest.fn() };
const Room = { findById: jest.fn() };
const Stay = { findOne: jest.fn() };
const notifyGeneral = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  AuditLog,
  Bill,
  Payment,
  Reservation,
  Room,
  Stay,
}));
await jest.unstable_mockModule("../config/structuredInitialPayment.js", () => ({
  STRUCTURED_INITIAL_PAYMENT_WORKFLOW: "structured-initial-payment-v1",
  usesStructuredInitialPayment: () => true,
}));
await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: { general: notifyGeneral },
}));
await jest.unstable_mockModule("./billing/billingPolicy.js", () => ({
  syncBillAmounts,
}));

const {
  createStructuredInitialPaymentBill,
  getStructuredMoveInBlockers,
} = await import("./structuredInitialPaymentService.js");

describe("structured initial-payment release metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Bill.findOne.mockResolvedValue(null);
    AuditLog.create.mockResolvedValue({});
    notifyGeneral.mockResolvedValue({});
  });

  test("synchronizes release metadata before the bill's first save", async () => {
    const now = new Date("2026-08-17T04:00:00.000Z");
    const reservation = {
      _id: "reservation-1",
      userId: "tenant-1",
      roomId: "room-1",
      pricingSnapshot: {
        approvedAt: new Date("2026-08-16T00:00:00.000Z"),
        branchId: "gil-puyat",
        snapshotVersion: 1,
        reservationFeeAmount: 2000,
        advanceRentAmount: 6300,
        securityDepositAmount: 6300,
        approvedInitialCharges: 0,
      },
      save: jest.fn().mockResolvedValue({}),
    };
    const reservationFeePayment = {
      _id: "payment-1",
      status: "confirmed",
      method: "paymongo",
      paidAmount: 2000,
    };

    const result = await createStructuredInitialPaymentBill({
      reservation,
      reservationFeePayment,
      now,
    });

    expect(result.status).toBe("created");
    expect(syncBillAmounts).toHaveBeenCalledWith(result.bill, { now });
    expect(result.bill.releasedAt).toEqual(now);
    expect(syncBillAmounts.mock.invocationCallOrder[0]).toBeLessThan(saveBill.mock.invocationCallOrder[0]);
  });
});

describe("getStructuredMoveInBlockers", () => {
  test("blocks move-in when cancellation request is pending", async () => {
    const reservation = {
      _id: "reservation-1",
      financialWorkflowVersion: "structured-initial-payment-v1",
      cancellationRequested: true,
      cancellationStatus: "pending",
      reservationFeePaymentStatus: "verified",
      pricingSnapshot: { approvedAt: new Date() },
    };

    const blockers = await getStructuredMoveInBlockers(reservation);
    expect(blockers).toContain(
      "A pending cancellation request must be resolved (approved or rejected) before moving in the tenant.",
    );
  });
});
