import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const billFind = jest.fn();
const reservationFind = jest.fn();
const getCheckoutSession = jest.fn();
const readPaidPayments = jest.fn();
const handleDepositPayment = jest.fn();
const handleBillPayment = jest.fn();
const handleMultiBillPayment = jest.fn();

const mockQuery = (result) => ({
  select: () => ({
    limit: () => ({
      lean: () => Promise.resolve(result),
    }),
  }),
});

await jest.unstable_mockModule("../models/index.js", () => ({
  Bill: { find: billFind },
  Reservation: { find: reservationFind },
}));

await jest.unstable_mockModule("../config/paymongo.js", () => ({
  getCheckoutSession,
}));

await jest.unstable_mockModule("../utils/paymongoPaymentMethod.js", () => ({
  readPaidPayments,
}));

await jest.unstable_mockModule("../controllers/webhookController.js", () => ({
  handleDepositPayment,
  handleBillPayment,
  handleMultiBillPayment,
}));

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { reconcilePendingPaymongoSessions } = await import(
  "./paymongoReconciliationService.js"
);

describe("reconcilePendingPaymongoSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    billFind.mockReturnValue(mockQuery([]));
    reservationFind.mockReturnValue(mockQuery([]));
  });

  test("does nothing when there are no unsettled sessions", async () => {
    const result = await reconcilePendingPaymongoSessions();
    expect(result).toEqual({ checked: 0, reconciled: 0, failed: 0 });
    expect(getCheckoutSession).not.toHaveBeenCalled();
  });

  test("dedupes a session shared by a Bill and a Reservation into one provider check", async () => {
    billFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_shared" }]));
    reservationFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_shared" }]));
    getCheckoutSession.mockResolvedValue({ attributes: { metadata: {} } });
    readPaidPayments.mockReturnValue([]);

    const result = await reconcilePendingPaymongoSessions();

    expect(getCheckoutSession).toHaveBeenCalledTimes(1);
    expect(result.checked).toBe(1);
  });

  test("skips a session that has not actually been paid at the gateway", async () => {
    billFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_unpaid" }]));
    getCheckoutSession.mockResolvedValue({ attributes: { metadata: { type: "bill", billId: "bill_1" } } });
    readPaidPayments.mockReturnValue([]);

    await reconcilePendingPaymongoSessions();

    expect(handleBillPayment).not.toHaveBeenCalled();
  });

  test("settles a paid initial_payment/advance+deposit bill session via the shared webhook handler", async () => {
    billFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_bill_paid" }]));
    const session = {
      id: "cs_bill_paid",
      attributes: { metadata: { type: "bill", billId: "bill_1" } },
    };
    getCheckoutSession.mockResolvedValue(session);
    readPaidPayments.mockReturnValue([{ id: "pay_1" }]);

    const result = await reconcilePendingPaymongoSessions();

    expect(handleBillPayment).toHaveBeenCalledWith(
      session.attributes.metadata,
      session,
      expect.objectContaining({ sessionId: "cs_bill_paid" }),
    );
    expect(result.reconciled).toBe(1);
  });

  test("settles a paid deposit session via the shared webhook handler", async () => {
    reservationFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_deposit_paid" }]));
    const session = {
      id: "cs_deposit_paid",
      attributes: { metadata: { type: "deposit", reservationId: "res_1" } },
    };
    getCheckoutSession.mockResolvedValue(session);
    readPaidPayments.mockReturnValue([{ id: "pay_1" }]);

    const result = await reconcilePendingPaymongoSessions();

    expect(handleDepositPayment).toHaveBeenCalledWith(
      session.attributes.metadata,
      session,
      expect.objectContaining({ sessionId: "cs_deposit_paid" }),
    );
    expect(result.reconciled).toBe(1);
  });

  test("settles a paid multi_bill session via the shared webhook handler", async () => {
    billFind.mockReturnValue(mockQuery([{ paymongoSessionId: "cs_multi_paid" }]));
    const session = {
      id: "cs_multi_paid",
      attributes: { metadata: { type: "multi_bill" } },
    };
    getCheckoutSession.mockResolvedValue(session);
    readPaidPayments.mockReturnValue([{ id: "pay_1" }]);

    const result = await reconcilePendingPaymongoSessions();

    expect(handleMultiBillPayment).toHaveBeenCalled();
    expect(result.reconciled).toBe(1);
  });

  test("one failing session does not stop the rest of the sweep", async () => {
    billFind.mockReturnValue(
      mockQuery([
        { paymongoSessionId: "cs_broken" },
        { paymongoSessionId: "cs_ok" },
      ]),
    );
    getCheckoutSession.mockImplementation((sessionId) => {
      if (sessionId === "cs_broken") return Promise.reject(new Error("provider timeout"));
      return Promise.resolve({
        id: "cs_ok",
        attributes: { metadata: { type: "bill", billId: "bill_2" } },
      });
    });
    readPaidPayments.mockReturnValue([{ id: "pay_2" }]);

    const result = await reconcilePendingPaymongoSessions();

    expect(result).toEqual({ checked: 2, reconciled: 1, failed: 1 });
    expect(handleBillPayment).toHaveBeenCalledTimes(1);
  });
});
