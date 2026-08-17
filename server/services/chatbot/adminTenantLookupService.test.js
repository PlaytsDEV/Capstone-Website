import { jest } from "@jest/globals";

const mockUserFind = jest.fn();
const mockRoomFindOne = jest.fn();
const mockRoomFind = jest.fn();
const mockReservationFind = jest.fn();
const mockReservationFindOne = jest.fn();
const mockBillFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.unstable_mockModule("../../models/index.js", () => ({
  User: {
    find: mockUserFind,
  },
  Room: {
    findOne: mockRoomFindOne,
    find: mockRoomFind,
  },
  Reservation: {
    find: mockReservationFind,
    findOne: mockReservationFindOne,
  },
  Bill: {
    find: mockBillFind,
  },
  MaintenanceRequest: {
    countDocuments: mockCountDocuments,
  },
}));

const { findTenantOrRoomInfo } = await import("./adminTenantLookupService.js");

describe("adminTenantLookupService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default Bill and Maintenance mocks
    mockBillFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    mockReservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    mockReservationFindOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    mockCountDocuments.mockResolvedValue(0);
  });

  it("should return single tenant profile when exactly 1 tenant matches the name", async () => {
    const fakeUser = {
      _id: "user-123",
      user_id: "T-00123",
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan@example.com",
      phone: "09171234567",
      branch: "guadalupe",
      tenantStatus: "active",
    };

    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([fakeUser]),
        }),
      }),
    });

    mockRoomFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "room-204",
        roomNumber: "204",
        branch: "guadalupe",
        type: "double-sharing",
        beds: [{ occupiedBy: { userId: "user-123" }, code: "A", position: "lower" }],
      }),
    });

    const result = await findTenantOrRoomInfo({
      query: "Juan Dela Cruz",
      branch: "guadalupe",
      userRole: "branch_admin",
    });

    expect(result.found).toBe(true);
    expect(result.isSingle).toBe(true);
    expect(result.tenant.fullName).toBe("Juan Dela Cruz");
    expect(result.tenant.roomNumber).toBe("204");
  });

  it("should return candidate list when multiple tenants match", async () => {
    const fakeUsers = [
      {
        _id: "user-1",
        firstName: "Maria",
        lastName: "Santos",
        email: "maria.s@example.com",
        branch: "guadalupe",
      },
      {
        _id: "user-2",
        firstName: "Maria",
        lastName: "Clara",
        email: "maria.c@example.com",
        branch: "guadalupe",
      },
    ];

    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(fakeUsers),
        }),
      }),
    });

    mockRoomFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const result = await findTenantOrRoomInfo({
      query: "Maria",
      branch: "guadalupe",
      userRole: "branch_admin",
    });

    expect(result.found).toBe(true);
    expect(result.isMultiple).toBe(true);
    expect(result.candidates.length).toBe(2);
  });

  it("should find room and list its occupants when searching room number", async () => {
    mockRoomFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "room-101",
        roomNumber: "101",
        branch: "gil-puyat",
        floor: 1,
        type: "private",
        capacity: 1,
        beds: [{ occupiedBy: { userId: "user-999" }, code: "1" }],
      }),
    });

    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "user-999",
            firstName: "Pedro",
            lastName: "Penduko",
            email: "pedro@example.com",
            branch: "gil-puyat",
            tenantStatus: "active",
          },
        ]),
      }),
    });

    const result = await findTenantOrRoomInfo({
      query: "Room 101",
      branch: "gil-puyat",
      userRole: "branch_admin",
    });

    expect(result.found).toBe(true);
    expect(result.isRoomSearch).toBe(true);
    expect(result.roomNumber).toBe("101");
    expect(result.occupants.length).toBe(1);
    expect(result.occupants[0].fullName).toBe("Pedro Penduko");
  });

  it("should return not found if query doesn't match any tenant or room", async () => {
    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await findTenantOrRoomInfo({
      query: "NonexistentPersonXYZ",
      branch: "guadalupe",
      userRole: "branch_admin",
    });

    expect(result.found).toBe(false);
  });
});
