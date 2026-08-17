import fs from "fs/promises";
import admin from "firebase-admin";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  inspectPreparedContractDocument,
  removePreparedContractDocument,
  storePreparedContractDocument,
} from "./contractDocumentStorageService.js";
import { buildPreparedContractStorage } from "./contractPrivateStorageService.js";

const created = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((document) =>
    removePreparedContractDocument(document).catch(() => {})));
});

describe("prepared Contract document storage", () => {
  test("stores, verifies, and retrieves a local test PDF atomically", async () => {
    const target = buildPreparedContractStorage({
      contractId: "507f1f77bcf86cd799439011",
      branch: "gil-puyat",
      year: 2026,
      contractNumber: "LL-GP-2026-00001",
      tenantLegalName: "Test Tenant",
      roomType: "private",
      leaseType: "short_term",
      contractDate: "2026-07-27",
      version: Date.now(),
    });
    const stored = await storePreparedContractDocument({
      target,
      bytes: Buffer.from("%PDF-1.4\ncontract-test\n"),
    });
    const document = {
      storageProvider: stored.provider,
      storageKey: stored.storageKey,
    };
    created.push(document);

    const inspected = await inspectPreparedContractDocument(document);
    expect(stored.provider).toBe("local");
    expect(stored.storageKey).toMatch(
      /^contracts\/507f1f77bcf86cd799439011\/prepared\//,
    );
    expect(inspected.size).toBeGreaterThan(0);
    await expect(fs.readFile(inspected.absolutePath, "utf8"))
      .resolves.toContain("%PDF-");
  });

  test("rejects missing physical files with 410 semantics", async () => {
    await expect(inspectPreparedContractDocument({
      storageProvider: "local",
      storageKey: "contracts/missing/prepared/missing.pdf",
    })).rejects.toMatchObject({
      code: "PREPARED_DOCUMENT_STORAGE_MISSING",
      statusCode: 410,
    });
  });

  test("production never honors the local-storage override", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousStorage = process.env.CONTRACT_DOCUMENT_STORAGE;
    process.env.NODE_ENV = "production";
    process.env.CONTRACT_DOCUMENT_STORAGE = "local";
    jest.spyOn(admin, "apps", "get").mockReturnValue([]);
    try {
      await expect(storePreparedContractDocument({
        target: { storageKey: "contracts/test/prepared/test.pdf" },
        bytes: Buffer.from("%PDF-1.4\n"),
      })).rejects.toMatchObject({
        code: "CONTRACT_STORAGE_NOT_CONFIGURED",
        statusCode: 503,
      });
    } finally {
      jest.restoreAllMocks();
      process.env.NODE_ENV = previousNodeEnv;
      if (previousStorage === undefined) delete process.env.CONTRACT_DOCUMENT_STORAGE;
      else process.env.CONTRACT_DOCUMENT_STORAGE = previousStorage;
    }
  });

  test("falls back to local disk when document metadata specifies firebase-storage but file exists locally", async () => {
    const target = buildPreparedContractStorage({
      contractId: "507f1f77bcf86cd799439099",
      branch: "gil-puyat",
      year: 2026,
      contractNumber: "LL-GP-2026-FALLBACK",
      tenantLegalName: "Fallback Tenant",
      roomType: "private",
      leaseType: "short_term",
      contractDate: "2026-07-27",
      version: Date.now(),
    });
    await storePreparedContractDocument({
      target,
      bytes: Buffer.from("%PDF-1.4\nfallback-test\n"),
    });
    const document = {
      storageProvider: "firebase-storage",
      storageKey: target.storageKey,
    };
    created.push(document);

    const inspected = await inspectPreparedContractDocument(document);
    expect(inspected.provider).toBe("local");
    expect(inspected.size).toBeGreaterThan(0);
    await expect(fs.readFile(inspected.absolutePath, "utf8"))
      .resolves.toContain("fallback-test");
  });
});
