import fs from "fs/promises";
import { Contract } from "../models/index.js";
import { resolvePrivateContractStorageKey } from "./contractPrivateStorageService.js";

const cleanupError = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const cleanupEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_TEST_CONTRACT_CLEANUP === "true";

export const cleanUpSupersededTestVersions = async ({
  contractId,
  actorRole,
  reason,
}) => {
  if (!cleanupEnabled()) {
    throw cleanupError(
      "Prepared test-document cleanup is disabled in production.",
      "CONTRACT_TEST_CLEANUP_DISABLED",
      403,
    );
  }
  if (actorRole !== "owner") {
    throw cleanupError("Owner authorization is required.", "OWNER_AUTHORIZATION_REQUIRED", 403);
  }
  if (!String(reason || "").trim()) {
    throw cleanupError("A cleanup reason is required.", "CONTRACT_CLEANUP_REASON_REQUIRED");
  }
  const contract = await Contract.findById(contractId);
  if (!contract) throw cleanupError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  if (
    contract.status !== "generated" ||
    contract.signedStorageKey ||
    contract.notarizedStorageKey ||
    contract.finalStorageKey ||
    contract.signedUploadedAt ||
    contract.notarizedUploadedAt ||
    contract.publishedAt
  ) {
    throw cleanupError(
      "Prepared test-document cleanup is blocked after signing, notarization, publication, or activation.",
      "CONTRACT_TEST_CLEANUP_NOT_ALLOWED",
      409,
    );
  }

  const newest = [...(contract.preparedDocuments || [])]
    .filter((document) => document.superseded !== true)
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  if (!newest) {
    throw cleanupError(
      "A verified current prepared document is required before cleanup.",
      "CURRENT_PREPARED_CONTRACT_REQUIRED",
      409,
    );
  }
  const currentPath = resolvePrivateContractStorageKey(newest.storageKey);
  const currentStat = await fs.stat(currentPath).catch(() => null);
  if (!currentStat?.isFile()) {
    throw cleanupError(
      "The current prepared document file is unavailable.",
      "CURRENT_PREPARED_CONTRACT_REQUIRED",
      409,
    );
  }

  const candidates = (contract.preparedDocuments || [])
    .filter((document) => document.superseded === true && document.version !== newest.version);
  const deletedVersions = [];
  const failedDeletions = [];
  for (const document of candidates) {
    try {
      await fs.rm(resolvePrivateContractStorageKey(document.storageKey));
      deletedVersions.push(document.version);
    } catch (error) {
      failedDeletions.push({ version: document.version, error: error.message });
    }
  }
  const deleted = new Set(deletedVersions.map(Number));
  contract.preparedDocuments = contract.preparedDocuments
    .filter((document) => !deleted.has(Number(document.version)));
  await contract.save();

  return {
    contract,
    report: {
      contractNumber: contract.contractNumber,
      keptVersion: newest.version,
      deletedVersions,
      deletedFiles: deletedVersions.length,
      failedDeletions,
      reason: String(reason).trim(),
    },
  };
};

export const resetPreparedTestDocuments = async ({
  contractId,
  actorRole,
  actorId,
  reason,
}) => {
  if (!cleanupEnabled()) {
    throw cleanupError(
      "Prepared test-document reset is disabled in production.",
      "CONTRACT_TEST_RESET_DISABLED",
      403,
    );
  }
  if (actorRole !== "owner") {
    throw cleanupError("Owner authorization is required.", "OWNER_AUTHORIZATION_REQUIRED", 403);
  }
  if (!String(reason || "").trim()) {
    throw cleanupError("A reset reason is required.", "CONTRACT_RESET_REASON_REQUIRED");
  }
  const contract = await Contract.findById(contractId);
  if (!contract) throw cleanupError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  if (
    !["generated", "ready_for_generation"].includes(contract.status) ||
    contract.signedStorageKey ||
    contract.notarizedStorageKey ||
    contract.finalStorageKey ||
    contract.signedUploadedAt ||
    contract.notarizedUploadedAt ||
    contract.publishedAt
  ) {
    throw cleanupError(
      "Prepared test-document reset is blocked after signing, notarization, publication, or activation.",
      "CONTRACT_TEST_RESET_NOT_ALLOWED",
      409,
    );
  }

  const documents = [...(contract.preparedDocuments || [])];
  const resolved = documents.map((document) => ({
    document,
    absolutePath: resolvePrivateContractStorageKey(document.storageKey),
  }));
  for (const { document, absolutePath } of resolved) {
    const file = await fs.stat(absolutePath).catch(() => null);
    if (!file?.isFile()) {
      throw cleanupError(
        `Prepared Contract version ${document.version} is unavailable; reset was not applied.`,
        "PREPARED_CONTRACT_RESET_FILE_MISSING",
        409,
      );
    }
  }
  for (const { absolutePath } of resolved) await fs.rm(absolutePath);

  contract.preparedDocuments = [];
  contract.generatedStorageKey = undefined;
  contract.generatedFileName = undefined;
  contract.generatedFileHash = undefined;
  contract.generatedFileSize = undefined;
  contract.generatedPageCount = undefined;
  contract.generatedAt = undefined;
  contract.generatedBy = undefined;
  contract.generatedVersion = 0;
  contract.status = "ready_for_generation";
  contract.statusHistory = contract.statusHistory || [];
  contract.statusHistory.push({
    status: "ready_for_generation",
    changedAt: new Date(),
    changedBy: actorId,
    reason: `Prepared test-document reset: ${String(reason).trim()}`,
  });
  await contract.save();

  return {
    contract,
    report: {
      contractNumber: contract.contractNumber,
      deletedVersions: documents.map(({ version }) => version),
      deletedFiles: documents.length,
      status: contract.status,
      reason: String(reason).trim(),
    },
  };
};
