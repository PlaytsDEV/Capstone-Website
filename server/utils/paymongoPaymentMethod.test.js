import { readPaidPayments, normalizeCheckoutStatusForClient } from "./paymongoPaymentMethod.js";

function sessionWithPayments(payments, status = "active") {
  return { attributes: { status, payments } };
}

describe("normalizeCheckoutStatusForClient", () => {
  test("a session with a paid payment is always 'paid', regardless of session status", () => {
    const paid = [{ attributes: { status: "paid" } }];
    expect(normalizeCheckoutStatusForClient(sessionWithPayments(paid, "active"), readPaidPayments(sessionWithPayments(paid, "active")))).toBe("paid");
    expect(normalizeCheckoutStatusForClient(sessionWithPayments(paid, "inactive"), readPaidPayments(sessionWithPayments(paid, "inactive")))).toBe("paid");
  });

  test("an active session with no payment attempts yet is 'pending'", () => {
    const session = sessionWithPayments([], "active");
    expect(normalizeCheckoutStatusForClient(session, [])).toBe("pending");
  });

  test("an active session with a failed attempt is still 'pending' — the tenant can retry another method", () => {
    const failed = [{ attributes: { status: "failed" } }];
    const session = sessionWithPayments(failed, "active");
    expect(normalizeCheckoutStatusForClient(session, [])).toBe("pending");
  });

  test("an inactive session whose only attempt failed is 'failed'", () => {
    const failed = [{ attributes: { status: "failed" } }];
    const session = sessionWithPayments(failed, "inactive");
    expect(normalizeCheckoutStatusForClient(session, [])).toBe("failed");
  });

  test("an inactive session with no payment attempts at all is 'cancelled' (expired/abandoned)", () => {
    const session = sessionWithPayments([], "inactive");
    expect(normalizeCheckoutStatusForClient(session, [])).toBe("cancelled");
  });

  test("a session with an unrecognized/missing status is 'unknown'", () => {
    expect(normalizeCheckoutStatusForClient({ attributes: {} }, [])).toBe("unknown");
    expect(normalizeCheckoutStatusForClient(null, [])).toBe("unknown");
  });

  test("no state incorrectly becomes 'paid' when there is no paid payment", () => {
    const failed = [{ attributes: { status: "failed" } }];
    for (const status of ["active", "inactive", undefined, "something-new-paymongo-added"]) {
      const session = sessionWithPayments(failed, status);
      expect(normalizeCheckoutStatusForClient(session, [])).not.toBe("paid");
    }
  });

  test("reads payment_intent.payments in addition to attributes.payments, matching readPaidPayments", () => {
    const session = {
      attributes: {
        status: "inactive",
        payments: [],
        payment_intent: { payments: [{ attributes: { status: "failed" } }] },
      },
    };
    expect(normalizeCheckoutStatusForClient(session, [])).toBe("failed");
  });
});
