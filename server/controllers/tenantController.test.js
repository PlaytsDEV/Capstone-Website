import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const genericModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  exists: jest.fn(),
  save: jest.fn(),
  log: jest.fn(),
});

const userModel = genericModel();
const reservationModel = genericModel();
const auditLogModel = genericModel();
const roomModel = genericModel();
const stayModel = genericModel();
const billModel = genericModel();
const contractModel = genericModel();
const bedHistoryModel = genericModel();
const utilityReadingModel = genericModel();
const utilityPeriodModel = genericModel();

const allModels = {
  User: userModel,
  Room: roomModel,
  Reservation: reservationModel,
  Inquiry: genericModel(),
  AuditLog: auditLogModel,
  Bill: billModel,
  MeterReading: genericModel(),
  BillingPeriod: genericModel(),
  BillingResult: genericModel(),
  Announcement: genericModel(),
  MaintenanceRequest: genericModel(),
  Notification: genericModel(),
  Payment: genericModel(),
  TenantCredit: genericModel(),
  LoginLog: genericModel(),
  UserSession: genericModel(),
  AcknowledgmentAccount: genericModel(),
  BusinessSettings: genericModel(),
  VisitAvailability: genericModel(),
  VisitAvailabilityHistory: genericModel(),
  VisitConflictLog: genericModel(),
  LeaseRenewal: genericModel(),
  ChatConversation: genericModel(),
  ChatMessage: genericModel(),
  ChatAttachment: genericModel(),
  WaterBillingRecord: genericModel(),
  UtilityPeriod: utilityPeriodModel,
  UtilityReading: utilityReadingModel,
  UtilityFinalization: genericModel(),
  BedHistory: bedHistoryModel,
  Stay: stayModel,
  Contract: contractModel,
  ContractCounter: genericModel(),
  ContractAcknowledgement: genericModel(),
  BedCheckoutLock: genericModel(),
  BackupConfig: genericModel(),
  BackupRecord: genericModel(),
  ServiceProvider: genericModel(),
  OverdueNotice: genericModel(),
  TerminationReview: genericModel(),
  BillingDispute: genericModel(),
  TenantViolation: genericModel(),
  MoveOutClearance: genericModel(),
  PaymongoWebhookEvent: genericModel(),
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  INQUIRY_BRANCHES: ["gil-puyat", "guadalupe", "general"],
  ROOM_BRANCH_LABELS: { "gil-puyat": "Gil Puyat", guadalupe: "Guadalupe" },
  isValidRoomBranch: (b) => ["gil-puyat", "guadalupe"].includes(b),
  isValidInquiryBranch: (b) => ["gil-puyat", "guadalupe", "general"].includes(b),
  USER_ROLES: ["applicant", "tenant", "branch_admin", "owner"],
  TENANT_STATUSES: ["none", "active", "inactive", "moved_out", "evicted", "blacklisted"],
  INQUIRY_STATUSES: ["pending", "in-progress", "resolved", "closed"],
  RESERVATION_STATUSES: [],
  INQUIRY_TAGS: [],
  isValidRole: () => true,
};

await jest.unstable_mockModule("../models/index.js", () => allModels);
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { updateTenantAppliances } = await import("./tenantController.js");
const { copyApplianceAddOns } = await import("../utils/tenantActionService.js");

describe("tenantController - updateTenantAppliances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects when tenant ID is invalid", async () => {
    const req = {
      params: { id: "invalid-id" },
      body: { selectedAppliances: [] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "INVALID_TENANT_ID",
      }),
    );
  });

  test("rejects when tenant does not exist", async () => {
    userModel.findById.mockResolvedValue(null);

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: { selectedAppliances: [] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "TENANT_NOT_FOUND",
      }),
    );
  });

  test("rejects when no active reservation is found for tenant", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      firstName: "Jane",
      lastName: "Doe",
    });

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(null),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: { selectedAppliances: [] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "RESERVATION_NOT_FOUND",
      }),
    );
  });

  test("rejects when reservation is not at Guadalupe branch", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      firstName: "Jane",
      lastName: "Doe",
    });

    const mockReservation = {
      _id: "507f1f77bcf86cd799439022",
      roomId: { branch: "gil-puyat" },
      branch: "gil-puyat",
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockReservation),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: { selectedAppliances: [{ id: "fan", quantity: 1 }] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "APPLIANCE_FEES_DISABLED_FOR_BRANCH",
      }),
    );
  });

  test("rejects when selectedAppliances is not an array", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
    });

    const mockReservation = {
      _id: "507f1f77bcf86cd799439022",
      roomId: { branch: "guadalupe" },
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockReservation),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: { selectedAppliances: "invalid-string" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "INVALID_SELECTED_APPLIANCES",
      }),
    );
  });

  test("rejects when appliance item has invalid quantity", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
    });

    const mockReservation = {
      _id: "507f1f77bcf86cd799439022",
      roomId: { branch: "guadalupe" },
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockReservation),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      body: {
        selectedAppliances: [{ id: "fan", quantity: -2 }],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "INVALID_APPLIANCE_QUANTITY",
      }),
    );
  });

  test("successfully calculates fees and updates appliances on active reservation", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      email: "tenant@example.com",
    });

    const mockReservation = {
      _id: "507f1f77bcf86cd799439022",
      userId: "507f1f77bcf86cd799439011",
      roomId: { branch: "guadalupe" },
      monthlyRent: 4500,
      totalPrice: 4500,
      selectedAppliances: [],
      applianceFees: 0,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockReservation),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);
    auditLogModel.log.mockResolvedValue({});

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      user: { email: "admin@lilycrest.com", role: "branch_admin" },
      body: {
        selectedAppliances: [
          { id: "fan", name: "Electric Fan", quantity: 2, price: 200 },
          { id: "laptop", name: "Laptop", quantity: 1, price: 200 },
        ],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(mockReservation.applianceFees).toBe(600); // 2*200 + 1*200 = 600
    expect(mockReservation.totalPrice).toBe(5100); // 4500 + 600
    expect(mockReservation.selectedAppliances).toEqual([
      { id: "fan", name: "Electric Fan", quantity: 2 },
      { id: "laptop", name: "Laptop", quantity: 1 },
    ]);
    expect(mockReservation.save).toHaveBeenCalled();

    // Verify AuditLog action
    expect(auditLogModel.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "data_modification",
        action: "tenant.appliances_updated",
        metadata: expect.objectContaining({
          applianceFees: 600,
          tenantId: "507f1f77bcf86cd799439011",
        }),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        selectedAppliances: [
          { id: "fan", name: "Electric Fan", quantity: 2 },
          { id: "laptop", name: "Laptop", quantity: 1 },
        ],
        applianceFees: 600,
      },
    });
  });

  test("uses default fee of 200 per appliance when price is not specified", async () => {
    userModel.findById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
    });

    const mockReservation = {
      _id: "507f1f77bcf86cd799439022",
      roomId: { branch: "guadalupe" },
      monthlyRent: 4000,
      totalPrice: 4000,
      selectedAppliances: [],
      applianceFees: 0,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockReservation),
    };
    reservationModel.findOne.mockReturnValue(mockQuery);
    auditLogModel.log.mockResolvedValue({});

    const req = {
      params: { id: "507f1f77bcf86cd799439011" },
      user: { email: "admin@lilycrest.com" },
      body: {
        selectedAppliances: [
          { id: "ricecooker", quantity: 1 },
        ],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateTenantAppliances(req, res);

    expect(mockReservation.applianceFees).toBe(200);
    expect(mockReservation.totalPrice).toBe(4200);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("tenantActionService - copyApplianceAddOns", () => {
  test("cleanly copies appliances and applianceFees within Guadalupe", () => {
    const sourceRes = {
      roomId: { branch: "guadalupe" },
      selectedAppliances: [{ id: "fan", name: "Electric Fan", quantity: 2 }],
      applianceFees: 400,
    };
    const targetRes = {
      roomId: { branch: "guadalupe" },
      monthlyRent: 5000,
      totalPrice: 5000,
      selectedAppliances: [],
      applianceFees: 0,
    };

    copyApplianceAddOns(sourceRes, targetRes);

    expect(targetRes.selectedAppliances).toEqual([
      { id: "fan", name: "Electric Fan", quantity: 2 },
    ]);
    expect(targetRes.applianceFees).toBe(400);
    expect(targetRes.totalPrice).toBe(5400);
  });

  test("does not copy appliance add-ons when branch is not Guadalupe", () => {
    const sourceRes = {
      roomId: { branch: "gil-puyat" },
      selectedAppliances: [{ id: "fan", name: "Electric Fan", quantity: 1 }],
      applianceFees: 200,
    };
    const targetRes = {
      roomId: { branch: "gil-puyat" },
      monthlyRent: 5000,
      totalPrice: 5000,
      selectedAppliances: [],
      applianceFees: 0,
    };

    copyApplianceAddOns(sourceRes, targetRes);

    expect(targetRes.selectedAppliances).toEqual([]);
    expect(targetRes.applianceFees).toBe(0);
    expect(targetRes.totalPrice).toBe(5000);
  });
});
