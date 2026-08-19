import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import { Contract } from "../models/index.js";
import { assertValidContractTransition, transitionContract } from "./contractService.js";

export const SIGNED_CONTRACT_MAX_BYTES = 10 * 1024 * 1024;
export const SIGNED_CONTRACT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../private/signed-contracts",
);
const error = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });
const safePart = (value) => String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_");

const TYPES = Object.freeze({
  pdf: { mimeType: "application/pdf", extensions: [".pdf"] },
  jpeg: { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  png: { mimeType: "image/png", extensions: [".png"] },
});

export const detectSignedDocumentType = (buffer) => {
  if (buffer?.subarray(0, 5).toString("ascii") === "%PDF-") return TYPES.pdf;
  if (buffer?.[0] === 0xff && buffer?.[1] === 0xd8 && buffer?.[2] === 0xff) return TYPES.jpeg;
  if (buffer?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return TYPES.png;
  return null;
};

export const validateSignedDocumentUpload = (file) => {
  if (!file?.buffer?.length) throw error("A signed Contract file is required.", "SIGNED_DOCUMENT_REQUIRED");
  const fileSize = Number(file.size) || file.buffer.length;
  if (fileSize > SIGNED_CONTRACT_MAX_BYTES) throw error("Signed Contract file is too large.", "SIGNED_DOCUMENT_TOO_LARGE", 413);
  const detected = detectSignedDocumentType(file.buffer);
  if (!detected) throw error("Only PDF, JPG, JPEG, or PNG signed copies are accepted.", "SIGNED_DOCUMENT_UNSUPPORTED_TYPE");
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!detected.extensions.includes(extension) || file.mimetype !== detected.mimeType) {
    throw error("Signed Contract file type does not match its content.", "SIGNED_DOCUMENT_TYPE_MISMATCH");
  }
  return { ...detected, extension, fileSize };
};

export const resolveSignedContractPath = (storageKey) => {
  const normalized = String(storageKey || "").replaceAll("\\", "/");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw error("Invalid signed-document storage key.", "INVALID_SIGNED_STORAGE_KEY", 400);
  }
  const absolute = path.resolve(SIGNED_CONTRACT_ROOT, ...normalized.split("/"));
  if (!absolute.startsWith(`${SIGNED_CONTRACT_ROOT}${path.sep}`)) {
    throw error("Invalid signed-document storage key.", "INVALID_SIGNED_STORAGE_KEY", 400);
  }
  return absolute;
};

export const requiredSignaturesComplete = (contract) =>
  contract.tenantSignatureStatus === "completed" &&
  contract.lessorSignatureStatus === "completed" &&
  ["completed", "not_required"].includes(contract.witnessSignatureStatus);

export const resolvePhysicalSigningStage = (contract) => {
  if (["active", "published", "ready_for_publication", "notarized", "awaiting_notarization", "signed", "expiring_soon", "renewed"].includes(contract.status)) {
    return contract.status;
  }
  if (!contract.printedAt && !contract.signedStorageKey) return contract.status;
  if (requiredSignaturesComplete(contract) && contract.signedStorageKey && contract.signingVerifiedAt) return "signed";
  const progressed = [
    contract.tenantSignatureStatus,
    contract.lessorSignatureStatus,
    contract.witnessSignatureStatus,
  ].some((value) => value === "completed" || value === "not_required") ||
    Boolean(contract.signedStorageKey) || Boolean(contract.signingRejectionReason);
  return progressed ? "partially_signed" : (contract.status === "draft" ? "draft" : "awaiting_signatures");
};

const applyDerivedStatus = async (contract, actorId, reason) => {
  const next = resolvePhysicalSigningStage(contract);
  if (next !== contract.status) await transitionContract(contract, next, actorId, reason);
  else await contract.save();
  return contract;
};

export const markContractPrinted = async ({ contract, actorId }) => {
  if (contract.status !== "generated") throw error("Only a generated Contract can be marked printed.", "CONTRACT_NOT_READY_FOR_PRINTING", 409);
  contract.printedAt = new Date();
  contract.printedBy = actorId;
  await transitionContract(contract, "awaiting_signatures", actorId, "Prepared Contract marked as printed for physical signing");
  return contract;
};

const signatureFields = Object.freeze({
  tenant: ["tenantSignatureStatus", "tenantSignedAt", "tenantSignatureConfirmedBy"],
  lessor: ["lessorSignatureStatus", "lessorSignedAt", "lessorSignatureConfirmedBy"],
  witnesses: ["witnessSignatureStatus", "witnessSignedAt", "witnessSignatureConfirmedBy"],
});

export const updatePhysicalSignature = async ({ contract, signer, value, actorId }) => {
  if (!["awaiting_signatures", "partially_signed"].includes(contract.status)) {
    throw error("Signature progress cannot be changed in the current Contract status.", "CONTRACT_SIGNATURE_UPDATE_NOT_ALLOWED", 409);
  }
  const fields = signatureFields[signer];
  const allowed = signer === "witnesses" ? ["pending", "completed", "not_required"] : ["pending", "completed"];
  if (!fields || !allowed.includes(value)) throw error("Invalid signature status.", "INVALID_SIGNATURE_STATUS");
  const previousValue = contract[fields[0]];
  contract[fields[0]] = value;
  contract[fields[1]] = value === "completed" ? new Date() : null;
  contract[fields[2]] = value === "pending" ? null : actorId;
  contract.signingVerifiedAt = null;
  contract.signingVerifiedBy = null;
  await applyDerivedStatus(contract, actorId, `${signer} signature changed from ${previousValue} to ${value}`);
  return { contract, previousValue, newValue: value };
};

export const uploadSignedContract = async ({ contract, file, actorId, replacementReason = "" }) => {
  if (["terminated", "cancelled", "archived", "voided", "rejected"].includes(contract.status)) {
    throw error("Signed copy upload is not allowed in the current Contract status.", "SIGNED_DOCUMENT_UPLOAD_NOT_ALLOWED", 409);
  }
  const type = validateSignedDocumentUpload(file);
  if ((contract.signedDocuments?.length || 0) > 0 && !String(replacementReason).trim()) {
    throw error("A replacement reason is required.", "SIGNED_DOCUMENT_REPLACEMENT_REASON_REQUIRED");
  }
  const resolvedReason = String(replacementReason || "").trim() || "Uploaded signed contract copy";
  const version = Math.max(0, ...(contract.signedDocuments || []).map((item) => Number(item.version) || 0)) + 1;
  const storedName = `${safePart(contract.contractNumber)}_signed_v${version}${type.extension}`;
  const storageKey = [safePart(contract.branch), String(contract.contractYear), safePart(contract.contractNumber), storedName].join("/");
  const absolute = resolveSignedContractPath(storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, file.buffer, { flag: "wx" });
  const uploadedAt = new Date();
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  for (const document of contract.signedDocuments || []) document.superseded = true;
  contract.signedDocuments.push({
    version, storageKey, fileName: storedName, fileHash, fileSize: type.fileSize,
    mimeType: type.mimeType, uploadedAt, uploadedBy: actorId,
    preparedDocumentVersion: contract.generatedVersion || 1, superseded: false,
    replacementReason: resolvedReason,
  });
  Object.assign(contract, {
    signedStorageKey: storageKey, signedFileName: storedName, signedFileHash: fileHash,
    signedFileSize: type.fileSize, signedMimeType: type.mimeType, signedUploadedAt: uploadedAt,
    signedUploadedBy: actorId, signedDocumentVersion: version,
    signingVerifiedAt: null, signingVerifiedBy: null, signingVerificationNotes: "",
    signingRejectionReason: "",
  });
  try {
    if (["active", "published", "ready_for_publication", "notarized", "awaiting_notarization", "signed", "expiring_soon", "renewed"].includes(contract.status)) {
      await contract.save();
    } else {
      await applyDerivedStatus(contract, actorId, version === 1 ? "Signed Contract copy uploaded" : `Signed Contract copy replaced: ${resolvedReason}`);
    }
  } catch (saveError) {
    await fs.rm(absolute, { force: true }).catch(() => {});
    throw saveError;
  }
  return contract.signedDocuments.at(-1);
};

export const verifySignedContract = async ({ contract, actorId, notes = "", checklist = {} }) => {
  if (!["awaiting_signatures", "partially_signed"].includes(contract.status)) throw error("Signed copy verification is not allowed.", "SIGNED_DOCUMENT_VERIFICATION_NOT_ALLOWED", 409);
  if (!requiredSignaturesComplete(contract)) throw error("All required physical signatures must be complete.", "REQUIRED_SIGNATURES_INCOMPLETE", 422);
  if (!contract.signedStorageKey) throw error("A current signed copy is required.", "SIGNED_DOCUMENT_REQUIRED", 422);
  const requiredChecks = ["tenantSignatureVisible", "lessorSignatureVisible", "witnessesSatisfied", "contractNumberMatches", "tenantNameMatches", "allPagesComplete", "scanReadable", "preparedVersionMatches", "legalTextUnaltered"];
  if (!requiredChecks.every((key) => checklist[key] === true)) throw error("Every signed-copy verification check must be confirmed.", "SIGNED_DOCUMENT_CHECKLIST_INCOMPLETE", 422);
  const current = contract.signedDocuments.find((item) => Number(item.version) === Number(contract.signedDocumentVersion));
  if (!current || current.superseded) throw error("A current signed copy is required.", "SIGNED_DOCUMENT_REQUIRED", 422);
  const now = new Date();
  current.verifiedAt = now;
  current.verifiedBy = actorId;
  contract.signingVerifiedAt = now;
  contract.signingVerifiedBy = actorId;
  contract.signingVerificationNotes = String(notes || "").trim();
  contract.signingRejectionReason = "";
  await applyDerivedStatus(contract, actorId, "Signed Contract copy verified");
  return contract;
};

export const rejectSignedContract = async ({ contract, actorId, reason }) => {
  if (!["awaiting_signatures", "partially_signed"].includes(contract.status) || !contract.signedStorageKey) {
    throw error("There is no current signed copy to reject.", "SIGNED_DOCUMENT_REJECTION_NOT_ALLOWED", 409);
  }
  if (!String(reason || "").trim()) throw error("A signed-copy rejection reason is required.", "SIGNED_DOCUMENT_REJECTION_REASON_REQUIRED");
  const current = contract.signedDocuments.find((item) => Number(item.version) === Number(contract.signedDocumentVersion));
  if (current) {
    current.rejectionReason = String(reason).trim();
    current.superseded = true;
  }
  contract.signingRejectionReason = String(reason).trim();
  contract.signingVerifiedAt = null;
  contract.signingVerifiedBy = null;
  contract.signedStorageKey = null;
  contract.signedFileName = null;
  contract.signedFileHash = null;
  contract.signedFileSize = null;
  contract.signedMimeType = null;
  await applyDerivedStatus(contract, actorId, `Signed Contract copy rejected: ${reason}`);
  return contract;
};

// Statuses a signedDocuments[]-only Contract (predating the
// auto-finalize-on-upload fix) can safely be promoted to canonical
// `finalDocument` from — mirrors contractNotarizationService.js's
// DIRECT_NOTARIZED_UPLOAD_STATUSES plus the notarization/publication
// statuses a contract may already be sitting in, kept as a separate literal
// here (not imported) to avoid a circular dependency: contractNotarizationService.js
// already imports from this module.
const AUTO_FINALIZE_PENDING_STATUSES = Object.freeze([
  "generated", "awaiting_signatures", "partially_signed", "signed", "awaiting_notarization",
  "notarized", "ready_for_publication",
]);
const AUTO_FINALIZE_ALREADY_PUBLISHED_STATUSES = Object.freeze([
  "published", "active", "expiring_soon", "expired",
]);

// Whether an existing signedDocuments[]-only Contract is safe for
// scripts/reconcileFinalContractUploads.mjs to promote straight to the
// canonical finalDocument. Never used by an interactive admin upload —
// those go through uploadNotarizedContract / uploadAndFinalizeNotarizedContract,
// which enforce the full checklist-gated process instead.
export const canAutoFinalize = (contract) => {
  if (contract.finalDocument) return false;
  return AUTO_FINALIZE_PENDING_STATUSES.includes(contract.status) ||
    AUTO_FINALIZE_ALREADY_PUBLISHED_STATUSES.includes(contract.status);
};

export const pdfPageCount = async (absolutePath) => {
  const bytes = await fs.readFile(absolutePath);
  return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
};

// Advances contract.status/statusHistory in memory from its current
// pending status to "published" via the same canonical chain
// uploadAndFinalizeNotarizedContract uses (current -> notarized ->
// ready_for_publication -> published), without that function's
// intermediate transitionContract saves — the caller persists once with a
// single contract.save() alongside the finalDocument fields it also sets,
// so a historical backfill costs one write per contract. A no-op if the
// Contract is already at or past "published" in the lifecycle.
export const advanceStatusToPublished = (contract, actorId, reason) => {
  if (AUTO_FINALIZE_ALREADY_PUBLISHED_STATUSES.includes(contract.status)) return contract;
  const fullChain = ["notarized", "ready_for_publication", "published"];
  const startIndex = fullChain.indexOf(contract.status);
  const chain = startIndex === -1 ? fullChain : fullChain.slice(startIndex + 1);
  for (const next of chain) {
    assertValidContractTransition(contract.status, next);
    contract.status = next;
    contract.statusHistory.push({ status: next, changedBy: actorId, reason });
  }
  contract.updatedBy = actorId;
  return contract;
};

export const deleteSignedContract = async ({ contract, version = null, actorId, reason = "" }) => {
  if (["terminated", "cancelled", "archived", "voided", "rejected"].includes(contract.status)) {
    throw error("Signed copy deletion is not allowed in the current Contract status.", "SIGNED_DOCUMENT_DELETION_NOT_ALLOWED", 409);
  }

  const docs = contract.signedDocuments || [];
  if (docs.length === 0) {
    throw error("No signed contract document found to delete.", "SIGNED_DOCUMENT_NOT_FOUND", 404);
  }

  const targetVersion = version != null && String(version).trim() !== ""
    ? Number(version)
    : Number(contract.signedDocumentVersion) || Math.max(...docs.map((d) => Number(d.version) || 0));

  const targetIndex = docs.findIndex((item) => Number(item.version) === targetVersion);
  if (targetIndex === -1) {
    throw error(`Signed contract document version ${targetVersion} not found.`, "SIGNED_DOCUMENT_NOT_FOUND", 404);
  }

  const [deletedDoc] = docs.splice(targetIndex, 1);
  contract.markModified("signedDocuments");

  if (deletedDoc?.storageKey) {
    try {
      const absolute = resolveSignedContractPath(deletedDoc.storageKey);
      await fs.rm(absolute, { force: true }).catch(() => {});
    } catch {
      // non-fatal if storage file already absent
    }
  }

  const remaining = [...(contract.signedDocuments || [])].sort((a, b) => Number(b.version) - Number(a.version));
  const activeRemaining = remaining.find((d) => !d.superseded) || remaining[0];

  if (activeRemaining) {
    activeRemaining.superseded = false;
    Object.assign(contract, {
      signedStorageKey: activeRemaining.storageKey,
      signedFileName: activeRemaining.fileName,
      signedFileHash: activeRemaining.fileHash,
      signedFileSize: activeRemaining.fileSize,
      signedMimeType: activeRemaining.mimeType,
      signedUploadedAt: activeRemaining.uploadedAt,
      signedUploadedBy: activeRemaining.uploadedBy,
      signedDocumentVersion: activeRemaining.version,
      signingVerifiedAt: activeRemaining.verifiedAt || null,
      signingVerifiedBy: activeRemaining.verifiedBy || null,
      signingVerificationNotes: activeRemaining.verificationNotes || "",
      signingRejectionReason: activeRemaining.rejectionReason || "",
    });
  } else {
    Object.assign(contract, {
      signedStorageKey: null,
      signedFileName: null,
      signedFileHash: null,
      signedFileSize: null,
      signedMimeType: null,
      signedUploadedAt: null,
      signedUploadedBy: null,
      signedDocumentVersion: 0,
      signingVerifiedAt: null,
      signingVerifiedBy: null,
      signingVerificationNotes: "",
      signingRejectionReason: "",
    });
  }

  const changeReason = `Signed Contract copy (v${targetVersion}) deleted${reason ? `: ${reason}` : ""}`;
  if (["active", "published", "ready_for_publication", "notarized", "awaiting_notarization", "expiring_soon", "renewed"].includes(contract.status)) {
    await contract.save();
  } else {
    await applyDerivedStatus(contract, actorId, changeReason);
  }

  return { contract, deletedVersion: targetVersion };
};

