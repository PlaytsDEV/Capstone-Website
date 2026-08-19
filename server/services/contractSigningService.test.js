import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mkdir = jest.fn();
const writeFile = jest.fn();
const rm = jest.fn();
const rename = jest.fn();
const access = jest.fn(async () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
const transitionContract = jest.fn(async (contract, status, actorId) => {
  contract.status = status;
  contract.updatedBy = actorId;
  await contract.save();
});
const assertValidContractTransition = jest.fn(() => true);
await jest.unstable_mockModule("fs/promises", () => ({ default: { mkdir, writeFile, rm, rename, access } }));
await jest.unstable_mockModule("./contractService.js", () => ({ transitionContract, assertValidContractTransition }));

const {
  deleteSignedContract,
  uploadSignedContract,
  verifySignedContract,
  rejectSignedContract,
} = await import("./contractSigningService.js");

const mockContract = (changes = {}) => {
  const c = {
    status: "awaiting_signatures",
    contractNumber: "TEST-CONTRACT-0001",
    branch: "gil-puyat",
    contractYear: 2026,
    generatedVersion: 1,
    signedDocuments: [],
    tenantSignatureStatus: "completed",
    lessorSignatureStatus: "completed",
    witnessSignatureStatus: "completed",
    signedStorageKey: null,
    signedDocumentVersion: 0,
    save: jest.fn().mockResolvedValue(undefined),
    markModified: jest.fn(),
    ...changes,
  };
  return c;
};

beforeEach(() => {
  mkdir.mockReset().mockResolvedValue(undefined);
  writeFile.mockReset().mockResolvedValue(undefined);
  rm.mockReset().mockResolvedValue(undefined);
  transitionContract.mockClear();
});

describe("contractSigningService - deleteSignedContract", () => {
  test("deleting the only signed contract document cleans up file and clears contract pointers", async () => {
    const item = mockContract({
      status: "signed",
      signedStorageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v1.pdf",
      signedDocumentVersion: 1,
      signedFileName: "TEST-CONTRACT-0001_signed_v1.pdf",
      signingVerifiedAt: new Date(),
      signedDocuments: [
        {
          version: 1,
          storageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v1.pdf",
          fileName: "TEST-CONTRACT-0001_signed_v1.pdf",
          superseded: false,
        },
      ],
    });

    const res = await deleteSignedContract({ contract: item, version: 1, actorId: "admin-1" });
    expect(res.deletedVersion).toBe(1);
    expect(item.signedDocuments).toHaveLength(0);
    expect(item.signedStorageKey).toBeNull();
    expect(item.signedFileName).toBeNull();
    expect(item.signedDocumentVersion).toBe(0);
    expect(item.signingVerifiedAt).toBeNull();
    expect(rm).toHaveBeenCalled();
  });

  test("deleting active version falls back to previous version when multiple versions exist", async () => {
    const item = mockContract({
      status: "signed",
      signedStorageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v2.pdf",
      signedDocumentVersion: 2,
      signedFileName: "TEST-CONTRACT-0001_signed_v2.pdf",
      signedDocuments: [
        {
          version: 1,
          storageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v1.pdf",
          fileName: "TEST-CONTRACT-0001_signed_v1.pdf",
          fileHash: "hash-v1",
          fileSize: 1000,
          mimeType: "application/pdf",
          superseded: true,
        },
        {
          version: 2,
          storageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v2.pdf",
          fileName: "TEST-CONTRACT-0001_signed_v2.pdf",
          fileHash: "hash-v2",
          fileSize: 2000,
          mimeType: "application/pdf",
          superseded: false,
        },
      ],
    });

    const res = await deleteSignedContract({ contract: item, version: 2, actorId: "admin-1" });
    expect(res.deletedVersion).toBe(2);
    expect(item.signedDocuments).toHaveLength(1);
    expect(item.signedDocumentVersion).toBe(1);
    expect(item.signedFileName).toBe("TEST-CONTRACT-0001_signed_v1.pdf");
    expect(item.signedDocuments[0].superseded).toBe(false);
  });

  test("rejects deletion for non-existent version", async () => {
    const item = mockContract({
      signedDocuments: [
        {
          version: 1,
          storageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v1.pdf",
          fileName: "TEST-CONTRACT-0001_signed_v1.pdf",
          superseded: false,
        },
      ],
    });

    await expect(deleteSignedContract({ contract: item, version: 99, actorId: "admin-1" }))
      .rejects.toMatchObject({ code: "SIGNED_DOCUMENT_NOT_FOUND" });
  });

  test("rejects deletion if contract is in terminated / cancelled / archived status", async () => {
    const item = mockContract({
      status: "terminated",
      signedDocuments: [
        {
          version: 1,
          storageKey: "gil-puyat/2026/TEST-CONTRACT-0001/TEST-CONTRACT-0001_signed_v1.pdf",
          fileName: "TEST-CONTRACT-0001_signed_v1.pdf",
          superseded: false,
        },
      ],
    });

    await expect(deleteSignedContract({ contract: item, version: 1, actorId: "admin-1" }))
      .rejects.toMatchObject({ code: "SIGNED_DOCUMENT_DELETION_NOT_ALLOWED" });
  });
});
