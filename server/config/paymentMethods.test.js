import {
  PAYMENT_METHODS,
  PROHIBITED_CASH_PAYMENT_METHODS,
  isProhibitedCashPaymentMethod,
} from "./paymentMethods.js";

describe("prospective payment-method policy", () => {
  test("keeps PayMongo and removes physical cash", () => {
    expect(PAYMENT_METHODS).toContain("paymongo");
    expect(PAYMENT_METHODS).not.toContain("cash");
  });

  test.each(PROHIBITED_CASH_PAYMENT_METHODS)("rejects %s", (method) => {
    expect(isProhibitedCashPaymentMethod(method)).toBe(true);
    expect(PAYMENT_METHODS).not.toContain(method);
  });
});
