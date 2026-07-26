/**
 * ============================================================================
 * BILLING PRIORITY QUEUE SERVICE
 * ============================================================================
 * Enforces strict multi-bill settlement priority sequence:
 * 1. Oldest overdue utility bills
 * 2. Oldest overdue rent invoices
 * 3. Current month utility bills
 * 4. Current month rent invoices
 * ============================================================================
 */

import Bill from "../models/Bill.js";
import dayjs from "dayjs";

/**
 * Returns unpaid bills for a tenant sorted strictly by payment priority order.
 * 
 * @param {string} userId - Tenant MongoDB user ID
 * @returns {Promise<Array<Object>>} Sorted bill array with priority metadata
 */
export async function getTenantBillsInPriorityOrder(userId) {
  if (!userId) return [];

  const unpaidBills = await Bill.find({
    userId,
    status: { $in: ["pending", "overdue", "partially_paid"] },
    isArchived: { $ne: true }
  }).lean();

  const now = dayjs();

  // Helper to compute priority score (lower score = higher payment priority)
  const computePriorityScore = (bill) => {
    const dueDate = dayjs(bill.dueDate || bill.createdAt);
    const isOverdue = now.isAfter(dueDate.endOf("day"));
    const daysOverdue = isOverdue ? now.diff(dueDate, "day") : 0;
    const isUtility = (bill.charges?.electricity > 0 || bill.charges?.water > 0 || bill.billType === "utility");

    let baseCategory = 4; // Default: current rent

    if (isOverdue && isUtility) {
      baseCategory = 1; // 1. Oldest overdue utility
    } else if (isOverdue && !isUtility) {
      baseCategory = 2; // 2. Oldest overdue rent
    } else if (!isOverdue && isUtility) {
      baseCategory = 3; // 3. Current utility
    } else {
      baseCategory = 4; // 4. Current rent
    }

    // Weight by days overdue (subtract days to ensure older overdue bills come first)
    return baseCategory * 1000 - daysOverdue;
  };

  const sortedBills = unpaidBills
    .map((bill) => ({
      ...bill,
      priorityScore: computePriorityScore(bill),
      isUtility: (bill.charges?.electricity > 0 || bill.charges?.water > 0 || bill.billType === "utility"),
      isOverdue: now.isAfter(dayjs(bill.dueDate || bill.createdAt).endOf("day"))
    }))
    .sort((a, b) => a.priorityScore - b.priorityScore);

  return sortedBills;
}
