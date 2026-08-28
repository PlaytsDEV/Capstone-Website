import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const settleInitialMoveInOnCheckIn = jest.fn();
const ReservationFind = jest.fn();
const BillFindById = jest.fn();
const BillFindOne = jest.fn();

await jest.unstable_mockModule("../services/billing/billSettlement.js", () => ({
  settleInitialMoveInOnCheckIn,
}));

await jest.unstable_mockModule("../models/index.js", () => ({
  Reservation: {
    find: ReservationFind,
  },
  Bill: {
    findById: BillFindById,
    findOne: BillFindOne,
  },
}));

const { reconcileAllMovedInInitialBills } = await import("./reconcileMovedInInitialBills.js");

describe("reconcileAllMovedInInitialBills", () => {
  beforeEach(() => {
    settleInitialMoveInOnCheckIn.mockReset();
    ReservationFind.mockReset();
    BillFindById.mockReset();
    BillFindOne.mockReset();
  });

  test("scans moved-in reservations and settles pending initial bills", async () => {
    const mockRes = {
      _id: "66bc00000000000000000001",
      status: "moveIn",
      initialPaymentBillId: "66bc00000000000000000002",
    };
    const mockBill = {
      _id: "66bc00000000000000000002",
      billType: "initial_payment",
      status: "pending",
      remainingAmount: 10600,
      totalAmount: 10600,
    };

    ReservationFind.mockResolvedValue([mockRes]);
    BillFindById.mockResolvedValue(mockBill);
    settleInitialMoveInOnCheckIn.mockResolvedValue({ settled: true });

    const summary = await reconcileAllMovedInInitialBills({ dryRun: false });
    expect(summary.scannedCount).toBe(1);
    expect(summary.reconciledCount).toBe(1);
    expect(settleInitialMoveInOnCheckIn).toHaveBeenCalledWith({
      reservation: mockRes,
      actorId: "system-reconciliation",
      paymentMethod: "offline_cash",
    });
  });
});
