import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const noop = (_req, _res, next) => next?.();

const verifyToken = jest.fn(noop);
const verifyAdmin = jest.fn(noop);

const requirePermission = jest.fn((permission) => {
  const middleware = (_req, _res, next) => next?.();
  middleware.requiredPermission = permission;
  return middleware;
});

const createBillCheckout = jest.fn(noop);
const createDepositCheckout = jest.fn(noop);
const checkSessionStatus = jest.fn(noop);
const getPaymentsForBillController = jest.fn(noop);
const getPaymentHistory = jest.fn();
const getPaymentsForBill = jest.fn();
const userFindOne = jest.fn();
const reservationFind = jest.fn();
const readMoveInDate = jest.fn();

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  verifyToken,
  verifyAdmin,
}));

await jest.unstable_mockModule("../middleware/permissions.js", () => ({
  requirePermission,
}));

await jest.unstable_mockModule("../controllers/paymentController.js", () => ({
  createBillCheckout,
  createDepositCheckout,
  checkSessionStatus,
  getPaymentsForBill: getPaymentsForBillController,
  getAdminPaymentLedger: jest.fn(noop),
}));

await jest.unstable_mockModule("../models/Payment.js", () => ({
  default: {
    getPaymentHistory,
    getPaymentsForBill,
  },
}));

await jest.unstable_mockModule("../models/User.js", () => ({
  default: {
    findOne: userFindOne,
  },
}));

await jest.unstable_mockModule("../models/Reservation.js", () => ({
  default: {
    find: reservationFind,
  },
}));

await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  USER_ROLE_NAMES: Object.freeze(["applicant", "tenant", "branch_admin", "owner"]),
  CANONICAL_RESERVATION_STATUSES: Object.freeze(["pending", "visit_pending", "visit_approved", "payment_pending", "reserved", "moveIn", "moveOut", "cancelled", "archived"]),
  LEGACY_RESERVATION_STATUS_MAP: Object.freeze({}),
  ALLOWED_RESERVATION_STATUS_TRANSITIONS: Object.freeze({}),
  CANONICAL_UTILITY_EVENT_TYPES: Object.freeze(["moveIn", "moveOut", "regularBilling", "periodStart", "periodEnd", "manualAdjustment"]),
  LEGACY_UTILITY_EVENT_TYPE_MAP: Object.freeze({}),
  normalizeReservationStatus: (s) => s,
  reservationStatusesForQuery: (...s) => s.flat(),
  ACTIVE_OCCUPANCY_STATUS_QUERY: Object.freeze(["reserved", "moveIn"]),
  CURRENT_RESIDENT_STATUS_QUERY: Object.freeze(["moveIn"]),
  BILLABLE_RESERVATION_STATUS_QUERY: Object.freeze(["moveIn", "moveOut"]),
  ACTIVE_STAY_STATUS_QUERY: Object.freeze(["reserved", "moveIn"]),
  PAST_STAY_STATUS_QUERY: Object.freeze(["moveOut", "cancelled"]),
  isReservationStatus: () => false,
  hasReservationStatus: () => false,
  canTransitionReservationStatus: () => false,
  normalizeUtilityEventType: (v) => v,
  utilityEventTypesForQuery: (...v) => v.flat(),
  LIFECYCLE_UTILITY_EVENT_QUERY: Object.freeze([]),
  isUtilityEventType: () => false,
  hasUtilityEventType: () => false,
  readMoveInDate,
  readMoveOutDate: (v) => v?.moveOutDate ?? null,
  buildMoveInBeforeQuery: (d) => ({ moveInDate: { $lt: d } }),
  buildMoveOutAfterOrMissingQuery: (d) => ({}),
  ensureReservationDateAliases: (v) => v,
  normalizeReservationPayload: (p) => p,
  serializeReservation: (r) => r,
  serializeReservations: (rs) => rs,
  serializeUtilityReading: (r) => r,
  serializeUtilityReadings: (rs) => rs,
  serializeUtilityPeriod: (p) => p,
}));

const paymentRoutes = (await import("./paymentRoutes.js")).default;

function getRouteHandlers(router, path, method) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );
  return layer?.route?.stack?.map((entry) => entry.handle) || [];
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

describe("paymentRoutes", () => {
  beforeEach(() => {
    verifyToken.mockClear();
    verifyAdmin.mockClear();
    requirePermission.mockClear();
    createBillCheckout.mockClear();
    createDepositCheckout.mockClear();
    checkSessionStatus.mockClear();
    getPaymentsForBillController.mockClear();
    getPaymentHistory.mockReset();
    getPaymentsForBill.mockReset();
    userFindOne.mockReset();
    reservationFind.mockReset();
    readMoveInDate.mockReset();
  });

  test("history route returns tenant ledger entries for the authenticated user", async () => {
    const handlers = getRouteHandlers(paymentRoutes, "/history", "get");
    const historyHandler = handlers[handlers.length - 1];
    const payments = [
      {
        paymentId: "PAY-12345678",
        amount: 5000,
        method: "paymongo",
        source: "paymongo-webhook",
        externalPaymentId: "pay_123",
      },
    ];

    userFindOne.mockResolvedValue({ _id: "tenant_1" });
    getPaymentHistory.mockResolvedValue(payments);

    const req = { user: { uid: "firebase-1" }, query: { limit: "10" } };
    const res = createRes();

    await historyHandler(req, res);

    expect(userFindOne).toHaveBeenCalledWith({ firebaseUid: "firebase-1" });
    expect(getPaymentHistory).toHaveBeenCalledWith("tenant_1", { limit: 10 });
    expect(res.payload).toEqual({ success: true, data: payments });
  });

  test("bill-payments route returns payment ledger records for a specific bill", async () => {
    const handlers = getRouteHandlers(paymentRoutes, "/bill/:billId/payments", "get");
    const billPaymentsHandler = handlers[handlers.length - 1];

    const req = { params: { billId: "bill_1" } };
    const res = createRes();
    const next = jest.fn();

    await billPaymentsHandler(req, res, next);

    expect(getPaymentsForBillController).toHaveBeenCalledWith(req, res, next);
  });
});
