import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  listMoveOutClearancesAction,
  getMoveOutClearanceAction,
  startMoveOutAction,
  markInspectedAction,
  completeMoveOutAction,
} from "../controllers/moveOutClearanceController.js";

const router = express.Router();

router.use(verifyToken, verifyAdmin, filterByBranch, requirePermission("manageTenants"));

router.get("/", listMoveOutClearancesAction);
router.get("/:id", getMoveOutClearanceAction);
router.post("/", startMoveOutAction);
router.patch("/:id/inspect", markInspectedAction);
router.patch("/:id/complete", completeMoveOutAction);

export default router;
