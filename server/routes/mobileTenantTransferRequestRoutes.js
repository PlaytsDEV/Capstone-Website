import express from "express";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import {
  cancelMyTenantTransferRequest,
  createMyTenantTransferRequest,
  getMyTenantTransferRequest,
  getMyTenantRoomTransferPreferences,
} from "../controllers/tenantTransferRequestController.js";

const router = express.Router();

router.post("/room-transfer-requests", mobileTenantAuth, createMyTenantTransferRequest);
router.get("/room-transfer-request/current", mobileTenantAuth, getMyTenantTransferRequest);
router.get("/room-transfer-preferences", mobileTenantAuth, getMyTenantRoomTransferPreferences);
router.patch(
  "/room-transfer-requests/:id/cancel",
  mobileTenantAuth,
  cancelMyTenantTransferRequest,
);

export default router;
