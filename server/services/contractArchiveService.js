import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import Stay from "../models/Stay.js";
import Reservation from "../models/Reservation.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import AuditLog from "../models/AuditLog.js";
import { removePreparedContractDocument } from "./contractDocumentStorageService.js";

const ARCHIVE_ELIGIBLE = new Set([
  "draft", "incomplete", "cancelled", "rejected", "replaced", "archived", "voided",
]);
const DELETE_ELIGIBLE = new Set(["draft", "incomplete", "voided", "rejected", "archived"]);
const cleanReason = (value, field = "reason") => {
  const result = String(value || "").trim();
  if (result.length < 10 || result.length > 500) {
    throw Object.assign(new Error(`${field} must contain 10 to 500 characters.`), {
      statusCode: 400, code: "CONTRACT_REASON_REQUIRED",
    });
  }
  return result;
};
const id = (value) => value ? String(value._id || value) : "";
const hasValue = (value) => value !== null && value !== undefined && value !== "";

export const assertOwnedContractStorageKey = (contractId, storageKey) => {
  const normalized = String(storageKey || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const prefix = `contracts/${String(contractId)}/`;
  if (!normalized.startsWith(prefix) || normalized.includes("../")) {
    throw Object.assign(new Error("Contract storage key is outside the permitted test-record namespace."), {
      statusCode: 409, code: "CONTRACT_STORAGE_KEY_UNSAFE",
    });
  }
  return normalized;
};

const currentPrepared = (contract) =>
  (contract.preparedDocuments || []).filter((item) => item?.superseded !== true);

const countOtherCollectionReferences = async (contractId) => {
  const database = mongoose.connection.db;
  if (!database) return 0;
  const excluded = new Set(["contracts", "auditLogs"]);
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  let total = 0;
  for (const { name } of collections) {
    if (!name || excluded.has(name) || name.startsWith("system.")) continue;
    total += await database.collection(name).countDocuments({
      $or: [
        { contractId }, { contract: contractId }, { contractReference: contractId },
        { "metadata.contractId": contractId },
      ],
    }, { limit: 1 });
  }
  return total;
};

export const buildContractDeletionEligibility = async (contract, adapters = {}) => {
  const ContractModel = adapters.ContractModel || Contract;
  const StayModel = adapters.StayModel || Stay;
  const ReservationModel = adapters.ReservationModel || Reservation;
  const BillModel = adapters.BillModel || Bill;
  const PaymentModel = adapters.PaymentModel || Payment;
  const contractId = contract._id;
  const referenceQuery = {
    _id: { $ne: contractId },
    $or: [
      { previousContractId: contractId }, { renewedContractId: contractId },
      { supersededBy: contractId }, { supersededByContractId: contractId },
      { parentContractId: contractId }, { replacesContractId: contractId },
      { duplicateOfContractId: contractId },
    ],
  };
  const otherReferenceCounter = adapters.countOtherCollectionReferences ||
    countOtherCollectionReferences;
  const [contractReferences, stayReferences, reservationReferences, billings, payments, otherCollectionReferences] =
    await Promise.all([
      ContractModel.countDocuments(referenceQuery),
      StayModel.countDocuments({ contractId }),
      ReservationModel.countDocuments({ contractId }),
      BillModel.countDocuments({ contractId }),
      PaymentModel.countDocuments({ contractId }),
      otherReferenceCounter(contractId),
    ]);
  const prepared = contract.preparedDocuments || [];
  const dependencies = {
    signedDocuments: (contract.signedDocuments || []).length,
    notarizedDocuments: (contract.notarizedDocuments || []).length,
    finalDocuments: contract.finalDocument || contract.finalStorageKey ? 1 : 0,
    printedIssuances: contract.printedAt || contract.printedBy ? 1 : 0,
    activePreparedDocuments: currentPrepared(contract).length,
    preparedDocuments: prepared.length,
    payments,
    billings,
    renewalsAmendmentsReplacements: contractReferences,
    residentPublications: contract.tenantVisible || contract.publishedAt ||
      ["published", "active", "expiring_soon"].includes(contract.status) ? 1 : 0,
    stayReferences,
    reservationReferences,
    otherCollectionReferences,
  };
  const blockingDependencies = [];
  if (contract.isTestRecord !== true) blockingDependencies.push("notTestRecord");
  if (contract.isCanonical !== false) blockingDependencies.push("canonicalContract");
  if (!DELETE_ELIGIBLE.has(contract.status)) blockingDependencies.push("status");
  for (const [key, count] of Object.entries(dependencies)) {
    if (key === "preparedDocuments") continue;
    if (Number(count) > 0) blockingDependencies.push(key);
  }
  const unsafeStorageKeys = prepared
    .map((document) => document?.storageKey)
    .filter(Boolean)
    .filter((storageKey) => {
      try { assertOwnedContractStorageKey(contractId, storageKey); return false; } catch { return true; }
    });
  if (unsafeStorageKeys.length) blockingDependencies.push("unsafeStorageKey");
  return {
    eligible: blockingDependencies.length === 0,
    contractNumber: contract.contractNumber,
    isCanonical: contract.isCanonical === true,
    isTestRecord: contract.isTestRecord === true,
    dependencies,
    blockingDependencies: [...new Set(blockingDependencies)],
  };
};

const assertArchiveSafety = async (contract, replacement, ContractModel) => {
  if (!ARCHIVE_ELIGIBLE.has(contract.status) && !contract.duplicateOfContractId &&
      contract.isTestRecord !== true && contract.isCanonical !== false) {
    throw Object.assign(new Error("This Contract is not eligible for archive."), {
      statusCode: 409, code: "CONTRACT_ARCHIVE_BLOCKED",
    });
  }
  if (contract.isCanonical === true) {
    if (!replacement || id(replacement) === id(contract)) {
      throw Object.assign(new Error("A valid replacement canonical Contract is required."), {
        statusCode: 409, code: "CANONICAL_REPLACEMENT_REQUIRED",
      });
    }
    const sameRelationship = ["tenantId", "reservationId", "stayId"]
      .some((field) => hasValue(contract[field]) && id(contract[field]) === id(replacement[field]));
    if (!sameRelationship || replacement.archivedAt || replacement.isCanonical === false ||
        ["draft", "incomplete", "voided", "rejected", "cancelled", "archived"].includes(replacement.status)) {
      throw Object.assign(new Error("The selected replacement is not a valid canonical Contract."), {
        statusCode: 409, code: "CANONICAL_REPLACEMENT_INVALID",
      });
    }
  }
  const dependent = await ContractModel.exists({
    _id: { $ne: contract._id },
    $or: [{ previousContractId: contract._id }, { parentContractId: contract._id }],
    status: { $nin: ["voided", "rejected", "cancelled", "archived"] },
  });
  if (dependent) throw Object.assign(new Error("An active renewal or amendment depends on this Contract."), {
    statusCode: 409, code: "CONTRACT_ARCHIVE_DEPENDENCY",
  });
};

export const archiveContract = async ({
  contractId, actorId, reason, duplicateOfContractId = null, allowedBranch, adapters = {},
}) => {
  const ContractModel = adapters.ContractModel || Contract;
  const contract = await ContractModel.findById(contractId);
  if (!contract) throw Object.assign(new Error("Contract not found."), {
    statusCode: 404, code: "CONTRACT_NOT_FOUND",
  });
  if (allowedBranch && contract.branch !== allowedBranch) throw Object.assign(
    new Error("You cannot archive Contracts from another branch."),
    { statusCode: 403, code: "CONTRACT_BRANCH_ACCESS_DENIED" },
  );
  if (contract.archivedAt) throw Object.assign(new Error("Contract is already archived."), {
    statusCode: 409, code: "CONTRACT_ALREADY_ARCHIVED",
  });
  const replacementId = duplicateOfContractId || contract.duplicateOfContractId || null;
  const replacement = replacementId ? await ContractModel.findById(replacementId) : null;
  await assertArchiveSafety(contract, replacement, ContractModel);
  const now = new Date();
  const previousStatus = contract.status;
  const update = {
    status: "voided",
    isCurrent: false,
    isCanonical: false,
    publicationStatus: "withdrawn",
    tenantVisible: false,
    archivedAt: now,
    archivedBy: actorId,
    archiveReason: cleanReason(reason, "Archive reason"),
    archivedPreviousStatus: previousStatus,
    voidedAt: now,
    voidedBy: actorId,
    voidReason: cleanReason(reason, "Archive reason"),
    updatedBy: actorId,
    ...(replacement ? { duplicateOfContractId: replacement._id } : {}),
  };
  const archived = await ContractModel.findOneAndUpdate(
    { _id: contract._id, archivedAt: null },
    {
      $set: update,
      $push: { statusHistory: { status: "voided", changedAt: now, changedBy: actorId, reason: update.archiveReason } },
    },
    { new: true },
  );
  if (!archived) throw Object.assign(new Error("Contract archive was already processed."), {
    statusCode: 409, code: "CONTRACT_ARCHIVE_CONFLICT",
  });
  if (replacement && replacement.isCanonical !== true) {
    await ContractModel.updateOne(
      { _id: replacement._id, archivedAt: null },
      { $set: { isCanonical: true, isCurrent: true, updatedBy: actorId } },
    );
  }
  return { contract: archived, previousStatus, replacement };
};

export const restoreArchivedContract = async ({ contractId, actorId, reason, adapters = {} }) => {
  const ContractModel = adapters.ContractModel || Contract;
  const contract = await ContractModel.findById(contractId);
  if (!contract) throw Object.assign(new Error("Contract not found."), {
    statusCode: 404, code: "CONTRACT_NOT_FOUND",
  });
  if (!contract.archivedAt) throw Object.assign(new Error("Contract is not archived."), {
    statusCode: 409, code: "CONTRACT_NOT_ARCHIVED",
  });
  if (contract.duplicateOfContractId) throw Object.assign(
    new Error("A confirmed duplicate cannot be restored through the standard restore action."),
    { statusCode: 409, code: "DUPLICATE_CONTRACT_RESTORE_BLOCKED" },
  );
  const conflict = await ContractModel.exists({
    _id: { $ne: contract._id },
    tenantId: contract.tenantId,
    isCanonical: true,
    archivedAt: null,
    status: { $nin: ["voided", "rejected", "cancelled", "archived"] },
  });
  if (conflict) throw Object.assign(new Error("Another canonical Contract conflicts with restoration."), {
    statusCode: 409, code: "CONTRACT_RESTORE_CONFLICT",
  });
  const now = new Date();
  const restoredStatus = contract.archivedPreviousStatus &&
    !["voided", "archived"].includes(contract.archivedPreviousStatus)
    ? contract.archivedPreviousStatus : "incomplete";
  const restored = await ContractModel.findOneAndUpdate(
    { _id: contract._id, archivedAt: { $ne: null } },
    {
      $set: {
        status: restoredStatus, archivedAt: null, archivedBy: null,
        restoredAt: now, restoredBy: actorId, restoreReason: cleanReason(reason, "Restore reason"),
        publicationStatus: "internal", isCanonical: false, isCurrent: false,
        updatedBy: actorId,
      },
      $push: { statusHistory: { status: restoredStatus, changedAt: now, changedBy: actorId, reason } },
    },
    { new: true },
  );
  if (!restored) throw Object.assign(new Error("Contract restoration was already processed."), {
    statusCode: 409, code: "CONTRACT_RESTORE_CONFLICT",
  });
  return restored;
};

export const permanentlyDeleteTestContract = async ({
  contractId, actorId, confirmationContractNumber, reason, adapters = {},
}) => {
  const ContractModel = adapters.ContractModel || Contract;
  const removeDocument = adapters.removeDocument || removePreparedContractDocument;
  const auditDeletion = adapters.auditDeletion || ((payload) => AuditLog.log(payload));
  const contract = await ContractModel.findById(contractId);
  if (!contract) throw Object.assign(new Error("Contract not found."), {
    statusCode: 404, code: "CONTRACT_NOT_FOUND",
  });
  if (String(confirmationContractNumber || "") !== contract.contractNumber) {
    throw Object.assign(new Error("The confirmation Contract number does not match."), {
      statusCode: 400, code: "CONTRACT_DELETE_CONFIRMATION_MISMATCH",
    });
  }
  const deletionReason = cleanReason(reason, "Deletion reason");
  const eligibility = await buildContractDeletionEligibility(contract, adapters);
  if (!eligibility.eligible) throw Object.assign(
    new Error("This Contract has related records and must be archived instead."),
    {
      statusCode: 409, code: "CONTRACT_DELETE_BLOCKED",
      details: { blockingDependencies: eligibility.blockingDependencies, dependencies: eligibility.dependencies },
    },
  );
  await auditDeletion({
    type: "data_deletion",
    action: "Authorized permanent test Contract deletion",
    severity: "critical",
    user: `admin:${String(actorId)}`,
    userId: mongoose.isValidObjectId(actorId) ? actorId : undefined,
    userRole: "owner",
    branch: contract.branch || "",
    entityType: "contract",
    entityId: String(contract._id),
    details: deletionReason,
    metadata: {
      contractNumber: contract.contractNumber,
      isTestRecord: true,
      dependencySummary: eligibility.dependencies,
    },
  });
  const deleted = await ContractModel.findOneAndDelete({
    _id: contract._id, isTestRecord: true, isCanonical: false,
    status: { $in: [...DELETE_ELIGIBLE] },
  });
  if (!deleted) throw Object.assign(new Error("Contract deletion was already processed or eligibility changed."), {
    statusCode: 409, code: "CONTRACT_DELETE_CONFLICT",
  });
  const cleanupFailures = [];
  for (const document of contract.preparedDocuments || []) {
    assertOwnedContractStorageKey(contract._id, document.storageKey);
    try { await removeDocument(document); } catch (error) {
      cleanupFailures.push({ storageKey: document.storageKey, code: error.code || "STORAGE_DELETE_FAILED" });
    }
  }
  return {
    deletedContract: deleted,
    deletionReason,
    actorId,
    dependencySummary: eligibility.dependencies,
    cleanupFailures,
  };
};
