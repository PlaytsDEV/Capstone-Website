import { describe, expect, test } from "@jest/globals";
import dayjs from "dayjs";
import { resolveRentDueDate } from "./_helpers.js";

describe("Rent Billing Due Date Resolution", () => {
  test("correctly resolves due date matching cycle start date for rent billing", () => {
    const cycle = {
      billingMonth: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleStart: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleEnd: new Date("2026-09-11T00:00:00.000Z"),
      dueDate: new Date("2026-08-11T00:00:00.000Z"),
      generationDate: new Date("2026-07-28T00:00:00.000Z"),
      cycleIndex: 1,
    };

    const resolved = resolveRentDueDate(cycle);
    expect(dayjs(resolved).format("YYYY-MM-DD")).toBe("2026-08-11");
  });

  test("correctly resolves custom due date when provided", () => {
    const cycle = {
      billingMonth: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleStart: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleEnd: new Date("2026-09-11T00:00:00.000Z"),
      dueDate: new Date("2026-08-11T00:00:00.000Z"),
      cycleIndex: 1,
    };

    const resolved = resolveRentDueDate(cycle, "2026-08-15");
    expect(dayjs(resolved).format("YYYY-MM-DD")).toBe("2026-08-15");
  });

  test("correctly handles structured rent cycle due date", () => {
    const cycle = {
      billingMonth: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleStart: new Date("2026-08-11T00:00:00.000Z"),
      billingCycleEnd: new Date("2026-09-11T00:00:00.000Z"),
      dueDate: new Date("2026-08-11T00:00:00.000Z"),
      structured: true,
      cycleIndex: 1,
    };

    const resolved = resolveRentDueDate(cycle);
    expect(dayjs(resolved).format("YYYY-MM-DD")).toBe("2026-08-11");
  });
});
