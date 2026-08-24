import { describe, expect, test } from "@jest/globals";
import { computePenalty } from "./penaltyCalculator.js";

const settings = { penaltyRatePerDay: 50, latePaymentGraceDays: 1, maxCapPercent: 100 };

// Local wall-clock dates (not UTC ISO strings) so the "same calendar day"
// assertions below are meaningful regardless of the machine's timezone.
const localDate = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const bill = (overrides = {}) => ({
  dueDate: localDate(2026, 6, 10),
  charges: { rent: 6300 },
  penaltyDetails: {},
  ...overrides,
});

describe("computePenalty", () => {
  test("applies no penalty on the due date itself", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 10, 23));
    expect(result).toMatchObject({ penalty: 0, daysLate: 0, isWithinGracePeriod: false });
  });

  test("applies ₱0 penalty during the 1-day grace period on Day 1 past due (e.g. Jun 11 for Jun 10 due date)", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 11, 8));
    expect(result.penalty).toBe(0); // Day 1 past due = within 1-day grace => ₱0
    expect(result.daysLate).toBe(1);
    expect(result.billableDays).toBe(0);
    expect(result.isWithinGracePeriod).toBe(true);
  });

  test("charges ₱50 on Day 2 past due (1st billable day after 1-day grace period, e.g. Jun 12)", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 12));
    expect(result.penalty).toBe(50); // Day 2 past due = (2 - 1) = 1 billable day × ₱50
    expect(result.daysLate).toBe(2);
    expect(result.billableDays).toBe(1);
    expect(result.isWithinGracePeriod).toBe(false);
  });

  test("charges ₱100 on Day 3 past due (2nd billable day after 1-day grace period, e.g. Jun 13)", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 13));
    expect(result.penalty).toBe(100); // Day 3 past due = (3 - 1) = 2 billable days × ₱50
    expect(result.daysLate).toBe(3);
    expect(result.billableDays).toBe(2);
  });

  test("supports custom grace days setting (e.g. 0 grace days charges ₱50 on Day 1)", async () => {
    const zeroGraceSettings = { penaltyRatePerDay: 50, latePaymentGraceDays: 0, maxCapPercent: 100 };
    const day1Result = await computePenalty(bill(), zeroGraceSettings, localDate(2026, 6, 11));
    expect(day1Result.penalty).toBe(50);
    expect(day1Result.billableDays).toBe(1);
  });

  test("accrues per calendar day regardless of time-of-day (day-boundary normalization)", async () => {
    // Same calendar day as the due date, but late in the day — must not be
    // counted as a day late due to a raw (non-startOf-day) diff.
    const sameCalendarDay = await computePenalty(
      bill(),
      settings,
      localDate(2026, 6, 10, 23, 59),
    );
    expect(sameCalendarDay.daysLate).toBe(0);

    // Now is early in the morning three calendar days after the due date.
    const threeDaysLate = await computePenalty(
      bill(),
      settings,
      localDate(2026, 6, 13, 0, 5),
    );
    expect(threeDaysLate.daysLate).toBe(3);
    // 1-day grace -> 2 billable days × ₱50 = ₱100
    expect(threeDaysLate.penalty).toBe(100);
  });

  test("caps the penalty at maxCapPercent of the rent charge", async () => {
    const result = await computePenalty(
      bill(),
      { penaltyRatePerDay: 50, maxCapPercent: 1 },
      localDate(2026, 7, 1),
    );
    expect(result.capped).toBe(true);
    expect(result.penalty).toBe(63); // 1% of 6300
  });

  // Plan 4 (D2): Cap uses contractRentAtMoveIn, not charges.rent
  test("uses contractRentAtMoveIn for penalty cap when provided (D2)", async () => {
    const billWithContract = bill({
      contractRentAtMoveIn: 5000, // locked contract rate at move-in
      charges: { rent: 7000 },    // current room rate is different (room upgraded)
    });

    // 200 days past due × ₱50/day = ₱10,000 raw — exceeds both caps, but cap should be 5000
    const result = await computePenalty(
      billWithContract,
      { penaltyRatePerDay: 50, maxCapPercent: 100 },
      localDate(2027, 1, 26), // ~200 days past Jun 10 2026 due date
    );

    // Cap should be based on 5000 (contractRentAtMoveIn × 100%), not 7000 (charges.rent)
    expect(result.capped).toBe(true);
    expect(result.penalty).toBe(5000); // ≤ contractRentAtMoveIn cap, not 7000
  });

  // Plan 4 (D2): Falls back to charges.rent when contractRentAtMoveIn is not set
  test("falls back to charges.rent for cap when contractRentAtMoveIn is absent (D2 backward compat)", async () => {
    // 200 days past due × ₱50/day = ₱10,000 raw — exceeds the ₱6300 cap
    const result = await computePenalty(
      bill(), // no contractRentAtMoveIn field
      { penaltyRatePerDay: 50, maxCapPercent: 100 },
      localDate(2027, 1, 26), // ~200 days past Jun 10 2026 due date
    );
    expect(result.capped).toBe(true);
    expect(result.penalty).toBe(6300); // falls back to charges.rent = 6300
  });
});
