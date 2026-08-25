/**
 * ============================================================================
 * SETTLE PAYMONGO BILL — CROSS-PATH IDEMPOTENCY
 * ============================================================================
 *
 * A paid PayMongo checkout session can now be settled through three
 * independent entry points: a live webhook, the tenant-facing checkout
 * retry/reuse check, and the scheduled paymongoReconciliationService sweep.
 * Whichever reaches the session first must be the only one that writes a
 * ledger entry — dedup must be keyed on the canonical PayMongo payment ID
 * (paymongoPaymentId / externalPaymentId), never a session status string,
 * since more than one of these paths can legitimately observe "paid".
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const paymentCreate = jest.fn();
const paymentFindOne = jest.fn();
const paymentDeleteOne = jest.fn();
const syncStructuredReservationAfterBillSettlement = jest.fn();
const quarantineStructuredSettlementMismatch = jest.fn();

let createdPayments;

await jest.unstable_mockModule("../../models/Payment.js", () => ({
  default: {
    create: paymentCreate,
    findOne: paymentFindOne,
    deleteOne: paymentDeleteOne,
  },
}));

await jest.unstable_mockModule("../structuredInitialPaymentService.js", () => ({
  syncStructuredReservationAfterBillSettlement,
  quarantineStructuredSettlementMismatch,
}));

const { settlePaymongoBill } = await import("./billSettlement.js");

function makeBill(overrides = {}) {
  const bill = {
    _id: "bill-cross-1",
    userId: "user-1",
    branch: "gil-puyat",
    billType: "monthly",
    charges: {
      rent: 10600,
      electricity: 0,
      water: 0,
      applianceFees: 0,
      corkageFees: 0,
      penalty: 0,
      discount: 0,
    },
    grossAmount: 10600,
    totalAmount: 10600,
    paidAmount: 0,
    remainingAmount: 10600,
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
    save: async function save() {
      return this;
    },
    ...overrides,
  };
  bill.remainingAmount = Math.max(0, (bill.totalAmount || 0) - (bill.paidAmount || 0));
  return bill;
}

describe("settlePaymongoBill — cross-path idempotency", () => {
  beforeEach(() => {
    createdPayments = [];
    paymentCreate.mockImplementation(async (payload) => {
      const payment = { _id: `pay-${createdPayments.length + 1}`, ...payload };
      createdPayments.push(payment);
      return payment;
    });
    paymentFindOne.mockImplementation(({ externalPaymentId } = {}) =>
      Promise.resolve(
        createdPayments.find((p) => p.externalPaymentId === externalPaymentId) || null,
      ),
    );
    syncStructuredReservationAfterBillSettlement.mockResolvedValue(undefined);
  });

  test("reconciliation settles first; a later delayed webhook replay for the same PayMongo payment is a safe no-op", async () => {
    const bill = makeBill();
    const paymentReference = "paymongo-pay-abc123";

    const reconciliationResult = await settlePaymongoBill({
      bill,
      paymentReference,
      settledAmount: 10600,
      source: "paymongo-reconciliation",
      metadata: { sessionId: "cs_1", sessionType: "bill", currency: "PHP" },
    });

    expect(reconciliationResult.applied).toBe(true);
    expect(reconciliationResult.appliedAmount).toBe(10600);
    expect(createdPayments).toHaveLength(1);
    expect(bill.paidAmount).toBe(10600);
    expect(bill.remainingAmount).toBe(0);

    // The originally-missed webhook eventually arrives for the SAME PayMongo payment.
    const webhookResult = await settlePaymongoBill({
      bill,
      paymentReference,
      settledAmount: 10600,
      source: "paymongo-webhook",
      metadata: { sessionId: "cs_1", sessionType: "bill", currency: "PHP" },
    });

    expect(webhookResult.applied).toBe(false);
    expect(webhookResult.reason).toBe("already_applied");
    expect(webhookResult.appliedAmount).toBe(0);
    // No second Payment ledger entry and no double reduction of the bill balance.
    expect(createdPayments).toHaveLength(1);
    expect(bill.paidAmount).toBe(10600);
    expect(bill.remainingAmount).toBe(0);
  });

  test("running reconciliation twice for the same paid checkout does not double-settle", async () => {
    const bill = makeBill();
    const paymentReference = "paymongo-pay-xyz789";
    const args = {
      bill,
      paymentReference,
      settledAmount: 10600,
      source: "paymongo-reconciliation",
      metadata: { sessionId: "cs_2", sessionType: "bill", currency: "PHP" },
    };

    const first = await settlePaymongoBill(args);
    const second = await settlePaymongoBill(args);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.reason).toBe("already_applied");
    expect(createdPayments).toHaveLength(1);
    expect(bill.paidAmount).toBe(10600);
    expect(bill.remainingAmount).toBe(0);
  });

  test("webhook settles first; a later reconciliation pass over the same still-listed session is a safe no-op", async () => {
    const bill = makeBill();
    const paymentReference = "paymongo-pay-def456";

    const webhookResult = await settlePaymongoBill({
      bill,
      paymentReference,
      settledAmount: 10600,
      source: "paymongo-webhook",
      metadata: { sessionId: "cs_3", sessionType: "bill", currency: "PHP" },
    });
    const reconciliationResult = await settlePaymongoBill({
      bill,
      paymentReference,
      settledAmount: 10600,
      source: "paymongo-reconciliation",
      metadata: { sessionId: "cs_3", sessionType: "bill", currency: "PHP" },
    });

    expect(webhookResult.applied).toBe(true);
    expect(reconciliationResult.applied).toBe(false);
    expect(reconciliationResult.reason).toBe("already_applied");
    expect(createdPayments).toHaveLength(1);
    expect(bill.paidAmount).toBe(10600);
  });
});
