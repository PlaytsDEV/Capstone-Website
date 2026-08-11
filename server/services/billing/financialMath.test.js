/**
 * ============================================================================
 * FINANCIAL MATH UNIT TESTS
 * ============================================================================
 */

import {
  toCents,
  toPesos,
  roundMoney,
  hamiltonAllocate,
  verifyReconciliation,
} from "./financialMath.js";

describe("toCents", () => {
  it("converts pesos to integer cents", () => {
    expect(toCents(1250.50)).toBe(125050);
    expect(toCents(0)).toBe(0);
    expect(toCents(1)).toBe(100);
  });

  it("handles floating-point input safely", () => {
    expect(toCents(0.1 + 0.2)).toBe(30); // classic float trap
  });

  it("handles null/undefined input as zero", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });
});

describe("toPesos", () => {
  it("converts cents to pesos", () => {
    expect(toPesos(125050)).toBe(1250.50);
    expect(toPesos(0)).toBe(0);
    expect(toPesos(1)).toBe(0.01);
  });
});

describe("roundMoney", () => {
  it("is equivalent to toCents round-trip", () => {
    expect(roundMoney(1250.505)).toBe(toPesos(toCents(1250.505)));
  });
});

describe("hamiltonAllocate", () => {
  it("distributes totalCents exactly — no remainder lost", () => {
    const total = 10000; // ₱100.00 in cents
    const weights = [1, 1, 1];
    const shares = hamiltonAllocate(total, weights);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("handles even split with no remainder", () => {
    const shares = hamiltonAllocate(300, [1, 1, 1]);
    expect(shares).toEqual([100, 100, 100]);
  });

  it("distributes remainder cents to highest fractional slots first", () => {
    // 100 cents / 3 tenants → [34, 33, 33]
    const shares = hamiltonAllocate(100, [1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    const sorted = [...shares].sort((a, b) => b - a);
    expect(sorted[0]).toBe(shares[0]); // first slot gets the extra cent
  });

  it("uses tieKey for deterministic ordering when fractions are equal", () => {
    // All equal weights + equal fracs → tieKey ASC gets extra cents
    const shares1 = hamiltonAllocate(100, [1, 1, 1], ["c", "a", "b"]);
    const shares2 = hamiltonAllocate(100, [1, 1, 1], ["c", "a", "b"]);
    expect(shares1).toEqual(shares2); // deterministic
    expect(shares1.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("handles zero total", () => {
    expect(hamiltonAllocate(0, [1, 1, 1])).toEqual([0, 0, 0]);
  });

  it("handles single slot", () => {
    expect(hamiltonAllocate(1234, [1])).toEqual([1234]);
  });

  it("handles empty weights", () => {
    expect(hamiltonAllocate(100, [])).toEqual([]);
  });

  it("handles zero-weight slots with equal fallback", () => {
    const shares = hamiltonAllocate(100, [0, 0, 0]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("reconciles a real-world multi-tenant electricity bill", () => {
    // ₱1,250.50 split across 4 tenants
    const totalCents = toCents(1250.50);
    const shares = hamiltonAllocate(totalCents, [1, 1, 1, 1]);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(sum).toBe(totalCents);
    // All shares should be within 1 cent of each other
    const max = Math.max(...shares);
    const min = Math.min(...shares);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});

describe("verifyReconciliation", () => {
  it("returns valid: true when sum matches", () => {
    expect(verifyReconciliation([3334, 3333, 3333], 10000)).toEqual({ valid: true, delta: 0 });
  });

  it("returns valid: false with delta when off", () => {
    const result = verifyReconciliation([3333, 3333, 3333], 10000);
    expect(result.valid).toBe(false);
    expect(result.delta).toBe(-1); // sum=9999, expected=10000
  });
});
