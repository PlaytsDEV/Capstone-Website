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

  test("exposes the Contract's own tenantLegalName/tenantResidentialAddress snapshot, never a placeholder", () => {
    const view = toTenantContractView({
      _id: "contract-1",
      contractNumber: "LC-2026-0001",
      status: "generated",
      tenantLegalName: "Ayla Suson",
      tenantAddress: "2811, Mendoza, Barangay 182, City of Manila, National Capital Region (NCR)",
    });
    expect(view.tenantLegalName).toBe("Ayla Suson");
    expect(view.tenantResidentialAddress).toBe(
      "2811, Mendoza, Barangay 182, City of Manila, National Capital Region (NCR)",
    );
    expect(view.tenantResidentialAddress).not.toContain("SMDC JAZZ RESIDENCES");
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

  test("only exposes a final document once the Contract has actually reached a published status", () => {
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

  test("exposes an admin_scan (wet-signed) final document even though notarizationVerifiedAt is never set", () => {
    const view = toTenantContractView({
      _id: "contract-1",
      status: "published",
      publicationStatus: "published",
      tenantVisible: true,
      notarizationVerifiedAt: null,
      finalDocument: {
        fileName: "wet-signed.pdf",
        storageKey: "private/wet-signed.pdf",
        fileSize: 456,
        pageCount: 2,
        sourceType: "admin_scan",
        publishedAt: new Date(),
      },
    });
    expect(view.finalDocument).toMatchObject({
      available: true,
      fileName: "wet-signed.pdf",
      viewUrl: "/api/contracts/my/contract-1/documents/final",
    });
    expect(view.tenantDocument).toMatchObject({ isFinal: true, available: true });
  });

  test("still exposes a notarized final document once verified and published", () => {
    const view = toTenantContractView({
      _id: "contract-1",
      status: "published",
      tenantVisible: true,
      notarizationVerifiedAt: new Date(),
      finalDocument: {
        fileName: "notarized.pdf",
        storageKey: "private/notarized.pdf",
        fileSize: 789,
        pageCount: 3,
        sourceType: "notarized",
        publishedAt: new Date(),
      },
    });
    expect(view.finalDocument).toMatchObject({ available: true, fileName: "notarized.pdf" });
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

  test("maps a legacy current wet-signed upload to its authenticated signed-document route", () => {
    const view = toTenantContractView({
      _id: "contract-legacy-signed",
      status: "partially_signed",
      signedDocuments: [{
        version: 4,
        storageKey: "signed/v4.pdf",
        fileName: "signed-v4.pdf",
        fileSize: 456,
        mimeType: "application/pdf",
        uploadedAt: new Date("2026-08-20T08:00:00Z"),
        superseded: false,
      }],
      preparedDocuments: [],
      finalDocument: null,
    }, new Date(), { documentBasePath: "/api/m/contracts" });

    expect(view.tenantDocument).toMatchObject({
      available: true,
      type: "final_signed",
      isFinal: true,
      version: 4,
      viewUrl: "/api/m/contracts/contract-legacy-signed/documents/signed/4",
      downloadUrl: "/api/m/contracts/contract-legacy-signed/documents/signed/4?download=1",
    });
  });
});
