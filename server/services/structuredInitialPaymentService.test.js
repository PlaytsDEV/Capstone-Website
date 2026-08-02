import dayjs from "dayjs";
import {
  buildRollingRentalPeriod,
  buildStructuredPricingSnapshot,
  calculateStructuredInitialPayment,
  resolveVerifiedReservationFeeCredit,
  resolveVisibleStructuredRentPeriod,
} from "./structuredInitialPaymentPolicy.js";
import {
  isStructuredInitialPaymentEnabled,
  usesStructuredInitialPayment,
} from "../config/structuredInitialPayment.js";

const label = (date) => dayjs(date).format("YYYY-MM-DD");

describe("structured initial-payment math", () => {
  test("calculates the PHP 6,300 reference example", () => {
    expect(calculateStructuredInitialPayment({
      advanceRent: 6300,
      securityDeposit: 6300,
      approvedInitialCharges: 0,
      reservationFeeCredit: 2000,
    })).toEqual({
      advanceRent: 6300,
      securityDeposit: 6300,
      approvedInitialCharges: 0,
      reservationFeeCredit: 2000,
      grossInitialAmount: 12600,
      initialPaymentTotal: 10600,
    });
  });

  test("includes approved charges and rounds deterministically to centavos", () => {
    expect(calculateStructuredInitialPayment({
      advanceRent: 6300.115,
      securityDeposit: 6300.114,
      approvedInitialCharges: 250.555,
      reservationFeeCredit: 1999.999,
    }).initialPaymentTotal).toBe(10850.79);
  });

  test("caps credit at the gross amount and never creates a negative balance", () => {
    const result = calculateStructuredInitialPayment({
      advanceRent: 500,
      securityDeposit: 500,
      reservationFeeCredit: 2000,
    });
    expect(result.reservationFeeCredit).toBe(1000);
    expect(result.initialPaymentTotal).toBe(0);
  });

  test.each(["pending", "failed", "reconciliation_required"])(
    "does not credit an unverified %s Reservation Fee",
    (status) => {
      expect(resolveVerifiedReservationFeeCredit({
        status,
        method: "paymongo",
        amount: 2000,
      }, 2000)).toBe(0);
    },
  );

  test("credits only the smaller verified PayMongo amount", () => {
    expect(resolveVerifiedReservationFeeCredit({
      status: "confirmed",
      method: "paymongo",
      paidAmount: 1500,
    }, 2000)).toBe(1500);
  });
});

describe("rolling advance coverage", () => {
  test("March 23 produces non-overlapping advance and second-month periods", () => {
    const advance = buildRollingRentalPeriod("2026-03-23T00:00:00.000Z", 0);
    const firstRegular = buildRollingRentalPeriod("2026-03-23T00:00:00.000Z", 1);
    expect(label(advance.coverageStart)).toBe("2026-03-23");
    expect(label(advance.displayEnd)).toBe("2026-04-22");
    expect(label(advance.coverageEndExclusive)).toBe("2026-04-23");
    expect(label(firstRegular.coverageStart)).toBe("2026-04-23");
    expect(label(firstRegular.displayEnd)).toBe("2026-05-22");
    expect(label(firstRegular.dueDate)).toBe("2026-04-23");
  });

  test.each([
    ["2026-01-10", "2026-02-10"],
    ["2026-01-31", "2026-02-28"],
    ["2024-01-31", "2024-02-29"],
    ["2026-03-25", "2026-04-25"],
  ])("anchors %s to the next rolling boundary %s", (start, end) => {
    const period = buildRollingRentalPeriod(`${start}T00:00:00.000Z`, 0);
    expect(label(period.coverageEndExclusive)).toBe(end);
  });

  test("first visible regular Bill is the full second rental month", () => {
    expect(resolveVisibleStructuredRentPeriod(
      "2026-03-23T00:00:00.000Z",
      "2026-04-18T00:00:00.000Z",
    )).toMatchObject({ cycleIndex: 1 });
    expect(resolveVisibleStructuredRentPeriod(
      "2026-03-23T00:00:00.000Z",
      "2026-03-23T00:00:00.000Z",
    )).toBeNull();
  });
});

describe("prospective boundary and frozen pricing", () => {
  test("flag requires enablement and an arrived effective date", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    expect(isStructuredInitialPaymentEnabled(now, {
      STRUCTURED_INITIAL_PAYMENT_ENABLED: "false",
    })).toBe(false);
    expect(isStructuredInitialPaymentEnabled(now, {
      STRUCTURED_INITIAL_PAYMENT_ENABLED: "true",
      STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT: "2026-08-03T00:00:00.000Z",
    })).toBe(false);
    expect(isStructuredInitialPaymentEnabled(now, {
      STRUCTURED_INITIAL_PAYMENT_ENABLED: "true",
      STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT: "2026-08-01T00:00:00.000Z",
    })).toBe(true);
  });

  test("only the stored marker opts a Reservation into the workflow", () => {
    expect(usesStructuredInitialPayment({ createdAt: new Date() })).toBe(false);
    expect(usesStructuredInitialPayment({
      financialWorkflowVersion: "structured-initial-payment-v1",
    })).toBe(true);
  });

  test("accepts a valid zero percent discount snapshot", () => {
    const snapshot = buildStructuredPricingSnapshot({
      reservation: {
        monthlyRent: 6300,
        reservationFeeAmount: 2000,
        leaseDuration: 6,
        selectedBed: { id: "A" },
      },
      room: {
        _id: "507f1f77bcf86cd799439011",
        monthlyPrice: 6300,
        branch: "gil-puyat",
        type: "private",
      },
    });
    expect(snapshot).toMatchObject({
      regularMonthlyRate: 6300,
      discountPercentage: 0,
      discountAmount: 0,
      finalMonthlyRate: 6300,
      advanceRentAmount: 6300,
      securityDepositAmount: 6300,
    });
  });
});
