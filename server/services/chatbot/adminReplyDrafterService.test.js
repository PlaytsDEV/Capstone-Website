import { jest } from "@jest/globals";

jest.unstable_mockModule("./aiProviderService.js", () => ({
  generateChatCompletion: jest.fn()
}));

const { generateChatCompletion } = await import("./aiProviderService.js");
const { generateAdminReplyDraft } = await import("./adminReplyDrafterService.js");

describe("adminReplyDrafterService", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should generate a reply draft and parse the JSON correctly", async () => {
    const mockResponse = JSON.stringify({
      suggestedReply: "Dear tenant, we will fix your sink tomorrow.",
      confidence: 0.9,
      recommendedActions: [{ label: "Create Work Order", action: "CREATE_WO" }],
    });
    generateChatCompletion.mockResolvedValue(mockResponse);

    const result = await generateAdminReplyDraft({
      conversationId: "123",
      ticketCategory: "Plumbing",
      urgency: "High",
      recentMessages: [{ role: "user", content: "My sink is leaking" }],
      tenantContext: { room: "101" },
      tone: "professional",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("suggestedReply");
    expect(result.data.suggestedReply).toContain("fix your sink tomorrow");
    expect(result.data.confidence).toBe(0.9);
    expect(Array.isArray(result.data.recommendedActions)).toBe(true);
  });

  it("should handle malformed JSON response gracefully", async () => {
    generateChatCompletion.mockResolvedValue("This is just some text, not JSON");

    const result = await generateAdminReplyDraft({
      conversationId: "123",
    });

    expect(result.success).toBe(true);
    expect(result.data.suggestedReply).toBe("This is just some text, not JSON");
    expect(result.data.confidence).toBe(0.5); // Fallback confidence
  });
});
