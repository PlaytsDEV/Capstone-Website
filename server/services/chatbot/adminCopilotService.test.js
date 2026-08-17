import { jest } from "@jest/globals";

jest.unstable_mockModule("./aiProviderService.js", () => ({
  generateChatCompletion: jest.fn()
}));

const { generateChatCompletion } = await import("./aiProviderService.js");
const { queryAdminSopService } = await import("./adminCopilotService.js");

describe("adminCopilotService", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should process a valid query and return guidance with citations", async () => {
    generateChatCompletion.mockResolvedValue(
      "According to §7.2, lost key replacement is ₱250."
    );

    const result = await queryAdminSopService({
      query: "What is the fee for a lost key?",
      branch: "Gil Puyat",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("guidance");
    expect(result.data).toHaveProperty("citations");
    expect(Array.isArray(result.data.citations)).toBe(true);
    expect(result.data.guidance).toContain("₱250");
  });

  it("should handle AI provider errors gracefully", async () => {
    generateChatCompletion.mockRejectedValue(new Error("AI Error"));

    const result = await queryAdminSopService({
      query: "What is the fee for a lost key?",
      branch: "Gil Puyat",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to query Admin SOP Service");
  });
});
