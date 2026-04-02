import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockUserFindOne = jest.fn();
const mockRoomFindById = jest.fn();
const mockWaterFindById = jest.fn();
const mockWaterFindOne = jest.fn();
const mockBuildWaterCycle = jest.fn();
const mockBuildWaterTenantSnapshot = jest.fn();
const mockComputeWaterUsage = jest.fn();
const mockComputeWaterAmount = jest.fn();
const mockGetLatestWaterRecordForRoom = jest.fn();
const mockIsWaterBillableRoomType = jest.fn();
const mockValidateWaterCycleWindow = jest.fn();
const mockApplyWaterRecordToDraftBills = jest.fn();
const mockRoundMoney = jest.fn((value) => value);
const mockLogBillingAudit = jest.fn();
const mockGetWaterRecordDiagnostics = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  Bill: {},
  Reservation: {},
  Room: {
    findById: mockRoomFindById,
  },
  User: {
    findOne: mockUserFindOne,
  },
  WaterBillingRecord: Object.assign(
    jest.fn(),
    {
      findById: mockWaterFindById,
      findOne: mockWaterFindOne,
    },
  ),
}));

await jest.unstable_mockModule("../utils/waterBilling.js", () => ({
  applyWaterRecordToDraftBills: mockApplyWaterRecordToDraftBills,
  buildWaterCycle: mockBuildWaterCycle,
  buildWaterTenantSnapshot: mockBuildWaterTenantSnapshot,
  computeWaterAmount: mockComputeWaterAmount,
  computeWaterUsage: mockComputeWaterUsage,
  getLatestWaterRecordForRoom: mockGetLatestWaterRecordForRoom,
  isWaterBillableRoomType: mockIsWaterBillableRoomType,
  validateWaterCycleWindow: mockValidateWaterCycleWindow,
}));

await jest.unstable_mockModule("../utils/billingPolicy.js", () => ({
  roundMoney: mockRoundMoney,
}));

await jest.unstable_mockModule("../utils/billingAudit.js", () => ({
  logBillingAudit: mockLogBillingAudit,
}));

await jest.unstable_mockModule("../utils/roomLabel.js", () => ({
  getRoomLabel: jest.fn(() => "Room 101"),
}));

await jest.unstable_mockModule("../utils/utilityDiagnostics.js", () => ({
  getWaterRecordDiagnostics: mockGetWaterRecordDiagnostics,
}));

const {
  createWaterRecord,
  deleteWaterRecord,
  finalizeWaterRecord,
} = await import("./waterBillingController.js");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("waterBillingController", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUserFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "admin-1",
        role: "admin",
        branch: "gil-puyat",
        email: "admin@example.com",
        firstName: "Ada",
        lastName: "Min",
      }),
    });

    mockGetWaterRecordDiagnostics.mockResolvedValue(null);
    mockRoundMoney.mockImplementation((value) => value);
  });

  test("createWaterRecord rejects non-billable room types", async () => {
    const room = {
      _id: "room-1",
      branch: "gil-puyat",
      type: "quadruple-sharing",
    };
    const req = {
      user: { uid: "firebase-admin", email: "admin@example.com" },
      body: {
        roomId: "room-1",
        cycleEnd: "2026-04-15",
        previousReading: 100,
        currentReading: 150,
        ratePerUnit: 30,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    mockRoomFindById.mockResolvedValue(room);
    mockIsWaterBillableRoomType.mockReturnValue(false);

    await createWaterRecord(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Water billing is not enabled for this room type.",
    });
    expect(mockGetLatestWaterRecordForRoom).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("createWaterRecord rejects when a draft already exists for the room", async () => {
    const room = {
      _id: "room-1",
      branch: "gil-puyat",
      type: "private",
    };
    const req = {
      user: { uid: "firebase-admin", email: "admin@example.com" },
      body: {
        roomId: "room-1",
        cycleEnd: "2026-04-15",
        previousReading: 100,
        currentReading: 150,
        ratePerUnit: 30,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    mockRoomFindById.mockResolvedValue(room);
    mockIsWaterBillableRoomType.mockReturnValue(true);
    mockWaterFindOne.mockResolvedValue({
      _id: "draft-1",
      roomId: "room-1",
      status: "draft",
      isArchived: false,
    });

    await createWaterRecord(req, res, next);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "Finish or delete the existing draft water billing period before starting a new one.",
    });
    expect(mockGetLatestWaterRecordForRoom).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("finalizeWaterRecord rejects records that are already finalized", async () => {
    const req = {
      user: { uid: "firebase-admin", email: "admin@example.com" },
      params: { id: "water-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    mockWaterFindById.mockResolvedValue({
      _id: "water-1",
      branch: "gil-puyat",
      roomId: "room-1",
      status: "finalized",
      isArchived: false,
    });

    await finalizeWaterRecord(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Only draft water records can be finalized",
    });
    expect(mockApplyWaterRecordToDraftBills).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("deleteWaterRecord rejects records that are already finalized", async () => {
    const req = {
      user: { uid: "firebase-admin", email: "admin@example.com" },
      params: { id: "water-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    mockWaterFindById.mockResolvedValue({
      _id: "water-1",
      branch: "gil-puyat",
      roomId: "room-1",
      status: "finalized",
      isArchived: false,
    });

    await deleteWaterRecord(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Only draft water records can be deleted",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("deleteWaterRecord archives a draft record", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const req = {
      user: { uid: "firebase-admin", email: "admin@example.com" },
      params: { id: "water-1" },
    };
    const res = createResponse();
    const next = jest.fn();

    mockWaterFindById.mockResolvedValue({
      _id: "water-1",
      branch: "gil-puyat",
      roomId: "room-1",
      status: "draft",
      isArchived: false,
      cycleStart: new Date("2026-03-15"),
      cycleEnd: new Date("2026-04-15"),
      save,
    });

    await deleteWaterRecord(req, res, next);

    expect(save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      id: "water-1",
    });
    expect(mockLogBillingAudit).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
