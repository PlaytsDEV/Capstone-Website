import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { transitionContract } from "./contractService.js";
import { validateSignedDocumentUpload } from "./contractSigningService.js";

export const NOTARIZED_CONTRACT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../private/notarized-contracts",
);

export const DIRECT_NOTARIZED_UPLOAD_STATUSES = Object.freeze([
  "generated", "awaiting_signatures", "partially_signed", "signed", "awaiting_notarization",
]);

export const NOTARIZATION_CHECKLIST_KEYS = Object.freeze([
  "contractNumberMatches", "tenantLegalNameMatches", "assignmentMatches",
  "leaseDatesMatch", "currentPreparedContractUsed",
  "tenantWetSignatureVisible", "lessorWetSignatureVisible", "witnessSignaturesVisible",
  "acknowledgmentCompleted", "notarySignatureVisible", "notarialSealVisible",
  "notarizationDateVisible", "notarizationPlaceVisible", "documentNumberCompleted",
  "pageNumberCompleted", "bookNumberCompleted", "seriesCompleted",
  "allPagesPresent", "scanReadable", "noPageCropped", "noPageMissing",
  "legalWordingUnchanged", "noUnauthorizedAlteration",
]);

const terminalStatuses = new Set([
  "expired", "terminated", "cancelled", "replaced", "archived", "renewed",
]);
const publishedStatuses = new Set(["ready_for_publication", "published", "active"]);
const error = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });
const safe = (value) => String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_");
const clean = (value, max = 200) => String(value || "").trim().slice(0, max);

const normalizeNotarialDetails = (details = {}) => {
  const normalized = {
    notarizedAt: details.notarizedAt ? new Date(details.notarizedAt) : null,
    notarizationPlace: clean(details.notarizationPlace),
    notaryName: clean(details.notaryName),
    notaryOffice: clean(details.notaryOffice),
    documentNumber: clean(details.documentNumber, 80),
    pageNumber: clean(details.pageNumber, 80),
    bookNumber: clean(details.bookNumber, 80),
    seriesYear: details.seriesYear === "" || details.seriesYear == null
      ? null : Number(details.seriesYear),
  };
  if (normalized.notarizedAt && Number.isNaN(normalized.notarizedAt.getTime())) {
    throw error("The notarization date is invalid.", "INVALID_NOTARIZATION_DATE");
  }
  if (normalized.seriesYear != null &&
      (!Number.isInteger(normalized.seriesYear) || normalized.seriesYear < 1900 || normalized.seriesYear > 2200)) {
    throw error("The notarial series year is invalid.", "INVALID_NOTARIZATION_SERIES_YEAR");
  }
  return normalized;
};

export const resolveNotarizedContractPath = (storageKey) => {
  const normalized = String(storageKey || "").replaceAll("\\", "/");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw error("Invalid notarized-document storage key.", "INVALID_NOTARIZED_STORAGE_KEY");
  }
  const absolute = path.resolve(NOTARIZED_CONTRACT_ROOT, ...normalized.split("/"));
  if (!absolute.startsWith(`${NOTARIZED_CONTRACT_ROOT}${path.sep}`)) {
    throw error("Invalid notarized-document storage key.", "INVALID_NOTARIZED_STORAGE_KEY");
  }
  return absolute;
};

const currentNotarizedDocument = (contract) =>
  (contract.notarizedDocuments || []).find(
    (item) => Number(item.version) === Number(contract.notarizedDocumentVersion) &&
      !item.superseded && !item.rejectedAt,
  );

const assertDirectUploadAllowed = (contract, preparedDocumentVersion) => {
  if (terminalStatuses.has(contract.status) || publishedStatuses.has(contract.status) ||
      contract.finalStorageKey || contract.publishedAt) {
    const published = contract.finalDocument || contract.finalStorageKey || contract.publishedAt ||
      ["published", "active"].includes(contract.status);
    throw error(
      published
        ? "Replacing a published final document requires a formal process."
        : "A notarized upload is not allowed for a closed Contract.",
      published
        ? "FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS"
        : "NOTARIZED_DOCUMENT_UPLOAD_NOT_ALLOWED",
      409,
    );
  }
  if (!DIRECT_NOTARIZED_UPLOAD_STATUSES.includes(contract.status)) {
    throw error("Notarized upload is not allowed in the current status.",
      "NOTARIZED_DOCUMENT_UPLOAD_NOT_ALLOWED", 409);
  }
  const currentPrepared = (contract.preparedDocuments || []).find(
    (item) => Number(item.version) === Number(contract.generatedVersion) && !item.superseded,
  );
  if (!contract.generatedStorageKey || !currentPrepared) {
    throw error("A current prepared Contract is required.", "CURRENT_PREPARED_CONTRACT_REQUIRED", 422);
  }
  if (Number(preparedDocumentVersion) !== Number(contract.generatedVersion)) {
    throw error("The upload must correspond to the current prepared Contract version.",
      "NOTARIZED_PREPARED_VERSION_MISMATCH", 409, {
        expectedVersion: contract.generatedVersion,
      });
  }
};

export const uploadNotarizedContract = async ({
  contract, file, actorId, replacementReason = "", preparedDocumentVersion,
  notarialDetails = {},
}) => {
  assertDirectUploadAllowed(contract, preparedDocumentVersion);
  const type = validateSignedDocumentUpload(file);
  const previous = currentNotarizedDocument(contract);
  if ((contract.notarizedDocuments?.length || 0) > 0 && !clean(replacementReason)) {
    throw error("A replacement reason is required.",
      "NOTARIZED_DOCUMENT_REPLACEMENT_REASON_REQUIRED");
  }
  const version = Math.max(
    0, ...(contract.notarizedDocuments || []).map((item) => Number(item.version) || 0),
  ) + 1;
  const fileName = `${safe(contract.contractNumber)}_signed_notarized_v${version}${type.extension}`;
  const storageKey = [
    safe(contract.branch), String(contract.contractYear), safe(contract.contractNumber), fileName,
  ].join("/");
  const absolute = resolveNotarizedContractPath(storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolute, file.buffer, { flag: "wx", mode: 0o600 });
  const uploadedAt = new Date();
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const details = normalizeNotarialDetails(notarialDetails);
  if (previous) {
    previous.superseded = true;
    previous.replacementReason = clean(replacementReason, 500);
  } else if ((contract.notarizedDocuments?.length || 0) > 0) {
    contract.notarizedDocuments.at(-1).replacementReason = clean(replacementReason, 500);
  }
  contract.notarizedDocuments.push({
    version, storageKey, fileName, fileHash, fileSize: type.fileSize,
    mimeType: type.mimeType, uploadedAt, uploadedBy: actorId,
    preparedDocumentVersion: contract.generatedVersion, superseded: false,
    replacementReason: clean(replacementReason, 500), notarialDetails: details,
  });
  Object.assign(contract, {
    notarizedStorageKey: storageKey,
    notarizedFileName: fileName,
    notarizedFileHash: fileHash,
    notarizedFileSize: type.fileSize,
    notarizedMimeType: type.mimeType,
    notarizedUploadedAt: uploadedAt,
    notarizedUploadedBy: actorId,
    notarizedDocumentVersion: version,
    notarizationVerifiedAt: null,
    notarizationVerifiedBy: null,
    notarizationVerificationNotes: "",
    notarizationVerificationChecklist: null,
    notarizationRejectionReason: "",
    ...details,
  });
  try {
    await contract.save();
  } catch (saveError) {
    await fs.rm(absolute, { force: true }).catch(() => {});
    throw saveError;
  }
  return contract.notarizedDocuments.at(-1);
};

export const verifyNotarizedContract = async ({
  contract, actorId, documentVersion, notes = "", checklist = {},
}) => {
  const current = currentNotarizedDocument(contract);
  if (!current || !contract.notarizedStorageKey) {
    throw error("A current notarized copy is required.", "NOTARIZED_DOCUMENT_REQUIRED", 422);
  }
  if (Number(documentVersion) !== Number(current.version)) {
    throw error("The notarized document version has changed. Review the current upload.",
      "NOTARIZED_DOCUMENT_VERSION_MISMATCH", 409);
  }
  const missing = NOTARIZATION_CHECKLIST_KEYS.filter((key) => checklist[key] !== true);
  if (missing.length) {
    throw error("Every signed-and-notarized verification check must be confirmed.",
      "NOTARIZED_DOCUMENT_CHECKLIST_INCOMPLETE", 422, { missing });
  }
  if (checklist.warning === true && !clean(notes)) {
    throw error("Verification notes are required when a warning is recorded.",
      "NOTARIZED_DOCUMENT_WARNING_NOTES_REQUIRED", 422);
  }
  const now = new Date();
  current.verifiedAt = now;
  current.verifiedBy = actorId;
  current.verificationNotes = clean(notes, 2000);
  current.verificationChecklist = { ...checklist };
  contract.notarizationVerifiedAt = now;
  contract.notarizationVerifiedBy = actorId;
  contract.notarizationVerificationNotes = clean(notes, 2000);
  contract.notarizationVerificationChecklist = { ...checklist };
  contract.notarizationRejectionReason = "";
  await transitionContract(
    contract, "notarized", actorId,
    "Signed-and-notarized Contract scan verified; final publication remains pending",
  );
  return contract;
};

export const rejectNotarizedContract = async ({
  contract, actorId, documentVersion, reason,
}) => {
  const current = currentNotarizedDocument(contract);
  if (!current || !contract.notarizedStorageKey) {
    throw error("There is no current notarized copy to reject.",
      "NOTARIZED_DOCUMENT_REJECTION_NOT_ALLOWED", 409);
  }
  if (Number(documentVersion) !== Number(current.version)) {
    throw error("The notarized document version has changed. Review the current upload.",
      "NOTARIZED_DOCUMENT_VERSION_MISMATCH", 409);
  }
  const rejectionReason = clean(reason, 1000);
  if (!rejectionReason) {
    throw error("A notarized-copy rejection reason is required.",
      "NOTARIZED_DOCUMENT_REJECTION_REASON_REQUIRED");
  }
  current.rejectedAt = new Date();
  current.rejectedBy = actorId;
  current.rejectionReason = rejectionReason;
  current.superseded = true;
  contract.notarizationRejectionReason = rejectionReason;
  contract.notarizationVerifiedAt = null;
  contract.notarizationVerifiedBy = null;
  contract.notarizationVerificationChecklist = null;
  contract.notarizedStorageKey = null;
  contract.notarizedFileName = null;
  contract.notarizedFileHash = null;
  contract.notarizedFileSize = null;
  contract.notarizedMimeType = null;
  await contract.save();
  return contract;
};
