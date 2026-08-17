import { jest } from "@jest/globals";

const mockReservationFind = jest.fn();
const mockMoveOutFind = jest.fn();
const mockMaintenanceFind = jest.fn();
const mockPaymentFind = jest.fn();
const mockBillCount = jest.fn();
const mockAnnouncementFind = jest.fn();

jest.unstable_mockModule("../../models/index.js", () => ({
  Reservation: {
    find: mockReservationFind,
  },
  MoveOutClearance: {
    find: mockMoveOutFind,
  },
  MaintenanceRequest: {
    find: mockMaintenanceFind,
  },
  Bill: {
    countDocuments: mockBillCount,
  },
  Payment: {
    find: mockPaymentFind,
  },
  Announcement: {
    find: mockAnnouncementFind,
  },
  Room: {
    find: jest.fn(),
  },
}));

const { generateDailyShiftBriefing } = await import("./adminDailyBriefingService.js");

describe("adminDailyBriefingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockReservationFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              firstName: "Carlos",
              lastName: "Mendoza",
              roomId: { roomNumber: "201" },
              bedId: "Bed A",
              phone: "09181234567",
            },
          ]),
        }),
      }),
    });

    mockMoveOutFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockMaintenanceFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([
                {
                  _id: "maint-1",
                  title: "Water leak in bathroom",
                  roomId: { roomNumber: "204" },
                  urgency: "urgent",
                  status: "pending",
                },
              ]),
            }),
          }),
        }),
      }),
    });

    mockPaymentFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ amount: 12500 }]),
      }),
    });

    mockBillCount.mockResolvedValue(2);

    mockAnnouncementFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                title: "Water Tank Cleaning on Wednesday",
                category: "Maintenance",
              },
            ]),
          }),
        }),
      }),
    });
  });

  it("should generate a structured daily shift briefing for a specific branch", async () => {
    const result = await generateDailyShiftBriefing({
      branch: "guadalupe",
      userRole: "branch_admin",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("title");
    expect(result.data.title).toContain("Guadalupe Branch");
    expect(result.data.stats.moveInsCount).toBe(1);
    expect(result.data.stats.urgentMaintenanceCount).toBe(1);
    expect(result.data.stats.paymentsCollectedYesterday).toBe(12500);
    expect(result.data.moveIns[0].name).toBe("Carlos Mendoza");
    expect(result.data.maintenance[0].title).toBe("Water leak in bathroom");
    expect(result.data.announcements.length).toBe(1);
  });

  it("should generate a consolidated briefing for dormitory owner", async () => {
    const result = await generateDailyShiftBriefing({
      branch: "all",
      userRole: "owner",
    });

    expect(result.success).toBe(true);
    expect(result.data.branch).toContain("Consolidated");
  });

  it("should handle database model failures gracefully", async () => {
    mockReservationFind.mockImplementation(() => {
      throw new Error("DB Connection Interrupted");
    });

    const result = await generateDailyShiftBriefing({
      branch: "gil-puyat",
      userRole: "branch_admin",
    });

    expect(result.success).toBe(true);
    expect(result.data.stats.moveInsCount).toBe(0);
  });
});
