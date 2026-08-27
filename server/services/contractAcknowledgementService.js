/**
 * ============================================================================
 * CONTRACT ACKNOWLEDGEMENT SERVICE
 * ============================================================================
 *
 * Records "I confirm that I have viewed this contract" — never described as
 * a signature or legal acceptance (see ContractAcknowledgement.js header).
 * Bound to the exact {contractId, documentVersion, documentFileHash} of the
 * Contract's current finalDocument, so a later document replacement
 * naturally requires a fresh acknowledgement without needing any explicit
 * invalidation step — the old record simply stops matching the current key.
 *
 * ============================================================================
 */

import { Contract, ContractAcknowledgement } from "../models/index.js";
import auditLogger from "./audit/auditLogger.js";

const serviceError = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const resolveAcknowledgeableDocument = (contract) => {
  const finalDocument = contract?.finalDocument;
  if (!finalDocument || finalDocument.tenantVisible !== true) return null;
  if (!finalDocument.version || !finalDocument.fileHash) return null;
  return finalDocument;
};

/**
 * Idempotent — a duplicate acknowledge for the same tenant/contract/document
 * version safely returns the existing record rather than erroring, following
 * the same findOneAndUpdate + $setOnInsert + upsert idiom used by
 * BedCheckoutLock.acquireLock (server/models/BedCheckoutLock.js), backed by
 * the unique compound index on the ContractAcknowledgement model.
 */
export async function acknowledgeContract({ contractId, tenantId, req }) {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw serviceError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  }
  if (String(contract.tenantId) !== String(tenantId)) {
    throw serviceError("You can only acknowledge your own contract.", "CONTRACT_ACCESS_DENIED", 403);
  }

  const finalDocument = resolveAcknowledgeableDocument(contract);
  if (!finalDocument) {
    throw serviceError(
      "This contract does not yet have a final document available to acknowledge.",
      "NO_ACKNOWLEDGEABLE_DOCUMENT",
      409,
    );
  }

  const key = {
    contractId,
    tenantId,
    documentVersion: finalDocument.version,
    documentFileHash: finalDocument.fileHash,
  };

  // includeResultMetadata surfaces lastErrorObject.upserted so we can tell
  // "this call actually created the record" apart from "the record already
  // existed" WITHOUT a separate pre-check — a pre-check-then-upsert is a
  // TOCTOU race under real concurrency (two simultaneous acknowledges can
  // both observe "not yet created" before either upserts), which would log
  // a duplicate audit entry for what the unique index correctly collapsed
  // into a single document.
  const result = await ContractAcknowledgement.findOneAndUpdate(
    key,
    {
      $setOnInsert: {
        ...key,
        acknowledgedAt: new Date(),
        ipAddress: req?.ip || null,
        userAgent: req?.get ? req.get("user-agent") || null : null,
      },
    },
    { upsert: true, new: true, runValidators: true, includeResultMetadata: true },
  );
  const doc = result.value;
  const isNewAcknowledgement = Boolean(result.lastErrorObject?.upserted);

  if (isNewAcknowledgement) {
    await auditLogger.log({
      req,
      type: "data_modification",
      action: "acknowledge_contract",
      severity: "info",
      entityType: "contract_acknowledgement",
      entityId: doc._id,
      details: `Tenant acknowledged Contract ${contract.contractNumber || contractId} (version ${finalDocument.version})`,
      metadata: {
        contractId: String(contractId),
        documentVersion: finalDocument.version,
        documentFileHash: finalDocument.fileHash,
      },
    });
  }

  return doc;
}

/**
 * Reports acknowledgement status against the CURRENT finalDocument version —
 * if the document was replaced after a prior acknowledgement, this correctly
 * reports acknowledged:false for the new version while the old
 * ContractAcknowledgement record remains untouched (never deleted/mutated).
 */
export async function getAcknowledgementStatus({ contractId, tenantId }) {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw serviceError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  }

  const finalDocument = resolveAcknowledgeableDocument(contract);
  if (!finalDocument) {
    return { required: false, acknowledged: false, acknowledgedAt: null, documentVersion: null };
  }

  const record = await ContractAcknowledgement.findOne({
    contractId,
    tenantId,
    documentVersion: finalDocument.version,
    documentFileHash: finalDocument.fileHash,
  }).lean();

  return {
    required: true,
    acknowledged: Boolean(record),
    acknowledgedAt: record?.acknowledgedAt || null,
    documentVersion: finalDocument.version,
  };
}
