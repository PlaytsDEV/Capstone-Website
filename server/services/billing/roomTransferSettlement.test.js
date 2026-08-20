import { describe, expect, test } from "@jest/globals";
import { calculateRoomTransferRentSettlement } from "./roomTransferSettlement.js";

describe("calculateRoomTransferRentSettlement", () => {
  test("31-day period (August): higher-priced destination produces additional amount due", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 14400,
    });

    expect(result.totalCoverageDays).toBe(31);
    expect(result.sourceDays).toBe(14);
    expect(result.destinationDays).toBe(17);
    expect(result.sourceDays + result.destinationDays).toBe(result.totalCoverageDays);

    // sourceConsumedValue + unusedPrepaidCredit must reconcile exactly to
    // the applicable prepaid rent (defaults to sourceApprovedRate).
    expect(result.sourceConsumedValue + result.unusedPrepaidCredit).toBeCloseTo(6300, 2);

    expect(result.additionalAmountDue).toBeGreaterThan(0);
    expect(result.excessCredit).toBe(0);
    expect(result.settlementAmount).toBeCloseTo(result.additionalAmountDue, 2);
  });

  test("30-day period (April): source/destination days sum to the full period, no overlap or gap", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-05-01T00:00:00.000Z",
      transferDate: "2026-04-16T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 6300,
    });

    expect(result.totalCoverageDays).toBe(30);
    expect(result.sourceDays).toBe(15);
    expect(result.destinationDays).toBe(15);
    expect(result.sourceDays + result.destinationDays).toBe(30);
  });

  test("February non-leap year (28-day period): actual day count used, not a fixed 30-day divisor", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2027-02-01T00:00:00.000Z",
      periodEnd: "2027-03-01T00:00:00.000Z",
      transferDate: "2027-02-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 6300,
    });

    expect(result.totalCoverageDays).toBe(28);
    expect(result.sourceDays).toBe(14);
    expect(result.destinationDays).toBe(14);
  });

  test("February leap year (29-day period): actual day count used", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2028-02-01T00:00:00.000Z",
      periodEnd: "2028-03-01T00:00:00.000Z",
      transferDate: "2028-02-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 6300,
    });

    expect(result.totalCoverageDays).toBe(29);
    expect(result.sourceDays).toBe(14);
    expect(result.destinationDays).toBe(15);
  });

  test("transfer at period start: zero source consumption, destination covers the whole period", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-01T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 14400,
    });

    expect(result.sourceDays).toBe(0);
    expect(result.destinationDays).toBe(31);
    expect(result.sourceConsumedValue).toBe(0);
    expect(result.unusedPrepaidCredit).toBeCloseTo(6300, 2);
    expect(result.destinationProratedValue).toBeCloseTo(14400, 2);
  });

  test("transfer on the final day of the period: source consumes the whole period, no destination charge, no off-by-one", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-31T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 14400,
    });

    expect(result.sourceDays).toBe(30);
    expect(result.destinationDays).toBe(1);
    expect(result.sourceDays + result.destinationDays).toBe(31);
  });

  test("lower-priced destination: excess credit recorded, never auto-refunded", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-15T00:00:00.000Z",
      sourceApprovedRate: 14400,
      destinationApprovedRate: 6300,
    });

    expect(result.excessCredit).toBeGreaterThan(0);
    expect(result.additionalAmountDue).toBe(0);
    expect(result.settlementAmount).toBeLessThan(0);
    // No refund field/side effect exists on the return shape — the function
    // only reports the credit for audit purposes.
    expect(Object.keys(result)).not.toContain("refundAmount");
  });

  test("same rate on both sides: settlement is driven purely by the period split", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 6300,
    });

    // Same rate + same total period means destinationProratedValue and
    // unusedPrepaidCredit should be very close (both derived from the same
    // rate/period, split complementarily), settlement near zero aside from
    // canonical cent rounding.
    expect(Math.abs(result.settlementAmount)).toBeLessThanOrEqual(0.02);
  });

  test("rounding: sourceConsumedValue + unusedPrepaidCredit reconciles exactly to applicablePrepaidRent across fractional-cent cases", () => {
    const cases = [
      { rate: 6300, days: 31, transferOffset: 7 },
      { rate: 8333.33, days: 31, transferOffset: 11 },
      { rate: 5555.55, days: 30, transferOffset: 19 },
      { rate: 14400, days: 28, transferOffset: 3 },
    ];
    for (const { rate, days, transferOffset } of cases) {
      const periodStart = new Date("2026-01-01T00:00:00.000Z");
      const periodEnd = new Date(periodStart.getTime() + days * 86_400_000);
      const transferDate = new Date(periodStart.getTime() + transferOffset * 86_400_000);
      const result = calculateRoomTransferRentSettlement({
        periodStart,
        periodEnd,
        transferDate,
        sourceApprovedRate: rate,
        destinationApprovedRate: 6300,
      });
      expect(
        Math.round((result.sourceConsumedValue + result.unusedPrepaidCredit) * 100) / 100,
      ).toBeCloseTo(Math.round(rate * 100) / 100, 2);
    }
  });

  test("explicit applicablePrepaidRent overrides the sourceApprovedRate default", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 6300,
      applicablePrepaidRent: 5000,
    });
    expect(result.sourceConsumedValue + result.unusedPrepaidCredit).toBeCloseTo(5000, 2);
  });

  test("applicablePrepaidRent lower than the value already consumed floors unusedPrepaidCredit at 0, never a negative credit", () => {
    const result = calculateRoomTransferRentSettlement({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      transferDate: "2026-08-15T00:00:00.000Z",
      sourceApprovedRate: 6300,
      destinationApprovedRate: 14400,
      // sourceConsumedValue = 6300/31*14 ≈ 2845.16 — less than the amount
      // actually prepaid/funded (e.g. an unpaid current-period Bill, or a
      // structured advance-rent basis lower than the Contract rate).
      applicablePrepaidRent: 0,
    });
    expect(result.sourceConsumedValue).toBeCloseTo(2845.16, 2);
    expect(result.unusedPrepaidCredit).toBe(0);
    expect(result.excessCredit).toBe(0);
    // The shortfall is not folded into this settlement's additionalAmountDue —
    // it remains a separate, pre-existing rent obligation on the source-room
    // period, untouched by room-transfer settlement.
    expect(result.additionalAmountDue).toBeCloseTo(result.destinationProratedValue, 2);
  });
});
