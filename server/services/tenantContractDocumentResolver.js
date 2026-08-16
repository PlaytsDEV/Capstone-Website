import { selectCurrentPreparedDocument } from "./preparedContractDocumentService.js";

/**
 * ============================================================================
 * CANONICAL TENANT CONTRACT DOCUMENT RESOLVER
 * ============================================================================
 *
 * Implements the authoritative 2-tier document visibility rule defined in
 * LILYCREST_CONTRACT_WEB_FLOW_LOGIC_IMPROVEMENT1.md:
 *
 * 1. Final Notarized Contract (`finalDocument`)
 *    - Highest priority.
 *    - Signed, notarized, and finalized.
 *    - Automatically replaces any generated draft.
 *
 * 2. Generated Draft (`preparedDocuments[]`)
 *    - Second priority.
 *    - Visible to the tenant immediately after PDF generation (including
 *      auto-generation upon Move-In).
 *    - Labeled "Generated Draft — For Signing".
 *
 * 3. Unavailable / Preparing
 *    - When no valid PDF exists yet.
 *    - Labeled "Contract is being prepared."
 *
 * Both Web (/api/contracts/my/*) and Mobile (/api/m/contracts/*) consume this
 * single source of truth for document selection.
 * ============================================================================
 */

/**
 * Resolve which document is currently active for tenant viewing.
 *
 * @param {Object} contract - The Contract mongoose document or plain object
 * @returns {{
 *   available: boolean,
 *   type: 'final_notarized' | 'generated_draft' | null,
 *   label: string,
 *   isFinal: boolean,
 *   document: Object | null,
 *   version: number | null,
 *   fileName: string | null,
 *   fileSize: number | null,
 *   pageCount: number | null,
 *   generatedAt: Date | string | null,
 *   publishedAt: Date | string | null
 * }}
 */
export function resolveTenantContractDocument(contract) {
  if (!contract) {
    return {
      available: false,
      type: null,
      label: "Contract is being prepared.",
      isFinal: false,
      document: null,
      version: null,
      fileName: null,
      fileSize: null,
      pageCount: null,
      generatedAt: null,
      publishedAt: null,
    };
  }

  // 1. Final Notarized Contract takes top priority
  if (
    contract.finalDocument &&
    Boolean(contract.finalDocument.fileName) &&
    Boolean(contract.finalDocument.storageKey || contract.finalStorageKey)
  ) {
    const finalDoc = contract.finalDocument;
    return {
      available: true,
      type: "final_notarized",
      label: "Final Notarized Contract",
      isFinal: true,
      document: finalDoc,
      version: Number(finalDoc.sourceVersion) || Number(contract.notarizedDocumentVersion) || Number(contract.version) || 1,
      fileName: finalDoc.fileName,
      fileSize: finalDoc.fileSize ?? null,
      pageCount: finalDoc.pageCount ?? null,
      generatedAt: finalDoc.sourceUploadedAt || null,
      publishedAt: finalDoc.publishedAt || contract.publishedAt || null,
    };
  }

  // 2. Latest valid prepared draft (generated for signing)
  const prepared = selectCurrentPreparedDocument(contract);
  if (prepared) {
    return {
      available: true,
      type: "generated_draft",
      label: "Generated Draft — For Signing",
      isFinal: false,
      document: prepared,
      version: Number(prepared.version) || 1,
      fileName: prepared.fileName,
      fileSize: prepared.fileSize ?? null,
      pageCount: prepared.pageCount ?? null,
      generatedAt: prepared.generatedAt || null,
      publishedAt: null,
    };
  }

  // 3. Fallback: document is being prepared
  return {
    available: false,
    type: null,
    label: "Contract is being prepared.",
    isFinal: false,
    document: null,
    version: null,
    fileName: null,
    fileSize: null,
    pageCount: null,
    generatedAt: null,
    publishedAt: null,
  };
}
