import { describe, expect, jest, test } from "@jest/globals";
import {
  buildBillReceiptSourceVersion,
  isBillReceiptStale,
  recordBillReceiptGeneration,
} from "./billReceiptCache.js";
import { BILL_RECEIPT_TEMPLATE_VERSION } from "./billingReceiptTemplate.js";

const bill = {
  _id: "bill-1",
  updatedAt: new Date("2026-08-18T00:00:00Z"),
  invoiceVersion: 2,
  paidAmount: 5900,
  remainingAmount: 0,
};
const payment = {
  _id: "payment-1",
  paymentId: "PAY-REAL-001",
  amount: 5900,
  method: "gcash",
  status: "paid",
  settlementTimestamp: new Date("2026-08-18T01:00:00Z"),
  updatedAt: new Date("2026-08-18T01:00:00Z"),
};

describe("bill Receipt cache provenance", () => {
  test("source version is stable for the same bill and payment ledger", () => {
    expect(buildBillReceiptSourceVersion(bill, [payment]))
      .toBe(buildBillReceiptSourceVersion({ ...bill }, [{ ...payment }]));
  });

  test("a changed settled payment invalidates old Receipt bytes", () => {
    expect(buildBillReceiptSourceVersion(bill, [payment]))
      .not.toBe(buildBillReceiptSourceVersion(bill, [{ ...payment, amount: 5800 }]));
  });

  test("template or source mismatches are stale", () => {
    const source = buildBillReceiptSourceVersion(bill, [payment]);
    expect(isBillReceiptStale({
      receiptPath: "uploads/bills/receipt-bill-1.pdf",
      receiptGeneratedAt: new Date(),
      receiptTemplateVersion: BILL_RECEIPT_TEMPLATE_VERSION - 1,
      receiptSourceVersion: source,
    }, source)).toBe(true);
    expect(isBillReceiptStale({
      receiptPath: "uploads/bills/receipt-bill-1.pdf",
      receiptGeneratedAt: new Date(),
      receiptTemplateVersion: BILL_RECEIPT_TEMPLATE_VERSION,
      receiptSourceVersion: source,
    }, "different")).toBe(true);
  });

  test("recording cache metadata does not advance business timestamps", async () => {
    const source = buildBillReceiptSourceVersion(bill, [payment]);
    const target = { updatedAt: bill.updatedAt, save: jest.fn().mockResolvedValue({}) };
    await recordBillReceiptGeneration(target, "uploads/bills/receipt-bill-1.pdf", source);
    expect(target.save).toHaveBeenCalledWith({ timestamps: false });
    expect(target.updatedAt).toBe(bill.updatedAt);
    expect(isBillReceiptStale(target, source)).toBe(false);
  });
});
