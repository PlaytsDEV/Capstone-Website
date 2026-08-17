import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockReservationFind = jest.fn();
const mockReservationCountDocuments = jest.fn();
const mockRoomFind = jest.fn();
const mockFindDbUser = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Reservation: {
    find: mockReservationFind,
    countDocuments: mockReservationCountDocuments,
  },
  Room: {
    find: mockRoomFind,
  },
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  VisitAvailability: {
    findOne: jest.fn(),
  },
  VisitAvailabilityHistory: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  VisitConflictLog: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  INQUIRY_BRANCHES: ["gil-puyat", "guadalupe", "general"],
  isValidRoomBranch: jest.fn(() => true),
  isValidInquiryBranch: jest.fn(() => true),
}));

await jest.unstable_mockModule("./_helpers.js", () => ({
  findDbUser: mockFindDbUser,
  resolveVisitAvailabilityBranch: jest.fn((req, user) => ({
    branch: req.query.branch || "gil-puyat",
  })),
  buildVisitAvailabilityActor: jest.fn(),
  normalizeViewingPreferenceInput: jest.fn(),
  deriveViewingPreference: jest.fn(),
  deriveViewingType: jest.fn(),
  isViewingPreferenceLocked: jest.fn(),
  buildVisitEmailContext: jest.fn(),
  serializeReservation: jest.fn(),
  DOCUMENT_PRECHECK_TYPES: {},
  normalizeDocumentPrecheckType: jest.fn(),
  mapAiStatusToLegacyValidationStatus: jest.fn(),
}));

const { getVisitScheduledUsersHistory } = await import(
  "./visitManagementController.js"
);

describe("getVisitScheduledUsersHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns scheduled users history with formatted records and summary", async () => {
    mockFindDbUser.mockResolvedValue({ _id: "admin-1", role: "admin" });
    mockRoomFind.mockReturnValue({
      distinct: jest.fn().mockResolvedValue(["room-101", "room-102"]),
    });

    const mockRecords = [
      {
        _id: "res-1",
        tenantName: "Juan Dela Cruz",
        email: "juan@example.com",
        phone: "09171234567",
        visitDate: new Date("2026-09-01T09:00:00.000Z"),
        visitTime: "09:00 AM",
        visitCode: "VIS-ABC123",
        visitStatus: "schedule_approved",
        viewingPreference: "physical_visit",
        status: "pending",
        scheduleApproved: true,
        scheduleApprovedAt: new Date("2026-08-20T10:00:00.000Z"),
        scheduleRejected: false,
        visitHistory: [],
        createdAt: new Date("2026-08-20T09:30:00.000Z"),
        roomId: {
          roomNumber: "101",
          name: "Room 101",
          branch: "gil-puyat",
          roomType: "Single Deluxe",
        },
      },
    ];

    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecords),
    };

    mockReservationFind.mockReturnValue(mockChain);
    mockReservationCountDocuments
      .mockResolvedValueOnce(1)  // total
      .mockResolvedValueOnce(1)  // upcomingCount
      .mockResolvedValueOnce(0)  // completedCount
      .mockResolvedValueOnce(0); // cancelledCount

    const req = {
      user: { uid: "firebase-uid-admin" },
      query: { branch: "gil-puyat", page: "1", limit: "15" },
    };

    let responseData = null;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        responseData = data;
        return data;
      }),
    };
    const next = jest.fn();

    await getVisitScheduledUsersHistory(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(responseData).toBeDefined();
    expect(responseData.success).toBe(true);
    expect(responseData.data.branch).toBe("gil-puyat");
    expect(responseData.data.records).toHaveLength(1);
    expect(responseData.data.records[0].tenantName).toBe("Juan Dela Cruz");
    expect(responseData.data.records[0].visitCode).toBe("VIS-ABC123");
    expect(responseData.data.records[0].roomNumber).toBe("101");
    expect(responseData.data.summary.totalScheduled).toBe(1);
  });

  test("applies status and search filter correctly", async () => {
    mockFindDbUser.mockResolvedValue({ _id: "admin-1", role: "admin" });
    mockRoomFind.mockReturnValue({
      distinct: jest.fn().mockResolvedValue([]),
    });

    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };

    mockReservationFind.mockReturnValue(mockChain);
    mockReservationCountDocuments.mockResolvedValue(0);

    const req = {
      user: { uid: "firebase-uid-admin" },
      query: {
        branch: "gil-puyat",
        status: "upcoming",
        search: "Juan",
        page: "1",
        limit: "15",
      },
    };

    let responseData = null;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        responseData = data;
        return data;
      }),
    };
    const next = jest.fn();

    await getVisitScheduledUsersHistory(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(responseData.success).toBe(true);
    expect(mockReservationFind).toHaveBeenCalled();
    const queryArg = mockReservationFind.mock.calls[0][0];
    expect(queryArg.$and).toBeDefined();
    expect(queryArg.visitDate).toBeDefined();
  });
});
