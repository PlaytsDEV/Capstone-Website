/**
 * ============================================================================
 * TENANT BILLING CONTROLLER
 * ============================================================================
 *
 * Handles all billing-related operations for tenants.
 * Ensures data isolation by branch and provides forecasting data.
 *
 * ============================================================================
 */

import { Bill, Reservation } from "../models/index.js";

/**
 * Get current billing balance for logged-in user
 * @route GET /api/billing/current
 * @access Private
 */
export const getCurrentBilling = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { branch } = req.user;

    // Find user's active stay
    const activeStay = await Reservation.findOne({
      userId,
      branch,
      status: "checked-in",
    });

    if (!activeStay) {
      return res.status(404).json({
        error: "No active stay found",
      });
    }

    // Get current month's bill
    const currentDate = new Date();
    const currentBill = await Bill.findOne({
      reservationId: activeStay._id,
      branch,
      billingMonth: {
        $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        $lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
      },
    });

    if (!currentBill) {
      return res.status(404).json({
        error: "No current bill found",
      });
    }

    res.json({
      currentBalance: currentBill.totalAmount - currentBill.paidAmount,
      totalAmount: currentBill.totalAmount,
      paidAmount: currentBill.paidAmount,
      dueDate: currentBill.dueDate,
      status: currentBill.status,
      charges: currentBill.charges,
    });
  } catch (error) {
    console.error("❌ Get current billing error:", error);
    res.status(500).json({ error: "Failed to fetch billing information" });
  }
};

/**
 * Get billing history for logged-in user
 * @route GET /api/billing/history?limit=50
 * @access Private
 */
export const getBillingHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { branch } = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Find user's stays
    const stays = await Reservation.find({
      userId,
      branch,
    });

    const stayIds = stays.map((s) => s._id);

    // Get billing history
    const bills = await Bill.find({
      reservationId: { $in: stayIds },
      branch,
      isArchived: false,
    })
      .sort({ billingMonth: -1 })
      .limit(limit);

    const history = bills.map((bill) => ({
      id: bill._id,
      date: bill.billingMonth,
      dueDate: bill.dueDate,
      amount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      status: bill.status,
      charges: bill.charges,
      paymentDate: bill.paymentDate,
    }));

    res.json({
      count: history.length,
      bills: history,
    });
  } catch (error) {
    console.error("❌ Get billing history error:", error);
    res.status(500).json({ error: "Failed to fetch billing history" });
  }
};

/**
 * Get billing statistics by branch (for forecasting)
 * @route GET /api/billing/stats
 * @access Private (Admin only)
 */
export const getBillingStats = async (req, res) => {
  try {
    const { branch } = req.user;

    if (!branch || !["gil-puyat", "guadalupe"].includes(branch)) {
      return res.status(403).json({ error: "Invalid branch" });
    }

    // Get monthly revenue
    const monthlyRevenue = await Bill.getMonthlyRevenueByBranch(branch, 12);

    // Get payment stats
    const paymentStats = await Bill.getPaymentStats(branch);

    res.json({
      branch,
      monthlyRevenue,
      paymentStats,
    });
  } catch (error) {
    console.error("❌ Get billing stats error:", error);
    res.status(500).json({ error: "Failed to fetch billing statistics" });
  }
};

/**
 * Mark bill as paid (Admin operation)
 * @route POST /api/billing/:billId/mark-paid
 * @access Private (Admin only)
 */
export const markBillAsPaid = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, note } = req.body;
    const { branch } = req.user;

    const bill = await Bill.findById(billId);

    if (!bill || bill.branch !== branch) {
      return res.status(404).json({ error: "Bill not found" });
    }

    await bill.markAsPaid(amount || bill.totalAmount);

    if (note) {
      bill.notes = note;
      await bill.save();
    }

    res.json({
      success: true,
      bill: bill.toObject(),
    });
  } catch (error) {
    console.error("❌ Mark bill as paid error:", error);
    res.status(500).json({ error: "Failed to update bill" });
  }
};

export default {
  getCurrentBilling,
  getBillingHistory,
  getBillingStats,
  markBillAsPaid,
};
