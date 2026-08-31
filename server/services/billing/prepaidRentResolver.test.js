import { describe, expect, jest, test } from "@jest/globals";

const billFindOne = jest.fn();
const billFindById = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Bill: { findOne: billFindOne, findById: billFindById },
}));

const { resolveApplicablePrepaidRentForTransfer, resolveSourceEffectiveRentForTransfer } =
  await import("./prepaidRentResolver.js");

function mockBillResult(bill) {
  billFindOne.mockReturnValue({ session: jest.fn().mockResolvedValue(bill) });
}

function mockInitialBillResult(bill) {
  billFindById.mockReturnValue({ session: jest.fn().mockResolvedValue(bill) });
}

describe("resolveSourceEffectiveRentForTransfer", () => {
  const predecessorContract = { approvedMonthlyRate: 6300 };

  test("flat-rate reservation (no pricingSnapshot): uses the predecessor Contract's approved rate", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      reservation: { financialWorkflowVersion: null },
      predecessorContract,
    });
    expect(result).toEqual({ sourceEffectiveRate: 6300, sourceRateSource: "contract_approved_monthly_rate" });
  });

  test("structured reservation with an approved discount: uses pricingSnapshot.finalMonthlyRate, NOT the (undiscounted) Contract rate", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      reservation: {
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: { approvedAt: new Date(), regularMonthlyRate: 6300, finalMonthlyRate: 5400 },
      },
      predecessorContract, // approvedMonthlyRate: 6300 — deliberately different (e.g. post-renewal drift)
    });
    expect(result).toEqual({ sourceEffectiveRate: 5400, sourceRateSource: "structured_final_monthly_rate" });
  });

  test("structured reservation with no discount: matches the equivalent flat-rate result", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      reservation: {
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: { approvedAt: new Date(), regularMonthlyRate: 6300, finalMonthlyRate: 6300 },
      },
      predecessorContract,
    });
    expect(result).toEqual({ sourceEffectiveRate: 6300, sourceRateSource: "structured_final_monthly_rate" });
  });

  test("structured reservation with an unapproved snapshot: falls back to the Contract rate", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      reservation: {
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: { approvedAt: null, finalMonthlyRate: 5400 },
      },
      predecessorContract,
    });
    expect(result).toEqual({ sourceEffectiveRate: 6300, sourceRateSource: "contract_approved_monthly_rate" });
  });

  // ── B9: multi-transfer source rate ──────────────────────────────────────
  // recurringRentRate is set by a PRIOR transfer's cutover to that transfer's
  // destination approved rate. On the NEXT transfer it is the tenant's
  // current effective recurring rent and must be the SOURCE rate.

  test("B9 — prior-transfer recurringRentRate wins over the immutable original pricingSnapshot", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      // Structured tenant, originally Quad @ 5400 (still on the snapshot),
      // already transferred once to Double @ 8000 (recurringRentRate).
      reservation: {
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: { approvedAt: new Date(), regularMonthlyRate: 6000, finalMonthlyRate: 5400 },
        recurringRentRate: 8000,
      },
      predecessorContract: { approvedMonthlyRate: 5400 },
    });
    expect(result).toEqual({ sourceEffectiveRate: 8000, sourceRateSource: "prior_transfer_recurring_rate" });
  });

  test("B9 — prior-transfer recurringRentRate wins over the predecessor Contract rate for a flat-rate tenant", () => {
    const result = resolveSourceEffectiveRentForTransfer({
      reservation: { financialWorkflowVersion: null, recurringRentRate: 8000 },
      predecessorContract: { approvedMonthlyRate: 6300 },
    });
    expect(result).toEqual({ sourceEffectiveRate: 8000, sourceRateSource: "prior_transfer_recurring_rate" });
  });

  test("no prior transfer (recurringRentRate unset/null/0): precedence is unchanged", () => {
    expect(
      resolveSourceEffectiveRentForTransfer({
        reservation: { financialWorkflowVersion: null, recurringRentRate: null },
        predecessorContract: { approvedMonthlyRate: 6300 },
      }),
    ).toEqual({ sourceEffectiveRate: 6300, sourceRateSource: "contract_approved_monthly_rate" });
    expect(
      resolveSourceEffectiveRentForTransfer({
        reservation: { financialWorkflowVersion: null, recurringRentRate: 0 },
        predecessorContract: { approvedMonthlyRate: 6300 },
      }),
    ).toEqual({ sourceEffectiveRate: 6300, sourceRateSource: "contract_approved_monthly_rate" });
  });
});

describe("resolveApplicablePrepaidRentForTransfer", () => {
  const sourceEffectiveRate = 6300;

  test("first period (cycleIndex 0), flat-rate reservation: uses the resolved source-effective rate", async () => {
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r1", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-08-01"), cycleIndex: 0 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "initial_period_contract_rate",
      sourceBillId: null,
      sourceBillType: null,
    });
    expect(billFindOne).not.toHaveBeenCalled();
  });

  test("first period, structured reservation: uses pricingSnapshot.advanceRentAmount, not the source-effective rate parameter", async () => {
    const reservation = {
      _id: "r2",
      financialWorkflowVersion: "structured-initial-payment-v1",
      pricingSnapshot: { approvedAt: new Date(), advanceRentAmount: 5400 },
      initialPaymentBillId: "bill-initial",
    };
    mockInitialBillResult({
      _id: "bill-initial",
      billType: "initial_payment",
      status: "paid",
      remainingAmount: 0,
      initialPaymentBreakdown: { advanceRent: 5400 },
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation,
      sourceEffectiveRate: 5400,
      currentBillingCycle: { billingCycleStart: new Date("2026-08-01"), cycleIndex: 0 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 5400,
      prepaidRentSource: "verified_initial_payment_bill",
      sourceBillId: "bill-initial",
      sourceBillType: "initial_payment",
    });
    expect(billFindOne).not.toHaveBeenCalled();
  });

  test("structured reservation missing an approved snapshot falls back to the source-effective rate", async () => {
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: {
        _id: "r3",
        financialWorkflowVersion: "structured-initial-payment-v1",
        pricingSnapshot: { approvedAt: null },
      },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-08-01"), cycleIndex: 0 },
    });
    expect(result.prepaidRentSource).toBe("initial_period_contract_rate");
    expect(result.applicablePrepaidRent).toBe(6300);
  });

  test("later period, fully paid current-period Bill: uses the Bill's rent charge", async () => {
    mockBillResult({
      _id: "bill-2",
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      paidAmount: 6300,
      remainingAmount: 0,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r4", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-2",
      sourceBillType: "monthly",
    });
  });

  test("later period, NO current-period Bill found: does NOT assume full prepaid rent — credit is zero", async () => {
    mockBillResult(null);
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r5", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 0,
      prepaidRentSource: "no_current_bill_unfunded",
      sourceBillId: null,
      sourceBillType: null,
    });
  });

  test("later period, unpaid current-period Bill: reconciles the rent already billed", async () => {
    mockBillResult({
      _id: "bill-3",
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      paidAmount: 0,
      remainingAmount: 6300,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r6", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-3",
      sourceBillType: "monthly",
    });
  });

  test("later period, partially paid rent-only Bill: reconciles the full rent already billed", async () => {
    mockBillResult({
      _id: "bill-4",
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      paidAmount: 3000,
      remainingAmount: 3300,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r7", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-4",
      sourceBillType: "monthly",
    });
  });

  test("later period, partially paid mixed Bill: reconciles only its full rent charge", async () => {
    mockBillResult({
      _id: "bill-5",
      charges: { rent: 6300, electricity: 800, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      paidAmount: 5000,
      remainingAmount: 2100,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r8", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-5",
      sourceBillType: "monthly",
    });
  });

  test("later period, fully paid MIXED Bill: still uses the rent charge (fully-funded case is unambiguous)", async () => {
    mockBillResult({
      _id: "bill-6",
      charges: { rent: 6300, electricity: 800, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      paidAmount: 7100,
      remainingAmount: 0,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r9", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-6",
      sourceBillType: "monthly",
    });
  });

  test("penalty on a partially paid Bill does not change its represented rent liability", async () => {
    mockBillResult({
      _id: "bill-7",
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 500, discount: 0 },
      paidAmount: 500,
      remainingAmount: 6300,
    });
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r10", financialWorkflowVersion: null },
      sourceEffectiveRate,
      currentBillingCycle: { billingCycleStart: new Date("2026-09-01"), cycleIndex: 1 },
    });
    expect(result).toEqual({
      applicablePrepaidRent: 6300,
      prepaidRentSource: "current_bill_billed_rent",
      sourceBillId: "bill-7",
      sourceBillType: "monthly",
    });
  });

  test("missing currentBillingCycle: falls back to the source-effective rate without querying Bill", async () => {
    billFindOne.mockClear();
    const result = await resolveApplicablePrepaidRentForTransfer({
      reservation: { _id: "r11" },
      sourceEffectiveRate,
      currentBillingCycle: null,
    });
    expect(result.prepaidRentSource).toBe("contract_rate_fallback");
    expect(billFindOne).not.toHaveBeenCalled();
  });
});
