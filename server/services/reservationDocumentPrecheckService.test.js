import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: logger,
}));

const {
  getDocumentPrecheckApiKey,
  getDocumentPrecheckModel,
  getDocumentPrecheckStartupStatus,
  getDocumentPrecheckTimeoutMs,
  logDocumentPrecheckStartupStatus,
  runReservationDocumentPrecheck,
} = await import("./reservationDocumentPrecheckService.js");

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

const createImageResponse = (bytes = [1, 2, 3]) => ({
  ok: true,
  headers: {
    get: (name) => (String(name).toLowerCase() === "content-type" ? "image/jpeg" : null),
  },
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});

describe("reservationDocumentPrecheckService", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.RESERVATION_DOCUMENT_PRECHECK_MODEL;
    delete process.env.RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  test("prefers GEMINI_API_KEY and reports startup status without exposing the key", () => {
    process.env.GOOGLE_AI_API_KEY = "fallback-google-key";
    process.env.GEMINI_API_KEY = "preferred-gemini-key";
    process.env.RESERVATION_DOCUMENT_PRECHECK_MODEL = "gemini-2.5-flash";
    process.env.RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS = "18000";

    expect(getDocumentPrecheckApiKey()).toBe("preferred-gemini-key");
    expect(getDocumentPrecheckModel()).toBe("gemini-2.5-flash");
    expect(getDocumentPrecheckTimeoutMs()).toBe(18000);
    expect(getDocumentPrecheckStartupStatus()).toEqual({
      enabled: true,
      model: "gemini-2.5-flash",
      timeoutMs: 18000,
    });

    logDocumentPrecheckStartupStatus();

    expect(logger.info).toHaveBeenCalledWith(
      {
        model: "gemini-2.5-flash",
        timeoutMs: 18000,
      },
      "Document pre-check: enabled",
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("preferred-gemini-key");
  });

  test("logs manual review fallback when no Gemini key is configured", async () => {
    global.fetch = jest.fn();
    logDocumentPrecheckStartupStatus();

    expect(logger.info).toHaveBeenCalledWith("Document pre-check: manual review fallback");

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: "https://example.com/id-front.jpg",
      idType: "Passport",
    });

    expect(result).toMatchObject({
      aiCheckStatus: "error",
      aiCheckWarnings: [],
      provider: "unconfigured",
      requiresAdminAttention: true,
      summaryMessage:
        "Automatic document pre-check is unavailable right now. Admin will review this file manually.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("runs the Gemini pre-check when a backend key is present", async () => {
    process.env.GEMINI_API_KEY = "server-only-gemini-key";
    process.env.RESERVATION_DOCUMENT_PRECHECK_MODEL = "gemini-1.5-flash";

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createImageResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      status: "warning",
                      warnings: [
                        "This image may be blurry. Please upload a clearer copy.",
                        "The document appears cropped. Please make sure the full document is visible.",
                      ],
                      summary:
                        "The document looks partially readable, but the image may be blurry and cropped.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: "https://example.com/id-front.jpg",
      idType: "Driver's License",
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://example.com/id-front.jpg",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=server-only-gemini-key",
      ),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toMatchObject({
      aiCheckStatus: "warning",
      provider: "gemini",
      requiresAdminAttention: true,
      summaryMessage:
        "The document looks partially readable, but the image may be blurry and cropped.",
    });
    expect(result.aiCheckWarnings).toEqual([
      "This image may be blurry. Please upload a clearer copy.",
      "The document appears cropped. Please make sure the full document is visible.",
    ]);
  });

  test("falls back to manual review without leaking Gemini errors", async () => {
    process.env.GEMINI_API_KEY = "server-only-gemini-key";

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createImageResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Gemini upstream timeout with internal details",
      });

    const result = await runReservationDocumentPrecheck({
      documentType: "valid_id_front",
      documentUrl: "https://example.com/id-front.jpg",
      idType: "Passport",
    });

    expect(result).toMatchObject({
      aiCheckStatus: "error",
      provider: "error",
      requiresAdminAttention: true,
      summaryMessage:
        "Automatic document pre-check is temporarily unavailable. Admin will review this file manually.",
    });
    expect(result.aiCheckWarnings).toEqual([
      "Automatic document pre-check could not be completed. Admin will review this file manually.",
    ]);
    expect(result.summaryMessage).not.toContain("503");
    expect(result.summaryMessage).not.toContain("Gemini upstream timeout");
    expect(logger.warn).toHaveBeenCalled();
  });

  test("treats timeout failures as manual-review fallback without blocking uploads", async () => {
    process.env.GEMINI_API_KEY = "server-only-gemini-key";
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createImageResponse())
      .mockRejectedValueOnce(abortError);

    const result = await runReservationDocumentPrecheck({
      documentType: "nbi_clearance",
      documentUrl: "https://example.com/nbi.jpg",
    });

    expect(result).toMatchObject({
      aiCheckStatus: "error",
      provider: "error",
      requiresAdminAttention: true,
      summaryMessage:
        "Automatic document pre-check timed out. Admin will review this file manually.",
    });
    expect(result.aiCheckWarnings).toEqual([
      "Automatic document pre-check timed out. Admin will review this file manually.",
    ]);
  });
});
