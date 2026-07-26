import { describe, expect, test } from "@jest/globals";
import {
  calculateContractDaysRemaining,
  getTenantContractDisplayStatus,
  toTenantContractView,
} from "./tenantContractViewService.js";

describe("tenant Contract safe view", () => {
  test("formats raw lifecycle statuses", () => {
    expect(getTenantContractDisplayStatus("awaiting_notarization"))
      .toBe("Physical signing and in-person notarization are in progress.");
  });

  test.each(["draft", "incomplete", "ready_for_generation"])(
    "%s uses the preparation message",
    (status) => expect(getTenantContractDisplayStatus(status)).toBe("Contract is being prepared."),
  );

  test("returns only the current non-superseded prepared document", () => {
    const view = toTenantContractView({
      _id: "contract-1",
      contractNumber: "LC-2026-0001",
      status: "generated",
      generatedVersion: 2,
      preparedDocuments: [
        { version: 1, superseded: true, storageKey: "private/old.pdf", fileName: "old.pdf" },
        { version: 2, superseded: false, storageKey: "private/current.pdf", fileName: "current.pdf", fileSize: 42 },
      ],
    });
    expect(view.preparedDocument).toMatchObject({
      available: true, currentVersion: 2, fileName: "current.pdf", fileSize: 42,
    });
    expect(view).toMatchObject({
      contractId: "contract-1",
      preparedDocumentAvailable: true,
      preparedDocumentVersion: 2,
      preparedDocumentFileName: "current.pdf",
      preparedDocumentFileSize: 42,
    });
    expect(JSON.stringify(view)).not.toContain("storageKey");
    expect(JSON.stringify(view)).not.toContain("private/current.pdf");
  });

  test("does not expose a superseded generated version", () => {
    const view = toTenantContractView({
      _id: "contract-1", status: "generated", generatedVersion: 2,
      preparedDocuments: [{ version: 2, superseded: true, storageKey: "private/file.pdf" }],
    });
    expect(view.preparedDocument.available).toBe(false);
  });

  test("selects the newest non-superseded document even when generatedVersion is stale", () => {
    const view = toTenantContractView({
      _id: "contract-1", status: "generated", generatedVersion: 1,
      preparedDocuments: [
        { version: 1, superseded: true, fileName: "old.pdf" },
        { version: 2, superseded: false, fileName: "latest.pdf", storageKey: "latest.pdf" },
      ],
    });
    expect(view.preparedDocument).toMatchObject({
      available: true, currentVersion: 2, fileName: "latest.pdf",
    });
    expect(view.preparedDocument.viewUrl)
      .toBe("/api/contracts/my/contract-1/documents/prepared");
  });

  test("calculates days remaining once on the backend", () => {
    expect(calculateContractDaysRemaining("2026-07-30", new Date("2026-07-26T00:00:00Z"))).toBe(4);
    expect(calculateContractDaysRemaining(null)).toBeNull();
  });

  test("only exposes a final document after verified publication", () => {
    const base = {
      _id: "contract-1",
      finalStorageKey: "private/final.pdf",
      notarizedFileName: "official.pdf",
      notarizationVerifiedAt: new Date(),
      publishedAt: new Date(),
      tenantVisible: true,
      finalDocument: {
        fileName: "official.pdf",
        fileSize: 123,
        pageCount: 1,
        publishedAt: new Date(),
      },
    };
    expect(toTenantContractView({ ...base, status: "notarized" }).finalDocument.available).toBe(false);
    const published = toTenantContractView({ ...base, status: "published" });
    expect(published.finalDocument).toMatchObject({
      available: true,
      fileName: "official.pdf",
      viewUrl: "/api/contracts/my/contract-1/documents/final",
    });
    expect(JSON.stringify(published)).not.toContain("private/final.pdf");
  });
});
