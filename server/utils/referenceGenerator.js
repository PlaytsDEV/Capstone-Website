/**
 * ============================================================================
 * LILYCREST PAYMENT REFERENCE GENERATOR
 * ============================================================================
 *
 * Provides standardized, domain-branded reference numbers for Lilycrest DMS.
 * Decouples public/tenant-facing reference numbers from raw payment gateway IDs
 * (e.g. PayMongo's "pay_mPxYFUnBuW2SgCabJkrLV447").
 *
 * Formats:
 *   - Payment Reference: PAY-YYYYMMDD-XXXXXX (e.g., PAY-20260818-7K2M9X)
 *   - Reservation Code:  RES-XXXXXX
 *   - Bill Reference:    BILL-YYYYMMDD-XXXXXX
 * ============================================================================
 */

import crypto from "crypto";

// Unambiguous alphanumeric characters (omits 0, O, 1, I to prevent human reading confusion)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a clean, structured Lilycrest payment reference code.
 *
 * @param {Object} options
 * @param {string} [options.prefix="PAY"] - Prefix (e.g. "PAY", "REF", "BILL")
 * @param {Date} [options.date=new Date()] - Date to encode in reference
 * @param {number} [options.randomLength=6] - Length of random suffix
 * @returns {string} e.g. "PAY-20260818-7K2M9X"
 */
export function generatePaymentReference({
  prefix = "PAY",
  date = new Date(),
  randomLength = 6,
} = {}) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const bytes = crypto.randomBytes(randomLength);
  let randomPart = "";
  for (let i = 0; i < randomLength; i++) {
    randomPart += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }

  return `${prefix}-${dateStr}-${randomPart}`;
}

/**
 * Determine if a string is a raw external payment gateway identifier
 * (e.g. PayMongo `pay_...`, `cs_...`, `src_...`, or a 24-char raw MongoDB ObjectID).
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
 * Format any reference code for tenant-facing, receipt, and email display.
 * If a legacy or raw gateway ID is passed, safely converts it to a clean Lilycrest reference display.
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

export default {
  generatePaymentReference,
  isRawPaymentGatewayId,
  formatDisplayReference,
};
