import { jest } from "@jest/globals";

jest.unstable_mockModule("./aiProviderService.js", () => ({
  generateChatCompletion: jest.fn(),
}));

jest.unstable_mockModule("../../models/ChatConversation.js", () => ({
  default: {
    find: jest.fn(() => ({
      lean: jest.fn(() => Promise.resolve([])),
    })),
  },
  find: jest.fn(() => ({
    lean: jest.fn(() => Promise.resolve([])),
  })),
}));

const { generateChatCompletion } = await import("./aiProviderService.js");
const { default: ChatConversation } = await import("../../models/ChatConversation.js");
const { getOwnerSupportTrends } = await import("./ownerSupportTrendsService.js");

describe("ownerSupportTrendsService", () => {
  beforeEach(() => {
    ChatConversation.find = jest.fn(() => ({
      lean: jest.fn(() => Promise.resolve([])),
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should generate an executive summary for support trends", async () => {
    const mockResponse = JSON.stringify({
      executiveSummary: "This is the summary.",
      keyInsights: ["Insight A"],
      recommendations: ["Rec 1"],
      rawMetrics: {},
    });
    generateChatCompletion.mockResolvedValue(mockResponse);

    const result = await getOwnerSupportTrends({
      timeframe: "30d",
      branch: "All",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("executiveSummary");
    expect(result.data.executiveSummary).toBe("This is the summary.");
    expect(Array.isArray(result.data.keyInsights)).toBe(true);
    expect(result.data.keyInsights.length).toBe(1);
    expect(Array.isArray(result.data.recommendations)).toBe(true);
  });

  it("should handle malformed JSON response gracefully", async () => {
    generateChatCompletion.mockResolvedValue("Malformed string response");

    const result = await getOwnerSupportTrends({
      timeframe: "30d",
      branch: "Gil Puyat",
    });

    expect(result.success).toBe(true);
    expect(result.data.executiveSummary).toBe("Summary could not be generated.");
    expect(Array.isArray(result.data.keyInsights)).toBe(true);
    expect(result.data.keyInsights.length).toBe(0);
  });
});
