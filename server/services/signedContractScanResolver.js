/**
 * ============================================================================
 * CANONICAL SIGNED-SCAN RESOLVER
 * ============================================================================
 *
 * ONE source of truth for "which wet-signed / final scan applies to THIS
 * Contract, and where does the viewer fetch it from".
 *
 * The signed/wet-signed scan is uploaded onto the lease Contract that was in
 * effect at signing time (usually the `initial` Contract). A room transfer
 * then makes a Room Transfer Addendum (`contractPurpose: "amendment"`, or a
 * legacy `"replacement"`) the tenant's current canonical Contract — and that
 * Addendum has NO signed scan of its own (it is acknowledgement-only). The
 * viewer must therefore resolve the scan through the Contract lineage instead
 * of only looking at `currentContract.signedDocuments`.
 *
 * Resolution order for a given Contract:
 *   1. This Contract owns an admin_scan finalDocument -> return it.
 *   2. This Contract has a non-superseded, non-rejected signedDocuments[]
 *      entry -> return the newest one.
 *   3. This Contract is an amendment/replacement -> walk
 *      replacesContractId, then parentContractId, up the lineage until an
 *      ancestor satisfies (1) or (2). Return that ancestor's identity flagged
 *      `inheritedFromContractId` (+ number) so the UI can label it
 *      "Signed copy from the original lease — <number>".
 *   4. Nothing found anywhere in the lineage -> return null (a genuine empty
 *      state; never fabricate availability).
 *
 * The returned `{ contractId, version }` is the identity BOTH the Admin viewer
 * (contractApi.getSignedContractFile -> /contracts/:id/documents/signed/:v)
 * and the Tenant viewer
 * (tenantContractApi.getMySignedContractFile -> /contracts/my/:id/documents/signed/:v)
 * use, so Preview / Open-in-tab / Download all resolve the same file.
 * ============================================================================
 */

import { Contract } from "../models/index.js";

const AMENDMENT_PURPOSES = new Set(["amendment", "replacement"]);
const MAX_LINEAGE_DEPTH = 12;

/**
 * The newest non-superseded, non-rejected signedDocuments[] entry with a real
 * stored file, or null.
 */
function newestValidSignedDoc(contract) {
  return (
    [...(contract?.signedDocuments || [])]
      .filter(
        (d) =>
          d &&
          d.superseded !== true &&
          !d.rejectedAt &&
          Boolean(d.storageKey) &&
          Boolean(d.fileName),
      )
      .sort(
        (a, b) =>
          (Number(b.version) || 0) - (Number(a.version) || 0) ||
          new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime(),
      )[0] || null
  );
}

/**
 * Does THIS Contract (not its lineage) directly own a resolvable signed scan?
 * Returns the scan identity for this contract, or null.
 *
 * @param {Object} contract - plain object or mongoose doc
 * @returns {{ contractId: string, contractNumber: string, version: number, fileName: string|null, mimeType: string|null, source: "admin_scan"|"signed_document" } | null}
 */
export function resolveOwnSignedScan(contract) {
  if (!contract) return null;
  const id = String(contract._id || contract.id || "");

  const fd = contract.finalDocument;
  if (
    fd &&
    fd.sourceType === "admin_scan" &&
    Boolean(fd.fileName) &&
    Boolean(fd.storageKey || contract.finalStorageKey)
  ) {
    const version =
      Number(fd.sourceVersion) ||
      Number(contract.signedDocumentVersion) ||
      Number(contract.version) ||
      1;
    return {
      contractId: id,
      contractNumber: contract.contractNumber || "",
      version,
      fileName: fd.fileName || null,
      mimeType: fd.mimeType || "application/pdf",
      source: "admin_scan",
    };
  }

  const signed = newestValidSignedDoc(contract);
  if (signed) {
    return {
      contractId: id,
      contractNumber: contract.contractNumber || "",
      version: Number(signed.version) || Number(contract.signedDocumentVersion) || 1,
      fileName: signed.fileName || null,
      mimeType: signed.mimeType || "application/pdf",
      source: "signed_document",
    };
  }

  return null;
}

/**
 * Resolve the canonical signed scan for `contract`, walking the Contract
 * lineage for an amendment/replacement that has none of its own.
 *
 * @param {Object} contract - the Contract the viewer is showing (plain object
 *   or mongoose doc). MUST include _id, contractPurpose, replacesContractId,
 *   parentContractId, finalDocument, signedDocuments.
 * @param {Object} [opts]
 * @param {Function} [opts.loadContractById] - async (id) => contract|null.
 *   Defaults to a lean Contract.findById with the fields the walk needs.
 * @returns {Promise<null | {
 *   contractId: string,
 *   version: number,
 *   fileName: string|null,
 *   mimeType: string|null,
 *   source: "admin_scan"|"signed_document",
 *   inherited: boolean,
 *   inheritedFromContractId: string|null,
 *   inheritedFromContractNumber: string|null,
 * }>}
 */
export async function resolveSignedScanForContract(contract, opts = {}) {
  if (!contract) return null;

  const loadContractById =
    opts.loadContractById ||
    ((id) =>
      Contract.findById(id)
        .select(
          "_id contractNumber contractPurpose replacesContractId parentContractId finalDocument finalStorageKey signedDocuments signedDocumentVersion version",
        )
        .lean());

  // 1 + 2: does the viewed Contract own a scan directly?
  const own = resolveOwnSignedScan(contract);
  if (own) {
    return {
      contractId: own.contractId,
      version: own.version,
      fileName: own.fileName,
      mimeType: own.mimeType,
      source: own.source,
      inherited: false,
      inheritedFromContractId: null,
      inheritedFromContractNumber: null,
    };
  }

  // 3: only an amendment/replacement inherits from its lineage. An `initial` /
  // `renewal` Contract with no scan of its own is simply "no signed copy".
  const purpose = String(contract.contractPurpose || "initial");
  if (!AMENDMENT_PURPOSES.has(purpose)) return null;

  const visited = new Set([String(contract._id || contract.id || "")]);
  let nextId = contract.replacesContractId || contract.parentContractId || null;
  let depth = 0;

  while (nextId && depth < MAX_LINEAGE_DEPTH) {
    const key = String(nextId);
    if (visited.has(key)) break; // cycle guard
    visited.add(key);
    depth += 1;

    // eslint-disable-next-line no-await-in-loop
    const ancestor = await loadContractById(key);
    if (!ancestor) break;

    const ancestorScan = resolveOwnSignedScan(ancestor);
    if (ancestorScan) {
      return {
        contractId: ancestorScan.contractId,
        version: ancestorScan.version,
        fileName: ancestorScan.fileName,
        mimeType: ancestorScan.mimeType,
        source: ancestorScan.source,
        inherited: true,
        inheritedFromContractId: ancestorScan.contractId,
        inheritedFromContractNumber: ancestorScan.contractNumber || null,
      };
    }

    nextId = ancestor.replacesContractId || ancestor.parentContractId || null;
  }

  // 4: nothing in the lineage.
  return null;
}
