import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const createWorker = jest.fn();

await jest.unstable_mockModule("tesseract.js", () => ({
  default: {
    createWorker,
  },
}));

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: logger,
}));

const {
  getDocumentPrecheckStartupStatus,
  getDocumentPrecheckTimeoutMs,
  isAllowedReservationDocumentUrl,
  logDocumentPrecheckStartupStatus,
  runReservationDocumentPrecheck,
} = await import("./reservationDocumentPrecheckService.js");

const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const allowedDocumentUrl = (name) =>
  `https://firebasestorage.googleapis.com/v0/b/dormitorymanagement-caps-572cf.firebasestorage.app/o/applicant-documents%2F${name}`;

const createImageResponse = (bytes = [1, 2, 3], mimeType = "image/jpeg", extraHeaders = {}) => ({
  ok: true,
  headers: {
    get: (name) => {
      const key = String(name).toLowerCase();
      if (key === "content-type") return mimeType;
      return extraHeaders[key] ?? null;
    },
  },
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});

const mockOcr = ({ text, confidence = 85 }) => {
  const terminate = jest.fn().mockResolvedValue(undefined);
  createWorker.mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: { text, confidence },
    }),
    terminate,
  });
  return { terminate };
};

describe("reservationDocumentPrecheckService", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.RESERVATION_DOCUMENT_UPLOAD_URL_ENDPOINT;

    delete process.env.RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS;
    global.fetch = jest.fn().mockResolvedValue(createImageResponse());
    createWorker.mockReset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  test("reports OCR startup status without requiring Google credentials", () => {
    process.env.GEMINI_API_KEY = "should-not-be-used";
    process.env.RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS = "18000";

    expect(getDocumentPrecheckTimeoutMs()).toBe(18000);
    expect(getDocumentPrecheckStartupStatus()).toEqual({
      enabled: true,
      timeoutMs: 18000,
    });

    logDocumentPrecheckStartupStatus();

    expect(logger.info).toHaveBeenCalledWith(
      { timeoutMs: 18000 },
      "Document OCR pre-check: enabled",
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("should-not-be-used");
  });

  test("marks a readable valid ID as ready for submission", async () => {
    const documentUrl = allowedDocumentUrl("id-front.jpg");
    mockOcr({
      text: "REPUBLIC OF THE PHILIPPINES NATIONAL IDENTIFICATION CARD NAME JUAN DELA CRUZ",
      confidence: 91,
    });

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl,
      idType: "national_id",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      documentUrl,
      expect.objectContaining({ method: "GET" }),
    );
    expect(createWorker).toHaveBeenCalledWith("eng");
    expect(result).toMatchObject({
      precheckProvider: "ocr",
      precheckStatus: "ready_for_submission",
      readabilityStatus: "readable",
      documentTypeStatus: "possible_match",
      canSubmit: true,
      requiresManualReview: true,
      aiCheckStatus: "passed",
    });
    expect(result.applicantMessage).toContain("Readable text was detected");
  });

  test("marks low-confidence OCR as needing clearer upload", async () => {
    mockOcr({
      text: "REPUBLIC PHILIPPINES NAME JUAN DELA CRUZ",
      confidence: 12,
    });

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: allowedDocumentUrl("blurry-id.jpg"),
      idType: "national_id",
    });

    expect(result).toMatchObject({
      precheckStatus: "needs_reupload",
      readabilityStatus: "low_readability",
      canSubmit: false,
    });
    expect(result.applicantMessage).toContain("unclear or unreadable");
  });

  test("marks blank or unreadable images as needing re-upload", async () => {
    mockOcr({ text: "   ", confidence: 0 });

    const result = await runReservationDocumentPrecheck({
      documentType: "nbi_clearance",
      documentUrl: allowedDocumentUrl("blank.jpg"),
    });

    expect(result).toMatchObject({
      precheckStatus: "needs_reupload",
      readabilityStatus: "unreadable",
      canSubmit: false,
    });
    expect(result.flags).toContain("no_readable_text");
  });

  test("flags a clear possible document type mismatch", async () => {
    mockOcr({
      text: "UNIVERSITY STUDENT SCHOOL COLLEGE ID CARD NAME JUAN DELA CRUZ",
      confidence: 88,
    });

    const result = await runReservationDocumentPrecheck({
      documentType: "nbi_clearance",
      documentUrl: allowedDocumentUrl("student-id.jpg"),
    });

    expect(result).toMatchObject({
      precheckStatus: "needs_reupload",
      readabilityStatus: "readable",
      documentTypeStatus: "possible_mismatch",
      canSubmit: false,
    });
    expect(result.applicantMessage).toContain("may not match the required document type");
  });

  test("uses manual review fallback when OCR is unavailable", async () => {
    createWorker.mockRejectedValue(new Error("worker unavailable with internal details"));

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: allowedDocumentUrl("id-front.jpg"),
      idType: "passport",
    });

    expect(result).toMatchObject({
      precheckStatus: "manual_review_fallback",
      readabilityStatus: "ocr_unavailable",
      documentTypeStatus: "unknown",
      canSubmit: true,
      aiCheckStatus: "error",
    });
    expect(result.applicantMessage).not.toContain("worker unavailable");
    expect(logger.warn).toHaveBeenCalled();
  });

  test("allows manual review fallback for unsupported file types", async () => {
    const response = createImageResponse([1, 2, 3], "application/pdf");
    response.arrayBuffer = jest.fn();
    global.fetch = jest.fn().mockResolvedValue(response);

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: allowedDocumentUrl("id-front.pdf"),
      idType: "passport",
    });

    expect(result).toMatchObject({
      precheckStatus: "manual_review_fallback",
      readabilityStatus: "ocr_unavailable",
      canSubmit: true,
    });
    expect(createWorker).not.toHaveBeenCalled();
    expect(response.arrayBuffer).not.toHaveBeenCalled();
  });

  test("uses manual review fallback for oversized images without buffering the body", async () => {
    const response = createImageResponse([1, 2, 3], "image/jpeg", {
      "content-length": String(6 * 1024 * 1024),
    });
    response.arrayBuffer = jest.fn();
    global.fetch = jest.fn().mockResolvedValue(response);

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: allowedDocumentUrl("large-id.jpg"),
      idType: "passport",
    });

    expect(result).toMatchObject({
      precheckStatus: "manual_review_fallback",
      readabilityStatus: "ocr_unavailable",
      canSubmit: true,
      flags: ["file_too_large_for_ocr"],
    });
    expect(createWorker).not.toHaveBeenCalled();
    expect(response.arrayBuffer).not.toHaveBeenCalled();
  });

  test("rejects non-portal document URLs before fetching", async () => {
    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: "https://example.com/id-front.jpg",
      idType: "passport",
    });

    expect(isAllowedReservationDocumentUrl("https://example.com/id-front.jpg")).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createWorker).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      precheckStatus: "needs_reupload",
      canSubmit: false,
      flags: ["invalid_document_url"],
    });
  });
});
