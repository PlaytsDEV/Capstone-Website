import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const userFindById = jest.fn();
const userFindOne = jest.fn();
const billFindOne = jest.fn();
const roomFindById = jest.fn();
const getAdminInfo = jest.fn();
const loadRentBillForAdmin = jest.fn();
const deliverBillNotification = jest.fn();
const logBillingAudit = jest.fn();
const generateCanonicalBillReceiptPdf = jest.fn();
const isAdminRole = jest.fn();
const isOwnerRole = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Bill: { findOne: billFindOne },
  User: { findById: userFindById, findOne: userFindOne },
  Room: { findById: roomFindById },
  Reservation: { findById: jest.fn() },
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
  isAdminRole,
  isOwnerRole,
}));

await jest.unstable_mockModule("../../services/billPdfCache.js", () => ({
  isBillPdfStale: jest.fn(),
}));

await jest.unstable_mockModule("../../services/mobileBillingBridge.js", () => ({
  isMobileEffectivelyPaid: jest.fn(() => true),
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
  generateCanonicalBillReceiptPdf,
  SERVER_ROOT: "D:/test-server",
  BILL_PDF_ROOT: "D:/test-server/uploads/bills",
  isPathInsideBillingPdfRoot: jest.fn(() => true),
}));

const { downloadBillReceipt, sendRentBill } = await import("./billingReportController.js");

function queryResult(value) {
  return { select: jest.fn().mockResolvedValue(value) };
}

function leanQueryResult(value) {
  return { select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(value) })) };
}

function populatedQueryResult(value) {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return query;
}

function response() {
  return {
    status: jest.fn(function status() { return this; }),
    json: jest.fn(function json() { return this; }),
  };
}

describe("billing document authorization", () => {
  test("Tenant B cannot retrieve Tenant A's cached Receipt bytes", async () => {
    userFindOne.mockReturnValue(leanQueryResult({ _id: "tenant-b", role: "tenant", branch: "gil-puyat" }));
    billFindOne.mockReturnValue(populatedQueryResult({
      _id: "bill-a",
      userId: { _id: "tenant-a", firstName: "Ava" },
      branch: "gil-puyat",
      status: "paid",
      remainingAmount: 0,
      receiptPath: "uploads/bills/receipt-bill-a.pdf",
    }));
    isAdminRole.mockReturnValue(false);
    const res = response();

    await downloadBillReceipt(
      { params: { billId: "bill-a" }, user: { uid: "firebase-tenant-b" } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Access denied" });
    expect(generateCanonicalBillReceiptPdf).not.toHaveBeenCalled();
  });
});

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
