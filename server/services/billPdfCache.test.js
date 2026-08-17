import { describe, expect, jest, test } from "@jest/globals";
import { isBillPdfStale, recordBillPdfGeneration } from "./billPdfCache.js";

describe("bill statement PDF cache", () => {
  test("treats a cached path without generation provenance as stale", () => {
    expect(isBillPdfStale({ pdfPath: "uploads/bills/a.pdf", updatedAt: new Date() })).toBe(true);
  });

  test("invalidates a PDF generated before the bill source revision", () => {
    expect(isBillPdfStale({
      pdfPath: "uploads/bills/a.pdf",
      pdfGeneratedAt: new Date("2026-08-16T00:00:00.000Z"),
      updatedAt: new Date("2026-08-17T00:00:00.000Z"),
    })).toBe(true);
  });

  test("keeps a PDF generated for the current source revision", () => {
    expect(isBillPdfStale({
      pdfPath: "uploads/bills/a.pdf",
      pdfGeneratedAt: new Date("2026-08-17T00:00:00.000Z"),
      updatedAt: new Date("2026-08-17T00:00:00.000Z"),
    })).toBe(false);
  });

  test("recording generated metadata does not advance updatedAt or self-invalidate", async () => {
    const updatedAt = new Date("2026-08-17T00:00:00.000Z");
    const bill = { updatedAt, save: jest.fn().mockResolvedValue({}) };

    await recordBillPdfGeneration(
      bill,
      "uploads/bills/a.pdf",
      new Date("2026-08-17T00:01:00.000Z"),
    );

    expect(bill.save).toHaveBeenCalledWith({ timestamps: false });
    expect(bill.updatedAt).toBe(updatedAt);
    expect(isBillPdfStale(bill)).toBe(false);
  });
});
