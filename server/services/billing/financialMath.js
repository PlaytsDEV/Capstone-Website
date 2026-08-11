/**
 * ============================================================================
 * FINANCIAL MATH UTILITIES
 * ============================================================================
 *
 * Pure, dependency-free math helpers for billing precision.
 *
 * Design rules:
 * - All functions are pure (no side effects, no imports).
 * - Monetary storage unit is integer cents (₱1.00 = 100).
 * - Convert to pesos only at API/UI boundaries via toPesos().
 * - Hamilton allocation guarantees: sum(shares) === totalCents exactly.
 */

// ============================================================================
// UNIT CONVERSION
// ============================================================================

/**
 * Convert a peso float value to integer cents.
 * Rounds half-up at the cent boundary.
 * @param {number} pesos
 * @returns {number} integer cents
 */
export function toCents(pesos) {
  return Math.round((Number(pesos) || 0) * 100);
}

/**
 * Convert integer cents back to a peso float (2 decimal places).
 * @param {number} cents
 * @returns {number} pesos rounded to 2 decimal places
 */
export function toPesos(cents) {
  return Math.round((Number(cents) || 0)) / 100;
}

/**
 * Round a peso value to 2 decimal places.
 * Thin wrapper kept for backward-compatibility; internally uses toCents/toPesos.
 * @param {number} value
 * @returns {number}
 * @deprecated Prefer toCents() for calculation; toPesos() for display.
 */
export function roundMoney(value) {
  return toPesos(toCents(value));
}

// ============================================================================
// HAMILTON ALLOCATION
// ============================================================================

/**
 * Distribute `totalCents` across `n` slots using the Hamilton (largest-
 * remainder) method. Guarantees: sum(result) === totalCents exactly.
 *
 * @param {number} totalCents  - Integer total to distribute (must be >= 0)
 * @param {number[]} weights   - Non-negative weight per slot (need not sum to 1)
 * @param {string[]} [tieKeys] - Optional deterministic tie-break keys (e.g. tenantId strings).
 *                               When two fractional parts are equal, the slot with the
 *                               lexicographically smaller key receives the extra cent first.
 * @returns {number[]} Integer cent shares, one per weight slot. sum === totalCents.
 *
 * @example
 * // Split ₱100 among 3 tenants with equal weights
 * hamiltonAllocate(10000, [1, 1, 1])
 * // => [3334, 3333, 3333]  (sum = 10000) ✓
 */
export function hamiltonAllocate(totalCents, weights, tieKeys = []) {
  const n = weights.length;
  if (n === 0) return [];

  const safeCents = Math.max(0, Math.round(Number(totalCents) || 0));
  const totalWeight = weights.reduce((sum, w) => sum + (Number(w) || 0), 0);

  if (totalWeight <= 0) {
    // Equal split fallback when all weights are zero.
    const base = Math.floor(safeCents / n);
    const remainder = safeCents - base * n;
    return weights.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  // Step 1: compute raw (fractional) shares in cents
  const rawShares = weights.map((w) => (Number(w) || 0) / totalWeight * safeCents);

  // Step 2: floor all shares
  const baseShares = rawShares.map(Math.floor);

  // Step 3: compute remainder cents to distribute
  let remainder = safeCents - baseShares.reduce((a, b) => a + b, 0);

  // Step 4: rank by descending fractional part; tie-break by tieKey ASC
  const fractionals = rawShares.map((raw, index) => ({
    index,
    frac: raw - baseShares[index],
    tieKey: String(tieKeys[index] ?? index),
  }));

  fractionals.sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;      // larger frac first
    return a.tieKey.localeCompare(b.tieKey);              // ASC tieKey
  });

  // Step 5: give one extra cent to the top `remainder` slots
  for (let i = 0; i < remainder; i += 1) {
    baseShares[fractionals[i].index] += 1;
  }

  return baseShares;
}

// ============================================================================
// RECONCILIATION GUARD
// ============================================================================

/**
 * Verify that a set of cent shares reconciles exactly to the expected total.
 * @param {number[]} shares
 * @param {number} expectedCents
 * @returns {{ valid: boolean, delta: number }}
 */
export function verifyReconciliation(shares, expectedCents) {
  const actual = shares.reduce((a, b) => a + b, 0);
  const delta = actual - Math.round(Number(expectedCents) || 0);
  return { valid: delta === 0, delta };
}
