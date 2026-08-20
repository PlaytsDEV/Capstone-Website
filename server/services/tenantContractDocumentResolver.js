import { selectCurrentPreparedDocument } from "./preparedContractDocumentService.js";

/**
 * ============================================================================
 * CANONICAL TENANT CONTRACT DOCUMENT RESOLVER
 * ============================================================================
 *
 * Implements the authoritative document visibility rule:
 *
 * 1. Final Contract (`finalDocument`)
 *    - Highest priority, always the single source of truth once set.
 *    - Two ways to get here, both fully tenant-visible immediately, with no
 *      further notarization/verification/publication step required:
 *        a. `sourceType: "admin_scan"` — an authorized admin uploaded a
 *           wet-signed scan (PDF/JPG/JPEG/PNG); that upload IS the
 *           finalization event (see contractSigningService.js
 *           uploadSignedContract's "CORE BUSINESS RULE" comment).
 *        b. `sourceType: "notarized"` — the optional, internal
 *           upload -> verify -> notarize -> publish pipeline was used
 *           instead. Functionally equivalent for tenant visibility; kept
 *           distinct only for admin-facing labeling/audit history.
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
 * `signedDocuments[]` (wet-signed scan upload/version history) is
 * intentionally NOT a resolver tier: it's audit/version history, not a
 * tenant-visibility source, once its current entry has been promoted into
 * `finalDocument`.
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

  // 1. Final Contract takes top priority — admin_scan (wet-signed upload,
  // final on upload) or notarized (optional formal pipeline), both final.
  if (
    contract.finalDocument &&
    Boolean(contract.finalDocument.fileName) &&
    Boolean(contract.finalDocument.storageKey || contract.finalStorageKey)
  ) {
    const finalDoc = contract.finalDocument;
    return {
      available: true,
      type: "final_notarized",
      label: finalDoc.sourceType === "notarized" ? "Final Notarized Contract" : "Final Contract",
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
