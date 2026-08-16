import { jest } from "@jest/globals";

jest.unstable_mockModule("../services/chatbot/chatbotService.js", () => ({
  queryGeminiChatbot: jest.fn(),
  streamGeminiChatbot: jest.fn(),
}));

class MockInquiry {
  constructor(data) {
    Object.assign(this, data);
    this._id = "mocked-id-123";
  }
  save = jest.fn().mockResolvedValue(true);
}

jest.unstable_mockModule("../models/Inquiry.js", () => ({
  default: MockInquiry,
}));

const { handlePublicQuery, handlePublicStream, handleLeadEscalation } =
  await import("./chatbotController.js");
const { queryGeminiChatbot, streamGeminiChatbot } =
  await import("../services/chatbot/chatbotService.js");

describe("chatbotController", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      on: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handlePublicQuery", () => {
    it("should return successful response with valid data and default branchFocus", async () => {
      req.body = {
        message: "How much is a room?",
        conversationHistory: [],
      };

      const mockData = {
        reply: "It costs ₱3,500.",
        suggestedActions: [],
        widget: null,
        canEscalate: true,
      };

      queryGeminiChatbot.mockResolvedValueOnce(mockData);

      await handlePublicQuery(req, res, next);

      expect(queryGeminiChatbot).toHaveBeenCalledWith("How much is a room?", [], "all");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("should accept optional branchFocus", async () => {
      req.body = {
        message: "Where are you located?",
        conversationHistory: [],
        branchFocus: "guadalupe",
      };

      const mockData = {
        reply: "Guadalupe Branch is at EDSA Guadalupe Nuevo, Makati.",
        suggestedActions: [],
        widget: null,
        canEscalate: true,
      };

      queryGeminiChatbot.mockResolvedValueOnce(mockData);

      await handlePublicQuery(req, res, next);

      expect(queryGeminiChatbot).toHaveBeenCalledWith(
        "Where are you located?",
        [],
        "guadalupe",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("should return 400 on validation error", async () => {
      req.body = {}; // missing message

      await handlePublicQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  describe("handlePublicStream", () => {
    it("should set SSE headers and trigger stream callbacks", async () => {
      req.body = {
        message: "Tell me about room rates",
        conversationHistory: [],
        branchFocus: "gil_puyat",
      };

      streamGeminiChatbot.mockImplementation(
        async ({ onToken, onWidget, onActions, onDone }) => {
          onWidget({ type: "room_showcase", data: {} });
          onToken("Quadruple ");
          onToken("Sharing is ₱3,500.");
          onActions([{ label: "Browse Gil Puyat Rooms" }]);
          onDone({ fullReply: "Quadruple Sharing is ₱3,500." });
        },
      );

      await handlePublicStream(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-transform");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");

      // Verify SSE events were written
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"event":"widget"'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"event":"token","data":"Quadruple "'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"event":"token","data":"Sharing is ₱3,500."'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"event":"actions"'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"event":"done"'),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it("should return 400 on validation error without setting SSE headers", async () => {
      req.body = { message: "" }; // empty message

      await handlePublicStream(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
        }),
      );
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it("should register abort listener on request close", async () => {
      req.body = {
        message: "Hello Lilycrest",
      };

      streamGeminiChatbot.mockResolvedValueOnce();

      await handlePublicStream(req, res, next);

      expect(req.on).toHaveBeenCalledWith("close", expect.any(Function));
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
        preferredRoomType: "private_room",
      };

      await handleLeadEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          inquiryId: expect.any(String),
          message:
            "Your assistance request has been sent to our front desk admin team. We will contact you promptly.",
        },
      });
    });

    it("should accept any branch and undecided room type", async () => {
      req.body = {
        name: "Test User",
        email: "test@example.com",
        phone: "09123456789",
        preferredBranch: "any",
        message: "Inquiry with no preference",
        preferredRoomType: "undecided",
      };

      await handleLeadEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 400 on missing required fields", async () => {
      req.body = {
        name: "Test User",
        email: "test@example.com",
        // missing phone and message
      };

      await handleLeadEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });
});
