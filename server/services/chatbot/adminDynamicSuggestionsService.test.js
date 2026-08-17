import { jest } from "@jest/globals";

const mockMaintenanceFind = jest.fn();
const mockReservationFind = jest.fn();
const mockBillCount = jest.fn();
const mockContractCount = jest.fn();

jest.unstable_mockModule("../../models/index.js", () => ({
  MaintenanceRequest: {
    find: mockMaintenanceFind,
  },
  Reservation: {
    find: mockReservationFind,
  },
  Bill: {
    countDocuments: mockBillCount,
  },
  Contract: {
    countDocuments: mockContractCount,
  },
  Room: {
    find: jest.fn(),
  },
}));

const { getAdminDynamicSuggestions } = await import("./adminDynamicSuggestionsService.js");

describe("adminDynamicSuggestionsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockMaintenanceFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                title: "Water leak in bathroom",
                roomId: { roomNumber: "204" },
                urgency: "urgent",
              },
            ]),
          }),
        }),
      }),
    });

    mockReservationFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              firstName: "Juan",
              lastName: "Dela Cruz",
              roomId: { roomNumber: "102" },
            },
          ]),
        }),
      }),
    });

    mockBillCount.mockResolvedValue(3);
    mockContractCount.mockResolvedValue(2);
  });

  it("should generate dynamic suggestions based on real-time database state", async () => {
    const result = await getAdminDynamicSuggestions({
      branch: "guadalupe",
      userRole: "branch_admin",
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const standup = result.data.find((s) => s.category === "standup");
    expect(standup).toBeDefined();

    const maint = result.data.find((s) => s.category === "maintenance");
    expect(maint).toBeDefined();
    expect(maint.label).toContain("204");

    const moveIn = result.data.find((s) => s.category === "move_in");
    expect(moveIn).toBeDefined();
    expect(moveIn.label).toContain("Juan Dela Cruz");

    const billing = result.data.find((s) => s.category === "billing");
    expect(billing).toBeDefined();
    expect(billing.label).toContain("3 Overdue");
  });

  it("should fall back gracefully on database error", async () => {
    mockMaintenanceFind.mockImplementation(() => {
      throw new Error("DB Error");
    });

    const result = await getAdminDynamicSuggestions({
      branch: "gil-puyat",
      userRole: "branch_admin",
    });

    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });
});
