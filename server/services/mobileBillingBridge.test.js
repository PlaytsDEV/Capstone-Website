import { describe, expect, test } from "@jest/globals";
import {
  resolveMobileBillStatus,
  mobileBillStatusLabel,
  toMobilePaymentMethodLabel,
  toMobileBill,
  isMobileEffectivelyPaid,
  MOBILE_BILL_STATUSES,
} from "./mobileBillingBridge.js";

describe("resolveMobileBillStatus", () => {
  test("unpaid: no payments made yet, not overdue", () => {
    expect(
      resolveMobileBillStatus({ status: "pending", remainingAmount: 5000, paidAmount: 0 }),
    ).toBe("unpaid");
  });

  test("unpaid: overdue is still unpaid at the mobile-effective-status level", () => {
    expect(
      resolveMobileBillStatus({ status: "overdue", remainingAmount: 5000, paidAmount: 0 }),
    ).toBe("unpaid");
  });

  test("partially_paid: some payment applied, balance remains", () => {
    expect(
      resolveMobileBillStatus({ status: "partially-paid", remainingAmount: 2000, paidAmount: 3000 }),
    ).toBe("partially_paid");
  });

  test("paid: remainingAmount <= 0 wins regardless of stale stored status", () => {
    // Stored status still says "pending" (stale write, e.g. sync race) but
    // the balance is actually zero — must show Paid, never Unpaid.
    expect(
      resolveMobileBillStatus({ status: "pending", remainingAmount: 0, paidAmount: 5000 }),
    ).toBe("paid");
  });

  test("paid: negative remaining (overpayment) still resolves to paid", () => {
    expect(
      resolveMobileBillStatus({ status: "pending", remainingAmount: -50, paidAmount: 5050 }),
    ).toBe("paid");
  });

  test("cancelled: voided bill", () => {
    expect(
      resolveMobileBillStatus({ status: "voided", remainingAmount: 5000, paidAmount: 0 }),
    ).toBe("cancelled");
  });

  test("paid: waived bill (tenant no longer liable)", () => {
    expect(
      resolveMobileBillStatus({ status: "waived", remainingAmount: 500, paidAmount: 0 }),
    ).toBe("paid");
  });

  test("pending_verification: proof submitted, balance still owed", () => {
    expect(
      resolveMobileBillStatus({
        status: "pending",
        remainingAmount: 5000,
        paidAmount: 0,
        paymentProof: { verificationStatus: "pending-verification" },
      }),
    ).toBe("pending_verification");
  });

  test("paid wins over a stale pending-verification flag once balance is actually zero", () => {
    // e.g. tenant submitted proof, but the bill was separately settled via
    // PayMongo before an admin reviewed the proof.
    expect(
      resolveMobileBillStatus({
        status: "paid",
        remainingAmount: 0,
        paidAmount: 5000,
        paymentProof: { verificationStatus: "pending-verification" },
      }),
    ).toBe("paid");
  });

  test("rejected: proof rejected, balance still owed", () => {
    expect(
      resolveMobileBillStatus({
        status: "pending",
        remainingAmount: 5000,
        paidAmount: 0,
        paymentProof: { verificationStatus: "rejected" },
      }),
    ).toBe("rejected");
  });

  test("adjusted status falls through to payment-evidence rules, not treated as terminal", () => {
    expect(
      resolveMobileBillStatus({ status: "adjusted", remainingAmount: 1000, paidAmount: 500 }),
    ).toBe("partially_paid");
    expect(
      resolveMobileBillStatus({ status: "adjusted", remainingAmount: 0, paidAmount: 1000 }),
    ).toBe("paid");
  });

  test("every branch returns a value from the mobile status vocabulary", () => {
    const cases = [
      { status: "voided", remainingAmount: 1, paidAmount: 0 },
      { status: "pending", remainingAmount: 0, paidAmount: 1 },
      { status: "waived", remainingAmount: 1, paidAmount: 0 },
      { status: "pending", remainingAmount: 1, paidAmount: 0, paymentProof: { verificationStatus: "pending-verification" } },
      { status: "pending", remainingAmount: 1, paidAmount: 0, paymentProof: { verificationStatus: "rejected" } },
      { status: "partially-paid", remainingAmount: 1, paidAmount: 1 },
      { status: "pending", remainingAmount: 1, paidAmount: 0 },
    ];
    for (const c of cases) {
      expect(MOBILE_BILL_STATUSES).toContain(resolveMobileBillStatus(c));
    }
  });
});

describe("mobileBillStatusLabel", () => {
  test("maps every vocabulary entry to a human label", () => {
    for (const status of MOBILE_BILL_STATUSES) {
      expect(typeof mobileBillStatusLabel(status)).toBe("string");
      expect(mobileBillStatusLabel(status).length).toBeGreaterThan(0);
    }
  });
});

describe("toMobilePaymentMethodLabel", () => {
  test("never surfaces the raw settlement-rail name 'PayMongo' verbatim as a channel", () => {
    const label = toMobilePaymentMethodLabel("paymongo");
    expect(label).not.toBe("PayMongo");
    expect(label).toBe("Online Payment (PayMongo)");
  });

  test("maps real channels to human labels", () => {
    expect(toMobilePaymentMethodLabel("gcash")).toBe("GCash");
    expect(toMobilePaymentMethodLabel("card")).toBe("Credit / Debit Card");
    expect(toMobilePaymentMethodLabel("grab_pay")).toBe("GrabPay");
    expect(toMobilePaymentMethodLabel("bank")).toBe("Bank Transfer");
    expect(toMobilePaymentMethodLabel("offline_cash")).toBe("Cash (Branch)");
  });

  test("returns null (a neutral fallback) rather than guessing for unknown/empty input", () => {
    expect(toMobilePaymentMethodLabel(null)).toBeNull();
    expect(toMobilePaymentMethodLabel("")).toBeNull();
    expect(toMobilePaymentMethodLabel("some_future_unmapped_channel")).toBeNull();
  });
});

function makeBill(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439011",
    status: "pending",
    billingMonth: new Date("2026-05-01"),
    billingCycleStart: new Date("2026-05-01"),
    dueDate: new Date("2026-05-31"),
    charges: { rent: 5000, electricity: 300, water: 100, penalty: 0, applianceFees: 0, corkageFees: 0, discount: 0 },
    totalAmount: 5400,
    grossAmount: 5400,
    paidAmount: 0,
    remainingAmount: 5400,
    paymentMethod: null,
    paymentDate: null,
    paymongoPaymentId: null,
    additionalCharges: [],
    paymentProof: { verificationStatus: "none" },
    createdAt: new Date("2026-05-01"),
    ...overrides,
  };
}

describe("toMobileBill", () => {
  test("maps a canonical Bill into the legacy-mobile-shaped contract with an explicit mobile status", () => {
    const mobileBill = toMobileBill(makeBill());
    expect(mobileBill.billing_id).toBe("507f1f77bcf86cd799439011");
    expect(mobileBill.status).toBe("unpaid");
    expect(MOBILE_BILL_STATUSES).toContain(mobileBill.status);
    expect(mobileBill.rent).toBe(5000);
    expect(mobileBill.total).toBe(5400);
    expect(mobileBill.remaining_amount).toBe(5400);
  });

  test("never leaks the raw canonical status string as the status field", () => {
    const mobileBill = toMobileBill(makeBill({ status: "overdue" }));
    expect(mobileBill.status).not.toBe("overdue");
    expect(mobileBill.status).toBe("unpaid");
  });

  test("humanizes payment_method instead of exposing the raw rail value", () => {
    const mobileBill = toMobileBill(
      makeBill({ status: "paid", remainingAmount: 0, paidAmount: 5400, paymentMethod: "gcash" }),
    );
    expect(mobileBill.payment_method).toBe("GCash");
    expect(mobileBill.status).toBe("paid");
  });
});

describe("toMobileBill utility_deadlines", () => {
  // Regression for the exact bug this bridge reconciliation phase was
  // built to close: a bill with an electricity/water charge but no
  // utility_deadlines entry renders as permanently "not released" on the
  // mobile app (billingStatus.js getUtilityReleaseSchedule), independent of
  // paid status — so a fully paid bill could show "Paid" AND "Your utility
  // bill has not been released yet." at the same time. utility_deadlines
  // must be populated whenever the canonical utility dispatch state is
  // genuinely "sent", using the SAME signal isUtilityChargeVisible() uses.
  test("a bill with a dispatched (sent) electricity charge carries a populated utility_deadlines entry", () => {
    const issuedAt = new Date("2026-05-10");
    const dueDate = new Date("2026-05-20");
    const mobileBill = toMobileBill(makeBill({
      utilityDispatch: { electricity: { state: "sent", issuedAt, dueDate, publishedAt: issuedAt } },
    }));
    expect(mobileBill.utility_deadlines.electricity).toEqual({
      billReleaseDate: issuedAt,
      finalDueDate: dueDate,
      meterReadingDate: issuedAt,
    });
  });

  test("a bill with a still-draft (undispatched) electricity charge carries no utility_deadlines entry for it — not a fabricated null-dated one", () => {
    const mobileBill = toMobileBill(makeBill({
      utilityDispatch: { electricity: { state: "draft" } },
    }));
    expect(mobileBill.utility_deadlines.electricity).toBeUndefined();
  });

  test("a bill with no electricity/water charge carries no utility_deadlines entries at all", () => {
    const mobileBill = toMobileBill(makeBill({ charges: { rent: 5000 }, totalAmount: 5000, remainingAmount: 5000 }));
    expect(mobileBill.utility_deadlines).toEqual({});
  });

  test("a paid bill with a dispatched electricity charge is simultaneously 'paid' and has a released utility schedule — never a contradiction", () => {
    const issuedAt = new Date("2026-05-10");
    const dueDate = new Date("2026-05-20");
    const mobileBill = toMobileBill(makeBill({
      status: "paid",
      remainingAmount: 0,
      paidAmount: 5400,
      utilityDispatch: { electricity: { state: "sent", issuedAt, dueDate } },
    }));
    expect(mobileBill.status).toBe("paid");
    expect(mobileBill.utility_deadlines.electricity.billReleaseDate).toEqual(issuedAt);
    expect(mobileBill.utility_deadlines.electricity.finalDueDate).toEqual(dueDate);
  });
});

describe("isMobileEffectivelyPaid", () => {
  test("true only when the resolved mobile status is paid", () => {
    expect(isMobileEffectivelyPaid(makeBill({ remainingAmount: 0, paidAmount: 5400 }))).toBe(true);
    expect(isMobileEffectivelyPaid(makeBill({ remainingAmount: 5400, paidAmount: 0 }))).toBe(false);
    expect(
      isMobileEffectivelyPaid(
        makeBill({ paymentProof: { verificationStatus: "pending-verification" } }),
      ),
    ).toBe(false);
  });
});
