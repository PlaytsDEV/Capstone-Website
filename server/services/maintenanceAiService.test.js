import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const {
  generateMaintenanceUpdateDraft,
  generateMaintenanceReportText,
} = await import("./maintenanceAiService.js");

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

const request = {
  typeLabel: "Electrical",
  description: "Outlet stopped working near the desk.",
  status: "in_progress",
  urgency: "medium",
  assignedProviderName: "Lilycrest Electrical",
};

describe("maintenanceAiService", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_MODEL;
    global.fetch = jest.fn();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("returns a friendly unavailable draft when Gemini is not configured", async () => {
    const result = await generateMaintenanceUpdateDraft({ request, timeline: [] });

    expect(result).toMatchObject({
      draft: "AI drafting is currently unavailable. Please write the update manually.",
      provider: "unavailable",
      unavailable: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("uses GEMINI_API_KEY and GEMINI_MODEL from process.env", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GOOGLE_AI_API_KEY = "test-google-key";
    process.env.GEMINI_MODEL = "gemini-custom-model";
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "The maintenance request is in progress." }],
            },
          },
        ],
      }),
    }));

    const result = await generateMaintenanceUpdateDraft({ request, timeline: [] });
    const [endpoint] = global.fetch.mock.calls[0];

    expect(endpoint).toContain("gemini-custom-model:generateContent");
    expect(endpoint).toContain("key=test-gemini-key");
    expect(endpoint).not.toContain("test-google-key");
    expect(result).toMatchObject({
      draft: "The maintenance request is in progress.",
      provider: "gemini",
      unavailable: false,
    });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("falls back to GOOGLE_AI_API_KEY and the safe default Gemini model", async () => {
    process.env.GOOGLE_AI_API_KEY = "test-google-key";
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "A provider is reviewing the request." }],
            },
          },
        ],
      }),
    }));

    const result = await generateMaintenanceUpdateDraft({ request, timeline: [] });
    const [endpoint] = global.fetch.mock.calls[0];

    expect(endpoint).toContain("gemini-2.5-flash-lite:generateContent");
    expect(endpoint).toContain("key=test-google-key");
    expect(result).toMatchObject({
      draft: "A provider is reviewing the request.",
      provider: "gemini",
      unavailable: false,
    });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("generates a rule-based report when Gemini is not configured", async () => {
    const result = await generateMaintenanceReportText({
      reportType: "admin",
      title: "Maintenance Admin Report - maint_test",
      standardSummary: "# Maintenance Admin Report - maint_test\n\nRecorded report.",
      context: {},
    });

    expect(result).toMatchObject({
      summary: "# Maintenance Admin Report - maint_test\n\nRecorded report.",
      provider: "rule-based",
      unavailable: true,
      message: "AI summary is unavailable, so a standard report was generated from the recorded timeline.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("filters sensitive tenant summary details from generated report output", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Provider contact 09171234567 and internal note should not be visible. Email admin@example.com.",
                },
              ],
            },
          },
        ],
      }),
    }));

    const result = await generateMaintenanceReportText({
      reportType: "tenant",
      title: "Maintenance Tenant Summary - maint_test",
      standardSummary: "Tenant-safe standard report.",
      context: {
        providerContact: "09171234567",
        providerNotes: "internal note should not be visible",
        internalNotes: ["private admin note"],
      },
    });

    expect(result.provider).toBe("gemini");
    expect(result.summary).not.toContain("09171234567");
    expect(result.summary).not.toContain("admin@example.com");
    expect(result.summary).not.toContain("internal note should not be visible");
    expect(result.summary).toContain("[contact hidden]");
  });
});
