import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const visitAvailabilityFindOne = jest.fn();
const visitAvailabilityCreate = jest.fn();
const roomFind = jest.fn();
const reservationFind = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
  Room: { find: roomFind },
  Reservation: { find: reservationFind },
  VisitAvailability: {
    findOne: visitAvailabilityFindOne,
    create: visitAvailabilityCreate,
  },
}));

await jest.unstable_mockModule("./lifecycleNaming.js", () => ({
  reservationStatusesForQuery: jest.fn((...statuses) => statuses.flat()),
}));

const {
  buildVisitAvailability,
  getDateClosureReason,
  getVisitAvailabilitySettings,
  resolveSlotsForDay,
  serializeVisitAvailabilitySettings,
  validateVisitSelection,
} = await import("./visitAvailability.js");

const buildSettings = (overrides = {}) => ({
  branch: "gil-puyat",
  enabledWeekdays: [1, 2, 3, 4, 5],
  slots: [{ label: "09:00 AM", enabled: true, capacity: 1 }],
  blackoutDates: [],
  ...overrides,
});

const mockRoomIds = () => {
  roomFind.mockReturnValue({
    distinct: jest.fn().mockResolvedValue(["room-1", "room-2"]),
  });
};

const mockReservations = (rows = []) => {
  const normalizedRows = rows.map((row) => ({
    visitDate: "2026-05-05T09:00:00.000Z",
    roomId: "room-1",
    ...row,
  }));
  reservationFind.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(normalizedRows),
    }),
  });
};

describe("visitAvailability", () => {
  beforeEach(() => {
    visitAvailabilityFindOne.mockReset();
    visitAvailabilityCreate.mockReset();
    roomFind.mockReset();
    reservationFind.mockReset();
    visitAvailabilityFindOne.mockResolvedValue(buildSettings());
    mockRoomIds();
    mockReservations();
  });

  test("creates default branch settings when missing", async () => {
    visitAvailabilityFindOne.mockResolvedValue(null);
    visitAvailabilityCreate.mockResolvedValue(buildSettings());

    const settings = await getVisitAvailabilitySettings("gil-puyat");

    expect(visitAvailabilityCreate).toHaveBeenCalledWith({ branch: "gil-puyat" });
    expect(settings.branch).toBe("gil-puyat");
  });

  test("rejects same-day visit attempts", async () => {
    const result = await validateVisitSelection({
      branch: "gil-puyat",
      visitDate: "2026-05-04",
      visitTime: "09:00 AM",
      roomId: "room-1",
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VISIT_DATE_SAME_DAY");
  });

  test("rejects past visit attempts", async () => {
    const result = await validateVisitSelection({
      branch: "gil-puyat",
      visitDate: "2026-05-03",
      visitTime: "09:00 AM",
      roomId: "room-1",
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VISIT_DATE_IN_PAST");
  });

  test("rejects closed blackout dates", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ blackoutDates: [{ date: "2026-05-05", reason: "Staff training" }] }),
    );

    const result = await validateVisitSelection({
      branch: "gil-puyat",
      visitDate: "2026-05-05",
      visitTime: "09:00 AM",
      roomId: "room-1",
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VISIT_DATE_CLOSED");
    expect(result.error).toBe("Staff training");
  });

  test("treats canonical Monday-Friday settings as open weekdays only", () => {
    const settings = buildSettings({ enabledWeekdays: [1, 2, 3, 4, 5], weekdaySystem: "js-get-day" });
    const now = new Date("2026-05-04T08:00:00");

    expect(getDateClosureReason({ dateKey: "2026-05-08", settings, now })).toBeNull();
    expect(getDateClosureReason({ dateKey: "2026-05-09", settings, now })?.code).toBe("VISIT_DATE_CLOSED");
    expect(getDateClosureReason({ dateKey: "2026-05-10", settings, now })?.code).toBe("VISIT_DATE_CLOSED");
    expect(getDateClosureReason({ dateKey: "2026-05-11", settings, now })).toBeNull();
  });

  test("interprets legacy Monday-zero default as Monday-Friday", () => {
    const settings = buildSettings({ enabledWeekdays: [0, 1, 2, 3, 4], weekdaySystem: undefined });
    const now = new Date("2026-05-04T08:00:00");

    expect(serializeVisitAvailabilitySettings(settings).enabledWeekdays).toEqual([1, 2, 3, 4, 5]);
    expect(getDateClosureReason({ dateKey: "2026-05-08", settings, now })).toBeNull();
    expect(getDateClosureReason({ dateKey: "2026-05-09", settings, now })?.code).toBe("VISIT_DATE_CLOSED");
    expect(getDateClosureReason({ dateKey: "2026-05-10", settings, now })?.code).toBe("VISIT_DATE_CLOSED");
  });

  test("builds applicant availability with weekends closed for Monday-Friday rules", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ enabledWeekdays: [1, 2, 3, 4, 5], weekdaySystem: "js-get-day" }),
    );

    const result = await buildVisitAvailability({
      branch: "gil-puyat",
      from: "2026-05-08",
      days: 4,
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.dates.map((date) => [date.date, date.available])).toEqual([
      ["2026-05-08", true],
      ["2026-05-09", false],
      ["2026-05-10", false],
      ["2026-05-11", true],
    ]);
  });

  test("deducts active reservations from returned slot remaining counts", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ slots: [{ label: "09:00 AM", enabled: true, capacity: 5 }] }),
    );
    mockReservations([{ visitTime: "09:00 AM" }]);

    const result = await buildVisitAvailability({
      branch: "gil-puyat",
      from: "2026-05-05",
      days: 1,
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.dates[0].slots[0]).toEqual(
      expect.objectContaining({
        count: 1,
        capacity: 5,
        remaining: 4,
        available: true,
      }),
    );
  });

  test("marks full slots unavailable in returned availability", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ slots: [{ label: "09:00 AM", enabled: true, capacity: 2 }] }),
    );
    mockReservations([{ visitTime: "09:00 AM" }, { visitTime: "09:00 AM" }]);

    const result = await buildVisitAvailability({
      branch: "gil-puyat",
      from: "2026-05-05",
      days: 1,
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.dates[0].slots[0]).toEqual(
      expect.objectContaining({
        count: 2,
        remaining: 0,
        available: false,
        disabledCode: "VISIT_CAPACITY_REACHED",
      }),
    );
  });

  test("rejects configured capacity when slot is full", async () => {
    mockReservations([{ visitTime: "09:00 AM" }]);

    const result = await validateVisitSelection({
      branch: "gil-puyat",
      visitDate: "2026-05-05",
      visitTime: "09:00 AM",
      roomId: "room-1",
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VISIT_CAPACITY_REACHED");
  });

  test("rejects room-slot conflicts after capacity allows the slot", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ slots: [{ label: "09:00 AM", enabled: true, capacity: 2 }] }),
    );
    reservationFind
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ visitTime: "09:00 AM" }]),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ visitTime: "09:00 AM" }]),
        }),
      });

    const result = await validateVisitSelection({
      branch: "gil-puyat",
      visitDate: "2026-05-05",
      visitTime: "09:00 AM",
      roomId: "room-1",
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VISIT_SLOT_CONFLICT");
  });

  test("does not deduct rejected or cancelled visit schedules from returned slot remaining counts", async () => {
    visitAvailabilityFindOne.mockResolvedValue(
      buildSettings({ slots: [{ label: "09:00 AM", enabled: true, capacity: 5 }] }),
    );

    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const result = await buildVisitAvailability({
      branch: "gil-puyat",
      from: "2026-05-05",
      days: 1,
      now: new Date("2026-05-04T08:00:00"),
    });

    expect(result.dates[0].slots[0]).toEqual(
      expect.objectContaining({
        count: 0,
        capacity: 5,
        remaining: 5,
        available: true,
      }),
    );
    expect(reservationFind).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleRejected: { $ne: true },
        visitStatus: { $nin: ["rejected", "cancelled", "visit_cancelled", "no_show"] },
      }),
    );
  });
});

describe("resolveSlotsForDay", () => {
  const baseSlots = [
    { label: "08:00 AM", enabled: true, capacity: 5 },
    { label: "09:00 AM", enabled: true, capacity: 5 },
    { label: "01:00 PM", enabled: false, capacity: 5 }, // globally off
  ];

  test("returns global defaults unchanged when dayOverrides is empty", () => {
    const result = resolveSlotsForDay(baseSlots, {}, 3); // Wednesday
    expect(result).toEqual(baseSlots);
  });

  test("applies per-day disable override for the matching weekday", () => {
    // Wednesday (3): 09:00 AM is off
    const overrides = { 3: { "09:00 AM": { enabled: false } } };
    const result = resolveSlotsForDay(baseSlots, overrides, 3);
    const slot = result.find((s) => s.label === "09:00 AM");
    expect(slot.enabled).toBe(false);
    // Other slots are unaffected
    expect(result.find((s) => s.label === "08:00 AM").enabled).toBe(true);
  });

  test("per-day override does NOT apply to other weekdays", () => {
    // Override is Wednesday-only; checking Tuesday (2)
    const overrides = { 3: { "09:00 AM": { enabled: false } } };
    const result = resolveSlotsForDay(baseSlots, overrides, 2); // Tuesday
    expect(result.find((s) => s.label === "09:00 AM").enabled).toBe(true);
  });

  test("per-day override can enable a slot specifically for a given weekday", () => {
    // 01:00 PM is globally disabled; override enables it for Wednesday (3)
    const overrides = { 3: { "01:00 PM": { enabled: true } } };
    const result = resolveSlotsForDay(baseSlots, overrides, 3);
    expect(result.find((s) => s.label === "01:00 PM").enabled).toBe(true);
  });

  test("accepts string weekday keys from MongoDB Mixed type", () => {
    // MongoDB may serialize map keys as strings
    const overrides = { "3": { "09:00 AM": { enabled: false } } };
    const result = resolveSlotsForDay(baseSlots, overrides, 3);
    expect(result.find((s) => s.label === "09:00 AM").enabled).toBe(false);
  });

  test("isolates per-day capacity overrides to the specified weekday", () => {
    // 08:00 AM capacity set to 10 for Tuesday (2) only
    const overrides = { 2: { "08:00 AM": { capacity: 10 } } };
    const tuesday = resolveSlotsForDay(baseSlots, overrides, 2);
    const monday = resolveSlotsForDay(baseSlots, overrides, 1);

    expect(tuesday.find((s) => s.label === "08:00 AM").capacity).toBe(10);
    expect(monday.find((s) => s.label === "08:00 AM").capacity).toBe(5);
  });
});
