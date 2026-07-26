import fsPromises from "fs/promises";
import { describe, expect, test } from "@jest/globals";
import {
  PREPARED_DOCUMENT_VISIBLE_STATUSES,
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
} from "./preparedContractDocumentService.js";
import { buildPreparedContractStorage } from "./contractPrivateStorageService.js";

const contract = (status = "generated") => ({
  status,
  generatedVersion: 1,
  preparedDocuments: [
    { version: 1, superseded: true, storageKey: "old.pdf", fileName: "old.pdf" },
    { version: 2, superseded: false, storageKey: "current.pdf", fileName: "current.pdf" },
  ],
});

describe("current prepared Contract document resolver", () => {
  test.each(PREPARED_DOCUMENT_VISIBLE_STATUSES)("%s retains prepared access", (status) => {
    expect(selectCurrentPreparedDocument(contract(status))?.version).toBe(2);
  });

  test.each(["draft", "incomplete", "ready_for_generation", "cancelled"])(
    "%s does not expose a prepared copy",
    (status) => expect(selectCurrentPreparedDocument(contract(status))).toBeNull(),
  );

  test("stale generatedVersion does not hide the newest valid history version", () => {
    expect(selectCurrentPreparedDocument(contract()).version).toBe(2);
  });

  test("missing private file returns the controlled unavailable error", async () => {
    await expect(resolveCurrentPreparedDocument(contract())).rejects.toMatchObject({
      code: "PREPARED_DOCUMENT_UNAVAILABLE",
      statusCode: 404,
    });
  });

  test("resolves an existing private prepared file", async () => {
    const target = buildPreparedContractStorage({
      branch: "gil-puyat",
      year: 2026,
      contractNumber: "VISIBILITY-TEST",
      tenantLegalName: "Visibility Test",
      roomType: "quadruple-sharing",
      leaseType: "short-term",
      contractDate: "2026-07-27",
      version: 1,
    });
    await fsPromises.mkdir(target.directory, { recursive: true });
    await fsPromises.writeFile(target.absolutePath, Buffer.from("%PDF-test"));
    try {
      const resolved = await resolveCurrentPreparedDocument({
        status: "generated",
        preparedDocuments: [{
          version: 1,
          superseded: false,
          storageKey: target.storageKey,
          fileName: target.fileName,
        }],
      });
      expect(resolved.document.version).toBe(1);
      expect(resolved.stat.isFile()).toBe(true);
    } finally {
      await fsPromises.rm(target.absolutePath, { force: true });
    }
  });
});
