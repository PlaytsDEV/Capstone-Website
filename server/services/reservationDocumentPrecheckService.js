import Tesseract from "tesseract.js";

import logger from "../middleware/logger.js";

const { createWorker } = Tesseract;

const DEFAULT_PRECHECK_TIMEOUT_MS = 15000;
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_DOCUMENT_UPLOAD_URL_ENDPOINT = "https://firebasestorage.googleapis.com";

const DOCUMENT_LABELS = Object.freeze({
  selfie_photo: "selfie photo",
  valid_id_front: "valid ID (front)",
  valid_id_back: "valid ID (back)",
  nbi_clearance: "NBI clearance",
  company_id: "company or school ID",
});

const ID_TYPE_KEYWORDS = Object.freeze({
  national_id: ["PHILIPPINE", "IDENTIFICATION", "NATIONAL", "PSN"],
  drivers_license: ["DRIVER", "LICENSE", "LTO"],
  passport: ["PASSPORT", "REPUBLIC", "PHILIPPINES"],
  sss_id: ["SSS", "SOCIAL", "SECURITY"],
  umid: ["UMID"],
  school_id: ["SCHOOL", "UNIVERSITY", "COLLEGE", "STUDENT"],
  other: [],
});

const GENERAL_ID_KEYWORDS = Object.freeze([
  "REPUBLIC",
  "PHILIPPINES",
  "IDENTIFICATION",
  "ID",
  "CARD",
  "PASSPORT",
  "LICENSE",
  "DRIVER",
  "NATIONAL",
  "BIRTH",
  "ADDRESS",
  "NAME",
]);

const NBI_KEYWORDS = Object.freeze([
  "NBI",
  "CLEARANCE",
  "BUREAU",
  "INVESTIGATION",
  "CRIMINAL",
  "REPUBLIC",
  "PHILIPPINES",
]);

const COMPANY_OR_SCHOOL_KEYWORDS = Object.freeze([
  "COMPANY",
  "EMPLOYEE",
  "EMPLOYMENT",
  "SCHOOL",
  "UNIVERSITY",
  "COLLEGE",
  "STUDENT",
  "FACULTY",
  "DEPARTMENT",
  "BADGE",
]);

const OCR_SUPPORTED_DOCUMENT_TYPES = new Set([
  "valid_id_front",
  "valid_id_back",
  "nbi_clearance",
  "company_id",
]);

const isObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const getDocumentPrecheckTimeoutMs = () => {
  const parsed = Number(process.env.RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return DEFAULT_PRECHECK_TIMEOUT_MS;
  }
  return Math.floor(parsed);
};

const getDocumentPrecheckStartupStatus = () => ({
  enabled: typeof createWorker === "function",
  timeoutMs: getDocumentPrecheckTimeoutMs(),
});

const parseAllowedUrlBase = (value) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return {
      origin: parsed.origin,
      pathname,
    };
  } catch {
    return null;
  }
};

const getAllowedDocumentUrlBases = () =>
  [
    process.env.RESERVATION_DOCUMENT_UPLOAD_URL_ENDPOINT,
    DEFAULT_DOCUMENT_UPLOAD_URL_ENDPOINT,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map(parseAllowedUrlBase)
    .filter(Boolean);

const isAllowedReservationDocumentUrl = (documentUrl) => {
  try {
    const parsed = new URL(documentUrl);
    if (parsed.protocol !== "https:") return false;
    return getAllowedDocumentUrlBases().some((base) => {
      if (parsed.origin !== base.origin) return false;
      if (base.pathname === "/") return true;
      return (
        parsed.pathname === base.pathname ||
        parsed.pathname.startsWith(`${base.pathname}/`)
      );
    });
  } catch {
    return false;
  }
};

const logDocumentPrecheckStartupStatus = () => {
  const status = getDocumentPrecheckStartupStatus();
  if (status.enabled) {
    logger.info(
      {
        timeoutMs: status.timeoutMs,
      },
      "Document OCR pre-check: enabled",
    );
  } else {
    logger.info("Document OCR pre-check: manual review fallback");
  }
  return status;
};

const normalizeFlags = (flags) =>
  Array.isArray(flags)
    ? [...new Set(flags.map((flag) => String(flag || "").trim()).filter(Boolean))].slice(0, 6)
    : [];

const mapPrecheckStatusToLegacy = ({ precheckStatus, documentTypeStatus }) => {
  if (precheckStatus === "ready_for_submission") return "passed";
  if (
    precheckStatus === "needs_reupload" &&
    documentTypeStatus === "possible_mismatch"
  ) {
    return "warning";
  }
  if (precheckStatus === "needs_reupload") return "failed";
  if (precheckStatus === "manual_review_fallback") return "error";
  return "not_checked";
};

const buildLegacyWarnings = ({
  precheckStatus,
  readabilityStatus,
  documentTypeStatus,
  applicantMessage,
  adminNote,
}) => {
  if (precheckStatus === "ready_for_submission") {
    return ["OCR detected readable text. Manual review is still required."];
  }
  if (documentTypeStatus === "possible_mismatch") {
    return ["OCR flagged a possible document type mismatch. Please inspect manually."];
  }
  if (readabilityStatus === "unreadable") {
    return ["OCR could not detect enough readable text. Please inspect manually."];
  }
  if (readabilityStatus === "low_readability") {
    return ["OCR flagged low readability. Please inspect manually."];
  }
  if (precheckStatus === "manual_review_fallback") {
    return [adminNote || applicantMessage || "OCR could not complete. Manual review required."];
  }
  return [];
};

const buildResult = ({
  precheckProvider = "ocr",
  precheckStatus = "not_checked",
  readabilityStatus = "unknown",
  documentTypeStatus = "unknown",
  canSubmit = precheckStatus !== "needs_reupload",
  applicantMessage = "",
  adminNote = "",
  confidence = null,
  flags = [],
}) => {
  const normalizedFlags = normalizeFlags(flags);
  const normalizedConfidence =
    Number.isFinite(Number(confidence)) ? Math.round(Number(confidence) * 100) / 100 : null;
  const warnings = buildLegacyWarnings({
    precheckStatus,
    readabilityStatus,
    documentTypeStatus,
    applicantMessage,
    adminNote,
  });
  const legacyStatus = mapPrecheckStatusToLegacy({
    precheckStatus,
    documentTypeStatus,
  });

  return {
    precheckProvider,
    precheckStatus,
    readabilityStatus,
    documentTypeStatus,
    canSubmit: Boolean(canSubmit),
    requiresManualReview: true,
    applicantMessage: String(applicantMessage || "").trim(),
    adminNote: String(adminNote || "").trim(),
    confidence: normalizedConfidence,
    flags: normalizedFlags,
    aiCheckStatus: legacyStatus,
    aiCheckWarnings: warnings,
    aiCheckedAt: new Date(),
    requiresAdminAttention: precheckStatus !== "ready_for_submission",
    summaryMessage:
      String(applicantMessage || "").trim() ||
      String(adminNote || "").trim() ||
      warnings[0] ||
      "",
    provider: precheckProvider,
  };
};

const buildManualFallbackResult = ({
  applicantMessage = "Document uploaded successfully. We could not complete the readability check, so this document will be reviewed manually.",
  adminNote = "OCR could not complete. Manual review required.",
  flags = ["ocr_manual_fallback"],
} = {}) =>
  buildResult({
    precheckStatus: "manual_review_fallback",
    readabilityStatus: "ocr_unavailable",
    documentTypeStatus: "unknown",
    canSubmit: true,
    applicantMessage,
    adminNote,
    flags,
  });

const buildNeedsReuploadResult = ({
  readabilityStatus,
  documentTypeStatus = "unknown",
  applicantMessage,
  adminNote,
  confidence = null,
  flags = [],
}) =>
  buildResult({
    precheckStatus: "needs_reupload",
    readabilityStatus,
    documentTypeStatus,
    canSubmit: false,
    applicantMessage,
    adminNote,
    confidence,
    flags,
  });

const buildReadyResult = ({
  documentTypeStatus = "unknown",
  confidence = null,
  flags = [],
}) =>
  buildResult({
    precheckStatus: "ready_for_submission",
    readabilityStatus: "readable",
    documentTypeStatus,
    canSubmit: true,
    applicantMessage:
      "Document uploaded successfully. Readable text was detected. This document is ready for submission and will still be reviewed by admin.",
    adminNote: "OCR detected readable text. Manual review is still required.",
    confidence,
    flags,
  });

const createTimeoutError = () => {
  const error = new Error("OCR pre-check timed out.");
  error.name = "OcrTimeoutError";
  return error;
};

const withTimeout = async (promise, timeoutMs) => {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(createTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = getDocumentPrecheckTimeoutMs()) => {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available for OCR pre-checking.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const downloadDocument = async (documentUrl) => {
  const response = await fetchWithTimeout(
    documentUrl,
    {
      method: "GET",
      headers: {
        Accept: "image/*,application/pdf",
      },
    },
    getDocumentPrecheckTimeoutMs(),
  );

  if (!response.ok) {
    throw new Error(`Document download failed with status ${response.status}.`);
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const unsupported = !mimeType.startsWith("image/");
  if (unsupported) {
    return {
      mimeType,
      buffer: Buffer.alloc(0),
      unsupported: true,
      oversized: false,
    };
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
    return {
      mimeType,
      buffer: Buffer.alloc(0),
      unsupported: false,
      oversized: true,
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    mimeType,
    buffer,
    unsupported: false,
    oversized: buffer.length > MAX_DOWNLOAD_BYTES,
  };
};

const normalizeOcrText = (text) =>
  String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toUpperText = (text) => normalizeOcrText(text).toUpperCase();

const stripNonAlphanumeric = (text) => toUpperText(text).replace(/[^A-Z0-9]/g, "");

const countKeywordMatches = (text, keywords = []) =>
  keywords.reduce(
    (total, keyword) => (text.includes(String(keyword).toUpperCase()) ? total + 1 : total),
    0,
  );

const getExpectedKeywords = (documentType, idType = "") => {
  if (documentType === "valid_id_front" || documentType === "valid_id_back") {
    const typeKeywords =
      ID_TYPE_KEYWORDS[String(idType || "").trim().toLowerCase()] || [];
    return [...GENERAL_ID_KEYWORDS, ...typeKeywords];
  }
  if (documentType === "nbi_clearance") return [...NBI_KEYWORDS];
  if (documentType === "company_id") return [...COMPANY_OR_SCHOOL_KEYWORDS];
  return [];
};

const getConflictingKeywordGroups = (documentType) => {
  if (documentType === "valid_id_front" || documentType === "valid_id_back") {
    return [
      { status: "possible_mismatch", keywords: NBI_KEYWORDS },
    ];
  }
  if (documentType === "nbi_clearance") {
    return [
      { status: "possible_mismatch", keywords: COMPANY_OR_SCHOOL_KEYWORDS },
    ];
  }
  if (documentType === "company_id") {
    return [
      { status: "possible_mismatch", keywords: NBI_KEYWORDS },
    ];
  }
  return [];
};

const evaluateReadability = ({ text, confidence }) => {
  const normalizedText = normalizeOcrText(text);
  const condensed = stripNonAlphanumeric(normalizedText);
  const charCount = condensed.length;
  const numericConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : null;

  if (!charCount) {
    return {
      readabilityStatus: "unreadable",
      flags: ["no_readable_text", "blank_or_unreadable_image"],
      charCount,
    };
  }

  if (charCount < 8) {
    return {
      readabilityStatus: "unreadable",
      flags: ["insufficient_readable_text", "possible_blurry_or_cropped_image"],
      charCount,
    };
  }

  if ((numericConfidence != null && numericConfidence < 25) || charCount < 18) {
    return {
      readabilityStatus: "low_readability",
      flags: ["low_ocr_confidence", "possible_blurry_or_cropped_image"],
      charCount,
    };
  }

  return {
    readabilityStatus: "readable",
    flags: [],
    charCount,
  };
};

const evaluateDocumentType = ({ documentType, text, idType }) => {
  const upperText = toUpperText(text);
  if (!upperText) {
    return { documentTypeStatus: "unknown", flags: [] };
  }

  const expectedKeywords = getExpectedKeywords(documentType, idType);
  const expectedMatchCount = countKeywordMatches(upperText, expectedKeywords);

  const conflictingGroups = getConflictingKeywordGroups(documentType);
  const strongestConflict = conflictingGroups.reduce(
    (best, group) => {
      const matchCount = countKeywordMatches(upperText, group.keywords);
      if (matchCount > best.matchCount) {
        return { matchCount, status: group.status };
      }
      return best;
    },
    { matchCount: 0, status: "unknown" },
  );

  if (expectedMatchCount >= 2) {
    return { documentTypeStatus: "possible_match", flags: [] };
  }

  if (expectedMatchCount === 0 && strongestConflict.matchCount >= 2) {
    return {
      documentTypeStatus: "possible_mismatch",
      flags: ["possible_wrong_document_type"],
    };
  }

  return { documentTypeStatus: "unknown", flags: [] };
};

const runOcr = async (buffer) => {
  let worker = null;
  try {
    worker = await withTimeout(
      createWorker("eng"),
      getDocumentPrecheckTimeoutMs(),
    );
    const result = await withTimeout(
      worker.recognize(buffer),
      getDocumentPrecheckTimeoutMs(),
    );

    return {
      text: result?.data?.text || "",
      confidence: result?.data?.confidence ?? null,
    };
  } finally {
    if (worker && typeof worker.terminate === "function") {
      await worker.terminate().catch(() => {});
    }
  }
};

const buildNeedsReuploadMessage = ({
  readabilityStatus,
  documentTypeStatus,
}) => {
  if (documentTypeStatus === "possible_mismatch") {
    return {
      applicantMessage:
        "Document uploaded successfully, but it may not match the required document type. Please check the file and re-upload the correct document before submitting.",
      adminNote:
        "OCR flagged a possible document type mismatch. Please inspect manually.",
    };
  }

  if (readabilityStatus === "unreadable") {
    return {
      applicantMessage:
        "Document uploaded successfully, but the image appears unclear or unreadable. Please re-upload a clearer copy before submitting your application.",
      adminNote:
        "OCR could not detect enough readable text. Please inspect manually.",
    };
  }

  return {
    applicantMessage:
      "Document uploaded successfully, but the image appears unclear or unreadable. Please re-upload a clearer copy before submitting your application.",
    adminNote: "OCR flagged low readability. Please inspect manually.",
  };
};

export const runReservationDocumentPrecheck = async ({
  documentType,
  documentUrl,
  idType = "",
}) => {
  if (!documentUrl) {
    return buildNeedsReuploadResult({
      readabilityStatus: "unreadable",
      applicantMessage:
        "Document uploaded successfully, but the image appears unclear or unreadable. Please re-upload a clearer copy before submitting your application.",
      adminNote: "No document URL was provided for OCR pre-check.",
      flags: ["missing_document_url"],
    });
  }

  if (!OCR_SUPPORTED_DOCUMENT_TYPES.has(documentType)) {
    return buildManualFallbackResult({
      flags: ["ocr_not_supported_for_document_type"],
    });
  }

  if (!isAllowedReservationDocumentUrl(documentUrl)) {
    return buildNeedsReuploadResult({
      readabilityStatus: "unreadable",
      applicantMessage:
        "Please upload this document through the portal before running the readability check.",
      adminNote:
        "Document URL was not from an allowed upload source. OCR fetch was skipped.",
      flags: ["invalid_document_url"],
    });
  }

  try {
    const downloaded = await downloadDocument(documentUrl);

    if (downloaded.unsupported) {
      return buildManualFallbackResult({
        flags: ["unsupported_file_type_for_ocr"],
      });
    }

    if (downloaded.oversized) {
      return buildManualFallbackResult({
        flags: ["file_too_large_for_ocr"],
      });
    }

    const ocrResult = await runOcr(downloaded.buffer);
    const readability = evaluateReadability(ocrResult);
    const typeCheck = evaluateDocumentType({
      documentType,
      text: ocrResult.text,
      idType,
    });

    if (readability.readabilityStatus !== "readable") {
      const messages = buildNeedsReuploadMessage({
        readabilityStatus: readability.readabilityStatus,
        documentTypeStatus: typeCheck.documentTypeStatus,
      });
      return buildNeedsReuploadResult({
        readabilityStatus: readability.readabilityStatus,
        documentTypeStatus: typeCheck.documentTypeStatus,
        applicantMessage: messages.applicantMessage,
        adminNote: messages.adminNote,
        confidence: ocrResult.confidence,
        flags: [...readability.flags, ...typeCheck.flags],
      });
    }

    if (typeCheck.documentTypeStatus === "possible_mismatch") {
      const messages = buildNeedsReuploadMessage({
        readabilityStatus: readability.readabilityStatus,
        documentTypeStatus: typeCheck.documentTypeStatus,
      });
      return buildNeedsReuploadResult({
        readabilityStatus: "readable",
        documentTypeStatus: "possible_mismatch",
        applicantMessage: messages.applicantMessage,
        adminNote: messages.adminNote,
        confidence: ocrResult.confidence,
        flags: typeCheck.flags,
      });
    }

    return buildReadyResult({
      documentTypeStatus: typeCheck.documentTypeStatus,
      confidence: ocrResult.confidence,
      flags: typeCheck.flags,
    });
  } catch (error) {
    logger.warn(
      {
        err: error,
        documentType,
      },
      "Document OCR pre-check fell back to manual review",
    );

    return buildManualFallbackResult({
      flags:
        error?.name === "OcrTimeoutError" || error?.name === "AbortError"
          ? ["ocr_timeout"]
          : ["ocr_runtime_fallback"],
    });
  }
};

export {
  getDocumentPrecheckStartupStatus,
  getDocumentPrecheckTimeoutMs,
  isAllowedReservationDocumentUrl,
  logDocumentPrecheckStartupStatus,
};
