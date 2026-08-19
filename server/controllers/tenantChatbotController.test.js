import { jest } from "@jest/globals";

const mockContextSnapshot = {
  tenantName: "Juan Dela Cruz",
  tenantEmail: "juan@example.com",
  branch: "Guadalupe",
  branchRaw: "guadalupe",
  roomNumber: "204",
  bedPosition: "Bed B",
  currentBill: {
    month: new Date("2026-08-01"),
    totalAmount: 4850,
    rentAmount: 3500,
    electricityAmount: 1350,
    waterAmount: 0,
    applianceAmount: 0,
    penaltyAmount: 0,
    discountAmount: 0,
    status: "pending",
    dueDate: new Date("2026-08-15"),
    proRataDays: null,
  },
  contract: {
    startDate: new Date("2026-01-15"),
    endDate: new Date("2026-12-15"),
    daysRemaining: 120,
    monthlyRate: 3500,
    depositAmount: 3500,
    status: "active",
  },
  activeMaintenance: [
    {
      ticketCode: "MNT-2026-1049",
      category: "Air Conditioning",
      urgency: "normal",
      status: "scheduled",
      description: "Filter cleaning requested",
      submittedDate: new Date("2026-08-10"),
    },
  ],
  inquiries: [],
};

jest.unstable_mockModule("../services/chatbot/tenantContextResolver.js", () => ({
  resolveTenantAIContext: jest.fn().mockResolvedValue(mockContextSnapshot),
  buildNeutralContext: jest.fn(() => ({
    tenantName: "Resident",
    branch: "Lilycrest Residence",
    branchRaw: null,
    roomNumber: null,
    bedPosition: null,
    currentBill: null,
    contract: null,
    activeMaintenance: [],
    inquiries: [],
  })),
}));

jest.unstable_mockModule("../services/chatbot/tenantChatbotService.js", () => ({
  queryTenantGeminiChatbot: jest.fn().mockResolvedValue({
    reply: "Ang inyong bill ngayong buwan ay ₱4,850.00.",
    widget: "billing_breakdown",
    suggestedActions: ["Pay My Bill"],
  }),
  streamTenantGeminiChatbot: jest.fn(),
}));

class MockConversation {
  static instances = [];
  constructor(data) {
    Object.assign(this, data);
    this._id = "mock-convo-id";
    MockConversation.instances.push(this);
  }
  save = jest.fn().mockResolvedValue(true);
  static findOne = jest.fn().mockResolvedValue(null);
}

class MockMessage {
  static instances = [];
  constructor(data) {
    Object.assign(this, data);
    this._id = "mock-msg-id";
    MockMessage.instances.push(this);
  }
  save = jest.fn().mockResolvedValue(true);
}

jest.unstable_mockModule("../models/ChatConversation.js", () => ({
  default: MockConversation,
}));

jest.unstable_mockModule("../models/ChatMessage.js", () => ({
  default: MockMessage,
}));

jest.unstable_mockModule("./chatController.js", () => ({
  autoAssignConversation: jest.fn().mockResolvedValue(true),
}));

const { handleTenantQuery, handleTenantStream, handleTenantEscalation } =
  await import("./tenantChatbotController.js");
const { resolveTenantAIContext } =
  await import("../services/chatbot/tenantContextResolver.js");
const { queryTenantGeminiChatbot } =
  await import("../services/chatbot/tenantChatbotService.js");

describe("tenantChatbotController", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    MockConversation.instances = [];
    MockMessage.instances = [];
    req = {
      body: {},
      authUser: { _id: "mock-user-id-123" },
      app: {
        get: jest.fn().mockReturnValue(null),
      },
      on: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleTenantQuery", () => {
    it("should resolve tenant context and return grounded AI response", async () => {
      req.body = {
        message: "Magkano kuryente ko?",
      };

      await handleTenantQuery(req, res, next);

      expect(resolveTenantAIContext).toHaveBeenCalledWith("mock-user-id-123", req.authUser);
      expect(queryTenantGeminiChatbot).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            reply: expect.any(String),
            contextSnapshot: expect.any(Object),
            canEscalate: true,
          }),
        }),
      );
    });

    it("should return 400 on empty message payload", async () => {
      req.body = { message: "" };

      await handleTenantQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "VALIDATION_ERROR",
        }),
      );
    });
  });

  describe("handleTenantEscalation", () => {
    it("should create conversation and initial message for human admin escalation", async () => {
      req.body = {
        category: "Billing Dispute",
        priority: "urgent",
        summary: "I was charged twice for electricity submeter reading.",
        lastBotMessage: "Your electricity is ₱1,350.00.",
      };

      await handleTenantEscalation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            conversationId: "mock-convo-id",
            status: "open",
          }),
        }),
      );
      expect(MockConversation.instances[0]).toMatchObject({
        tenantId: "mock-user-id-123",
        tenantName: "Juan Dela Cruz",
        branch: "guadalupe",
        status: "open",
        category: "billing_concern",
        priority: "urgent",
      });
      expect(MockMessage.instances[0]).toMatchObject({
        conversationId: "mock-convo-id",
        senderId: "mock-user-id-123",
        senderName: "Juan Dela Cruz",
        senderRole: "tenant",
        message: expect.stringContaining("Billing Dispute"),
      });
    });
  });
});
