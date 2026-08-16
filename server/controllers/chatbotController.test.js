import { jest } from "@jest/globals";

jest.unstable_mockModule("../services/chatbot/chatbotService.js", () => ({
  queryGeminiChatbot: jest.fn()
}));

class MockInquiry {
  constructor(data) {
    Object.assign(this, data);
    this._id = "mocked-id-123";
  }
  save = jest.fn().mockResolvedValue(true);
}

jest.unstable_mockModule("../models/Inquiry.js", () => ({
  default: MockInquiry
}));

const { handlePublicQuery, handleLeadEscalation } = await import("./chatbotController.js");
const { queryGeminiChatbot } = await import("../services/chatbot/chatbotService.js");

describe("chatbotController", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handlePublicQuery", () => {
    it("should return successful response with valid data", async () => {
      req.body = {
        message: "How much is a room?",
        conversationHistory: []
      };

      const mockData = {
        reply: "It costs ₱3,500.",
        suggestedActions: [],
        canEscalate: true
      };

      queryGeminiChatbot.mockResolvedValueOnce(mockData);

      await handlePublicQuery(req, res, next);

      expect(queryGeminiChatbot).toHaveBeenCalledWith("How much is a room?", []);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("should return 400 on validation error", async () => {
      req.body = {}; // missing message

      await handlePublicQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });
  });

  describe("handleLeadEscalation", () => {
    it("should save inquiry and return successful response with valid data", async () => {
      req.body = {
        name: "Test User",
        email: "test@example.com",
        phone: "09123456789",
        preferredBranch: "guadalupe",
        message: "Looking for a room",
        preferredRoomType: "private_room"
      };

      await handleLeadEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          inquiryId: expect.any(String),
          message: "Your inquiry has been sent to our admin team. We will contact you within 24 hours."
        }
      });
    });

    it("should return 400 on missing required fields", async () => {
      req.body = {
        name: "Test User",
        email: "test@example.com"
        // missing phone and message
      };

      await handleLeadEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });
  });
});
