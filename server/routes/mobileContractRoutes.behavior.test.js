import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import express from "express";
import { Readable } from "stream";

const TENANT_ID = "64b000000000000000000001";
const CONTRACT_ID = "64b000000000000000000002";
const preparedV2 = {
  version: 2,
  superseded: false,
  storageKey: "contracts/current/prepared-v2.pdf",
  fileName: "prepared-v2.pdf",
  fileSize: 21,
  pageCount: 1,
  generatedAt: new Date("2026-08-17T00:00:00.000Z"),
};
const contract = {
  _id: CONTRACT_ID,
  tenantId: TENANT_ID,
  status: "generated",
  isCurrent: true,
  isCanonical: true,
  tenantVisible: true,
  publicationStatus: "ready_for_resident",
  generatedVersion: 1,
  preparedDocuments: [
    {
      version: 1,
      superseded: true,
      storageKey: "contracts/old/prepared-v1.pdf",
      fileName: "prepared-v1.pdf",
    },
    preparedV2,
  ],
};

const resolveTenantCanonicalContract = jest.fn(async () => contract);
const selectCurrentPreparedDocument = jest.fn((source) => [...(source?.preparedDocuments || [])]
  .filter((entry) => entry.superseded !== true)
  .sort((left, right) => Number(right.version) - Number(left.version))[0] || null);
const resolveCurrentPreparedDocument = jest.fn(async (source) => {
  const document = selectCurrentPreparedDocument(source);
  const bytes = Buffer.from("%PDF-canonical-v2\n");
  return {
    document,
    size: bytes.length,
    createReadStream: () => Readable.from(bytes),
  };
});
await jest.unstable_mockModule("../services/tenantContractSelectionService.js", () => ({
  resolveTenantCanonicalContract,
}));
await jest.unstable_mockModule("../services/preparedContractDocumentService.js", () => ({
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
}));
await jest.unstable_mockModule("../services/contractPublicationService.js", () => ({
  resolvePublishedFinalDocument: jest.fn(),
  resolveContractDisplayLifecycle: (source) => ({ key: source?.status || "unavailable", label: null }),
}));
await jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, _res, next) => {
    req.mobileTenant = { _id: TENANT_ID };
    next();
  },
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { logModification: jest.fn(async () => {}) },
}));

const { default: mobileContractRoutes } = await import("./mobileContractRoutes.js");

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use("/api/m", mobileContractRoutes);
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("mobile Contract canonical document behavior", () => {
  test("current contract exposes the newest canonical tenantDocument without any notification dependency", async () => {
    const response = await fetch(`${baseUrl}/api/m/contracts/current`);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(resolveTenantCanonicalContract).toHaveBeenCalledWith(
      TENANT_ID,
      { includeEarlyStages: true },
    );
    expect(body.contract.tenantDocument).toMatchObject({
      available: true,
      type: "generated_draft",
      version: 2,
      fileName: "prepared-v2.pdf",
      viewUrl: `/api/m/contracts/${CONTRACT_ID}/documents/prepared`,
    });
  });

  test("prepared document endpoint streams the canonical PDF without a notification record", async () => {
    const response = await fetch(
      `${baseUrl}/api/m/contracts/${CONTRACT_ID}/documents/prepared`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-canonical-v2\n");
    expect(resolveCurrentPreparedDocument).toHaveBeenCalledWith(contract);
  });
});
