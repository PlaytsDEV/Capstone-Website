import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockRoomFindById = jest.fn();
const mockReservationFind = jest.fn();
const mockWaterRecordFindById = jest.fn();
const mockUpsertDraftBillsForUtility = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  Reservation: {
    find: mockReservationFind,
  },
  Room: {
    findById: mockRoomFindById,
  },
  WaterBillingRecord: Object.assign(jest.fn(), {
    findById: mockWaterRecordFindById,
  }),
}));

await jest.unstable_mockModule("./utilityBillFlow.js", () => ({
  upsertDraftBillsForUtility: mockUpsertDraftBillsForUtility,
}));

const { applyWaterRecordToDraftBills } = await import("./waterBilling.js");

function makeReservationQuery(reservations) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(reservations),
  };
}

describe("applyWaterRecordToDraftBills", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("preserves finalized tenant shares when no overlapping reservations remain", async () => {
    const existingShares = [
      {
        tenantId: "tenant-1",
        reservationId: "reservation-1",
        tenantName: "Ava Tenant",
        shareAmount: 300,
        billId: "bill-1",
      },
    ];
    const waterRecord = {
      roomId: "room-1",
      status: "finalized",
      cycleStart: new Date("2026-03-15T00:00:00.000Z"),
      cycleEnd: new Date("2026-04-15T00:00:00.000Z"),
      finalAmount: 300,
      tenantShares: [...existingShares],
      save: jest.fn(),
    };

    mockRoomFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "room-1",
        type: "private",
      }),
    });
    mockReservationFind.mockReturnValue(makeReservationQuery([]));
    mockWaterRecordFindById.mockResolvedValue(waterRecord);

    const result = await applyWaterRecordToDraftBills("water-1");

    expect(result).toEqual({
      applied: false,
      appliedBillCount: 0,
      reason: "no-overlapping-reservations",
    });
    expect(waterRecord.tenantShares).toEqual(existingShares);
    expect(waterRecord.save).not.toHaveBeenCalled();
  });

  test("syncs finalized water charges into draft bills without waiting for electricity", async () => {
    const waterRecord = {
      _id: "water-2",
      roomId: "room-2",
      status: "finalized",
      cycleStart: new Date("2026-03-15T00:00:00.000Z"),
      cycleEnd: new Date("2026-04-15T00:00:00.000Z"),
      previousReading: 100,
      currentReading: 120,
      usage: 20,
      ratePerUnit: 30,
      finalAmount: 600,
      branch: "gil-puyat",
      tenantShares: [
        {
          tenantId: "tenant-2",
          reservationId: "reservation-2",
          tenantName: "Bea Tenant",
          shareAmount: 600,
          billId: null,
        },
      ],
      save: jest.fn(),
    };

    mockRoomFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "room-2",
        type: "private",
        branch: "gil-puyat",
      }),
    });
    mockReservationFind.mockReturnValue(
      makeReservationQuery([
        {
          _id: "reservation-2",
          userId: { _id: "tenant-2", firstName: "Bea", lastName: "Tenant" },
        },
      ]),
    );
    mockWaterRecordFindById.mockResolvedValue(waterRecord);
    mockUpsertDraftBillsForUtility.mockResolvedValue([
      {
        tenantId: "tenant-2",
        tenantName: "Bea Tenant",
        billAmount: 600,
        billId: "bill-water-2",
      },
    ]);

    const result = await applyWaterRecordToDraftBills("water-2");

    expect(mockUpsertDraftBillsForUtility).toHaveBeenCalledWith(
      expect.objectContaining({
        utilityType: "water",
      }),
    );
    expect(result).toEqual({
      applied: true,
      appliedBillCount: 1,
      periodId: "water-2",
    });
    expect(waterRecord.tenantShares[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-2",
        reservationId: "reservation-2",
        billId: "bill-water-2",
      }),
    );
    expect(waterRecord.save).toHaveBeenCalled();
  });
});
