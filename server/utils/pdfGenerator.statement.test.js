import { afterEach, describe, expect, test } from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { generateBillPdf } from "./pdfGenerator.js";
import {
  BILL_STATEMENT_TEMPLATE_MARKER,
  BILL_STATEMENT_TEMPLATE_VERSION,
} from "../services/billingStatementTemplate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const generatedFiles = [];

afterEach(async () => {
  await Promise.all(generatedFiles.splice(0).map((file) => fs.rm(file, { force: true })));
});

describe("canonical billing statement template", () => {
  test("generated PDF carries the canonical template marker in document metadata", async () => {
    const id = `statement-template-${process.pid}-${Date.now()}`;
    const relativePath = await generateBillPdf({
      bill: {
        _id: id,
        userId: "tenant-1",
        billingMonth: new Date("2026-08-01T00:00:00.000Z"),
        issuedAt: new Date("2026-08-16T00:00:00.000Z"),
        dueDate: new Date("2026-08-23T00:00:00.000Z"),
        charges: { rent: 5400, electricity: 500 },
        totalAmount: 5900,
      },
      billingResult: null,
      period: {
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-09-01T00:00:00.000Z"),
        branch: "gil-puyat",
      },
      room: { roomNumber: "GP-202", branch: "gil-puyat" },
      tenant: { firstName: "Ava", lastName: "Guest" },
    });
    const absolutePath = path.resolve(here, "..", relativePath);
    generatedFiles.push(absolutePath);

    const parsed = await PdfLibDocument.load(await fs.readFile(absolutePath), {
      updateMetadata: false,
    });
    expect(parsed.getProducer()).toContain(BILL_STATEMENT_TEMPLATE_MARKER);
    expect(parsed.getKeywords()).toContain(BILL_STATEMENT_TEMPLATE_MARKER);
    expect(BILL_STATEMENT_TEMPLATE_VERSION).toBeGreaterThan(1);
  });
});
