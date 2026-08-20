/**
 * ============================================================================
 * ADMIN SEARCH ROUTES
 * ============================================================================
 *
 * Search routing for Command Palette / Quick Search.
 * ============================================================================
 */

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { handleAdminQuickSearch } from "../controllers/adminSearchController.js";

const router = express.Router();

// GET /api/search/quick
router.get(
  "/quick",
  verifyToken,
  verifyAdmin,
  filterByBranch,
  handleAdminQuickSearch
);

export default router;
