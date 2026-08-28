/**
 * =============================================================================
 * TENANT MANAGEMENT ROUTES
 * =============================================================================
 *
 * Routes for administrative tenant management operations.
 *
 * Available Endpoints:
 * - PATCH /api/tenants/:id/appliances - Update tenant declared appliance add-ons
 */

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { updateTenantAppliances } from "../controllers/tenantController.js";

const router = express.Router();

export const requireAuth = [verifyToken, verifyAdmin];

/**
 * PATCH /api/tenants/:id/appliances
 * Update tenant declared appliance add-ons and calculate appliance fees.
 *
 * Access: Admin / Owner with 'manage_tenants' / 'manageTenants' permission.
 */
router.patch(
  "/:id/appliances",
  requireAuth,
  requirePermission("manage_tenants"),
  updateTenantAppliances,
);

export default router;
