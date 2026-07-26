import { describe, test, expect } from "@jest/globals";
import { calculateProRataUtilitySplits } from "./proRataUtilityEngine.js";

describe("Pro-Rata Utility Engine Tests", () => {
  test("calculates exact pro-rata splits without centavo discrepancy", () => {
    const occupants = [
      { userId: "tenant1", activeDays: 30, isPrimary: true },
      { userId: "tenant2", activeDays: 30 },
      { userId: "tenant3", activeDays: 30 },
    ];
    const totalMeterAmount = 1000.00;

    const result = calculateProRataUtilitySplits({ totalMeterAmount, occupants });

    expect(result.splits).toHaveLength(3);
    // 1000 / 3 = 333.33 each, plus 0.01 assigned to primary = 333.34
    expect(result.splits[0].allocatedAmount).toBe(333.34);
    expect(result.splits[1].allocatedAmount).toBe(333.33);
    expect(result.splits[2].allocatedAmount).toBe(333.33);

    // Exact sum must equal 1000.00
    const sum = result.splits.reduce((a, b) => a + b.allocatedAmount, 0);
    expect(Math.round(sum * 100) / 100).toBe(1000.00);
    expect(result.variance).toBe(0);
  });

  test("handles dynamic active days across room occupants", () => {
    const occupants = [
      { userId: "tenantA", activeDays: 15, isPrimary: true },
      { userId: "tenantB", activeDays: 30 },
    ];
    const totalMeterAmount = 1500.00;

    const result = calculateProRataUtilitySplits({ totalMeterAmount, occupants });

    // 15 / 45 * 1500 = 500; 30 / 45 * 1500 = 1000
    expect(result.splits[0].allocatedAmount).toBe(500.00);
    expect(result.splits[1].allocatedAmount).toBe(1000.00);
    expect(result.totalAllocated).toBe(1500.00);
  });
});
