import { describe, expect, test } from "@jest/globals";
import { computePenalty } from "./penaltyCalculator.js";

const settings = { penaltyRatePerDay: 50, maxCapPercent: 100 };

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
    expect(result).toMatchObject({ penalty: 0, daysLate: 0 });
  });

  // Plan 4 (D4): Grace period removed — penalty starts on Day 1 past due.
  // The old "applies no penalty during the one-day grace period" test is now
  // updated to assert that ₱50 IS charged on Day 1 past due.
  test("charges ₱50 immediately on Day 1 past due (no grace period — D4)", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 11, 8));
    expect(result.penalty).toBe(50); // Day 1 past due = 1 billable day × ₱50
    expect(result.daysLate).toBe(1);
  });

  test("charges PHP 50/day starting Day 1 (no longer Day 2 after grace)", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 12));
    expect(result.penalty).toBe(100); // Day 2 past due = 2 billable days × ₱50
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
    // D4: no grace → 3 billable days × ₱50 = ₱150
    expect(threeDaysLate.penalty).toBe(150);
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
