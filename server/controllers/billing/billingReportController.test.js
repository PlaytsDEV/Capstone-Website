import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const userFindById = jest.fn();
const roomFindById = jest.fn();
const getAdminInfo = jest.fn();
const loadRentBillForAdmin = jest.fn();
const deliverBillNotification = jest.fn();
const logBillingAudit = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Bill: {},
  User: { findById: userFindById },
  Room: { findById: roomFindById },
}));

await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

await jest.unstable_mockModule("../../utils/billingAudit.js", () => ({
  logBillingAudit,
}));

await jest.unstable_mockModule("../../utils/penaltyCalculator.js", () => ({
  computePenalty: jest.fn(),
  fetchPenaltySettings: jest.fn(),
}));

await jest.unstable_mockModule("../../utils/billingPolicy.js", () => ({
  syncBillAmounts: jest.fn(),
  resolveBillStatus: jest.fn(),
}));

await jest.unstable_mockModule("../../config/roles.js", () => ({
  isAdminRole: jest.fn(),
  isOwnerRole: jest.fn(),
}));

await jest.unstable_mockModule("../../services/billPdfCache.js", () => ({
  isBillPdfStale: jest.fn(),
}));

await jest.unstable_mockModule("./_helpers.js", () => ({
  getAdminInfo,
  loadRentBillForAdmin,
  loadBillForAdmin: jest.fn(),
  deliverBillNotification,
  deliverBillReminder: jest.fn(),
  canSendBillReminder: jest.fn(),
  formatBillReference: jest.fn(() => "BILL-001"),
  formatBill: jest.fn((bill) => ({ id: bill._id })),
  generateRentBillPdf: jest.fn(),
  SERVER_ROOT: "D:/test-server",
  BILL_PDF_ROOT: "D:/test-server/uploads/bills",
}));

const { sendRentBill } = await import("./billingReportController.js");

function queryResult(value) {
  return { select: jest.fn().mockResolvedValue(value) };
}

function response() {
  return {
    status: jest.fn(function status() { return this; }),
    json: jest.fn(function json() { return this; }),
  };
}

function buildBill(overrides = {}) {
  return {
    _id: "bill-release-1",
    userId: "tenant-1",
    roomId: "room-1",
    branch: "gil-puyat",
    issuedAt: null,
    save: jest.fn(async function save() { return this; }),
    populate: jest.fn(async function populate() { return this; }),
    ...overrides,
  };
}

describe("billingReportController canonical release notification ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdminInfo.mockResolvedValue({ isOwner: false, branch: "gil-puyat" });
    userFindById.mockReturnValue(queryResult({ _id: "tenant-1", email: "tenant@example.test" }));
    roomFindById.mockReturnValue(queryResult({ _id: "room-1", branch: "gil-puyat" }));
    deliverBillNotification.mockResolvedValue({
      email: { status: "sent" },
      notification: { status: "sent" },
    });
    logBillingAudit.mockResolvedValue(undefined);
  });

  test("persists the canonical release timestamp before delivering the tenant notification", async () => {
    const bill = buildBill();
    loadRentBillForAdmin.mockResolvedValue(bill);
    const res = response();
    const next = jest.fn();

    await sendRentBill(
      {
        params: { billId: bill._id },
        user: { uid: "firebase-admin" },
        branchFilter: "gil-puyat",
      },
      res,
      next,
    );

    expect(bill.save).toHaveBeenCalledTimes(1);
    expect(deliverBillNotification).toHaveBeenCalledWith(expect.objectContaining({
      bill,
      billType: "rent",
    }));
    expect(bill.save.mock.invocationCallOrder[0]).toBeLessThan(
      deliverBillNotification.mock.invocationCallOrder[0],
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  test("does not deliver a success notification when release persistence fails", async () => {
    const failure = new Error("bill release persistence failed");
    const bill = buildBill({ save: jest.fn().mockRejectedValue(failure) });
    loadRentBillForAdmin.mockResolvedValue(bill);
    const next = jest.fn();

    await sendRentBill(
      {
        params: { billId: bill._id },
        user: { uid: "firebase-admin" },
        branchFilter: "gil-puyat",
      },
      response(),
      next,
    );

    expect(next).toHaveBeenCalledWith(failure);
    expect(deliverBillNotification).not.toHaveBeenCalled();
  });
});
