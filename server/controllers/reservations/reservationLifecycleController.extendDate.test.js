import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import mongoose from "mongoose";

const mockReservationSave = jest.fn();
const mockReservationPopulate = jest.fn();
let mockReservationDoc = null;

const reservationFindById = jest.fn((id) => ({
  populate: jest.fn().mockImplementation(() => {
    if (!mockReservationDoc) return Promise.resolve(null);
    return Promise.resolve(mockReservationDoc);
  }),
}));

const mockAuditLogModification = jest.fn();
const mockAuditLogError = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Reservation: {
    find: jest.fn(),
    findById: reservationFindById,
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  },
  User: { find: jest.fn(), findOne: jest.fn() },
  Room: { find: jest.fn(), findById: jest.fn() },
  VisitAvailability: { findOne: jest.fn(), create: jest.fn() },
  VisitAvailabilityHistory: { create: jest.fn().mockResolvedValue({}) },
  VisitConflictLog: { create: jest.fn().mockResolvedValue({}) },
  Bill: {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
  },
  Payment: {},
  TenantCredit: { find: jest.fn(() => ({ sort: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) })), findOne: jest.fn(() => ({ session: jest.fn().mockResolvedValue(null) })), create: jest.fn() },
  AuditLog: { create: jest.fn() },
  UtilityReading: { findOne: jest.fn() },
  UtilityPeriod: { findOne: jest.fn() },
  UtilityFinalization: {
    find: jest.fn(() => ({ session: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) })),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
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
}));

await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: {
    logModification: mockAuditLogModification,
    logError: mockAuditLogError,
  },
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { extendReservation } = await import("./reservationLifecycleController.js");

describe("extendReservation Controller", () => {
  const validReservationId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReservationDoc = {
      _id: validReservationId,
      status: "reserved",
      moveInDate: new Date("2026-08-20T00:00:00.000Z"),
      finalMoveInDate: new Date("2026-08-20T00:00:00.000Z"),
      roomId: { branch: "gil-puyat" },
      toObject() {
        return { ...this };
      },
      save: mockReservationSave.mockResolvedValue(true),
      populate: mockReservationPopulate.mockResolvedValue(true),
    };
  });

  test("reschedules move-in date to exact newMoveInDate", async () => {
    const req = {
      params: { reservationId: validReservationId },
      body: { newMoveInDate: "2026-08-28" },
      user: { uid: "firebase123" },
      authUser: { _id: "admin123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await extendReservation(req, res);

    expect(mockReservationDoc.moveInDate).toEqual(new Date("2026-08-28"));
    expect(mockReservationDoc.finalMoveInDate).toEqual(new Date("2026-08-28"));
    expect(mockReservationSave).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Rescheduled move-in date to 2026-08-28"),
        newMoveInDate: new Date("2026-08-28"),
      }),
    );
  });

  test("reschedules move-in date by extensionDays if no exact date is passed", async () => {
    const req = {
      params: { reservationId: validReservationId },
      body: { extensionDays: 5 },
      user: { uid: "firebase123" },
      authUser: { _id: "admin123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await extendReservation(req, res);

    const expectedDate = new Date("2026-08-25T00:00:00.000Z");
    expect(mockReservationDoc.moveInDate).toEqual(expectedDate);
    expect(mockReservationSave).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Extended move-in date by 5 days",
        newMoveInDate: expectedDate,
      }),
    );
  });

  test("returns 400 when invalid newMoveInDate is supplied", async () => {
    const req = {
      params: { reservationId: validReservationId },
      body: { newMoveInDate: "invalid-date-string" },
      user: { uid: "firebase123" },
      authUser: { _id: "admin123" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await extendReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INVALID_MOVEIN_DATE",
      }),
    );
  });
});
