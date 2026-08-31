import { describe, expect, test } from "@jest/globals";
import {
  resolveVerifiedSecurityDepositHeld,
  securityDepositEvidenceInternals,
} from "./securityDepositEvidenceService.js";

const reservation = (extra = {}) => ({
  _id: "66d000000000000000000001",
  securityDepositHeld: null,
  securityDepositLedger: [],
  pricingSnapshot: { securityDepositAmount: 6300 },
  approvedMonthlyRate: 6300,
  ...extra,
});

const paidInitialBill = (extra = {}) => ({
  _id: "66d000000000000000000010",
  billType: "initial_payment",
  status: "paid",
  totalAmount: 12600,
  paidAmount: 12600,
  remainingAmount: 0,
  initialPaymentBreakdown: { advanceRent: 6300, securityDeposit: 6300 },
  ...extra,
});

describe("Room Transfer security-deposit evidence", () => {
  test("fully paid initial_payment Bill with an explicit deposit proves exact held cash", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation(),
      bills: [paidInitialBill()],
      payments: [{ _id: "66d000000000000000000020", status: "confirmed", amount: 12600 }],
    });
    expect(result).toMatchObject({ classification: "VERIFIED", heldKnown: true, amount: 6300 });
    expect(result.billIds).toEqual(["66d000000000000000000010"]);
    expect(result.paymentIds).toEqual(["66d000000000000000000020"]);
  });

  test("pricing requirement alone is not payment evidence", async () => {
    await expect(resolveVerifiedSecurityDepositHeld({ reservation: reservation(), bills: [], payments: [] }))
      .resolves.toMatchObject({ classification: "UNKNOWN", heldKnown: false, amount: null });
  });

  test("approved monthly rate alone is not payment evidence", async () => {
    await expect(resolveVerifiedSecurityDepositHeld({
      reservation: reservation({ pricingSnapshot: null, approvedMonthlyRate: 6300 }),
      bills: [],
      payments: [],
    })).resolves.toMatchObject({ classification: "UNKNOWN", heldKnown: false });
  });

  test("explicit but unsettled deposit evidence requires manual reconciliation", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation(),
      bills: [paidInitialBill({ status: "partial", paidAmount: 9000, remainingAmount: 3600 })],
      payments: [],
    });
    expect(result).toMatchObject({ classification: "PARTIALLY_PROVABLE", heldKnown: false });
  });

  test("multiple paid initial Bills require reconciliation even when their deposit amounts match", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation(),
      bills: [
        paidInitialBill(),
        paidInitialBill({ _id: "66d000000000000000000011" }),
      ],
      payments: [],
    });
    expect(result).toMatchObject({
      classification: "PARTIALLY_PROVABLE",
      heldKnown: false,
      amount: null,
      source: "multiple_paid_initial_payment_bills",
    });
  });

  test("malformed ledger arithmetic is not accepted as proof of cash held", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation({
        securityDepositLedger: [{
          kind: "backfill",
          previousHeld: null,
          adjustmentAmount: 0,
          resultingHeld: 6300,
          billId: "66d000000000000000000010",
          idempotencyKey: "legacy-malformed-entry",
        }],
      }),
      bills: [],
      payments: [],
    });
    expect(result).toMatchObject({
      classification: "PARTIALLY_PROVABLE",
      heldKnown: false,
      source: "incomplete_deposit_ledger",
    });
  });

  test("a Contract-sourced ledger requirement is not accepted as proof of cash held", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation({
        securityDepositLedger: [{
          kind: "backfill",
          previousHeld: null,
          adjustmentAmount: 6300,
          resultingHeld: 6300,
          sourceRef: { kind: "contract", id: "66d000000000000000000030" },
          idempotencyKey: "legacy-contract-assumption",
        }],
      }),
      bills: [],
      payments: [],
    });
    expect(result).toMatchObject({ classification: "PARTIALLY_PROVABLE", heldKnown: false });
  });

  test("a sourced, idempotent ledger entry with reconciled arithmetic proves held cash", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation({
        securityDepositLedger: [{
          kind: "move_in",
          previousHeld: null,
          adjustmentAmount: 6300,
          resultingHeld: 6300,
          billId: "66d000000000000000000010",
          idempotencyKey: "move_in_deposit:66d000000000000000000010",
        }],
      }),
      bills: [],
      payments: [],
    });
    expect(result).toMatchObject({
      classification: "VERIFIED",
      heldKnown: true,
      amount: 6300,
      source: "securityDepositLedger.move_in",
    });
  });

  test("canonical zero is verified zero and is not confused with unknown", async () => {
    const result = await resolveVerifiedSecurityDepositHeld({
      reservation: reservation({ securityDepositHeld: 0 }),
      bills: [],
      payments: [],
    });
    expect(result).toMatchObject({ classification: "VERIFIED", heldKnown: true, amount: 0 });
  });

  test("settlement proof requires paid status, zero remaining, and paid total", () => {
    expect(securityDepositEvidenceInternals.billIsFullySettled(paidInitialBill())).toBe(true);
    expect(securityDepositEvidenceInternals.billIsFullySettled(paidInitialBill({ paidAmount: 10000 }))).toBe(false);
    expect(securityDepositEvidenceInternals.billIsFullySettled(paidInitialBill({ remainingAmount: 1 }))).toBe(false);
  });
});
