import express from "express";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import * as maintenanceController from "../controllers/maintenanceController.js";

// Session-authenticated adapter over the canonical maintenance controllers.
// This router owns every active tenant-mobile maintenance route before the
// vendored mobile router is mounted. It adapts authentication only; lifecycle,
// authorization, DTO privacy, notifications and mutations remain canonical.
const router = express.Router();

router.get("/maintenance/me", mobileTenantAuth, maintenanceController.getMyRequests);
router.post("/maintenance", mobileTenantAuth, maintenanceController.createRequest);
router.get("/maintenance/:requestId", mobileTenantAuth, maintenanceController.getRequestById);
router.put("/maintenance/:requestId", mobileTenantAuth, maintenanceController.updateMyRequest);
router.patch("/maintenance/:requestId", mobileTenantAuth, maintenanceController.updateMyRequest);
router.patch("/maintenance/:requestId/cancel", mobileTenantAuth, maintenanceController.cancelMyRequest);
router.post("/maintenance/:requestId/cancel", mobileTenantAuth, maintenanceController.cancelMyRequest);
router.patch("/maintenance/:requestId/reopen", mobileTenantAuth, maintenanceController.reopenMyRequest);
router.post("/maintenance/:requestId/reopen", mobileTenantAuth, maintenanceController.reopenMyRequest);
router.post("/maintenance/:requestId/confirm", mobileTenantAuth, maintenanceController.confirmResolution);
router.patch("/maintenance/:requestId/confirm-resolved", mobileTenantAuth, maintenanceController.confirmResolution);
router.post(
  "/maintenance/:requestId/reschedule-request",
  mobileTenantAuth,
  maintenanceController.requestMaintenanceReschedule,
);
router.post("/maintenance/:requestId/replies", mobileTenantAuth, maintenanceController.sendTenantReply);
router.post("/maintenance/:requestId/reply", mobileTenantAuth, maintenanceController.sendTenantReply);
router.patch("/maintenance/:requestId/read", mobileTenantAuth, maintenanceController.markTenantMaintenanceRead);
router.post("/maintenance/:requestId/typing", mobileTenantAuth, maintenanceController.broadcastTenantMaintenanceTyping);

export default router;
