/**
 * ============================================================================
 * BILLING ROUTES
 * ============================================================================
 *
 * Module 4 billing route group.
 * Owns bills, verification, penalties, readiness, publishing, reporting, and exports.
 * All endpoints require authentication.
 *
 * ============================================================================
 */

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import * as billingController from "../controllers/billingController.js";
import { requirePermission } from "../middleware/permissions.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  createViolationSchema,
  updateViolationSchema,
  adjudicateViolationSchema,
  overdueNoticeActionSchema,
} from "../validation/zodSchemas.js";

const router = express.Router();

// All billing routes require authentication
router.use(verifyToken);

// ============================================================================
// TENANT ROUTES
// ============================================================================

/**
 * GET /api/billing/current
 * Get current month's billing for logged-in tenant
 */
router.get("/current", billingController.getCurrentBilling);

/**
 * GET /api/billing/history
 * Get billing history for logged-in tenant
 */
router.get("/history", billingController.getBillingHistory);

/**
 * GET /api/billing/my-bills
 * Get all bills for logged-in tenant with full breakdown
 */
router.get("/my-bills", billingController.getMyBills);

/**
 * GET /api/billing/priority-queue
 * Get unpaid bills in strict priority sequence for tenant checkout.
 */
router.get("/priority-queue", billingController.getBillingPriorityQueueAction);

/**
 * POST /api/billing/milestone-arrangement
 * Admin action to create milestone sub-invoices for payment arrangements.
 */
router.post(
  "/milestone-arrangement",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.createMilestoneArrangementAction,
);

/**
 * POST /api/billing/late-penalties/run
 * Trigger automated late penalty cron job.
 */
router.post(
  "/late-penalties/run",
  verifyAdmin,
  requirePermission("manageBilling"),
  billingController.runLatePenaltyJobAction,
);

/**
 * GET /api/billing/:billId/pdf
 * Download a generated bill PDF. Tenants may download their own bills; admins
 * may download bills in their branch.
 */
router.get("/:billId/pdf", billingController.downloadBillPdf);
router.get("/:billId/receipt", billingController.downloadBillReceipt);

router.get("/:billId/utility-breakdown/:utilityType", billingController.getMyUtilityBreakdownByBillId);

// POST /:billId/submit-proof — REMOVED: manual billing proof decommissioned.
// All billing payments are handled via automated PayMongo checkout.

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /api/billing/stats
 * Get billing statistics by branch (Admin only)
 */
router.get(
  "/stats",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getBillingStats,
);

/**
 * GET /api/billing/branch
 * Get all bills for a branch (Admin only)
 */
router.get(
  "/branch",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getBillsByBranch,
);

/**
 * GET /api/billing/consolidated-monitor
 * Get unified statement matrix of rent + utilities per tenant per cycle (Admin only)
 */
router.get(
  "/consolidated-monitor",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getConsolidatedBillingMonitorAction,
);


/**
 * GET /api/billing/rooms
 * Get rooms with occupants for bill generation (Admin only)
 */
router.get(
  "/rooms",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getRoomsWithTenants,
);

// GET /pending-verifications — REMOVED: manual billing proof review decommissioned.

/**
 * GET /api/billing/report
 * Get billing report (revenue, overdue, penalties) (Admin only)
 */
router.get(
  "/report",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getBillingReport,
);

/**
 * GET /api/billing/rent
 * List monthly rent bills (Admin only)
 */
router.get(
  "/rent",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getRentBills,
);

/**
 * GET /api/billing/rent/tenants
 * List active tenants/contracts eligible for rent billing (Admin only)
 */
router.get(
  "/rent/tenants",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getRentBillableTenants,
);

/**
 * POST /api/billing/rent/preview
 * Preview one monthly rent bill before final generation (Admin only)
 */
router.post(
  "/rent/preview",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getRentBillPreview,
);

/**
 * POST /api/billing/rent/generate
 * Generate one monthly rent bill for an active reservation (Admin only)
 */
router.post(
  "/rent/generate",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.generateRentBill,
);

/**
 * POST /api/billing/rent/generate-all
 * Generate all ready monthly rent bills for a branch + billing month (Admin only)
 */
router.post(
  "/rent/generate-all",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.generateAllRentBills,
);

/**
 * POST /api/billing/rent/:billId/send
 * Send or resend an existing monthly rent bill (Admin only)
 */
router.post(
  "/rent/:billId/send",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.sendRentBill,
);

/**
 * POST /api/billing/:billId/remind
 * Send a reminder for an unpaid bill (Admin only)
 */
router.post(
  "/:billId/remind",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.sendBillReminder,
);

/**
 * POST /api/billing/batch-remind
 * Send reminders in batch for multiple unpaid bills (Admin only)
 */
router.post(
  "/batch-remind",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.batchSendBillReminders,
);

// POST /:billId/verify — REMOVED: manual billing proof review decommissioned.

/**
 * POST /api/billing/:billId/mark-paid
 * Mark a bill as paid (Admin only)
 */
router.post(
  "/:billId/mark-paid",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.markBillAsPaid,
);

/**
 * DELETE /api/billing/:billId
 * Hard-delete an orphaned or erroneous bill (Admin only)
 * Note: paid bills cannot be deleted.
 */
router.delete(
  "/:billId",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.deleteBill,
);

/**
 * POST /api/billing/apply-penalties
 * Auto-calculate and apply penalties to overdue bills (Admin only)
 */
router.post(
  "/apply-penalties",
  apiLimiter,
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.applyPenalties,
);

/**
 * GET /api/billing/readiness
 * Get per-room utility finalization status for the active billing cycle.
 * Used by the Issue Invoices tab to show what rooms are ready to publish.
 */
router.get(
  "/readiness",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getRoomReadiness,
);

/**
 * POST /api/billing/publish/:roomId
 * Atomically publish all draft bills for a room — flip to pending + PDF + email.
 * Guards: electricity must be closed + water must be finalized (where applicable).
 */
router.post(
  "/publish/:roomId",
  apiLimiter,
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.publishRoomBills,
);


/**
 * GET /api/billing/export
 * Get flattened billing data for CSV export (Admin only).
 * Query: ?branch=gil-puyat&status=overdue&month=2026-01
 */
router.get("/export", verifyAdmin, requirePermission("manageBilling"), filterByBranch, async (req, res, next) => {
  try {
    const { Bill } = await import("../models/index.js");
    // Branch admins: branch is forced from req.branchFilter (their assigned branch)
    // Owners: branch may optionally come from the query param
    const branch = req.branchFilter || req.query.branch;
    const { status, month } = req.query;

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month format — use YYYY-MM", code: "INVALID_MONTH" });
    }

    const filter = { isArchived: { $ne: true } };
    if (branch) filter.branch = branch;
    if (status) filter.status = status;
    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      filter.billingMonth = { $gte: start, $lt: end };
    }

    const bills = await Bill.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name")
      .sort({ billingMonth: -1 })
      .lean();

    const data = bills.map((b) => ({
      tenantName: `${b.userId?.firstName || ""} ${b.userId?.lastName || ""}`.trim(),
      email: b.userId?.email || "",
      roomName: b.roomId?.name || "",
      billingMonth: b.billingMonth ? new Date(b.billingMonth).toISOString().slice(0, 7) : "",
      rent: b.charges?.rent || 0,
      electricity: b.charges?.electricity || 0,
      water: b.charges?.water || 0,
      penalty: b.charges?.penalty || 0,
      totalAmount: b.totalAmount || 0,
      paidAmount: b.paidAmount || 0,
      status: b.status,
      dueDate: b.dueDate,
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// TRANSFER SETTLEMENT PDF
// ============================================================================

/**
 * GET /api/billing/transfer-settlement/:billId/pdf
 * Generate and stream a Transfer Room Settlement Receipt PDF for a transfer_settlement bill.
 */
router.get(
  "/transfer-settlement/:billId/pdf",
  verifyAdmin,
  requirePermission("manageBilling"),
  async (req, res, next) => {
    try {
      const { generateTransferSettlementPdf } = await import("../utils/pdfGenerator.js");
      const { Bill, User } = await import("../models/index.js");

      const bill = await Bill.findById(req.params.billId).lean();
      if (!bill) {
        return res.status(404).json({ success: false, message: "Bill not found." });
      }
      if (bill.billType !== "transfer_settlement") {
        return res.status(400).json({ success: false, message: "Bill is not a transfer settlement." });
      }

      const tenant = await User.findById(bill.userId).select("firstName lastName email").lean();

      const filePath = await generateTransferSettlementPdf({ bill, tenant });

      // Resolve absolute path and stream to client
      const path = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = path.default.dirname(fileURLToPath(import.meta.url));
      const absPath = path.default.resolve(__dirname, "..", filePath);

      const tenantName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join("_") || "tenant";
      const snap = bill.transferSnapshot || {};
      const safeFrom = (snap.fromRoomName || "prev").replace(/\s+/g, "-");
      const safeTo   = (snap.toRoomName   || "new").replace(/\s+/g, "-");
      const filename = `transfer-settlement_${tenantName}_${safeFrom}-to-${safeTo}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const fs = await import("fs");
      fs.default.createReadStream(absPath).pipe(res);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================================
// TENANT VIOLATIONS & WARNINGS (Spec §23)
// ============================================================================

/**
 * GET /api/billing/violations
 * List tenant violation records with filtering, search, and summary stats.
 */
router.get(
  "/violations",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getViolations,
);

/**
 * GET /api/billing/violations/active-tenants
 * List checked-in tenants in branch with active room and cumulative warning count.
 */
router.get(
  "/violations/active-tenants",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getActiveTenantsForViolations,
);

/**
 * GET /api/billing/violations/:id
 * Retrieve a single violation record with full details and audit trail.
 */
router.get(
  "/violations/:id",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getViolationById,
);

/**
 * POST /api/billing/violations
 * Record a new rule infraction with validation and warning computation.
 */
router.post(
  "/violations",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  validateRequest({ body: createViolationSchema }),
  billingController.createViolation,
);

/**
 * PATCH /api/billing/violations/:id/decision
 * Adjudicate a violation (confirm/dismiss, issue warning/penalty, or escalate).
 */
router.patch(
  "/violations/:id/decision",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  validateRequest({ body: adjudicateViolationSchema }),
  billingController.updateViolationDecision,
);

/**
 * PUT /api/billing/violations/:id
 * Admin updates violation details during in-office review.
 */
router.put(
  "/violations/:id",
  apiLimiter,
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  validateRequest({ body: updateViolationSchema }),
  billingController.updateViolation,
);

/**
 * DELETE /api/billing/violations/:id
 * Admin archives a violation record.
 */
router.delete(
  "/violations/:id",
  apiLimiter,
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.archiveViolation,
);

// ============================================================================
// OVERDUE NOTICE ESCALATION TRACKER (Spec §21)
// ============================================================================

/**
 * GET /api/billing/overdue-notices
 * List overdue billing accounts, 3-notice escalation chains, and summary metrics.
 */
router.get(
  "/overdue-notices",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getOverdueNoticesAction,
);

/**
 * POST /api/billing/:billId/send-overdue-notice
 * Issue formal Overdue Notice (Stage 1, 2, or 3 Final), snapshot debt, dispatch multi-channel receipts.
 */
router.post(
  "/:billId/send-overdue-notice",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  validateRequest({ body: overdueNoticeActionSchema }),
  billingController.sendOverdueNoticeAction,
);

// ============================================================================
// TERMINATION REVIEW BOARD (Spec §22)
// ============================================================================

/**
 * GET /api/billing/termination-reviews
 * Retrieve administrative termination review cases.
 */
router.get(
  "/termination-reviews",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.getTerminationCases,
);

/**
 * POST /api/billing/termination-reviews
 * Manually open an administrative termination review case.
 */
router.post(
  "/termination-reviews",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.createTerminationCase,
);

/**
 * PATCH /api/billing/termination-reviews/:id/decision
 * Adjudicate a termination review case (payment plan, extension, pre-termination, termination, dismissal).
 */
router.patch(
  "/termination-reviews/:id/decision",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.updateTerminationDecisionAction,
);

// ============================================================================
// EXPORT
// ============================================================================

export default router;

