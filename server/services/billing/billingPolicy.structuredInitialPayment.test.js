import {
  getVisibleBillSnapshot,
  syncBillAmounts,
} from "./billingPolicy.js";

describe("structured initial-payment Bill visibility", () => {
  const bill = () => ({
    billType: "initial_payment",
    status: "pending",
    initialPaymentBreakdown: {
      advanceRent: 6300,
      securityDeposit: 6300,
      approvedInitialCharges: 0,
      reservationFeeCredit: 2000,
      grossInitialAmount: 12600,
      initialPaymentTotal: 10600,
    },
    grossAmount: 12600,
    totalAmount: 10600,
    paidAmount: 0,
    remainingAmount: 10600,
    charges: {},
  });

  test("does not collapse the authoritative initial-payment total to zero", () => {
    expect(getVisibleBillSnapshot(bill())).toMatchObject({
      grossAmount: 12600,
      totalAmount: 10600,
      remainingAmount: 10600,
      status: "pending",
    });
  });

  test("marks paid only when the full remaining balance is settled", () => {
    const partiallyPaid = bill();
    partiallyPaid.paidAmount = 5000;
    expect(getVisibleBillSnapshot(partiallyPaid)).toMatchObject({
      remainingAmount: 5600,
      status: "partially-paid",
    });
    partiallyPaid.paidAmount = 10600;
    expect(getVisibleBillSnapshot(partiallyPaid)).toMatchObject({
      remainingAmount: 0,
      status: "paid",
    });
  });

  test("sync preserves the structured total", () => {
    const candidate = bill();
    syncBillAmounts(candidate);
    expect(candidate.totalAmount).toBe(10600);
    expect(candidate.remainingAmount).toBe(10600);
  });
});
