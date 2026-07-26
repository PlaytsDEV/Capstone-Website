import fsPromises from "fs/promises";
import { resolvePrivateContractStorageKey } from "./contractPrivateStorageService.js";

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
  new Error("The prepared document is temporarily unavailable."),
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

  let absolutePath;
  try {
    absolutePath = resolvePrivateContractStorageKey(document.storageKey);
  } catch {
    throw unavailableError();
  }
  const stat = await fsPromises.stat(absolutePath).catch(() => null);
  if (!stat?.isFile()) throw unavailableError();
  return { document, absolutePath, stat };
};
