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

  test("applies no penalty during the one-day grace period", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 11, 8));
    expect(result.penalty).toBe(0);
  });

  test("charges PHP 50/day starting the day after the grace period", async () => {
    const result = await computePenalty(bill(), settings, localDate(2026, 6, 12));
    expect(result.penalty).toBe(50);
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

    // Now is early in the morning three calendar days after the due date —
    // a naive time-sensitive diff would undercount this by one day.
    const threeDaysLate = await computePenalty(
      bill(),
      settings,
      localDate(2026, 6, 13, 0, 5),
    );
    expect(threeDaysLate.daysLate).toBe(3);
    expect(threeDaysLate.penalty).toBe(100); // 2 billable days after grace
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
});
