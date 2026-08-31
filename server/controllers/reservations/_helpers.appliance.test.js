import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockApplianceFind = jest.fn();

const mockModels = {
  Reservation: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  },
  User: { find: jest.fn(), findOne: jest.fn() },
  Room: { find: jest.fn(), findById: jest.fn() },
  Bill: { find: jest.fn(), countDocuments: jest.fn() },
  UtilityReading: { findOne: jest.fn() },
  UtilityPeriod: { findOne: jest.fn() },
  BedHistory: {},
  Stay: {},
  Contract: {},
  ContractCounter: {},
  BedCheckoutLock: {},
  Inquiry: {},
  MeterReading: {},
  BillingPeriod: {},
  BillingResult: {},
  Announcement: {},
  MaintenanceRequest: {},
  Notification: {},
  LoginLog: {},
  UserSession: {},
  AcknowledgmentAccount: {},
  BusinessSettings: {},
  Appliance: {
    find: mockApplianceFind,
  },
  LeaseRenewal: {},
  ChatConversation: {},
  ChatMessage: {},
  WaterBillingRecord: {},
  BackupConfig: {},
  BackupRecord: {},
  ServiceProvider: {},
  OverdueNotice: {},
  TerminationReview: {},
  BillingDispute: {},
  TenantViolation: {},
  TenantCredit: { find: jest.fn(), findOne: jest.fn() },
  Payment: {},
  AuditLog: { create: jest.fn() },
  VisitAvailability: { findOne: jest.fn(), create: jest.fn() },
  VisitAvailabilityHistory: { create: jest.fn() },
  VisitConflictLog: { create: jest.fn() },
  PaymongoWebhookEvent: {},
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  INQUIRY_BRANCHES: ["gil-puyat", "guadalupe", "general"],
  ROOM_BRANCH_LABELS: {},
  isValidRoomBranch: () => true,
  isValidInquiryBranch: () => true,
  USER_ROLES: [],
  TENANT_STATUSES: [],
  INQUIRY_STATUSES: [],
  RESERVATION_STATUSES: [],
  INQUIRY_TAGS: [],
};

await jest.unstable_mockModule("../../models/index.js", () => mockModels);

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

await jest.unstable_mockModule("../../config/email.js", () => ({
  sendInquiryResponseEmail: jest.fn(),
  sendReservationConfirmedEmail: jest.fn(),
  sendVisitApprovedEmail: jest.fn(),
  sendPhysicalVisitStatusEmail: jest.fn(),
  sendDocumentsRejectedEmail: jest.fn(),
  sendBillGeneratedEmail: jest.fn(),
  sendUtilityChargeAvailableEmail: jest.fn(),
  sendPaymentReminderEmail: jest.fn(),
  sendOverdueNoticeEmail: jest.fn(),
  sendPaymentApprovedEmail: jest.fn(),
  sendPaymentRejectedEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
  generateEmailVerificationEmail: jest.fn(),
  sendEmailVerificationLinkEmail: jest.fn(),
  generateLoginOtpEmail: jest.fn(),
  sendLoginOtpEmail: jest.fn(),
  normalizeOtpEmailResponse: jest.fn(),
  buildLoginOtpMessage: jest.fn(),
  classifyOtpEmailError: jest.fn(),
  default: {},
}));

await jest.unstable_mockModule("../../utils/notificationService.js", () => ({
  notify: jest.fn(),
}));

await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
  emitToAdmins: jest.fn(),
  emitRoomUpdate: jest.fn(),
}));

await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: {
    log: jest.fn(),
    logError: jest.fn(),
    logModification: jest.fn(),
  },
}));

const { validateSelectedAppliancesForReservation } = await import("./_helpers.js");

describe("validateSelectedAppliancesForReservation", () => {
  const guadalupeSettings = { isApplianceFeeEnabled: true, applianceFeeAmountPerUnit: 200 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApplianceFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  describe("Branch and Feature Flag Guards", () => {
    test("returns empty array when branch is not guadalupe", async () => {
      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [{ id: "fan", quantity: 1 }],
        branchId: "gil-puyat",
        branchSettings: { isApplianceFeeEnabled: true },
      });
      expect(result).toEqual([]);
    });

    test("returns empty array when isApplianceFeeEnabled is false", async () => {
      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [{ id: "fan", quantity: 1 }],
        branchId: "guadalupe",
        branchSettings: { isApplianceFeeEnabled: false },
      });
      expect(result).toEqual([]);
    });

    test("returns empty array when selectedAppliances is empty array or null", async () => {
      const resultEmpty = await validateSelectedAppliancesForReservation({
        selectedAppliances: [],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });
      expect(resultEmpty).toEqual([]);

      const resultNull = await validateSelectedAppliancesForReservation({
        selectedAppliances: null,
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });
      expect(resultNull).toEqual([]);
    });
  });

  describe("Fallback Default Appliances (DB empty)", () => {
    test("validates fallback items using array input format", async () => {
      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [
          { id: "fan", quantity: 2 },
          { id: "laptop", quantity: 1 },
        ],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "fan", name: "Electric Fan", quantity: 2, price: 200 },
        { id: "laptop", name: "Laptop", quantity: 1, price: 200 },
      ]);
    });

    test("validates fallback items using object input format", async () => {
      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: {
          fan: 1,
          ricecooker: 1,
        },
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "fan", name: "Electric Fan", quantity: 1, price: 200 },
        { id: "ricecooker", name: "Rice Cooker", quantity: 1, price: 200 },
      ]);
    });

    test("filters out zero quantity items", async () => {
      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [
          { id: "fan", quantity: 2 },
          { id: "laptop", quantity: 0 },
        ],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "fan", name: "Electric Fan", quantity: 2, price: 200 },
      ]);
    });
  });

  describe("Database Catalog Overlay & Fallback Retention", () => {
    test("retains fallback appliances when custom appliances exist in the database", async () => {
      const dbAppliances = [
        {
          code: "mini-fridge",
          name: "Mini Refrigerator",
          monthlyFee: 350,
          maxQuantity: 2,
          isActive: true,
        },
      ];

      mockApplianceFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(dbAppliances),
      });

      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [
          { id: "fan", quantity: 1 },
          { id: "mini-fridge", quantity: 1 },
        ],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "fan", name: "Electric Fan", quantity: 1, price: 200 },
        { id: "mini-fridge", name: "Mini Refrigerator", quantity: 1, price: 350 },
      ]);
    });

    test("overlays DB appliance price and maxQuantity on existing fallback appliance", async () => {
      const dbAppliances = [
        {
          code: "fan",
          name: "Heavy Duty Fan",
          monthlyFee: 250,
          maxQuantity: 3,
          isActive: true,
        },
      ];

      mockApplianceFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(dbAppliances),
      });

      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [{ id: "fan", quantity: 3 }],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "fan", name: "Heavy Duty Fan", quantity: 3, price: 250 },
      ]);
    });

    test("falls back gracefully to default catalog if DB query throws", async () => {
      mockApplianceFind.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("DB connection failure")),
      });

      const result = await validateSelectedAppliancesForReservation({
        selectedAppliances: [{ id: "laptop", quantity: 2 }],
        branchId: "guadalupe",
        branchSettings: guadalupeSettings,
      });

      expect(result).toEqual([
        { id: "laptop", name: "Laptop", quantity: 2, price: 200 },
      ]);
    });
  });

  describe("Validation Error Scenarios", () => {
    test("throws INVALID_APPLIANCE_ID for unknown appliance ID", async () => {
      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: [{ id: "washing-machine", quantity: 1 }],
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_APPLIANCE_ID",
      });
    });

    test("throws INVALID_APPLIANCE_QUANTITY for negative quantity", async () => {
      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: [{ id: "fan", quantity: -1 }],
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_APPLIANCE_QUANTITY",
      });
    });

    test("throws INVALID_APPLIANCE_QUANTITY for non-integer quantity", async () => {
      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: [{ id: "fan", quantity: 2.5 }],
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_APPLIANCE_QUANTITY",
      });
    });

    test("throws INVALID_APPLIANCE_QUANTITY when quantity exceeds default maxQuantity (5)", async () => {
      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: [{ id: "fan", quantity: 6 }],
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_APPLIANCE_QUANTITY",
      });
    });

    test("throws INVALID_APPLIANCE_QUANTITY when quantity exceeds DB custom maxQuantity", async () => {
      const dbAppliances = [
        {
          code: "air-cooler",
          name: "Air Cooler",
          monthlyFee: 400,
          maxQuantity: 1,
          isActive: true,
        },
      ];

      mockApplianceFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(dbAppliances),
      });

      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: [{ id: "air-cooler", quantity: 2 }],
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_APPLIANCE_QUANTITY",
      });
    });

    test("throws INVALID_SELECTED_APPLIANCES when payload is invalid type", async () => {
      await expect(
        validateSelectedAppliancesForReservation({
          selectedAppliances: "not-an-array-or-object",
          branchId: "guadalupe",
          branchSettings: guadalupeSettings,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_SELECTED_APPLIANCES",
      });
    });
  });
});
