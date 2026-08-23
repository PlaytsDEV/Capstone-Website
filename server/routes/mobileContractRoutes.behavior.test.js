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

const adminScanFinalContract = {
  ...contract,
  status: "published",
  finalDocument: {
    fileName: "wet-signed-final.pdf",
    storageKey: "contracts/current/final-v1.pdf",
    sourceType: "admin_scan",
    sourceVersion: 1,
    publishedAt: new Date("2026-08-18T00:00:00.000Z"),
  },
  notarizationVerifiedAt: null,
};
const finalScanBytes = Buffer.from("%PDF-final-scan\n");
const signedScanBytes = Buffer.from("%PDF-legacy-signed-scan\n");
const legacySignedContract = {
  ...contract,
  status: "partially_signed",
  signedDocuments: [{
    version: 2,
    storageKey: "contracts/current/signed-v2.pdf",
    fileName: "wet-signed-v2.pdf",
    fileSize: signedScanBytes.length,
    mimeType: "application/pdf",
    uploadedAt: new Date("2026-08-18T00:00:00.000Z"),
    superseded: false,
  }],
};
const resolvedFinalDocument = {
  finalDocument: {
    fileName: "wet-signed-final.pdf",
    mimeType: "application/pdf",
    fileSize: finalScanBytes.length,
    sourceVersion: 1,
    fileHash: "final-hash",
  },
  createReadStream: () => Readable.from(finalScanBytes),
};

const resolveTenantCanonicalContract = jest.fn(async () => contract);
const resolvePublishedFinalDocument = jest.fn(async () => resolvedFinalDocument);
const resolveTenantUpcomingContract = jest.fn(async () => null);
const inspectSignedContractDocument = jest.fn(async () => ({
  size: signedScanBytes.length,
  createReadStream: () => Readable.from(signedScanBytes),
}));
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
  resolveTenantUpcomingContract,
}));
await jest.unstable_mockModule("../services/preparedContractDocumentService.js", () => ({
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
}));
await jest.unstable_mockModule("../services/contractPublicationService.js", () => ({
  resolvePublishedFinalDocument,
  resolveContractDisplayLifecycle: (source) => ({ key: source?.status || "unavailable", label: null }),
}));
await jest.unstable_mockModule("../services/contractDocumentStorageService.js", () => ({
  inspectSignedContractDocument,
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
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
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

  test("backward-compatible /documents/contract streams the current prepared PDF when no final document exists", async () => {
    const response = await fetch(`${baseUrl}/api/m/documents/contract`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-canonical-v2\n");
  });

  test("backward-compatible /documents/contract streams the wet-signed (admin_scan) final PDF instead of the stale draft, even though notarizationVerifiedAt is never set", async () => {
    resolveTenantCanonicalContract.mockResolvedValueOnce(adminScanFinalContract);
    const response = await fetch(`${baseUrl}/api/m/documents/contract`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-final-scan\n");
    expect(resolvePublishedFinalDocument).toHaveBeenCalledWith(adminScanFinalContract);
  });

  test("legacy current wet-signed upload is normalized and streamed through the tenant-owned route", async () => {
    resolveTenantCanonicalContract.mockResolvedValueOnce(legacySignedContract);
    const currentResponse = await fetch(`${baseUrl}/api/m/contracts/current`);
    expect(currentResponse.status).toBe(200);
    expect((await currentResponse.json()).contract.tenantDocument).toMatchObject({
      available: true,
      type: "final_signed",
      version: 2,
      viewUrl: `/api/m/contracts/${CONTRACT_ID}/documents/signed/2`,
    });

    resolveTenantCanonicalContract.mockResolvedValueOnce(legacySignedContract);
    const streamResponse = await fetch(
      `${baseUrl}/api/m/contracts/${CONTRACT_ID}/documents/final`,
    );
    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await streamResponse.arrayBuffer()).toString())
      .toBe("%PDF-legacy-signed-scan\n");
    expect(inspectSignedContractDocument).toHaveBeenCalledWith(
      legacySignedContract.signedDocuments[0],
    );
  });

  test("legacy signed storage failure remains a structured 410 instead of falling back to the stale draft", async () => {
    resolveTenantCanonicalContract.mockResolvedValueOnce(legacySignedContract);
    inspectSignedContractDocument.mockRejectedValueOnce(Object.assign(
      new Error("Signed storage missing"),
      { code: "CONTRACT_ARTIFACT_STORAGE_MISSING", statusCode: 410 },
    ));
    const response = await fetch(
      `${baseUrl}/api/m/contracts/${CONTRACT_ID}/documents/final`,
    );
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      code: "CONTRACT_ARTIFACT_STORAGE_MISSING",
    });
  });

  test("signed document route does not expose a non-current signed version", async () => {
    resolveTenantCanonicalContract.mockResolvedValueOnce(legacySignedContract);
    const response = await fetch(
      `${baseUrl}/api/m/contracts/${CONTRACT_ID}/documents/signed/1`,
    );
    expect(response.status).toBe(404);
  });

  test("current contract logs warning and reports issue code when prepared document resolution fails", async () => {
    resolveCurrentPreparedDocument.mockRejectedValueOnce(
      Object.assign(new Error("Storage missing"), { code: "PREPARED_DOCUMENT_STORAGE_MISSING", statusCode: 410 })
    );
    const response = await fetch(`${baseUrl}/api/m/contracts/current`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.contract.preparedDocument.available).toBe(false);
    expect(body.contract.preparedDocument.issue).toBe("PREPARED_DOCUMENT_STORAGE_MISSING");
  });
});

