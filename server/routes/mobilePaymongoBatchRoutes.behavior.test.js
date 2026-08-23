import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

const billFind = jest.fn();
const billFindOne = jest.fn();
const billUpdateMany = jest.fn();
const createCheckoutSession = jest.fn();
const getCheckoutSession = jest.fn();
const settlePaymongoBill = jest.fn();
const auditLog = jest.fn();
const readPaidPayments = jest.fn();

jest.unstable_mockModule("../models/index.js", () => ({
  Bill: {
    find: billFind,
    findOne: billFindOne,
    findById: jest.fn(),
    updateMany: billUpdateMany,
  },
}));
jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, _res, next) => {
    req.mobileTenant = { _id: "tenant-a" };
    next();
  },
}));
jest.unstable_mockModule("../config/paymongo.js", () => ({ createCheckoutSession, getCheckoutSession }));
jest.unstable_mockModule("../utils/billingPolicy.js", () => ({
  getVisibleBillSnapshot: (bill) => ({ status: bill.status, remainingAmount: bill.remainingAmount }),
  getBillRemainingAmount: (bill) => Number(bill.remainingAmount || 0),
}));
jest.unstable_mockModule("../utils/billSettlement.js", () => ({ settlePaymongoBill }));
jest.unstable_mockModule("../utils/paymongoPaymentMethod.js", () => ({
  readPaidPayments,
  readPaymentMethod: () => ({ rawPaymentType: "gcash" }),
  normalizeCheckoutStatusForClient: () => "paid",
}));
jest.unstable_mockModule("../config/publicUrls.js", () => ({
  getPublicUrlConfig: () => ({ publicApiUrl: "https://api.lilycrest.space" }),
}));
jest.unstable_mockModule("../services/mobileBillingBridge.js", () => ({ toMobileBill: (bill) => bill }));
jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: { log: auditLog } }));

const { default: routes } = await import("./mobilePaymongoRoutes.js");

const IDS = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];
const bills = [
  { _id: IDS[0], status: "unpaid", remainingAmount: 3000 },
  { _id: IDS[1], status: "overdue", remainingAmount: 1050 },
];

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/m", routes);
  app.use((error, _req, res, _next) => res.status(500).json({ detail: error.message }));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  billFind.mockReset();
  billFindOne.mockReset();
  billUpdateMany.mockReset().mockResolvedValue({ matchedCount: 2 });
  createCheckoutSession.mockReset().mockResolvedValue({ checkoutUrl: "https://checkout.test/session", sessionId: "cs_test" });
  getCheckoutSession.mockReset();
  settlePaymongoBill.mockReset().mockResolvedValue({ applied: true });
  auditLog.mockReset().mockResolvedValue(undefined);
  readPaidPayments.mockReset().mockReturnValue([]);
});

describe("mobile aggregate PayMongo checkout", () => {
  test("charges the exact sum of all selected canonical unpaid bills", async () => {
    billFind.mockResolvedValueOnce(bills);
    const response = await fetch(`${baseUrl}/api/m/paymongo/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: IDS }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total_amount).toBe(4050);
    expect(body.bill_count).toBe(2);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      amount: 4050,
      metadata: expect.objectContaining({
        type: "multi_bill",
        billIds: JSON.stringify(IDS),
        userId: "tenant-a",
        amountDue: "4050",
      }),
    }));
    expect(billUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tenant-a" }),
      expect.objectContaining({ $set: expect.objectContaining({ paymongoSessionId: "cs_test" }) }),
    );
  });

  test("fails closed when any selected bill is missing or belongs to another tenant", async () => {
    billFind.mockResolvedValueOnce([bills[0]]);
    const response = await fetch(`${baseUrl}/api/m/paymongo/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: IDS }),
    });
    expect(response.status).toBe(404);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test("rejects duplicate IDs and a balance that changed before checkout", async () => {
    const duplicateResponse = await fetch(`${baseUrl}/api/m/paymongo/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: [IDS[0], IDS[0]] }),
    });
    expect(duplicateResponse.status).toBe(400);

    billFind.mockResolvedValueOnce([bills[0], { ...bills[1], status: "paid", remainingAmount: 0 }]);
    const changedResponse = await fetch(`${baseUrl}/api/m/paymongo/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: IDS }),
    });
    expect(changedResponse.status).toBe(409);
    expect((await changedResponse.json()).code).toBe("OUTSTANDING_BALANCE_CHANGED");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test("status polling rechecks ownership and settles every bill through the canonical settlement service", async () => {
    getCheckoutSession.mockResolvedValue({
      attributes: {
        metadata: { type: "multi_bill", billIds: JSON.stringify(IDS), userId: "tenant-a", amountDue: "4050" },
        checkout_url: "https://checkout.test/session",
      },
    });
    readPaidPayments.mockReturnValue([{ id: "pay_test", attributes: { amount: 405000 } }]);
    billFind.mockResolvedValueOnce(bills).mockResolvedValueOnce(bills);

    const response = await fetch(`${baseUrl}/api/m/paymongo/checkout/cs_test/status`);
    expect(response.status).toBe(200);
    expect(settlePaymongoBill).toHaveBeenCalledTimes(2);
    expect(settlePaymongoBill).toHaveBeenNthCalledWith(1, expect.objectContaining({
      bill: bills[0], settledAmount: 3000,
      metadata: expect.objectContaining({ sessionType: "multi_bill" }),
    }));
    expect(settlePaymongoBill).toHaveBeenNthCalledWith(2, expect.objectContaining({
      bill: bills[1], settledAmount: 1050,
      metadata: expect.objectContaining({ sessionType: "multi_bill" }),
    }));
  });
});
