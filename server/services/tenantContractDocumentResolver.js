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
 * 2. Legacy Current Signed Upload (`signedDocuments[]`)
 *    - Compatibility tier for an authorized wet-signed upload created before
 *      the live upload path began promoting that same artifact into
 *      `finalDocument` atomically.
 *    - Only the newest non-superseded, non-rejected signed version qualifies.
 *    - New uploads do not normally remain in this tier; they populate
 *      `finalDocument` during the same write.
 *
 * 3. Generated Draft (`preparedDocuments[]`)
 *    - Second priority.
 *    - Visible to the tenant immediately after PDF generation (including
 *      auto-generation upon Move-In).
 *    - Labeled "Generated Draft — For Signing".
 *
 * 4. Unavailable / Preparing
 *    - When no valid PDF exists yet.
 *    - Labeled "Contract is being prepared."
 *
 * Superseded and rejected `signedDocuments[]` entries remain audit/version
 * history and are never tenant-visible through this resolver.
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
 *   type: 'final_notarized' | 'final_signed' | 'generated_draft' | null,
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

  // 2. Compatibility for a valid, current wet-signed upload whose historical
  // write predates atomic finalDocument promotion. This is intentionally
  // strict: rejected/superseded versions never qualify, and deterministic
  // version/upload ordering ensures a replacement wins over its predecessor.
  const signed = [...(contract.signedDocuments || [])]
    .filter((document) => (
      document &&
      document.superseded !== true &&
      !document.rejectedAt &&
      Boolean(document.storageKey) &&
      Boolean(document.fileName)
    ))
    .sort((left, right) => (
      (Number(right.version) || 0) - (Number(left.version) || 0) ||
      new Date(right.uploadedAt || 0).getTime() - new Date(left.uploadedAt || 0).getTime()
    ))[0] || null;
  if (signed) {
    return {
      available: true,
      type: "final_signed",
      label: "Final Contract",
      isFinal: true,
      document: signed,
      version: Number(signed.version) || Number(contract.signedDocumentVersion) || 1,
      fileName: signed.fileName,
      fileSize: signed.fileSize ?? null,
      pageCount: null,
      generatedAt: signed.uploadedAt || null,
      publishedAt: signed.uploadedAt || null,
    };
  }

  // 3. Latest valid prepared draft (generated for signing)
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

  // 4. Fallback: document is being prepared
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
