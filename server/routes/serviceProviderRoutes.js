import express from "express";
import * as serviceProviderController from "../controllers/serviceProviderController.js";
import { verifyAdmin, verifyToken } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission } from "../middleware/permissions.js";

const router = express.Router();

const providerAccess = [
  verifyToken,
  verifyAdmin,
  filterByBranch,
  requirePermission("manageMaintenance"),
];

router.get("/", providerAccess, serviceProviderController.listServiceProviders);
router.post("/", providerAccess, serviceProviderController.createServiceProvider);
router.patch("/:id", providerAccess, serviceProviderController.updateServiceProvider);

export default router;
