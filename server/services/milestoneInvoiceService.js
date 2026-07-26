/**
 * ============================================================================
 * MILESTONE INVOICE SERVICE
 * ============================================================================
 * Handles structured payment arrangements under the Exact Payment Policy.
 * Voids single master invoices and creates exact-amount milestone sub-invoices.
 * ============================================================================
 */

import Bill from "../models/Bill.js";

/**
 * Creates milestone sub-invoices for an approved payment arrangement.
 * 
 * @param {string} parentBillId - ID of the master bill to split.
 * @param {Array<{ amount: number, dueDate: string|Date }>} milestones - Array of milestone specifications.
 * @param {string} adminUserId - ID of the admin approving the arrangement.
 * @returns {Promise<Array<Object>>} Created milestone sub-invoices.
 */
export async function createMilestoneSubInvoices(parentBillId, milestones, adminUserId) {
  if (!parentBillId || !Array.isArray(milestones) || milestones.length < 2) {
    throw new Error("Payment arrangement requires a valid bill ID and at least 2 milestone entries.");
  }

  const parentBill = await Bill.findById(parentBillId);
  if (!parentBill) {
    throw new Error("Master invoice not found.");
  }

  if (parentBill.status === "paid" || parentBill.status === "voided") {
    throw new Error(`Cannot split invoice with status '${parentBill.status}'.`);
  }

  // 1. Enforce Exact Total Sum Validation
  const milestoneTotal = milestones.reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const parentTotal = Number(parentBill.totalAmount || 0);

  // Allow floating point tolerance up to 0.01
  if (Math.abs(milestoneTotal - parentTotal) > 0.01) {
    throw new Error(
      `Sum of milestone amounts (₱${milestoneTotal.toFixed(2)}) must exactly equal the master bill total (₱${parentTotal.toFixed(2)}).`
    );
  }

  // 2. Void Master Bill
  parentBill.status = "voided";
  parentBill.notes = (parentBill.notes ? parentBill.notes + "\n" : "") + 
    `[${new Date().toISOString()}] Voided for Payment Arrangement by Admin (${adminUserId}). Split into ${milestones.length} milestones.`;
  await parentBill.save();

  // 3. Create Milestone Sub-Invoices
  const createdSubInvoices = [];
  const nextVersion = (parentBill.invoiceVersion || 1) + 1;

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const milestoneAmount = Number(m.amount);
    
    const subInvoice = await Bill.create({
      reservationId: parentBill.reservationId,
      userId: parentBill.userId,
      branch: parentBill.branch,
      roomId: parentBill.roomId,
      roomBillId: parentBill.roomBillId,
      billingMonth: parentBill.billingMonth,
      billingCycleStart: parentBill.billingCycleStart,
      billingCycleEnd: parentBill.billingCycleEnd,
      dueDate: new Date(m.dueDate),
      milestoneDueDate: new Date(m.dueDate),
      totalAmount: milestoneAmount,
      grossAmount: milestoneAmount,
      remainingAmount: milestoneAmount,
      charges: {
        rent: milestoneAmount,
        electricity: 0,
        water: 0,
        applianceFees: 0,
        corkageFees: 0,
        penalty: 0,
        discount: 0,
      },
      status: "pending",
      isMilestoneSubInvoice: true,
      parentInvoiceId: parentBill._id,
      milestoneIndex: i + 1,
      invoiceVersion: nextVersion,
      notes: `Milestone ${i + 1} of ${milestones.length} for Payment Arrangement (Parent Invoice ID: ${parentBill._id})`,
    });

    createdSubInvoices.push(subInvoice);
  }

  return createdSubInvoices;
}
