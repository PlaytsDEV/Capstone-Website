import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const billFindById = jest.fn();
const reservationFindById = jest.fn();
const roomFindById = jest.fn();
const stayFindOne = jest.fn();
const userFindById = jest.fn();
const createMilestoneSubInvoices = jest.fn();
const auditLog = jest.fn();

await jest.unstable_mockModule("../../models/index.js", () => ({
  Bill: { findById: billFindById },
  Reservation: { findById: reservationFindById },
  Room: { findById: roomFindById },
  Stay: { findOne: stayFindOne },
  User: { findById: userFindById },
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: auditLog },
}));
await jest.unstable_mockModule("../../utils/reservationHelpers.js", () => ({
  checkBranchAccess: (res, branchFilter, targetBranch) =>
    branchFilter && branchFilter !== targetBranch
      ? res.status(403).json({ error: "Access denied", code: "BRANCH_ACCESS_DENIED" })
      : null,
}));
await jest.unstable_mockModule("./_helpers.js", () => ({
  getAdminInfo: jest.fn(), fetchBills: jest.fn(), RoomBill: {},
  loadRentReservationForAdmin: jest.fn(), buildRentBillDraft: jest.fn(),
  formatRentBillPreview: jest.fn(), finalizeRentBill: jest.fn(), formatBill: jest.fn(),
  summarizeRentTenantRows: jest.fn(), formatActiveRentTenant: jest.fn(),
  resolveRentCycleForBillingMonth: jest.fn(), buildRentDuplicateFilter: jest.fn(),
  parseRequiredDate: jest.fn(), suggestRent: jest.fn(), getReservationRecurringFees: jest.fn(),
  readMoveInDate: jest.fn(), CURRENT_RESIDENT_STATUS_QUERY: [],
  getReservationBillingContext: jest.fn(), computeWaterShare: jest.fn(), r2: jest.fn(),
  roundMoney: jest.fn(), syncBillAmounts: jest.fn(), getRoomPublishState: jest.fn(),
  buildPublishResultFromPeriod: jest.fn(),
}));
await jest.unstable_mockModule("../../utils/utilityBillFlow.js", () => ({
  sendDraftUtilityBills: jest.fn(),
}));
await jest.unstable_mockModule("../../services/milestoneInvoiceService.js", () => ({
  createMilestoneSubInvoices,
}));
await jest.unstable_mockModule("../../services/penaltyEngineService.js", () => ({
  executeLatePenaltyCron: jest.fn(),
}));
await jest.unstable_mockModule("../../services/billingPriorityService.js", () => ({
  getTenantBillsInPriorityOrder: jest.fn(),
}));

const { createMilestoneArrangementAction } = await import("./rentBillingController.js");

const ids = {
  bill: "507f1f77bcf86cd799439031",
  reservation: "507f1f77bcf86cd799439032",
  room: "507f1f77bcf86cd799439033",
  tenant: "507f1f77bcf86cd799439034",
  stay: "507f1f77bcf86cd799439035",
};

const configure = (branch) => {
  const room = { _id: ids.room, branch, isArchived: false };
  const bill = {
    _id: ids.bill, reservationId: ids.reservation, roomId: ids.room,
    userId: ids.tenant, branch, totalAmount: 5000, remainingAmount: 5000,
    isArchived: false,
    toObject() { return { ...this }; },
  };
  const reservation = { _id: ids.reservation, userId: ids.tenant, roomId: room };
  const stay = { _id: ids.stay, reservationId: ids.reservation, tenantId: ids.tenant, roomId: room, branch };
  const tenant = { _id: ids.tenant, branch };
  billFindById.mockResolvedValue(bill);
  reservationFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(reservation) });
  roomFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(room) });
  stayFindOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(stay) });
  userFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(tenant) });
  return { bill };
};

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (branch) => ({
  id: "request-3",
  body: {
    parentBillId: ids.bill,
    reason: "Approved arrangement",
    milestones: [
      { amount: 2500, dueDate: "2026-09-01" },
      { amount: 2500, dueDate: "2026-10-01" },
    ],
  },
  user: { uid: "firebase-admin" },
  authUser: { role: "branch_admin", branch },
  branchFilter: branch,
  isOwner: false,
});

describe("milestone arrangement branch isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
  });

  test.each([
    ["gil-puyat", "guadalupe"],
    ["guadalupe", "gil-puyat"],
  ])("denies a correctly-permissioned %s admin on a %s Bill before financial mutation", async (actorBranch, targetBranch) => {
    configure(targetBranch);
    const res = response();
    await createMilestoneArrangementAction(request(actorBranch), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    expect(createMilestoneSubInvoices).not.toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.branch_action_denied" }));
  });

  test("allows same-branch creation and emits a complete success audit", async () => {
    configure("gil-puyat");
    createMilestoneSubInvoices.mockResolvedValue([{ _id: "sub-1" }, { _id: "sub-2" }]);
    const res = response();
    await createMilestoneArrangementAction(request("gil-puyat"), res, jest.fn());
    expect(res.statusCode).toBe(200);
    expect(createMilestoneSubInvoices).toHaveBeenCalledWith(
      ids.bill,
      expect.any(Array),
      "firebase-admin",
      { expectedBranch: "gil-puyat" },
    );
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "billing.milestone_arrangement.created",
      metadata: expect.objectContaining({
        branchAccessResult: "allowed",
        financial: expect.objectContaining({ originalBillAmount: 5000, arrangementAmount: 5000 }),
      }),
    }));
  });

  test("fails closed when linked Bill and Room branches conflict", async () => {
    configure("gil-puyat");
    roomFindById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: ids.room, branch: "guadalupe", isArchived: false }) });
    const res = response();
    await createMilestoneArrangementAction(request("gil-puyat"), res, jest.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("BRANCH_RELATIONSHIP_INCONSISTENT");
    expect(createMilestoneSubInvoices).not.toHaveBeenCalled();
  });
});
