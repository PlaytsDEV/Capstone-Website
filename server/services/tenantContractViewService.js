import { resolveContractDisplayLifecycle } from "./contractPublicationService.js";
import { selectCurrentPreparedDocument } from "./preparedContractDocumentService.js";
import { resolveTenantContractDocument } from "./tenantContractDocumentResolver.js";

const STATUS_LABELS = Object.freeze({
  draft: "Contract is being prepared.",
  incomplete: "Contract is being prepared.",
  ready_for_generation: "Contract is being prepared.",
  generated: "Prepared Contract Available",
  awaiting_signatures: "Physical signing and in-person notarization are in progress.",
  partially_signed: "Physical signing and in-person notarization are in progress.",
  signed: "Physical signing and in-person notarization are in progress.",
  awaiting_notarization: "Physical signing and in-person notarization are in progress.",
  notarized: "Notarization completed. Final Contract is being reviewed.",
  ready_for_publication: "Notarization completed. Final Contract is being reviewed.",
  published: "Final Signed and Notarized Contract Available",
  active: "Final Signed and Notarized Contract Available",
  expiring_soon: "Final Signed and Notarized Contract Available",
  expired: "Final Signed and Notarized Contract Available",
  terminated: "Contract Terminated",
  cancelled: "Contract Cancelled",
});

export const getTenantContractDisplayStatus = (status) =>
  STATUS_LABELS[status] || "Contract Status Unavailable";

export const calculateContractDaysRemaining = (leaseEndDate, now = new Date()) => {
  if (!leaseEndDate) return null;
  const end = new Date(leaseEndDate);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
};

export const toTenantContractView = (source, now = new Date(), options = {}) => {
  if (!source) return null;
  const contract = source.toObject ? source.toObject() : source;
  const documentBasePath = options.documentBasePath || "/api/contracts/my";
  const currentDocument = Object.prototype.hasOwnProperty.call(options, "preparedDocument")
    ? options.preparedDocument
    : selectCurrentPreparedDocument(contract);
  const finalPublished = ["published", "active", "expiring_soon", "expired"]
    .includes(contract.status)
    && Boolean(contract.notarizationVerifiedAt)
    && contract.tenantVisible === true
    && Boolean(contract.finalDocument);
  const displayLifecycle = resolveContractDisplayLifecycle(contract, now);
  const resolvedTenantDoc = resolveTenantContractDocument(contract);

  const id = String(contract._id || contract.id);
  const preparedDocument = {
    available: Boolean(currentDocument),
    issue: currentDocument ? null : options.preparedDocumentIssue || "PREPARED_DOCUMENT_UNAVAILABLE",
    currentVersion: currentDocument?.version || null,
    generatedAt: currentDocument?.generatedAt || null,
    fileName: currentDocument?.fileName || null,
    fileSize: currentDocument?.fileSize ?? null,
    pageCount: currentDocument?.pageCount ?? null,
    viewUrl: currentDocument ? `${documentBasePath}/${id}/documents/prepared` : null,
    downloadUrl: currentDocument ? `${documentBasePath}/${id}/documents/prepared?download=1` : null,
  };

  const normType = String(contract.roomType || "").toLowerCase();
  const isPrivate = normType.includes("private");
  const isLongTerm =
    contract.leaseType === "long_term" ||
    contract.leaseType === "long" ||
    Number(contract.leaseDurationMonths || 12) >= 6;

  let approvedMonthlyRate = contract.approvedMonthlyRate ?? null;
  let regularMonthlyRate = contract.regularMonthlyRate ?? null;
  let discountPercentage = contract.discountPercentage ?? null;
  let discountAmount = contract.discountAmount ?? null;

  if (isPrivate) {
    if (regularMonthlyRate !== null && (regularMonthlyRate < 10000 || (approvedMonthlyRate !== null && regularMonthlyRate < approvedMonthlyRate))) {
      regularMonthlyRate = isLongTerm ? 15000 : 16000;
      discountPercentage = isLongTerm ? 10 : 0;
    }
    if (approvedMonthlyRate !== null && approvedMonthlyRate < 10000) {
      approvedMonthlyRate = isLongTerm ? 13500 : 16000;
    }
    if (regularMonthlyRate && approvedMonthlyRate) {
      discountAmount = Math.max(0, regularMonthlyRate - approvedMonthlyRate);
    }
  } else if (regularMonthlyRate !== null && approvedMonthlyRate !== null && regularMonthlyRate < approvedMonthlyRate) {
    if (discountPercentage > 0 && discountPercentage < 100) {
      regularMonthlyRate = Math.round(approvedMonthlyRate / (1 - discountPercentage / 100));
    } else {
      regularMonthlyRate = approvedMonthlyRate;
    }
  }

  let advanceRentAmount = contract.advanceRentAmount ?? null;
  let securityDepositAmount = contract.securityDepositAmount ?? null;

  if (isPrivate) {
    if (advanceRentAmount !== null && (advanceRentAmount < 10000 || (approvedMonthlyRate !== null && advanceRentAmount < approvedMonthlyRate))) {
      advanceRentAmount = approvedMonthlyRate || (isLongTerm ? 13500 : 16000);
    }
    if (securityDepositAmount !== null && (securityDepositAmount < 10000 || (approvedMonthlyRate !== null && securityDepositAmount < approvedMonthlyRate))) {
      securityDepositAmount = approvedMonthlyRate || (isLongTerm ? 13500 : 16000);
    }
  } else {
    if (advanceRentAmount !== null && approvedMonthlyRate !== null && advanceRentAmount < approvedMonthlyRate) {
      advanceRentAmount = approvedMonthlyRate;
    }
    if (securityDepositAmount !== null && approvedMonthlyRate !== null && securityDepositAmount < approvedMonthlyRate) {
      securityDepositAmount = approvedMonthlyRate;
    }
  }

  return {
    id,
    contractId: id,
    contractNumber: contract.contractNumber || "",
    isCanonical: true,
    publicationStatus: contract.publicationStatus ||
      (contract.tenantVisible ? "published" : "ready_for_resident"),
    status: contract.status,
    displayStatus: getTenantContractDisplayStatus(contract.status),
    displayLifecycle,
    templateType: contract.templateType || "",
    roomType: contract.roomType || "",
    leaseType: contract.leaseType || "",
    version: contract.version || 1,
    branch: contract.branch || "",
    propertyName: contract.propertyName || "",
    roomNumber: contract.roomNumber || "",
    bedLabel: isPrivate ? "" : (contract.bedLabel || ""),
    leaseStartDate: contract.leaseStartDate || null,
    leaseEndDate: contract.leaseEndDate || null,
    leaseDurationMonths: contract.leaseDurationMonths ?? null,
    daysRemaining: calculateContractDaysRemaining(contract.leaseEndDate, now),
    approvedMonthlyRate,
    regularMonthlyRate,
    discountPercentage,
    discountAmount,
    discountType: contract.discountType || (discountPercentage > 0 ? "percentage" : "none"),
    advanceRentAmount,
    securityDepositAmount,
    reservationFeeAmount: contract.reservationFeeAmount ?? null,
    preparedDocument,
    preparedDocumentAvailable: preparedDocument.available,
    preparedDocumentVersion: preparedDocument.currentVersion,
    preparedDocumentFileName: preparedDocument.fileName,
    preparedDocumentFileSize: preparedDocument.fileSize,
    preparedDocumentPageCount: preparedDocument.pageCount,
    tenantDocument: {
      available: resolvedTenantDoc.available,
      type: resolvedTenantDoc.type,
      label: resolvedTenantDoc.label,
      isFinal: resolvedTenantDoc.isFinal,
      version: resolvedTenantDoc.version,
      fileName: resolvedTenantDoc.fileName,
      fileSize: resolvedTenantDoc.fileSize,
      pageCount: resolvedTenantDoc.pageCount,
      generatedAt: resolvedTenantDoc.generatedAt,
      publishedAt: resolvedTenantDoc.publishedAt,
      viewUrl: resolvedTenantDoc.available
        ? (resolvedTenantDoc.type === "final_notarized"
            ? `${documentBasePath}/${id}/documents/final`
            : `${documentBasePath}/${id}/documents/prepared`)
        : null,
      downloadUrl: resolvedTenantDoc.available
        ? (resolvedTenantDoc.type === "final_notarized"
            ? `${documentBasePath}/${id}/documents/final?download=1`
            : `${documentBasePath}/${id}/documents/prepared?download=1`)
        : null,
    },
    finalDocument: {
      available: finalPublished,
      publishedAt: finalPublished ? contract.finalDocument.publishedAt || contract.publishedAt || null : null,
      fileName: finalPublished ? contract.finalDocument.fileName : null,
      fileSize: finalPublished ? contract.finalDocument.fileSize ?? null : null,
      pageCount: finalPublished ? contract.finalDocument.pageCount ?? null : null,
      viewUrl: finalPublished ? `${documentBasePath}/${id}/documents/final` : null,
      downloadUrl: finalPublished ? `${documentBasePath}/${id}/documents/final?download=1` : null,
    },
    signedDocuments: (contract.signedDocuments || [])
      .filter((doc) => !doc.superseded)
      .sort((a, b) => (b.version || 0) - (a.version || 0))
      .map((doc) => ({
        version: doc.version,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        replacementReason: doc.replacementReason || "",
        viewUrl: `${documentBasePath}/${id}/documents/signed/${doc.version}`,
        downloadUrl: `${documentBasePath}/${id}/documents/signed/${doc.version}?download=1`,
      })),
  };
};
