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

export const toTenantContractView = (source, now = new Date()) => {
  if (!source) return null;
  const contract = source.toObject ? source.toObject() : source;
  const currentDocument = [...(contract.preparedDocuments || [])]
    .filter((item) => item.superseded !== true)
    .sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
  const finalPublished = ["published", "active", "expiring_soon", "expired"]
    .includes(contract.status)
    && Boolean(contract.notarizationVerifiedAt)
    && contract.tenantVisible === true
    && Boolean(contract.finalDocument);
  const displayLifecycle = resolveContractDisplayLifecycle(contract, now);

  return {
    id: String(contract._id || contract.id),
    contractNumber: contract.contractNumber || "",
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
    bedLabel: contract.bedLabel || "",
    leaseStartDate: contract.leaseStartDate || null,
    leaseEndDate: contract.leaseEndDate || null,
    leaseDurationMonths: contract.leaseDurationMonths ?? null,
    daysRemaining: calculateContractDaysRemaining(contract.leaseEndDate, now),
    approvedMonthlyRate: contract.approvedMonthlyRate ?? null,
    advanceRentAmount: contract.advanceRentAmount ?? null,
    securityDepositAmount: contract.securityDepositAmount ?? null,
    reservationFeeAmount: contract.reservationFeeAmount ?? null,
    preparedDocument: {
      available: Boolean(currentDocument),
      currentVersion: currentDocument?.version || null,
      generatedAt: currentDocument?.generatedAt || null,
      fileName: currentDocument?.fileName || null,
      fileSize: currentDocument?.fileSize ?? null,
      pageCount: currentDocument?.pageCount ?? null,
      viewUrl: currentDocument ? `/api/m/contracts/${contract._id || contract.id}/documents/prepared` : null,
      downloadUrl: currentDocument ? `/api/m/contracts/${contract._id || contract.id}/documents/prepared?download=1` : null,
    },
    finalDocument: {
      available: finalPublished,
      publishedAt: finalPublished ? contract.finalDocument.publishedAt || contract.publishedAt || null : null,
      fileName: finalPublished ? contract.finalDocument.fileName : null,
      fileSize: finalPublished ? contract.finalDocument.fileSize ?? null : null,
      pageCount: finalPublished ? contract.finalDocument.pageCount ?? null : null,
      viewUrl: finalPublished ? `/api/m/contracts/${contract._id || contract.id}/documents/final` : null,
      downloadUrl: finalPublished ? `/api/m/contracts/${contract._id || contract.id}/documents/final?download=1` : null,
    },
  };
};
import { resolveContractDisplayLifecycle } from "./contractPublicationService.js";
