import { inspectPreparedContractDocument } from "./contractDocumentStorageService.js";

export const PREPARED_DOCUMENT_VISIBLE_STATUSES = Object.freeze([
  "generated",
  "awaiting_signatures",
  "partially_signed",
  "signed",
  "awaiting_notarization",
  "notarized",
  "ready_for_publication",
  "published",
  "active",
  "expiring_soon",
  "expired",
]);

const unavailableError = () => Object.assign(
  new Error("The prepared Contract has not been generated yet."),
  { statusCode: 404, code: "PREPARED_DOCUMENT_UNAVAILABLE" },
);

export const selectCurrentPreparedDocument = (contract) => {
  if (!contract || !PREPARED_DOCUMENT_VISIBLE_STATUSES.includes(contract.status)) return null;
  return [...(contract.preparedDocuments || [])]
    .filter((entry) =>
      entry?.superseded !== true
      && Number.isInteger(Number(entry?.version))
      && Number(entry.version) > 0
      && Boolean(entry?.storageKey)
      && Boolean(entry?.fileName))
    .sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
};

export const resolveCurrentPreparedDocument = async (contract) => {
  const document = selectCurrentPreparedDocument(contract);
  if (!document) throw unavailableError();

  try {
    const stored = await inspectPreparedContractDocument(document);
    return {
      document,
      ...stored,
      stat: { size: stored.size, isFile: () => true },
    };
  } catch (inspectError) {
    if (inspectError.code === "PREPARED_DOCUMENT_STORAGE_MISSING" && (contract?._id || contract?.id)) {
      try {
        const { buildContractGenerationData } = await import("./contractGenerationDataService.js");
        const { renderPreparedContractPdf } = await import("./contractPdfService.js");
        const { storePreparedContractDocument: storePrepared } = await import("./contractDocumentStorageService.js");
        const { buildPreparedContractStorage } = await import("./contractPrivateStorageService.js");

        const generationData = await buildContractGenerationData(contract);
        const rendered = await renderPreparedContractPdf(generationData);
        const target = buildPreparedContractStorage({
          contractId: String(contract._id || contract.id),
          branch: contract.branch,
          year: contract.contractYear,
          contractNumber: contract.contractNumber,
          tenantLegalName: contract.tenantLegalName,
          roomType: contract.roomType,
          leaseType: contract.leaseType,
          contractDate: (generationData.lease?.executionDate || new Date()).toISOString().slice(0, 10),
          version: Number(document.version) || 1,
        });

        const storedResult = await storePrepared({
          target,
          bytes: rendered.bytes,
          metadata: {
            contractId: contract._id || contract.id,
            contractNumber: contract.contractNumber,
            documentType: "prepared",
            version: document.version,
            fileHash: document.fileHash,
          },
        });

        const stored = await inspectPreparedContractDocument({
          storageProvider: storedResult.provider,
          storageKey: storedResult.storageKey,
        });

        return {
          document,
          ...stored,
          stat: { size: stored.size, isFile: () => true },
        };
      } catch (_) {
        // If on-demand regeneration is not possible, re-throw the original storage missing error
        throw inspectError;
      }
    }
    throw inspectError;
  }
};
