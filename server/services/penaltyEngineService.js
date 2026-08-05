/**
 * ============================================================================
 * PENALTY ENGINE & GRACE PERIOD SERVICE
 * ============================================================================
 * Handles automated late fee calculations, 3-day grace period evaluations,
 * and immutable invoice versioning (`invoiceVersion`).
 */

import dayjs from "dayjs";
import Bill from "../models/Bill.js";
import logger from "../middleware/logger.js";
import { computePenalty, fetchPenaltySettings } from "./billing/penaltyCalculator.js";
import { syncBillAmounts, resolveBillStatus } from "./billing/billingPolicy.js";

/**
 * Evaluates whether a bill is within the grace period or past due, using the
 * same 1-day-grace policy as the canonical penalty calculator
 * (server/services/billing/penaltyCalculator.js). Kept for callers that only
 * need the boolean/day-count without a full penalty computation.
 *
 * @param {Object|Date|string} dueDateInput - Bill due date
 * @param {Date} [evaluationDate] - Reference date (defaults to now)
 * @returns {{ isPastDue: boolean, isWithinGracePeriod: boolean, daysOverdue: number }}
 */
export function evaluateGracePeriod(dueDateInput, evaluationDate = new Date()) {
  if (!dueDateInput) return { isPastDue: false, isWithinGracePeriod: false, daysOverdue: 0 };

  const dueDate = dayjs(dueDateInput).endOf("day");
  const now = dayjs(evaluationDate);

  if (now.isBefore(dueDate)) {
    return { isPastDue: false, isWithinGracePeriod: false, daysOverdue: 0 };
  }

  const daysOverdue = now.diff(dueDate, "day");
  const isWithinGracePeriod = daysOverdue <= 1;
  const isPastDue = daysOverdue > 1;

  return {
    isPastDue,
    isWithinGracePeriod,
    daysOverdue
  };
}

/**
 * Runs the late penalty engine over overdue bills, using the same canonical
 * computePenalty() formula as the scheduled daily job (server/utils/scheduler.js
 * computeOverduePenalties), so a manual trigger of this endpoint can never
 * write a conflicting penalty value to the same bill. Also increments
 * `invoiceVersion` so in-flight checkout sessions detect the stale total.
 *
 * @returns {Promise<{ processedCount: number, updatedBills: Array<Object> }>}
 */
export async function executeLatePenaltyCron(evaluationDate = new Date()) {
  const now = dayjs(evaluationDate);
  const settings = await fetchPenaltySettings();

  const overdueBills = await Bill.find({
    status: { $in: ["pending", "overdue"] },
    isArchived: { $ne: true },
  });

  const updatedBills = [];

  for (const bill of overdueBills) {
    if (!bill?.dueDate) continue;

    const { penalty: newPenalty, daysLate, ratePerDay } = await computePenalty(bill, settings, now);
    if (daysLate <= 0) continue;

    const oldPenalty = bill.charges?.penalty || 0;
    if (newPenalty === oldPenalty) continue;

    const newInvoiceVersion = (bill.invoiceVersion || 1) + 1;
    bill.notes = `${bill.notes ? bill.notes + " | " : ""}Late penalty recomputed on day ${daysLate} past due (v${bill.invoiceVersion || 1} -> v${newInvoiceVersion})`;

    bill.charges = { ...bill.charges, penalty: newPenalty };
    bill.penaltyDetails = {
      ...bill.penaltyDetails,
      daysLate,
      ratePerDay,
      appliedAt: now.toDate(),
    };
    bill.invoiceVersion = newInvoiceVersion;
    bill.penaltyAppliedAt = now.toDate();

    syncBillAmounts(bill);
    bill.status = resolveBillStatus(bill, now.toDate());

    await bill.save();
    updatedBills.push(bill);
  }

  logger.info({ count: updatedBills.length }, "Late penalty engine executed successfully.");

  return {
    processedCount: updatedBills.length,
    updatedBills
  };
}

/**
 * Validates invoice version freshness before checkout to prevent midnight boundary errors.
 * 
 * @param {string} billId - MongoDB ID of the bill
 * @param {number} expectedVersion - Version tenant loaded on frontend
 * @returns {Promise<{ valid: boolean, currentBill: Object, reason?: string }>}
 */
export async function validateInvoiceVersionForCheckout(billId, expectedVersion) {
  const bill = await Bill.findById(billId);
  if (!bill) {
    return { valid: false, reason: "Bill not found", currentBill: null };
  }

  if (expectedVersion !== undefined && expectedVersion !== null) {
    if (bill.invoiceVersion !== Number(expectedVersion)) {
      return {
        valid: false,
        reason: `Invoice version has changed from v${expectedVersion} to v${bill.invoiceVersion} (due to midnight fee update or adjustment). Please reload page.`,
        code: "INVOICE_VERSION_STALE",
        currentBill: bill
      };
    }
  }

  return { valid: true, currentBill: bill };
}
