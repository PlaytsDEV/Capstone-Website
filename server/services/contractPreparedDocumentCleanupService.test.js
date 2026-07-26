import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const rm = jest.fn();
const stat = jest.fn();
const findById = jest.fn();
const resolvePrivateContractStorageKey = jest.fn((key) => `/generated/${key}`);

await jest.unstable_mockModule("fs/promises", () => ({
  default: { rm, stat },
}));
await jest.unstable_mockModule("../models/index.js", () => ({
  Contract: { findById },
}));
await jest.unstable_mockModule("./contractPrivateStorageService.js", () => ({
  resolvePrivateContractStorageKey,
}));

const { cleanUpSupersededTestVersions, resetPreparedTestDocuments } =
  await import("./contractPreparedDocumentCleanupService.js");

const document = () => ({
  status: "generated",
  contractNumber: "TEST-CONTRACT-0001",
  preparedDocuments: [
    { version: 1, superseded: true, storageKey: "contract/v1.pdf" },
    { version: 2, superseded: true, storageKey: "contract/v2.pdf" },
    { version: 3, superseded: false, storageKey: "contract/v3.pdf" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  process.env.NODE_ENV = "test";
  delete process.env.ALLOW_TEST_CONTRACT_CLEANUP;
  rm.mockReset().mockResolvedValue(undefined);
  stat.mockReset().mockResolvedValue({ isFile: () => true });
  findById.mockReset();
  resolvePrivateContractStorageKey.mockClear();
});

describe("superseded test prepared-document cleanup", () => {
  test("keeps newest and deletes only older superseded prepared files", async () => {
    const contract = document();
    findById.mockResolvedValue(contract);
    const result = await cleanUpSupersededTestVersions({
      contractId: "contract-id", actorRole: "owner", reason: "Development cleanup",
    });
    expect(result.report).toEqual(expect.objectContaining({
      keptVersion: 3,
      deletedVersions: [1, 2],
      deletedFiles: 2,
    }));
    expect(contract.preparedDocuments.map((entry) => entry.version)).toEqual([3]);
    expect(rm).toHaveBeenCalledTimes(2);
    expect(resolvePrivateContractStorageKey).not.toHaveBeenCalledWith(
      expect.stringContaining("contract-templates"),
    );
  });

  test("cleanup is blocked in production without the maintenance flag", async () => {
    process.env.NODE_ENV = "production";
    await expect(cleanUpSupersededTestVersions({
      contractId: "contract-id", actorRole: "owner", reason: "Cleanup",
    })).rejects.toMatchObject({ code: "CONTRACT_TEST_CLEANUP_DISABLED" });
  });

  test("owner authorization and cleanup reason are required", async () => {
    await expect(cleanUpSupersededTestVersions({
      contractId: "contract-id", actorRole: "branch_admin", reason: "Cleanup",
    })).rejects.toMatchObject({ code: "OWNER_AUTHORIZATION_REQUIRED" });
    await expect(cleanUpSupersededTestVersions({
      contractId: "contract-id", actorRole: "owner", reason: "",
    })).rejects.toMatchObject({ code: "CONTRACT_CLEANUP_REASON_REQUIRED" });
  });

  test.each([
    ["signed", { status: "signed" }],
    ["notarized", { status: "notarized", notarizedStorageKey: "notarized.pdf" }],
    ["published", { status: "published", finalStorageKey: "final.pdf" }],
    ["active", { status: "active" }],
  ])("cleanup is blocked when the Contract is %s", async (_state, changes) => {
    findById.mockResolvedValue(Object.assign(document(), changes));
    await expect(cleanUpSupersededTestVersions({
      contractId: "contract-id", actorRole: "owner", reason: "Cleanup",
    })).rejects.toMatchObject({ code: "CONTRACT_TEST_CLEANUP_NOT_ALLOWED" });
    expect(rm).not.toHaveBeenCalled();
  });
});

describe("prepared test-document reset", () => {
  test("deletes every prepared version and clears only generated metadata", async () => {
    const contract = Object.assign(document(), {
      _id: "contract-id",
      tenantSnapshot: { legalName: "Preserved Tenant" },
      executionDate: new Date("2026-07-27T00:00:00Z"),
      generatedStorageKey: "contract/v3.pdf",
      generatedFileName: "v3.pdf",
      generatedFileHash: "hash",
      generatedFileSize: 123,
      generatedPageCount: 1,
      generatedAt: new Date(),
      generatedBy: "old-owner",
      generatedVersion: 3,
      statusHistory: [],
    });
    findById.mockResolvedValue(contract);
    const result = await resetPreparedTestDocuments({
      contractId: "contract-id",
      actorRole: "owner",
      actorId: "owner-id",
      reason: "Regenerate with safe masks",
    });
    expect(rm).toHaveBeenCalledTimes(3);
    expect(contract.preparedDocuments).toEqual([]);
    expect(contract.status).toBe("ready_for_generation");
    expect(contract.generatedVersion).toBe(0);
    expect(contract.generatedStorageKey).toBeUndefined();
    expect(contract.tenantSnapshot).toEqual({ legalName: "Preserved Tenant" });
    expect(contract.executionDate).toEqual(new Date("2026-07-27T00:00:00Z"));
    expect(contract.statusHistory.at(-1)).toEqual(expect.objectContaining({
      status: "ready_for_generation",
      changedBy: "owner-id",
    }));
    expect(result.report.deletedVersions).toEqual([1, 2, 3]);
  });

  test("reset requires owner, reason, and an unsigned generated state", async () => {
    await expect(resetPreparedTestDocuments({
      contractId: "contract-id", actorRole: "branch_admin", reason: "Reset",
    })).rejects.toMatchObject({ code: "OWNER_AUTHORIZATION_REQUIRED" });
    await expect(resetPreparedTestDocuments({
      contractId: "contract-id", actorRole: "owner", reason: "",
    })).rejects.toMatchObject({ code: "CONTRACT_RESET_REASON_REQUIRED" });
    findById.mockResolvedValue(Object.assign(document(), { status: "signed" }));
    await expect(resetPreparedTestDocuments({
      contractId: "contract-id", actorRole: "owner", reason: "Reset",
    })).rejects.toMatchObject({ code: "CONTRACT_TEST_RESET_NOT_ALLOWED" });
  });

  test("production reset is disabled and a missing file aborts before deletion", async () => {
    process.env.NODE_ENV = "production";
    await expect(resetPreparedTestDocuments({
      contractId: "contract-id", actorRole: "owner", reason: "Reset",
    })).rejects.toMatchObject({ code: "CONTRACT_TEST_RESET_DISABLED" });
    process.env.NODE_ENV = "test";
    findById.mockResolvedValue(document());
    stat.mockResolvedValueOnce(null);
    await expect(resetPreparedTestDocuments({
      contractId: "contract-id", actorRole: "owner", reason: "Reset",
    })).rejects.toMatchObject({ code: "PREPARED_CONTRACT_RESET_FILE_MISSING" });
    expect(rm).not.toHaveBeenCalled();
  });
});
