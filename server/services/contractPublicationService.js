import { PDFDocument } from "pdf-lib";
import { transitionContract } from "./contractService.js";
import { inspectNotarizedContractDocument, inspectSignedContractDocument } from "./contractDocumentStorageService.js";

export const PUBLICATION_CHECKLIST_KEYS = Object.freeze([
  "contractNumberMatches", "tenantLegalNameMatches", "branchMatches",
  "assignmentMatches", "leaseDatesMatch", "currentPreparedVersionMatches",
  "verifiedNotarizedVersionSelected", "wetSignaturesVisible",
  "acknowledgmentCompleted", "notarySignatureVisible", "notarialSealVisible",
  "allPagesPresent", "scanReadable", "noPageCropped", "legalWordingUnchanged",
  "noRejectedOrSupersededVersion", "tenantSecureAccessConfirmed",
  "finalDocumentImmutabilityConfirmed", "formalReplacementRequiredConfirmed",
]);

const closedStatuses = new Set([
  "expired", "terminated", "cancelled", "replaced", "archived", "renewed",
]);
const publicationError = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });
const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("end", () => resolve(Buffer.concat(chunks)));
  stream.on("error", reject);
});

// Reads through `inspected.createReadStream()` — provider-agnostic (local
// disk or Firebase Storage both expose the same interface via
// contractDocumentStorageService.js) — instead of assuming a local
// `absolutePath`, so this works identically for a locally-stored file and a
// durably-stored one.
const pageCountForInspected = async (inspected, mimeType) => {
  if (mimeType !== "application/pdf") return 1;
  const bytes = await streamToBuffer(inspected.createReadStream());
  return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
};

export const resolveVerifiedCurrentNotarizedDocument = async (contract) => {
  const current = (contract.notarizedDocuments || []).find(
    (item) => Number(item.version) === Number(contract.notarizedDocumentVersion),
  );
  if (!current) {
    throw publicationError("A verified notarized Contract is required.",
      "VERIFIED_NOTARIZED_DOCUMENT_REQUIRED", 422);
  }
  if (current.rejectedAt) {
    throw publicationError("The current notarized Contract was rejected.",
      "NOTARIZED_DOCUMENT_REJECTED", 409);
  }
  if (current.superseded) {
    throw publicationError("The current notarized Contract was superseded.",
      "NOTARIZED_DOCUMENT_SUPERSEDED", 409);
  }
  if (!current.verifiedAt || !current.verifiedBy || !contract.notarizationVerifiedAt) {
    throw publicationError("A verified notarized Contract is required.",
      "VERIFIED_NOTARIZED_DOCUMENT_REQUIRED", 422);
  }
  if (Number(current.preparedDocumentVersion) !== Number(contract.generatedVersion)) {
    throw publicationError("The notarized Contract does not match the current prepared version.",
      "NOTARIZED_PREPARED_VERSION_MISMATCH", 409);
  }
  const prepared = (contract.preparedDocuments || []).find(
    (item) => Number(item.version) === Number(contract.generatedVersion) && !item.superseded,
  );
  if (!prepared) {
    throw publicationError("The current prepared Contract version is unavailable.",
      "CURRENT_PREPARED_CONTRACT_REQUIRED", 409);
  }
  if (current.storageKey !== contract.notarizedStorageKey ||
      current.fileHash !== contract.notarizedFileHash) {
    throw publicationError("The verified notarized metadata is inconsistent.",
      "CURRENT_NOTARIZED_DOCUMENT_UNAVAILABLE", 409);
  }
  let inspected;
  try {
    inspected = await inspectNotarizedContractDocument(current);
  } catch {
    inspected = null;
  }
  if (!inspected || Number(inspected.size) !== Number(current.fileSize)) {
    throw publicationError("The verified notarized Contract file is unavailable.",
      "CURRENT_NOTARIZED_DOCUMENT_UNAVAILABLE", 409);
  }
  return {
    document: current,
    size: inspected.size,
    createReadStream: inspected.createReadStream,
    pageCount: await pageCountForInspected(inspected, current.mimeType),
  };
};

const assertPublicationIdentity = (contract) => {
  if (!contract.tenantId || !contract.contractNumber || !contract.branch ||
      !contract.roomId || !contract.roomNumber || !contract.leaseStartDate ||
      !contract.leaseEndDate) {
    throw publicationError("Contract identity and assignment must be complete.",
      "CONTRACT_PUBLICATION_DATA_INCOMPLETE", 422);
  }
};

const assertNotPublished = (contract) => {
  if (contract.finalDocument || contract.finalStorageKey || contract.publishedAt ||
      ["published", "active", "expiring_soon"].includes(contract.status)) {
    throw publicationError("A published Contract is immutable.",
      "PUBLISHED_CONTRACT_IMMUTABLE", 409);
  }
};

export const markContractReadyForPublication = async ({ contract, actorId }) => {
  if (contract.status !== "notarized" || closedStatuses.has(contract.status)) {
    throw publicationError("Only a verified notarized Contract can be marked ready.",
      "CONTRACT_NOT_READY_FOR_PUBLICATION", 409);
  }
  assertNotPublished(contract);
  assertPublicationIdentity(contract);
  await resolveVerifiedCurrentNotarizedDocument(contract);
  const now = new Date();
  contract.readyForPublicationAt = now;
  contract.readyForPublicationBy = actorId;
  await transitionContract(contract, "ready_for_publication", actorId,
    "Verified notarized Contract marked ready for final publication review");
  return contract;
};

export const publishFinalContract = async ({ contract, actorId, checklist = {}, notes = "" }) => {
  if (contract.status !== "ready_for_publication") {
    throw publicationError("Contract must be ready for publication.",
      "CONTRACT_NOT_READY_FOR_PUBLICATION", 409);
  }
  assertNotPublished(contract);
  assertPublicationIdentity(contract);
  const missing = PUBLICATION_CHECKLIST_KEYS.filter((key) => checklist[key] !== true);
  if (missing.length) {
    throw publicationError("Every final-publication check must be confirmed.",
      "PUBLICATION_CHECKLIST_INCOMPLETE", 422, { missing });
  }
  const source = await resolveVerifiedCurrentNotarizedDocument(contract);
  const now = new Date();
  contract.finalDocument = {
    storageKey: source.document.storageKey,
    fileName: source.document.fileName,
    fileHash: source.document.fileHash,
    fileSize: source.document.fileSize,
    mimeType: source.document.mimeType,
    pageCount: source.pageCount,
    sourceType: "notarized",
    sourceVersion: source.document.version,
    sourceUploadedAt: source.document.uploadedAt,
    sourceVerifiedAt: source.document.verifiedAt,
    sourceVerifiedBy: source.document.verifiedBy,
    publishedAt: now,
    publishedBy: actorId,
    tenantVisible: true,
  };
  contract.finalStorageKey = source.document.storageKey;
  contract.publishedAt = now;
  contract.publishedBy = actorId;
  contract.publicationNotes = clean(notes);
  contract.tenantVisible = true;
  contract.isCanonical = contract.duplicateOfContractId ? false : true;
  contract.publicationStatus = "published";
  contract.publicationChecklist = { ...checklist };
  contract.publicationChecklistConfirmedAt = now;
  contract.publicationChecklistConfirmedBy = actorId;
  await transitionContract(contract, "published", actorId,
    "Final wet-signed and notarized Contract published for secure tenant access");
  return { contract, finalDocument: contract.finalDocument };
};

// Serves a "admin_scan" finalDocument — a wet-signed scan backfilled by
// scripts/reconcileFinalContractUploads.mjs from a pre-existing
// signedDocuments[] entry that predates formal notarization verification —
// from that array directly, in place of resolveVerifiedCurrentNotarizedDocument's
// notarizedDocuments[]/notarizationVerifiedAt checks, which an admin_scan
// document never has and is never expected to have.
const resolveVerifiedAdminScanDocument = async (contract) => {
  const current = (contract.signedDocuments || []).find(
    (item) => Number(item.version) === Number(contract.finalDocument.sourceVersion),
  );
  if (!current || current.superseded || current.rejectedAt) {
    throw publicationError("The archived signed Contract scan is unavailable.",
      "CURRENT_SIGNED_DOCUMENT_UNAVAILABLE", 409);
  }
  if (current.fileHash !== contract.finalDocument.fileHash) {
    throw publicationError("The verified signed-scan metadata is inconsistent.",
      "CURRENT_SIGNED_DOCUMENT_UNAVAILABLE", 409);
  }
  let inspected;
  try {
    inspected = await inspectSignedContractDocument(current);
  } catch {
    inspected = null;
  }
  if (!inspected || Number(inspected.size) !== Number(current.fileSize)) {
    throw publicationError("The archived signed Contract scan file is unavailable.",
      "CURRENT_SIGNED_DOCUMENT_UNAVAILABLE", 409);
  }
  return {
    document: current,
    size: inspected.size,
    createReadStream: inspected.createReadStream,
    pageCount: await pageCountForInspected(inspected, current.mimeType),
  };
};

export const resolvePublishedFinalDocument = async (contract) => {
  if (!["published", "active", "expiring_soon", "expired"].includes(contract.status) ||
      contract.tenantVisible !== true || !contract.finalDocument) {
    throw publicationError("Final Contract is unavailable.", "FINAL_DOCUMENT_UNAVAILABLE", 404);
  }
  if (contract.finalDocument.sourceType === "admin_scan") {
    const source = await resolveVerifiedAdminScanDocument(contract);
    if (Number(contract.finalDocument.sourceVersion) !== Number(source.document.version)) {
      throw publicationError("Final Contract publication metadata is inconsistent.",
        "FINAL_DOCUMENT_UNAVAILABLE", 409);
    }
    return { ...source, finalDocument: contract.finalDocument };
  }
  if (!contract.notarizationVerifiedAt) {
    throw publicationError("Final Contract is unavailable.", "FINAL_DOCUMENT_UNAVAILABLE", 404);
  }
  const source = await resolveVerifiedCurrentNotarizedDocument(contract);
  if (String(contract.finalDocument.fileHash) !== String(source.document.fileHash) ||
      Number(contract.finalDocument.sourceVersion) !== Number(source.document.version) ||
      contract.finalDocument.sourceType !== "notarized") {
    throw publicationError("Final Contract publication metadata is inconsistent.",
      "FINAL_DOCUMENT_UNAVAILABLE", 409);
  }
  return { ...source, finalDocument: contract.finalDocument };
};

export const resolveContractDisplayLifecycle = (contract, now = new Date(), warningDays = 30) => {
  if (!["published", "active", "expiring_soon", "expired"].includes(contract?.status)) {
    return { key: contract?.status || "unavailable", label: null };
  }
  const current = new Date(now);
  const start = new Date(contract.leaseStartDate);
  const end = new Date(contract.leaseEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { key: "published", label: "Published" };
  }
  if (current < start) return { key: "published_future", label: "Published — Lease Not Yet Started" };
  if (current > end) return { key: "expired", label: "Expired" };
  const days = Math.ceil((end.getTime() - current.getTime()) / 86_400_000);
  return days <= warningDays
    ? { key: "expiring_soon", label: "Expiring Soon" }
    : { key: "active", label: "Active" };
};
