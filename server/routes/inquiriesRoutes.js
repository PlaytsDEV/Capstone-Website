/**
 * =============================================================================
 * INQUIRY MANAGEMENT ROUTES
 * =============================================================================
 *
 * Full CRUD routes for managing customer inquiries and contact form submissions.
 * Data is separated by branch - admins only see their branch's inquiries.
 *
 * Available Endpoints:
 * - GET    /api/inquiries              - Get all inquiries (filtered by branch)
 * - GET    /api/inquiries/stats        - Get inquiry statistics
 * - GET    /api/inquiries/branch/:branch - Get inquiries for specific branch (owner)
 * - GET    /api/inquiries/:id          - Get single inquiry by ID
 * - POST   /api/inquiries              - Submit new inquiry (public)
 * - PUT    /api/inquiries/:id          - Update inquiry (admin only)
 * - DELETE /api/inquiries/:id          - Archive inquiry (admin only)
 *
 * Branch Access Rules:
 * - Regular admins: Can only access inquiries from their assigned branch
 * - Owners: Can access inquiries from all branches
 * - Public: Can only submit new inquiries (POST)
 */

import express from "express";
import { verifyToken, verifyAdmin, verifyOwner, optionalAuth } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission, requireAnyPermission } from "../middleware/permissions.js";
import { inquiryLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createInquirySchema } from "../validation/zodSchemas.js";
import {
  getInquiryStats,
  getKanbanBoard,
  getMarketingRoi,
  getInquiriesByBranch,
  getInquiries,
  getInquiryById,
  convertToApplication,
  scheduleViewing,
  createInquiry,
  updateInquiry,
  retryInquiryEmail,
  deleteInquiry,
} from "../controllers/inquiriesController.js";

const router = express.Router();

// ============================================================================
// DEDICATED ADMIN REPORT & KANBAN ENDPOINTS (must be before /:id route)
// ============================================================================

/**
 * GET /api/inquiries/stats
 *
 * Get inquiry statistics for dashboard.
 *
 * Access: Admin (filtered by branch) | Owner (all branches)
 */
router.get("/stats", verifyToken, verifyAdmin, filterByBranch, requireAnyPermission(["manageReservations", "viewReports"]), getInquiryStats);

/**
 * GET /api/inquiries/kanban
 *
 * Get inquiry kanban board grouped into stages (new, viewing, converted).
 *
 * Access: Admin (filtered by branch) | Owner (all branches)
 */
router.get("/kanban", verifyToken, verifyAdmin, filterByBranch, requireAnyPermission(["manageReservations", "viewReports"]), getKanbanBoard);

/**
 * GET /api/inquiries/marketing-roi
 *
 * Get lead generation and conversion ROI metrics grouped by marketing channel.
 *
 * Access: Admin (filtered by branch) | Owner (all branches)
 */
router.get("/marketing-roi", verifyToken, verifyAdmin, filterByBranch, requireAnyPermission(["manageReservations", "viewReports"]), getMarketingRoi);

// ============================================================================
// GET INQUIRIES BY BRANCH (Owner only)
// ============================================================================

/**
 * GET /api/inquiries/branch/:branch
 *
 * Get all inquiries for a specific branch.
 *
 * Access: Owner only
 */
router.get("/branch/:branch", verifyToken, verifyOwner, getInquiriesByBranch);

// ============================================================================
// GET ALL INQUIRIES
// ============================================================================

/**
 * GET /api/inquiries
 *
 * Retrieve all inquiries with respondent information.
 * Results are filtered by the admin's assigned branch.
 *
 * Access: Admin (filtered by branch) | Owner (all branches)
 *
 * Query Parameters:
 * - status: Filter by status (pending, in-progress, resolved, closed)
 * - branch: Filter by branch (owner only)
 * - page: Page number for pagination (default: 1)
 * - limit: Items per page (default: 20)
 * - sort: Sort field (default: createdAt)
 * - order: Sort order (asc/desc, default: desc)
 */
router.get("/", verifyToken, verifyAdmin, filterByBranch, requireAnyPermission(["manageReservations", "manageTenants", "viewReports"]), getInquiries);

// ============================================================================
// CONVERT INQUIRY TO APPLICATION (Must be before /:id generic handler)
// ============================================================================

/**
 * POST /api/inquiries/:id/convert
 *
 * Convert an inquiry into a tenant reservation application.
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.post("/:id/convert", verifyToken, verifyAdmin, filterByBranch, requirePermission("manageReservations"), convertToApplication);

/**
 * POST /api/inquiries/:id/viewing
 *
 * Schedule or update viewing date/time for an inquiry.
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.post("/:id/viewing", verifyToken, verifyAdmin, filterByBranch, requirePermission("manageReservations"), scheduleViewing);

// ============================================================================
// GET SINGLE INQUIRY
// ============================================================================

/**
 * GET /api/inquiries/:id
 *
 * Retrieve a single inquiry by ID.
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.get("/:id", verifyToken, verifyAdmin, filterByBranch, requireAnyPermission(["manageReservations", "manageTenants", "viewReports"]), getInquiryById);

// ============================================================================
// CREATE INQUIRY (Public)
// ============================================================================

/**
 * POST /api/inquiries
 *
 * Submit a new inquiry from the contact form or room exploration.
 *
 * Access: Public (optional authentication supported)
 */
router.post("/", inquiryLimiter, optionalAuth, validateRequest({ body: createInquirySchema }), createInquiry);

// ============================================================================
// UPDATE INQUIRY
// ============================================================================

/**
 * PUT /api/inquiries/:id
 *
 * Update an inquiry's status, response, or other details.
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.put("/:id", verifyToken, verifyAdmin, filterByBranch, requirePermission("manageReservations"), updateInquiry);

/**
 * POST /api/inquiries/:id/retry-email
 *
 * Re-attempt dispatching the automated response email to customer.
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.post("/:id/retry-email", verifyToken, verifyAdmin, filterByBranch, requirePermission("manageReservations"), retryInquiryEmail);

// ============================================================================
// DELETE INQUIRY
// ============================================================================

/**
 * DELETE /api/inquiries/:id
 *
 * Archive an inquiry (soft delete).
 *
 * Access: Admin (must be from their branch) | Owner (any inquiry)
 */
router.delete("/:id", verifyToken, verifyAdmin, filterByBranch, requirePermission("manageReservations"), deleteInquiry);

export default router;
