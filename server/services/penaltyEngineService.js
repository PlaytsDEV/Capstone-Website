/**
 * ============================================================================
 * PENALTY ENGINE & GRACE PERIOD SERVICE
 * ============================================================================
 * Handles automated late fee calculations, 3-day grace period evaluations,
 * and immutable invoice versioning (`invoiceVersion`).
 */

import dayjs from "dayjs";
import Bill from "../models/Bill.js";
import { BUSINESS } from "../config/constants.js";
import logger from "../middleware/logger.js";

const DEFAULT_GRACE_PERIOD_DAYS = 3;
const DEFAULT_LATE_PENALTY_AMOUNT = 500; // PHP 500 late fee

/**
 * Evaluates whether a bill is within the grace period or past due.
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
  const isWithinGracePeriod = daysOverdue <= DEFAULT_GRACE_PERIOD_DAYS;
  const isPastDue = daysOverdue > DEFAULT_GRACE_PERIOD_DAYS;

  return {
    isPastDue,
    isWithinGracePeriod,
    daysOverdue
  };
}

/**
 * Runs the automated late penalty engine over overdue pending bills.
 * Voids outdated base rent invoice, increments `invoiceVersion`, and re-issues
 * updated invoice total (`Exact Base Rent + Exact Penalty Fee`).
 * 
 * @returns {Promise<{ processedCount: number, updatedBills: Array<Object> }>}
 */
export async function executeLatePenaltyCron(evaluationDate = new Date()) {
  const pendingBills = await Bill.find({
    status: "pending",
    isArchived: { $ne: true },
  });

  const updatedBills = [];

  for (const bill of pendingBills) {
    const { isPastDue, daysOverdue } = evaluateGracePeriod(bill.dueDate, evaluationDate);

    // If past 3-day grace period (day 4+) and penalty not yet applied
    if (isPastDue && (!bill.charges?.penalty || bill.charges.penalty === 0)) {
      const penaltyAmount = Number(BUSINESS.LATE_FEE_AMOUNT || DEFAULT_LATE_PENALTY_AMOUNT);
      const newGrossAmount = Number(bill.grossAmount || bill.totalAmount) + penaltyAmount;
      const newInvoiceVersion = (bill.invoiceVersion || 1) + 1;

      // 1. Void previous bill status note
      bill.notes = `${bill.notes ? bill.notes + " | " : ""}Late penalty applied on day ${daysOverdue} past due (v${bill.invoiceVersion || 1} -> v${newInvoiceVersion})`;

      // 2. Apply penalty and increment invoice version
      bill.charges = {
        ...bill.charges,
        penalty: penaltyAmount,
      };
      bill.totalAmount = newGrossAmount;
      bill.grossAmount = newGrossAmount;
      bill.remainingAmount = newGrossAmount;
      bill.invoiceVersion = newInvoiceVersion;
      bill.penaltyAppliedAt = evaluationDate;
      
      await bill.save();
      updatedBills.push(bill);
    }
  }

  logger.info({ count: updatedBills.length }, "Automated late penalty cron executed successfully.");

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
