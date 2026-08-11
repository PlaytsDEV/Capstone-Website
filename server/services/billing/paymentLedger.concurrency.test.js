/**
 * ============================================================================
 * PAYMENT LEDGER — CONCURRENCY & OVERPAYMENT TESTS (Phase 4+6)
 * ============================================================================
 */

import { applyBillPayment } from "./paymentLedger.js";

// ---------------------------------------------------------------------------
// Helpers — reconstructed fresh in each test
// ---------------------------------------------------------------------------

let createdPayments;
let mockPaymentModel;

function makeMockPaymentModel() {
  createdPayments = [];
  mockPaymentModel = {
    create: async (payload) => {
      const payment = { _id: `pay-${Date.now()}-${Math.random()}`, ...payload };
      createdPayments.push(payment);
      return payment;
    },
    findOne: async ({ externalPaymentId }) => {
      return createdPayments.find((p) => p.externalPaymentId === externalPaymentId) || null;
    },
    deleteOne: async ({ _id }) => {
      createdPayments = createdPayments.filter((p) => p._id !== _id);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBill(overrides = {}) {
  const bill = {
    _id: "bill-001",
    userId: "user-001",
    branch: "gil-puyat",
    billType: "monthly",
    charges: { rent: 5000, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
    grossAmount: 5000,
    totalAmount: 5000,
    paidAmount: 0,
    remainingAmount: 5000,
    reservationCreditApplied: 0,
    status: "pending",
    publicationState: "published",
    paymentState: "unpaid",
    dueState: "current",
    dueDate: null,
    paymentDate: null,
    paymentMethod: null,
    sentAt: new Date(),
    issuedAt: new Date(),
    isManuallyAdjusted: false,
    // Plain async function (no jest.fn needed — we just assert on bill fields, not save call count)
    save: async function () { return this; },
    ...overrides,
  };
  // Ensure amounts are synced
  bill.remainingAmount = Math.max(0, (bill.totalAmount || 0) - (bill.paidAmount || 0));
  return bill;
}

const basePaymentArgs = {
  method: "gcash",
  source: "admin-manual",
  actorId: "admin-001",
  referenceNumber: "REF-001",
  notes: "",
  metadata: {},
  proofImageUrl: null,
  now: new Date(),
  session: null,
};

// ---------------------------------------------------------------------------
// Exact payment
// ---------------------------------------------------------------------------

describe("applyBillPayment — exact payment", () => {
  beforeEach(makeMockPaymentModel);

  it("creates exactly one Payment record and sets bill to paid", async () => {
    const bill = makeBill();
    const { appliedAmount, payment } = await applyBillPayment({
      bill,
      amount: 5000,
      paymentModel: mockPaymentModel,
      ...basePaymentArgs,
    });

    expect(appliedAmount).toBe(5000);
    expect(payment).toBeDefined();
    expect(createdPayments).toHaveLength(1);
    expect(bill.paidAmount).toBe(5000);
    expect(bill.remainingAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Partial payment
// ---------------------------------------------------------------------------

describe("applyBillPayment — partial payment", () => {
  beforeEach(makeMockPaymentModel);

  it("applies partial amount and preserves remaining balance", async () => {
    const bill = makeBill();
    const { appliedAmount } = await applyBillPayment({
      bill,
      amount: 2000,
      paymentModel: mockPaymentModel,
      ...basePaymentArgs,
    });

    expect(appliedAmount).toBe(2000);
    expect(bill.paidAmount).toBe(2000);
    expect(bill.remainingAmount).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Overpayment rejection (Phase 4)
// ---------------------------------------------------------------------------

describe("applyBillPayment — overpayment rejection", () => {
  beforeEach(makeMockPaymentModel);

  it("throws OVERPAYMENT_REJECTED when amount > remaining + 0.01", async () => {
    const bill = makeBill();
    await expect(
      applyBillPayment({
        bill,
        amount: 5001, // ₱1 over remaining ₱5000
        paymentModel: mockPaymentModel,
        ...basePaymentArgs,
      }),
    ).rejects.toThrow(/OVERPAYMENT_REJECTED/);

    // No payment created
    expect(createdPayments).toHaveLength(0);
    // Bill amounts unchanged
    expect(bill.paidAmount).toBe(0);
  });

  it("allows payment within 1-cent tolerance of remaining (no overpayment error)", async () => {
    const bill = makeBill({ totalAmount: 5000.00, remainingAmount: 5000.00 });
    // ₱5000.005 — within 1-cent tolerance of ₱5000
    await expect(
      applyBillPayment({
        bill,
        amount: 5000.005,
        paymentModel: mockPaymentModel,
        ...basePaymentArgs,
      }),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Duplicate externalPaymentId (idempotency)
// ---------------------------------------------------------------------------

describe("applyBillPayment — duplicate externalPaymentId", () => {
  beforeEach(makeMockPaymentModel);

  it("returns reused: true and creates no second Payment on duplicate", async () => {
    const bill = makeBill();
    const extId = "paymongo-evt-001";

    // First call
    await applyBillPayment({
      bill,
      amount: 5000,
      externalPaymentId: extId,
      paymentModel: mockPaymentModel,
      ...basePaymentArgs,
    });
    expect(createdPayments).toHaveLength(1);

    // Second call with same externalPaymentId (simulates duplicate webhook)
    const bill2 = makeBill();
    const result2 = await applyBillPayment({
      bill: bill2,
      amount: 5000,
      externalPaymentId: extId,
      paymentModel: mockPaymentModel,
      ...basePaymentArgs,
    });

    // Still only one payment in the mock store
    expect(createdPayments).toHaveLength(1);
    expect(result2.reused).toBe(true);
    expect(result2.appliedAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Zero remaining balance guard
// ---------------------------------------------------------------------------

describe("applyBillPayment — zero remaining balance", () => {
  beforeEach(makeMockPaymentModel);

  it("throws on already-paid bill", async () => {
    const bill = makeBill({ paidAmount: 5000, remainingAmount: 0 });
    await expect(
      applyBillPayment({
        bill,
        amount: 100,
        paymentModel: mockPaymentModel,
        ...basePaymentArgs,
      }),
    ).rejects.toThrow(/remaining balance/);
  });
});

// ---------------------------------------------------------------------------
// No negative balance invariant
// ---------------------------------------------------------------------------

describe("payment ledger — no negative balance invariant", () => {
  beforeEach(makeMockPaymentModel);

  it("remainingAmount is never negative after payment", async () => {
    const bill = makeBill();
    await applyBillPayment({
      bill,
      amount: 5000,
      paymentModel: mockPaymentModel,
      ...basePaymentArgs,
    });
    expect(bill.remainingAmount).toBeGreaterThanOrEqual(0);
  });
});
