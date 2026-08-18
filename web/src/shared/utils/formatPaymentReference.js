/**
 * ============================================================================
 * FORMAT PAYMENT REFERENCE UTILITY
 * ============================================================================
 *
 * Ensures all tenant-facing UI components, receipts, and admin tables display
 * clean, professional Lilycrest reference numbers instead of raw gateway IDs.
 * ============================================================================
 */

/**
 * Check if a reference string is a raw external gateway identifier
 * (e.g. PayMongo `pay_...`, `cs_...`, `src_...`, or a 24-char hex MongoDB ObjectID).
 *
 * @param {string} ref
 * @returns {boolean}
 */
export function isRawPaymentGatewayId(ref) {
  if (!ref || typeof ref !== "string") return false;
  const trimmed = ref.trim();
  if (/^(pay_|cs_|src_|evt_|tok_|pm_|pi_)/i.test(trimmed)) return true;
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;
  return false;
}

/**
 * Format any reference code for customer display.
 * Converts legacy raw gateway tokens into clean masked references.
 *
 * @param {string} ref
 * @param {string} [fallback="—"]
 * @returns {string}
 */
export function formatDisplayReference(ref, fallback = "—") {
  if (!ref || typeof ref !== "string") return fallback;
  const trimmed = ref.trim();
  if (!trimmed) return fallback;

  if (isRawPaymentGatewayId(trimmed)) {
    const rawClean = trimmed.replace(/^(pay_|cs_|src_|evt_|tok_|pm_|pi_)/i, "");
    const suffix = rawClean.slice(-6).toUpperCase();
    return `PAY-REF-${suffix}`;
  }

  return trimmed;
}

export default formatDisplayReference;
