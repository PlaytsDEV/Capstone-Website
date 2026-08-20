import { describe, expect, it } from "@jest/globals";
import { resolveTenantContractDocument } from "./tenantContractDocumentResolver.js";

describe("tenantContractDocumentResolver", () => {
  it("returns unavailable when contract is null or undefined", () => {
    const result = resolveTenantContractDocument(null);
    expect(result).toEqual({
      available: false,
      type: null,
      label: "Contract is being prepared.",
      isFinal: false,
      document: null,
      version: null,
      fileName: null,
      fileSize: null,
      pageCount: null,
      generatedAt: null,
      publishedAt: null,
    });
  });

  it("returns unavailable when contract has no generated documents", () => {
    const contract = {
      status: "draft",
      preparedDocuments: [],
      finalDocument: null,
    };
    const result = resolveTenantContractDocument(contract);
    expect(result.available).toBe(false);
    expect(result.type).toBeNull();
    expect(result.label).toBe("Contract is being prepared.");
    expect(result.isFinal).toBe(false);
  });

  it("returns generated_draft when a valid prepared document exists", () => {
    const contract = {
      status: "generated",
      version: 1,
      preparedDocuments: [
        {
          version: 1,
          storageKey: "guadalupe/2026/LC-2026-001/draft_v1.pdf",
          fileName: "LC-2026-001_prepared_v1.pdf",
          fileSize: 204800,
          pageCount: 4,
          generatedAt: new Date("2026-08-16T08:00:00Z"),
          superseded: false,
        },
      ],
      finalDocument: null,
    };
    const result = resolveTenantContractDocument(contract);
    expect(result.available).toBe(true);
    expect(result.type).toBe("generated_draft");
    expect(result.label).toBe("Generated Draft — For Signing");
    expect(result.isFinal).toBe(false);
    expect(result.version).toBe(1);
    expect(result.fileName).toBe("LC-2026-001_prepared_v1.pdf");
    expect(result.fileSize).toBe(204800);
  });

  it("selects the latest non-superseded prepared version upon regeneration", () => {
    const contract = {
      status: "generated",
      preparedDocuments: [
        {
          version: 1,
          storageKey: "guadalupe/2026/LC-2026-001/draft_v1.pdf",
          fileName: "LC-2026-001_prepared_v1.pdf",
          fileSize: 200000,
          pageCount: 4,
          generatedAt: new Date("2026-08-16T08:00:00Z"),
          superseded: true,
        },
        {
          version: 2,
          storageKey: "guadalupe/2026/LC-2026-001/draft_v2.pdf",
          fileName: "LC-2026-001_prepared_v2.pdf",
          fileSize: 215000,
          pageCount: 4,
          generatedAt: new Date("2026-08-16T09:30:00Z"),
          superseded: false,
        },
      ],
      finalDocument: null,
    };
    const result = resolveTenantContractDocument(contract);
    expect(result.available).toBe(true);
    expect(result.type).toBe("generated_draft");
    expect(result.version).toBe(2);
    expect(result.fileName).toBe("LC-2026-001_prepared_v2.pdf");
  });

  it("prioritizes finalDocument over preparedDocuments when final notarized document exists", () => {
    const contract = {
      status: "active",
      notarizedDocumentVersion: 1,
      preparedDocuments: [
        {
          version: 1,
          storageKey: "guadalupe/2026/LC-2026-001/draft_v1.pdf",
          fileName: "LC-2026-001_prepared_v1.pdf",
          fileSize: 200000,
          superseded: false,
        },
      ],
      finalDocument: {
        storageKey: "guadalupe/2026/LC-2026-001/final_notarized_v1.pdf",
        fileName: "LC-2026-001_signed_notarized_v1.pdf",
        fileSize: 1048576,
        pageCount: 5,
        sourceType: "notarized",
        sourceVersion: 1,
        publishedAt: new Date("2026-08-16T12:00:00Z"),
      },
    };
    const result = resolveTenantContractDocument(contract);
    expect(result.available).toBe(true);
    expect(result.type).toBe("final_notarized");
    expect(result.label).toBe("Final Notarized Contract");
    expect(result.isFinal).toBe(true);
    expect(result.fileName).toBe("LC-2026-001_signed_notarized_v1.pdf");
    expect(result.fileSize).toBe(1048576);
    expect(result.pageCount).toBe(5);
  });

  test("labels an admin_scan final document as 'Final Contract', distinct from a notarized final", () => {
    const contract = {
      status: "published",
      preparedDocuments: [],
      finalDocument: {
        storageKey: "guadalupe/2026/LC-2026-002/final_signed_v1.pdf",
        fileName: "LC-2026-002_signed_v1.pdf",
        fileSize: 512000,
        pageCount: 4,
        sourceType: "admin_scan",
        sourceVersion: 1,
        publishedAt: new Date("2026-08-20T12:00:00Z"),
      },
    };
    const result = resolveTenantContractDocument(contract);
    expect(result.available).toBe(true);
    expect(result.type).toBe("final_notarized");
    expect(result.isFinal).toBe(true);
    expect(result.label).toBe("Final Contract");
  });
});
