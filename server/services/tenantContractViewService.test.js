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

  test("separates canonical Contract identity from missing PDF availability", () => {
    const view = toTenantContractView(
      { _id: "canonical", contractNumber: "TEST-CONTRACT-001", status: "generated" },
      new Date(),
      {
        preparedDocument: null,
        preparedDocumentIssue: "PREPARED_DOCUMENT_STORAGE_MISSING",
      },
    );
    expect(view).toMatchObject({
      contractNumber: "TEST-CONTRACT-001",
      isCanonical: true,
      preparedDocument: {
        available: false,
        issue: "PREPARED_DOCUMENT_STORAGE_MISSING",
      },
    });
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

  test("exposes a final document for an admin_scan (wet-signed) finalization with no notarizationVerifiedAt", () => {
    const wetSigned = toTenantContractView({
      _id: "contract-2",
      status: "published",
      tenantVisible: true,
      finalStorageKey: "private/wet-signed-final.pdf",
      publishedAt: new Date(),
      notarizationVerifiedAt: null,
      finalDocument: {
        fileName: "wet-signed-final.pdf",
        fileSize: 456,
        pageCount: 2,
        sourceType: "admin_scan",
        publishedAt: new Date(),
      },
    });
    expect(wetSigned.finalDocument).toMatchObject({
      available: true,
      fileName: "wet-signed-final.pdf",
      viewUrl: "/api/contracts/my/contract-2/documents/final",
    });
  });

  test("populates unified tenantDocument for draft and final states", () => {
    const draftContract = {
      _id: "contract-draft",
      status: "generated",
      preparedDocuments: [
        {
          version: 1,
          storageKey: "branch/2026/LC-01/draft_v1.pdf",
          fileName: "draft_v1.pdf",
          fileSize: 50000,
          pageCount: 3,
          superseded: false,
        },
      ],
      finalDocument: null,
    };
    const draftView = toTenantContractView(draftContract);
    expect(draftView.tenantDocument).toMatchObject({
      available: true,
      type: "generated_draft",
      label: "Generated Draft — For Signing",
      isFinal: false,
      version: 1,
      fileName: "draft_v1.pdf",
      viewUrl: "/api/contracts/my/contract-draft/documents/prepared",
      downloadUrl: "/api/contracts/my/contract-draft/documents/prepared?download=1",
    });

    const finalContract = {
      _id: "contract-final",
      status: "active",
      notarizedDocumentVersion: 1,
      preparedDocuments: [
        {
          version: 1,
          storageKey: "branch/2026/LC-01/draft_v1.pdf",
          fileName: "draft_v1.pdf",
          fileSize: 50000,
          superseded: false,
        },
      ],
      finalDocument: {
        storageKey: "branch/2026/LC-01/final_v1.pdf",
        fileName: "final_v1.pdf",
        fileSize: 120000,
        pageCount: 4,
        sourceType: "notarized",
        sourceVersion: 1,
      },
    };
    const finalView = toTenantContractView(finalContract);
    expect(finalView.tenantDocument).toMatchObject({
      available: true,
      type: "final_notarized",
      label: "Final Notarized Contract",
      isFinal: true,
      version: 1,
      fileName: "final_v1.pdf",
      viewUrl: "/api/contracts/my/contract-final/documents/final",
      downloadUrl: "/api/contracts/my/contract-final/documents/final?download=1",
    });
  });
});
