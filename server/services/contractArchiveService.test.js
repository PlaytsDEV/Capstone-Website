import { describe, expect, jest, test } from "@jest/globals";
import {
  archiveContract,
  assertOwnedContractStorageKey,
  buildContractDeletionEligibility,
  permanentlyDeleteTestContract,
} from "./contractArchiveService.js";

const emptyModel = (count = 0) => ({ countDocuments: jest.fn().mockResolvedValue(count) });
const adaptersFor = (overrides = {}) => ({
  ContractModel: emptyModel(),
  StayModel: emptyModel(),
  ReservationModel: emptyModel(),
  BillModel: emptyModel(),
  PaymentModel: emptyModel(),
  auditDeletion: jest.fn().mockResolvedValue(undefined),
  countOtherCollectionReferences: jest.fn().mockResolvedValue(0),
  ...overrides,
});
const testContract = (overrides = {}) => ({
  _id: "64b000000000000000000002",
  contractNumber: "TEST-CONTRACT-002",
  status: "voided",
  isCanonical: false,
  isCurrent: false,
  isTestRecord: true,
  tenantVisible: false,
  publicationStatus: "withdrawn",
  preparedDocuments: [],
  signedDocuments: [],
  notarizedDocuments: [],
  ...overrides,
});

describe("Contract archive and controlled deletion", () => {
  test("eligible unused test duplicate has no blocking dependencies", async () => {
    const result = await buildContractDeletionEligibility(testContract(), adaptersFor());
    expect(result).toMatchObject({ eligible: true, isCanonical: false, isTestRecord: true });
  });

  test.each([
    ["real Contract", { isTestRecord: false }, "notTestRecord"],
    ["canonical Contract", { isCanonical: true }, "canonicalContract"],
    ["signed Contract", { signedDocuments: [{}] }, "signedDocuments"],
    ["printed Contract", { printedAt: new Date() }, "printedIssuances"],
    ["resident publication", { tenantVisible: true }, "residentPublications"],
  ])("permanent deletion rejects %s", async (_label, override, blocker) => {
    const result = await buildContractDeletionEligibility(testContract(override), adaptersFor());
    expect(result.eligible).toBe(false);
    expect(result.blockingDependencies).toContain(blocker);
  });

  test("payment and billing references block deletion", async () => {
    const result = await buildContractDeletionEligibility(testContract(), adaptersFor({
      PaymentModel: emptyModel(1), BillModel: emptyModel(2),
    }));
    expect(result.blockingDependencies).toEqual(expect.arrayContaining(["payments", "billings"]));
  });

  test("renewal or amendment reference blocks deletion", async () => {
    const result = await buildContractDeletionEligibility(testContract(), adaptersFor({
      ContractModel: emptyModel(1),
    }));
    expect(result.blockingDependencies).toContain("renewalsAmendmentsReplacements");
  });

  test("storage keys are isolated to contracts/{contractId}", () => {
    expect(assertOwnedContractStorageKey("abc", "contracts/abc/prepared/v1.pdf"))
      .toBe("contracts/abc/prepared/v1.pdf");
    expect(() => assertOwnedContractStorageKey("abc", "contracts/canonical/prepared/v1.pdf"))
      .toThrow(expect.objectContaining({ code: "CONTRACT_STORAGE_KEY_UNSAFE" }));
    expect(() => assertOwnedContractStorageKey("abc", "contracts/abc/../canonical.pdf"))
      .toThrow(expect.objectContaining({ code: "CONTRACT_STORAGE_KEY_UNSAFE" }));
  });

  test("wrong confirmation number is rejected before deletion", async () => {
    const ContractModel = {
      findById: jest.fn().mockResolvedValue(testContract()),
      findOneAndDelete: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    await expect(permanentlyDeleteTestContract({
      contractId: "64b000000000000000000000002",
      actorId: "actor",
      confirmationContractNumber: "WRONG",
      reason: "Unused duplicate created for validation.",
      adapters: adaptersFor({ ContractModel }),
    })).rejects.toMatchObject({ code: "CONTRACT_DELETE_CONFIRMATION_MISMATCH" });
    expect(ContractModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  test("eligible test duplicate is atomically deleted and owned files are removed", async () => {
    const contract = testContract();
    contract.preparedDocuments = [{
      superseded: true,
      storageProvider: "firebase-storage",
      storageKey: `contracts/${contract._id}/prepared/v1.pdf`,
    }];
    const ContractModel = {
      findById: jest.fn().mockResolvedValue(contract),
      findOneAndDelete: jest.fn().mockResolvedValue(contract),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    const removeDocument = jest.fn().mockResolvedValue(undefined);
    const result = await permanentlyDeleteTestContract({
      contractId: contract._id,
      actorId: "actor",
      confirmationContractNumber: contract.contractNumber,
      reason: "Unused duplicate created for validation.",
      adapters: adaptersFor({ ContractModel, removeDocument }),
    });
    expect(result.deletedContract).toBe(contract);
    expect(removeDocument).toHaveBeenCalledTimes(1);
    expect(result.cleanupFailures).toEqual([]);
  });

  test("archive rejects canonical Contract without replacement", async () => {
    const ContractModel = {
      findById: jest.fn().mockResolvedValue(testContract({
        isCanonical: true, status: "incomplete", branch: "gil_puyat", archivedAt: null,
      })),
    };
    await expect(archiveContract({
      contractId: "64b000000000000000000000002",
      actorId: "actor",
      reason: "Confirmed unnecessary duplicate record.",
      adapters: { ContractModel },
    })).rejects.toMatchObject({ code: "CANONICAL_REPLACEMENT_REQUIRED" });
  });

  test("concurrent archive requests allow only one atomic update", async () => {
    const duplicate = testContract({
      status: "incomplete", branch: "gil_puyat", archivedAt: null, duplicateOfContractId: "canonical",
    });
    const canonical = testContract({
      _id: "canonical", status: "generated", isCanonical: true, archivedAt: null,
    });
    let calls = 0;
    const ContractModel = {
      findById: jest.fn(async (value) => value === "canonical" ? canonical : duplicate),
      exists: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      findOneAndUpdate: jest.fn(async () => (++calls === 1 ? duplicate : null)),
    };
    const action = () => archiveContract({
      contractId: duplicate._id, actorId: "actor",
      reason: "Confirmed unnecessary duplicate record.", adapters: { ContractModel },
    });
    const results = await Promise.allSettled([action(), action()]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")[0].reason.code)
      .toBe("CONTRACT_ARCHIVE_CONFLICT");
  });
});
