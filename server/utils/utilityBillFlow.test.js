import { beforeEach, describe, expect, jest, test } from "@jest/globals";

let storedBills = [];
let activeReservation = null;

class FakeBill {
  constructor(payload = {}) {
    Object.assign(this, payload);
    this._id = payload._id || `bill-${storedBills.length + 1}`;
    this.save = jest.fn(async () => {
      if (!storedBills.some((bill) => String(bill._id) === String(this._id))) {
        storedBills.push(this);
      }
      return this;
    });
  }
}

const datesMatch = (left, right) => {
  if (!left || !right) return left === right;
  return new Date(left).getTime() === new Date(right).getTime();
};

FakeBill.findOne = jest.fn(async (query = {}) =>
  storedBills.find(
    (bill) =>
      String(bill.userId) === String(query.userId) &&
      String(bill.reservationId) === String(query.reservationId) &&
      datesMatch(bill.billingMonth, query.billingMonth) &&
      bill.isArchived !== true,
  ) || null,
);
FakeBill.countDocuments = jest.fn(async () => 0);
FakeBill.populate = jest.fn(async (bills) => bills);

const reservationFindOne = jest.fn(() => ({
  sort: jest.fn(async () => activeReservation),
}));

await jest.unstable_mockModule("../models/index.js", () => ({
  Bill: FakeBill,
  Reservation: {
    findOne: reservationFindOne,
  },
  Room: {
    findById: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

await jest.unstable_mockModule("../config/email.js", () => ({
  sendBillGeneratedEmail: jest.fn(),
  sendUtilityChargeAvailableEmail: jest.fn(),
}));

await jest.unstable_mockModule("./notificationService.js", () => ({
  notify: {
    billGenerated: jest.fn(),
    utilityChargeAvailable: jest.fn(),
  },
}));

await jest.unstable_mockModule("./pdfGenerator.js", () => ({
  generateBillPdf: jest.fn(),
}));

await jest.unstable_mockModule("./lifecycleNaming.js", () => ({
  CURRENT_RESIDENT_STATUS_QUERY: ["moveIn", "active"],
  readMoveInDate: (reservation) => reservation?.moveInDate || null,
}));

const { upsertDraftBillsForUtility } = await import("./utilityBillFlow.js");

describe("upsertDraftBillsForUtility", () => {
  beforeEach(() => {
    storedBills = [];
    activeReservation = {
      _id: "reservation-1",
      userId: "tenant-1",
      status: "moveIn",
      moveInDate: new Date("2026-03-05T00:00:00.000Z"),
      paymentStatus: "unpaid",
    };
    FakeBill.findOne.mockClear();
    FakeBill.countDocuments.mockClear();
    FakeBill.populate.mockClear();
    reservationFindOne.mockClear();
  });

  test("merges an electricity close into the existing finalized-water draft bill for the same tenant cycle", async () => {
    const room = {
      _id: "room-1",
      branch: "gil-puyat",
    };
    const waterPeriod = {
      _id: "water-period-1",
      startDate: new Date("2026-04-15T00:00:00.000Z"),
      endDate: new Date("2026-05-15T00:00:00.000Z"),
    };
    const electricityPeriod = {
      _id: "electricity-period-1",
      startDate: new Date("2026-04-15T00:00:00.000Z"),
      endDate: new Date("2026-05-15T00:00:00.000Z"),
    };

    const waterSummaries = await upsertDraftBillsForUtility({
      period: waterPeriod,
      room,
      utilityType: "water",
      tenantSummaries: [
        {
          tenantId: "tenant-1",
          tenantName: "Ana Tenant",
          billAmount: 300,
        },
      ],
    });

    expect(storedBills).toHaveLength(1);
    expect(storedBills[0].charges).toMatchObject({
      electricity: 0,
      water: 300,
    });
    expect(storedBills[0].utilityDispatch.water).toMatchObject({
      state: "draft",
      periodId: "water-period-1",
      amount: 300,
    });

    const electricitySummaries = await upsertDraftBillsForUtility({
      period: electricityPeriod,
      room,
      utilityType: "electricity",
      tenantSummaries: [
        {
          tenantId: "tenant-1",
          tenantName: "Ana Tenant",
          billAmount: 900,
        },
      ],
    });

    expect(storedBills).toHaveLength(1);
    expect(electricitySummaries[0].billId).toBe(waterSummaries[0].billId);
    expect(storedBills[0].charges).toMatchObject({
      electricity: 900,
      water: 300,
    });
    expect(storedBills[0].utilityDispatch).toMatchObject({
      electricity: {
        state: "draft",
        periodId: "electricity-period-1",
        amount: 900,
      },
      water: {
        state: "draft",
        periodId: "water-period-1",
        amount: 300,
      },
    });
  });
});
