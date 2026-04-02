/**
 * ============================================================================
 * ELECTRICITY BILLING ROUTES
 * ============================================================================
 *
 * API endpoints for segment-based electricity billing.
 * All endpoints require authentication.
 *
 * ============================================================================
 */

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import * as electricityController from "../controllers/electricityBillingController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============================================================================
// TENANT ROUTES (verifyToken only â€” no admin required)
// ============================================================================

/**
 * GET /api/electricity/my-bills
 * Tenant views their electricity billing summaries
 */
router.get("/my-bills", electricityController.getMyElectricityBills);

/**
 * GET /api/electricity/my-bills/by-bill/:billId
 * Tenant: get segment breakdown for a specific electricity Bill document.
 * Must be declared BEFORE /my-bills/:periodId to avoid wildcard collision.
 */
router.get("/my-bills/by-bill/:billId", electricityController.getMyBillBreakdownByBillId);

/**
 * GET /api/electricity/my-bills/:periodId
 * Tenant views one period's segment breakdown (scoped to own data)
 */
router.get("/my-bills/:periodId", electricityController.getMyBillBreakdown);

// ============================================================================
// ADMIN ROUTES (verifyAdmin + filterByBranch)
// ============================================================================

/**
 * GET /api/electricity/rooms
 * Get rooms with billing period status for admin dashboard
 */
router.get("/rooms", verifyAdmin, filterByBranch, electricityController.getRoomsForBilling);
router.get("/diagnostics", verifyAdmin, filterByBranch, electricityController.getBillingDiagnostics);
router.get("/export", verifyAdmin, filterByBranch, electricityController.exportElectricityBilling);

// â”€â”€ Meter Readings â”€â”€

/**
 * POST /api/electricity/readings
 * Record a new submeter reading
 */
router.post("/readings", verifyAdmin, filterByBranch, electricityController.recordMeterReading);

/**
 * GET /api/electricity/readings/:roomId
 * Get all readings for a room (optional ?periodId filter)
 */
router.get("/readings/:roomId", verifyAdmin, filterByBranch, electricityController.getMeterReadings);

/**
 * GET /api/electricity/readings/:roomId/latest
 * Get the most recent reading for a room
 */
router.get("/readings/:roomId/latest", verifyAdmin, filterByBranch, electricityController.getLatestReading);

/**
 * PATCH /api/electricity/readings/:id
 * Update an existing meter reading (value, date, eventType, tenantId)
 */
router.patch("/readings/:id", verifyAdmin, filterByBranch, electricityController.updateMeterReading);

/**
 * DELETE /api/electricity/readings/:id
 * Soft-delete a meter reading (blocks if attached to a closed period)
 */
router.delete("/readings/:id", verifyAdmin, filterByBranch, electricityController.deleteMeterReading);

// â”€â”€ Billing Periods â”€â”€

/**
 * POST /api/electricity/periods
 * Open a new billing period for a room
 */
router.post("/periods", verifyAdmin, filterByBranch, electricityController.openBillingPeriod);

/**
 * GET /api/electricity/periods/:roomId
 * List all billing periods for a room
 */
router.get("/periods/:roomId", verifyAdmin, filterByBranch, electricityController.getBillingPeriods);

/**
 * PATCH /api/electricity/periods/:id
 * Update an open billing period
 */
router.patch("/periods/:id", verifyAdmin, filterByBranch, electricityController.updateBillingPeriod);

/**
 * PATCH /api/electricity/periods/:id/close
 * Close a billing period and trigger computation
 */
router.patch("/periods/:id/close", verifyAdmin, filterByBranch, electricityController.closeBillingPeriod);
router.post("/batch-close", verifyAdmin, filterByBranch, electricityController.batchCloseBillingPeriods);

/**
 * DELETE /api/electricity/periods/:id
 * Soft-delete an open billing period (blocked for closed/revised)
 */
router.delete("/periods/:id", verifyAdmin, filterByBranch, electricityController.deleteBillingPeriod);

// â”€â”€ Billing Results â”€â”€

/**
 * GET /api/electricity/results/:periodId
 * Get full billing result (segments + tenant summaries)
 */
router.get("/results/:periodId", verifyAdmin, filterByBranch, electricityController.getBillingResult);

/**
 * POST /api/electricity/results/:periodId/revise
 * Re-run computation on a closed period
 */
router.post("/results/:periodId/revise", verifyAdmin, filterByBranch, electricityController.reviseBillingResult);

// â”€â”€ Draft Billing â”€â”€

/**
 * GET /api/electricity/periods/:periodId/draft-bills
 * Get all draft bills for a closed period (admin review before send)
 */
router.get("/periods/:periodId/draft-bills", verifyAdmin, filterByBranch, electricityController.getDraftBills);

/**
 * PATCH /api/electricity/periods/:periodId/send-bills
 * Send all draft bills for a period â€” flips to pending + emails tenants
 */
router.patch("/periods/:periodId/send-bills", verifyAdmin, filterByBranch, electricityController.sendBills);

/**
 * PATCH /api/electricity/bills/:billId/adjust
 * Admin adjusts charges on a draft bill
 */
router.patch("/bills/:billId/adjust", verifyAdmin, filterByBranch, electricityController.adjustDraftBill);

/**
 * GET /api/electricity/bills/:billId/pdf
 * Tenant or Admin: download the generated PDF for a specific bill
 */
router.get("/bills/:billId/pdf", electricityController.downloadBillPdf);

/**
 * POST /api/electricity/bills/:billId/regenerate-pdf
 * Admin only: regenerate a bill's PDF (e.g., after PDF failed or adjustments)
 */
router.post("/bills/:billId/regenerate-pdf", verifyAdmin, filterByBranch, electricityController.regenerateBillPdf);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
