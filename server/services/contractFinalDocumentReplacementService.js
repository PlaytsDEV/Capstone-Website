import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { validateSignedDocumentUpload } from "./contractSigningService.js";
import { buildContractArtifactStorage } from "./contractPrivateStorageService.js";
import { storeSignedContractDocument, removeSignedContractDocument } from "./contractDocumentStorageService.js";

// The formal replacement process referenced (but not implemented) by
// contractSigningService.uploadSignedContract and
// contractNotarizationService.assertDirectUploadAllowed's
// FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS guard. Those guards
// exist to stop an accidental silent overwrite of an already-published
// finalDocument; this is the deliberate, audited path around them for when
// an admin genuinely uploaded the wrong scan.
//
// The replacement is stored into signedDocuments[] (not a new artifact
// kind) so contractPublicationService.resolveVerifiedAdminScanDocument's
// existing cross-check (finalDocument.sourceVersion must match a
// non-superseded signedDocuments[] entry with the same fileHash) keeps
// working unchanged for the new finalDocument too — this function does not
// introduce a second document resolver, it produces data the existing one
// already knows how to validate and stream.

const error = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });
const safePart = (value) => String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_");
const clean = (value, max = 1000) => String(value || "").trim().slice(0, max);

export const replaceFinalContractDocument = async ({ contract, file, actorId, replacementReason }) => {
  if (!contract.finalDocument) {
    throw error(
      "There is no published final document to replace. Upload a final document first.",
      "NO_FINAL_DOCUMENT_TO_REPLACE", 409,
    );
  }
  const reason = clean(replacementReason, 1000);
  if (!reason) {
    throw error("A replacement reason is required.", "FINAL_DOCUMENT_REPLACEMENT_REASON_REQUIRED");
  }
  const type = validateSignedDocumentUpload(file);

  const previousFinal = contract.finalDocument.toObject
    ? contract.finalDocument.toObject()
    : { ...contract.finalDocument };
  const previousVersion = Number(previousFinal.version) || 1;
  const nextVersion = previousVersion + 1;

  const signedVersion = Math.max(0, ...(contract.signedDocuments || []).map((item) => Number(item.version) || 0)) + 1;
  const storedName = `${safePart(contract.contractNumber)}_final_replacement_v${nextVersion}${type.extension}`;
  const target = buildContractArtifactStorage({ kind: "signed", contractId: contract._id, fileName: storedName });
  const uploadedAt = new Date();
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const stored = await storeSignedContractDocument({
    target,
    bytes: file.buffer,
    contentType: type.mimeType,
    metadata: {
      contractId: contract._id, contractNumber: contract.contractNumber,
      documentType: "final-replacement", version: signedVersion, fileHash,
    },
  });

  let pageCount = 1;
  if (type.mimeType === "application/pdf") {
    try {
      const pdfDoc = await PDFDocument.load(file.buffer, { updateMetadata: false });
      pageCount = pdfDoc.getPageCount();
    } catch (_) {
      pageCount = 1;
    }
  }

  try {
    for (const document of contract.signedDocuments || []) document.superseded = true;
    contract.signedDocuments.push({
      version: signedVersion, storageProvider: stored.provider, storageKey: stored.storageKey,
      fileName: storedName, fileHash, fileSize: type.fileSize, mimeType: type.mimeType,
      uploadedAt, uploadedBy: actorId,
      preparedDocumentVersion: contract.generatedVersion || 1, superseded: false,
      replacementReason: reason,
    });

    contract.finalDocumentHistory = contract.finalDocumentHistory || [];
    contract.finalDocumentHistory.push({
      ...previousFinal,
      version: previousVersion,
      supersededAt: uploadedAt,
      supersededBy: actorId,
    });

    contract.finalDocument = {
      version: nextVersion,
      storageKey: stored.storageKey,
      fileName: storedName,
      fileHash,
      fileSize: type.fileSize,
      mimeType: type.mimeType,
      pageCount,
      sourceType: "admin_scan",
      sourceVersion: signedVersion,
      sourceUploadedAt: uploadedAt,
      sourceVerifiedAt: null,
      sourceVerifiedBy: null,
      publishedAt: uploadedAt,
      publishedBy: actorId,
      tenantVisible: true,
      replacementReason: reason,
    };
    contract.finalStorageKey = stored.storageKey;
    contract.signedStorageKey = stored.storageKey;
    contract.signedFileName = storedName;
    contract.signedFileHash = fileHash;
    contract.signedFileSize = type.fileSize;
    contract.signedMimeType = type.mimeType;
    contract.signedUploadedAt = uploadedAt;
    contract.signedUploadedBy = actorId;
    contract.signedDocumentVersion = signedVersion;
    contract.publishedAt = uploadedAt;
    contract.publishedBy = actorId;
    contract.publicationNotes = `Final Contract document replaced (v${previousVersion} → v${nextVersion}): ${reason}`;

    await contract.save();
  } catch (saveError) {
    await removeSignedContractDocument({ storageProvider: stored.provider, storageKey: stored.storageKey }).catch(() => {});
    throw saveError;
  }

  return {
    contract,
    finalDocument: contract.finalDocument,
    previousVersion,
    nextVersion,
  };
};
