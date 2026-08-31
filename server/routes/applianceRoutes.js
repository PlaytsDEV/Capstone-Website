/**
 * ============================================================================
 * APPLIANCE ROUTES
 * ============================================================================
 *
 * RESTful API endpoints for the Appliance Catalog.
 * - GET /api/appliances - Public & Tenant catalog retrieval
 * - POST /api/appliances - Admin/Owner add appliance
 * - PATCH /api/appliances/:id - Admin/Owner update appliance
 * - DELETE /api/appliances/:id - Admin/Owner soft-delete appliance
 */

import express from "express";
import { verifyToken, verifyOwner } from "../middleware/auth.js";
import {
  getAppliances,
  createAppliance,
  updateAppliance,
  deleteAppliance,
} from "../controllers/applianceController.js";

const router = express.Router();

// GET /api/appliances - Open for public booking & authenticated users
router.get("/", getAppliances);

// Protected routes for managing appliance catalog (Owner only)
router.post("/", verifyToken, verifyOwner, createAppliance);
router.patch("/:id", verifyToken, verifyOwner, updateAppliance);
router.delete("/:id", verifyToken, verifyOwner, deleteAppliance);

export default router;
