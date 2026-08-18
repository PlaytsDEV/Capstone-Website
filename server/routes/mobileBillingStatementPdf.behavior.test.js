import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import express from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { BILL_STATEMENT_TEMPLATE_VERSION } from "../services/billingStatementTemplate.js";

const TENANT_ID = "64b000000000000000000001";
const BILL_ID = "64b000000000000000000002";
const serverRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lilycrest-statement-route-"));
const pdfRoot = path.join(serverRoot, "uploads", "bills");
const relativePdfPath = path.join("uploads", "bills", `${BILL_ID}.pdf`);
const absolutePdfPath = path.join(serverRoot, relativePdfPath);

const bill = {
  _id: BILL_ID,
  userId: TENANT_ID,
  reservationId: null,
  isArchived: false,
  pdfPath: relativePdfPath,
  pdfGeneratedAt: new Date("2026-08-17T00:01:00.000Z"),
  updatedAt: new Date("2026-08-17T00:00:00.000Z"),
  pdfTemplateVersion: BILL_STATEMENT_TEMPLATE_VERSION - 1,
};

function queryResult(result) {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

const billFindOne = jest.fn(() => queryResult(bill));
const generateRentBillPdf = jest.fn(async ({ bill: target }) => {
  await fsPromises.mkdir(pdfRoot, { recursive: true });
  await fsPromises.writeFile(absolutePdfPath, "%PDF-canonical-template-v2\n");
  target.pdfPath = relativePdfPath;
  target.pdfGeneratedAt = new Date("2026-08-17T00:02:00.000Z");
  target.pdfTemplateVersion = BILL_STATEMENT_TEMPLATE_VERSION;
  return relativePdfPath;
});

await jest.unstable_mockModule("../models/index.js", () => ({
  Bill: { find: jest.fn(), findOne: billFindOne, findById: jest.fn() },
  Reservation: { findById: jest.fn() },
}));
await jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, _res, next) => {
    req.mobileTenant = { _id: TENANT_ID };
    next();
  },
}));
await jest.unstable_mockModule("../controllers/billing/_helpers.js", () => ({
  generateRentBillPdf,
  generateCanonicalBillReceiptPdf: jest.fn(),
  formatBillReference: jest.fn(() => "LC-RB-RUNTIME"),
  buildTenantUtilityBreakdown: jest.fn(async () => null),
  SERVER_ROOT: serverRoot,
  BILL_PDF_ROOT: pdfRoot,
  isPathInsideBillingPdfRoot: jest.fn((candidate) => candidate.startsWith(pdfRoot)),
}));
await jest.unstable_mockModule("../services/mobileBillingBridge.js", () => ({
  toMobileBill: jest.fn((value) => value),
  isMobileEffectivelyPaid: jest.fn(() => false),
  toMobilePaymentMethodLabel: jest.fn(() => null),
  formatMobileElectricityBreakdown: jest.fn(() => null),
  formatMobileWaterBreakdown: jest.fn(() => null),
}));
await jest.unstable_mockModule("../utils/billingPolicy.js", () => ({
  getVisibleBillCharges: jest.fn(() => ({})),
  getVisibleBillSnapshot: jest.fn((value) => value),
}));
await jest.unstable_mockModule("../utils/pdfGenerator.js", () => ({
  generateBillReceiptPdf: jest.fn(),
}));

const { default: mobileBillingRoutes } = await import("./mobileBillingRoutes.js");

let server;
let baseUrl;

beforeAll(async () => {
  await fsPromises.mkdir(pdfRoot, { recursive: true });
  await fsPromises.writeFile(absolutePdfPath, "%PDF-stale-template-v1\n");
  const app = express();
  app.use("/api/m", mobileBillingRoutes);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fsPromises.rm(serverRoot, { recursive: true, force: true });
});

describe("mounted mobile billing statement route", () => {
  test("template-version mismatch invokes the canonical generator instead of serving stale bytes", async () => {
    const response = await fetch(`${baseUrl}/api/m/billing/${BILL_ID}/pdf`);
    expect(response.status).toBe(200);
    expect(generateRentBillPdf).toHaveBeenCalledWith({
      bill,
      reservation: { userId: bill.userId, roomId: undefined },
    });
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-canonical-template-v2\n");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  test("a current-template PDF is reused without unnecessary regeneration", async () => {
    generateRentBillPdf.mockClear();
    await fsPromises.writeFile(absolutePdfPath, "%PDF-current-template-v2\n");
    bill.pdfTemplateVersion = BILL_STATEMENT_TEMPLATE_VERSION;
    bill.pdfGeneratedAt = new Date("2026-08-17T00:01:00.000Z");
    bill.updatedAt = new Date("2026-08-17T00:00:00.000Z");

    const response = await fetch(`${baseUrl}/api/m/billing/${BILL_ID}/pdf`);
    expect(response.status).toBe(200);
    expect(generateRentBillPdf).not.toHaveBeenCalled();
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-current-template-v2\n");
  });
});
