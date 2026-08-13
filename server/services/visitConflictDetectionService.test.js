import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const roomFind = jest.fn();
const reservationFind = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  Room: { find: roomFind },
  Reservation: { find: reservationFind },
  VisitAvailability: { findOne: jest.fn(), create: jest.fn() },
}));

await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  reservationStatusesForQuery: jest.fn((...statuses) => statuses.flat()),
}));

const { detectVisitConflicts } = await import("./visitConflictDetectionService.js");

describe("visitConflictDetectionService", () => {
  beforeEach(() => {
    roomFind.mockReset();
    reservationFind.mockReset();

    roomFind.mockReturnValue({
      distinct: jest.fn().mockResolvedValue(["room-101", "room-102"]),
    });
  });

  test("detects blackout date conflicts when matching active reservation exists", async () => {
    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "res-1",
            tenantName: "Juan Dela Cruz",
            visitDate: new Date("2026-08-20T00:00:00.000Z"),
            visitTime: "09:00 AM",
            status: "pending",
            email: "juan@example.com",
          },
        ]),
      }),
    });

    const currentSettings = {
      blackoutDates: [],
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [{ label: "09:00 AM", enabled: true }],
    };

    const proposedChanges = {
      blackoutDates: [{ date: "2026-08-20", reason: "Maintenance" }],
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [{ label: "09:00 AM", enabled: true }],
    };

    const result = await detectVisitConflicts("gil-puyat", proposedChanges, currentSettings);

    expect(result.hasConflicts).toBe(true);
    expect(result.totalAffected).toBe(1);
    expect(result.conflicts[0].type).toBe("blackout_date_conflict");
    expect(result.conflicts[0].reservations[0].tenantName).toBe("Juan Dela Cruz");
  });

  test("returns no conflicts when no matching active reservations are found for blackout date", async () => {
    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const currentSettings = { blackoutDates: [] };
    const proposedChanges = { blackoutDates: [{ date: "2026-08-20", reason: "Holiday" }] };

    const result = await detectVisitConflicts("gil-puyat", proposedChanges, currentSettings);

    expect(result.hasConflicts).toBe(false);
    expect(result.totalAffected).toBe(0);
  });

  test("detects disabled operating weekday conflicts", async () => {
    // Return a reservation that falls on a Monday (e.g. 2026-08-17 is a Monday)
    const mondayDate = new Date(2026, 7, 17); // Aug 17, 2026 is Monday
    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "res-monday",
            tenantName: "Maria Santos",
            visitDate: mondayDate,
            visitTime: "10:00 AM",
            status: "pending",
          },
        ]),
      }),
    });

    const currentSettings = { enabledWeekdays: [1, 2, 3, 4, 5] }; // Mon-Fri
    const proposedChanges = { enabledWeekdays: [2, 3, 4, 5] }; // Disabling Monday (1)

    const result = await detectVisitConflicts("gil-puyat", proposedChanges, currentSettings);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe("weekday_removal_conflict");
    expect(result.conflicts[0].removedWeekdays).toContain(1);
  });

  test("detects disabled slot conflicts", async () => {
    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "res-slot",
            tenantName: "Pedro Reyes",
            visitDate: new Date(),
            visitTime: "04:00 PM",
            status: "pending",
          },
        ]),
      }),
    });

    const currentSettings = {
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [
        { label: "09:00 AM", enabled: true },
        { label: "04:00 PM", enabled: true },
      ],
    };

    const proposedChanges = {
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [
        { label: "09:00 AM", enabled: true },
        { label: "04:00 PM", enabled: false }, // Disabling 04:00 PM
      ],
    };

    const result = await detectVisitConflicts("gil-puyat", proposedChanges, currentSettings);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe("slot_disabled_conflict");
    expect(result.conflicts[0].disabledSlots).toContain("04:00 PM");
  });
});
