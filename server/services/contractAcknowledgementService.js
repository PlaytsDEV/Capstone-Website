/**
 * ============================================================================
 * CONTRACT ACKNOWLEDGEMENT SERVICE
 * ============================================================================
 *
 * Records "I confirm that I have received/reviewed this contract document" —
 * never described as a signature or legal acceptance (see
 * ContractAcknowledgement.js header). It NEVER changes Contract.status /
 * isCurrent / tenantVisible: a Draft acknowledgement leaves the Contract at
 * "generated", a final acknowledgement leaves it "published"/"active". The
 * legal lifecycle is entirely unaffected.
 *
 * WHAT CAN BE ACKNOWLEDGED (single canonical rule, all clients):
 *   1. The current FINAL document (contract.finalDocument, tenantVisible) —
 *      "I have seen my final contract."
 *   2. If there is no final document yet, the current GENERATED DRAFT
 *      (the newest non-superseded contract.preparedDocuments[] entry, while
 *      contract.status is in the prepared-visible range) — "I have received
 *      and reviewed the generated draft." This is explicitly NOT signing.
 *   FINAL always outranks DRAFT when both exist.
 *
 * VERSION BINDING (unchanged mechanism, now also covers drafts):
 *   An acknowledgement is scoped to a specific
 *   {contractId, documentVersion, documentFileHash} triple. If the document
 *   is later replaced — finalDocument bumped via
 *   contractFinalDocumentReplacementService, OR the draft regenerated with a
 *   new prepared version/hash — a prior acknowledgement of the old version
 *   correctly stops applying and the tenant must acknowledge the new one.
 *   The old ContractAcknowledgement record is never deleted or mutated.
 *
 * ============================================================================
 */

import { Contract, ContractAcknowledgement } from "../models/index.js";
import { selectCurrentPreparedDocument } from "./preparedContractDocumentService.js";
import auditLogger from "./audit/auditLogger.js";

const serviceError = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

// The prepared draft is acknowledgeable exactly while it is the tenant's
// live review copy — i.e. generated but not yet superseded by a final
// document. Once finalDocument exists, rule (1) takes over and the draft is
// no longer the thing being acknowledged.
const DRAFT_ACKNOWLEDGEABLE_STATUSES = new Set([
  "generated",
  "awaiting_signatures",
  "partially_signed",
  "signed",
  "awaiting_notarization",
  "notarized",
  "ready_for_publication",
]);

/**
 * Resolve which document (if any) the tenant is currently being asked to
 * acknowledge, normalized to a { kind, version, fileHash, label } shape so
 * every caller/client treats draft and final identically.
 *
 * @returns {{kind: "final"|"draft", version: number, fileHash: string, label: string}|null}
 */
export const resolveAcknowledgeableDocument = (contract) => {
  // (1) FINAL document — highest priority, unchanged rule.
  const finalDocument = contract?.finalDocument;
  if (
    finalDocument &&
    finalDocument.tenantVisible === true &&
    finalDocument.version &&
    finalDocument.fileHash
  ) {
    return {
      kind: "final",
      version: Number(finalDocument.version),
      fileHash: String(finalDocument.fileHash),
      label: "Final Contract",
    };
  }

  // (2) GENERATED DRAFT — only while it is the live review copy and no final
  // document has superseded it.
  if (contract && DRAFT_ACKNOWLEDGEABLE_STATUSES.has(contract.status)) {
    const prepared = selectCurrentPreparedDocument(contract);
    if (prepared && prepared.version && prepared.fileHash) {
      return {
        kind: "draft",
        version: Number(prepared.version),
        fileHash: String(prepared.fileHash),
        label: "Generated Draft — Review Copy",
      };
    }
  }

  return null;
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

  const target = resolveAcknowledgeableDocument(contract);
  if (!target) {
    throw serviceError(
      "This contract does not yet have a document available to acknowledge.",
      "NO_ACKNOWLEDGEABLE_DOCUMENT",
      409,
    );
  }

  const key = {
    contractId,
    tenantId,
    documentVersion: target.version,
    documentFileHash: target.fileHash,
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
  const doc = result.value?.toObject ? result.value.toObject() : result.value;
  const isNewAcknowledgement = Boolean(result.lastErrorObject?.upserted);

  if (isNewAcknowledgement) {
    await auditLogger.log({
      req,
      type: "data_modification",
      action: "acknowledge_contract",
      severity: "info",
      entityType: "contract_acknowledgement",
      entityId: doc._id,
      details: `Tenant acknowledged ${target.label} for Contract ${contract.contractNumber || contractId} (${target.kind} version ${target.version})`,
      metadata: {
        contractId: String(contractId),
        documentKind: target.kind,
        documentVersion: target.version,
        documentFileHash: target.fileHash,
      },
    });
  }

  return { ...doc, documentKind: target.kind };
}

const NOT_REQUIRED_STATUS = Object.freeze({
  required: false,
  acknowledged: false,
  acknowledgedAt: null,
  documentVersion: null,
  documentKind: null,
  documentLabel: null,
});

/**
 * Reports acknowledgement status against the CURRENT acknowledgeable
 * document (final if present, else the current generated draft) for an
 * ALREADY-LOADED contract — no extra Contract read. Prefer this from any
 * endpoint that already holds the contract (the three current-contract
 * endpoints). Returns the not-required shape when there is nothing to
 * acknowledge yet.
 */
export async function getAcknowledgementStatusForContract(contract, tenantId) {
  if (!contract) return { ...NOT_REQUIRED_STATUS };

  const target = resolveAcknowledgeableDocument(contract);
  if (!target) return { ...NOT_REQUIRED_STATUS };

  const record = await ContractAcknowledgement.findOne({
    contractId: contract._id,
    tenantId,
    documentVersion: target.version,
    documentFileHash: target.fileHash,
  }).lean();

  return {
    required: true,
    acknowledged: Boolean(record),
    acknowledgedAt: record?.acknowledgedAt || null,
    documentVersion: target.version,
    documentKind: target.kind,
    documentLabel: target.label,
  };
}

/**
 * Same as getAcknowledgementStatusForContract but takes a contractId and
 * loads the contract itself — used by the standalone
 * GET .../acknowledgement endpoints where the caller has only the id.
 * If that document was replaced/regenerated after a prior acknowledgement,
 * this correctly reports acknowledged:false for the new version while the
 * old ContractAcknowledgement record remains untouched.
 */
export async function getAcknowledgementStatus({ contractId, tenantId }) {
  const contract = await Contract.findById(contractId).lean();
  if (!contract) {
    throw serviceError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  }
  return getAcknowledgementStatusForContract(contract, tenantId);
}
