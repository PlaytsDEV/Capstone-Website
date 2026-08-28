import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const getAdminInfo = jest.fn();
const loadRentReservationForAdmin = jest.fn();
const buildRentBillDraft = jest.fn();
const finalizeRentBill = jest.fn();
const formatBill = jest.fn();
const logBillingAudit = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Bill: { find: jest.fn(), findOne: jest.fn() },
  Reservation: { find: jest.fn(), findOne: jest.fn() },
  Room: { find: jest.fn(), findOne: jest.fn() },
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

await jest.unstable_mockModule("../../utils/billingAudit.js", () => ({
  logBillingAudit,
}));

await jest.unstable_mockModule("../../utils/utilityBillFlow.js", () => ({
  sendDraftUtilityBills: jest.fn(),
}));

await jest.unstable_mockModule("../../services/milestoneInvoiceService.js", () => ({
  createMilestoneSubInvoices: jest.fn(),
}));

await jest.unstable_mockModule("../../services/penaltyEngineService.js", () => ({
  executeLatePenaltyCron: jest.fn(),
}));

await jest.unstable_mockModule("../../services/billingPriorityService.js", () => ({
  getTenantBillsInPriorityOrder: jest.fn(),
}));

await jest.unstable_mockModule("./_helpers.js", () => ({
  getAdminInfo,
  fetchBills: jest.fn(),
  RoomBill: class {},
  loadRentReservationForAdmin,
  buildRentBillDraft,
  formatRentBillPreview: jest.fn(),
  finalizeRentBill,
  formatBill,
  summarizeRentTenantRows: jest.fn(),
  formatActiveRentTenant: jest.fn(),
  resolveRentCycleForBillingMonth: jest.fn(),
  buildRentDuplicateFilter: jest.fn(),
  parseRequiredDate: jest.fn(),
  suggestRent: jest.fn(),
  getReservationRecurringFees: jest.fn(),
  readMoveInDate: jest.fn(),
  CURRENT_RESIDENT_STATUS_QUERY: ["checked-in", "active"],
  getReservationBillingContext: jest.fn(),
  computeWaterShare: jest.fn(),
  r2: jest.fn(),
  roundMoney: jest.fn(),
  syncBillAmounts: jest.fn(),
  getRoomPublishState: jest.fn(),
  buildPublishResultFromPeriod: jest.fn(),
}));

const { generateBatchRentBills } = await import("./rentBillingController.js");

function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("generateBatchRentBills", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdminInfo.mockResolvedValue({
      _id: "admin-1",
      role: "admin",
      branch: "gil-puyat",
      isOwner: false,
    });
  });

  test("validates missing or empty reservationIds returns 400", async () => {
    const res1 = createMockResponse();
    const req1 = { body: {} };
    await generateBatchRentBills(req1, res1, jest.fn());
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.json).toHaveBeenCalledWith({
      error: "reservationIds array is required and cannot be empty.",
    });

    const res2 = createMockResponse();
    const req2 = { body: { reservationIds: [] } };
    await generateBatchRentBills(req2, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith({
      error: "reservationIds array is required and cannot be empty.",
    });

    const res3 = createMockResponse();
    const req3 = { body: { reservationIds: "not-an-array" } };
    await generateBatchRentBills(req3, res3, jest.fn());
    expect(res3.status).toHaveBeenCalledWith(400);
    expect(res3.json).toHaveBeenCalledWith({
      error: "reservationIds array is required and cannot be empty.",
    });
  });

  test("validates missing branch returns 400", async () => {
    getAdminInfo.mockResolvedValue({
      _id: "owner-1",
      role: "owner",
      branch: null,
      isOwner: true,
    });

    const res = createMockResponse();
    const req = {
      body: {
        reservationIds: ["res-1"],
        billingMonth: "2026-08",
      },
    };

    await generateBatchRentBills(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Branch is required.",
    });
  });

  test("successfully generates batch rent bills and records email warnings", async () => {
    const mockReservation1 = {
      _id: "res-1",
      userId: { firstName: "Juan", lastName: "Dela Cruz", email: "juan@example.com" },
      roomId: { _id: "room-1", name: "Room 101", branch: "gil-puyat" },
    };
    const mockReservation2 = {
      _id: "res-2",
      userId: { firstName: "Maria", lastName: "Santos", email: "maria@example.com" },
      roomId: { _id: "room-2", name: "Room 102", branch: "gil-puyat" },
    };

    loadRentReservationForAdmin
      .mockResolvedValueOnce(mockReservation1)
      .mockResolvedValueOnce(mockReservation2);

    buildRentBillDraft
      .mockResolvedValueOnce({ bill: { _id: "bill-1", totalAmount: 5000 } })
      .mockResolvedValueOnce({ bill: { _id: "bill-2", totalAmount: 6000 } });

    finalizeRentBill
      .mockResolvedValueOnce({
        bill: { _id: "bill-1", totalAmount: 5000 },
        delivery: { email: { status: "sent" }, pdf: { status: "generated" } },
      })
      .mockResolvedValueOnce({
        bill: { _id: "bill-2", totalAmount: 6000 },
        delivery: { email: { status: "failed" }, pdf: { status: "generated" } },
      });

    formatBill
      .mockReturnValueOnce({ id: "bill-1", totalAmount: 5000 })
      .mockReturnValueOnce({ id: "bill-2", totalAmount: 6000 });

    const res = createMockResponse();
    const req = {
      body: {
        reservationIds: ["res-1", "res-2"],
        billingMonth: "2026-08",
        dueDate: "2026-08-15",
      },
    };

    await generateBatchRentBills(req, res, jest.fn());

    expect(loadRentReservationForAdmin).toHaveBeenCalledTimes(2);
    expect(buildRentBillDraft).toHaveBeenCalledWith({
      reservation: mockReservation1,
      branch: "gil-puyat",
      billingMonth: "2026-08",
      dueDate: "2026-08-15",
      rentAmount: null,
      notes: "Generated through multi-select rent batch billing.",
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 2,
        generated: 2,
        failed: 0,
        errors: [],
      },
      bills: [
        { id: "bill-1", totalAmount: 5000 },
        { id: "bill-2", totalAmount: 6000 },
      ],
      warnings: ["Maria Santos: email notification failed."],
    });

    expect(logBillingAudit).toHaveBeenCalled();
  });

  test("isolates errors per reservation and continues processing remainder", async () => {
    const mockReservation2 = {
      _id: "res-2",
      userId: { firstName: "Pedro", lastName: "Penduko", email: "pedro@example.com" },
      roomId: { _id: "room-2", name: "Room 102", branch: "gil-puyat" },
    };

    loadRentReservationForAdmin
      .mockRejectedValueOnce(new Error("Reservation not found"))
      .mockResolvedValueOnce(mockReservation2);

    buildRentBillDraft.mockResolvedValueOnce({ bill: { _id: "bill-2", totalAmount: 4500 } });

    finalizeRentBill.mockResolvedValueOnce({
      bill: { _id: "bill-2", totalAmount: 4500 },
      delivery: { email: { status: "sent" } },
    });

    formatBill.mockReturnValueOnce({ id: "bill-2", totalAmount: 4500 });

    const res = createMockResponse();
    const req = {
      body: {
        reservationIds: ["res-fail", "res-2"],
        billingMonth: "2026-08",
      },
    };

    await generateBatchRentBills(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 2,
        generated: 1,
        failed: 1,
        errors: [{ reservationId: "res-fail", error: "Reservation not found" }],
      },
      bills: [{ id: "bill-2", totalAmount: 4500 }],
      warnings: [],
    });
  });

  test("processes large batches in chunks of 10 with full concurrency and error isolation", async () => {
    const reservationIds = [
      "res-1", "res-2", "res-3", "res-4", "res-5",
      "res-6", "res-7", "res-8", "res-9", "res-10",
      "res-11", "res-fail",
    ];

    loadRentReservationForAdmin.mockImplementation(async ({ reservationId }) => {
      if (reservationId === "res-fail") {
        throw new Error("Tenant data corrupted");
      }
      return {
        _id: reservationId,
        userId: { firstName: "Tenant", lastName: reservationId, email: `${reservationId}@test.com` },
        roomId: { _id: `room-${reservationId}`, name: `Room ${reservationId}`, branch: "gil-puyat" },
      };
    });

    buildRentBillDraft.mockImplementation(async ({ reservation }) => ({
      bill: { _id: `bill-${reservation._id}`, totalAmount: 5000 },
    }));

    finalizeRentBill.mockImplementation(async ({ reservation }) => ({
      bill: { _id: `bill-${reservation._id}`, totalAmount: 5000 },
      delivery: { email: { status: "sent" }, pdf: { status: "generated" } },
    }));

    formatBill.mockImplementation((bill) => ({
      id: bill._id,
      totalAmount: bill.totalAmount,
    }));

    const res = createMockResponse();
    const req = {
      body: {
        reservationIds,
        billingMonth: "2026-08",
        dueDate: "2026-08-25",
      },
    };

    await generateBatchRentBills(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      summary: {
        total: 12,
        generated: 11,
        failed: 1,
        errors: [{ reservationId: "res-fail", error: "Tenant data corrupted" }],
      },
      bills: expect.arrayContaining([
        { id: "bill-res-1", totalAmount: 5000 },
        { id: "bill-res-11", totalAmount: 5000 },
      ]),
      warnings: [],
    });
  });
});
