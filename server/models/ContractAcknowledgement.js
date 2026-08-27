/**
 * ============================================================================
 * CONTRACT ACKNOWLEDGEMENT MODEL
 * ============================================================================
 *
 * Records that a tenant has viewed/acknowledged a specific Contract document
 * VERSION — not a legal e-signature, not electronic acceptance. The actual
 * legal document precedence (finalDocument: notarized > admin_scan, both
 * final-on-arrival) is entirely unaffected by acknowledgement; this exists
 * purely so the tenant confirms "I have seen this document" and Admin can
 * see whether/when that happened.
 *
 * VERSION BINDING:
 *   An acknowledgement is scoped to a specific
 *   {contractId, documentVersion, documentFileHash} triple, not just the
 *   Contract itself. If Contract.finalDocument is later replaced via
 *   contractFinalDocumentReplacementService (which bumps
 *   finalDocument.version and archives the prior value into
 *   finalDocumentHistory[]), a prior acknowledgement of the old version
 *   correctly stops applying — the tenant must acknowledge the new version.
 *   The old acknowledgement record is never deleted or mutated.
 *
 * ============================================================================
 */

import mongoose from "mongoose";

const contractAcknowledgementSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentVersion: {
      type: Number,
      required: true,
    },
    documentFileHash: {
      type: String,
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// The version-binding mechanism: a duplicate acknowledge (same tenant, same
// contract, same document version+hash) upserts onto this same record rather
// than creating a new one (idempotent double-click protection); a document
// replacement (new version/hash) always produces a new key, requiring fresh
// acknowledgement.
contractAcknowledgementSchema.index(
  { contractId: 1, tenantId: 1, documentVersion: 1, documentFileHash: 1 },
  { unique: true, name: "unique_contract_acknowledgement_version" },
);

// Fast lookup: "has this tenant acknowledged any version of this Contract?"
contractAcknowledgementSchema.index({ contractId: 1, tenantId: 1, acknowledgedAt: -1 });

export default mongoose.model("ContractAcknowledgement", contractAcknowledgementSchema);
