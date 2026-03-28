/**
 * ============================================================================
 * FINANCIAL ROUTES
 * ============================================================================
 * Owner-only financial overview.
 * All routes require: verifyToken → verifyAdmin
 * Owner enforcement is done at the frontend (RequireOwner guard) and
 * optionally hardened here via a role check middleware.
 * ============================================================================
 */

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { getOverview } from "../controllers/financialController.js";

const router = express.Router();

// All routes require authentication + admin role
router.use(verifyToken, verifyAdmin);

/**
 * GET /api/financial/overview?branch=
 * Owner-only financial KPIs and per-room breakdown.
 */
router.get("/overview", getOverview);

export default router;
