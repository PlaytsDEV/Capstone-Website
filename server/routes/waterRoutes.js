import express from "express";
import { verifyAdmin, verifyToken } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import * as waterController from "../controllers/waterBillingController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/my-bills", waterController.getMyWaterBills);
router.get("/my-bills/by-bill/:billId", waterController.getMyWaterBreakdownByBillId);
router.get("/my-bills/:periodId", waterController.getMyWaterBillBreakdown);
router.get("/my-records", waterController.getMyWaterRecords);
router.get("/my-records/by-bill/:billId", waterController.getMyWaterBreakdownByBillId);

router.use(verifyAdmin);
router.use(filterByBranch);

router.get("/export", waterController.exportWaterBilling);
router.get("/rooms", waterController.getRoomsForWaterBilling);
router.post("/periods", waterController.openWaterPeriod);
router.get("/periods/:roomId", waterController.getWaterPeriods);
router.patch("/periods/:id", waterController.updateWaterPeriod);
router.patch("/periods/:id/close", waterController.closeWaterPeriod);
router.get("/results/:periodId", waterController.getWaterBillingResult);
router.post("/results/:periodId/revise", waterController.reviseWaterBillingResult);
router.get("/periods/:periodId/draft-bills", waterController.getWaterDraftBills);
router.patch("/periods/:periodId/send-bills", waterController.sendWaterBills);
router.get("/records/:roomId/latest", waterController.getLatestWaterRecord);
router.get("/records/:roomId", waterController.getWaterRecords);
router.post("/records", waterController.createWaterRecord);
router.delete("/records/:id", waterController.deleteWaterRecord);
router.patch("/records/:id", waterController.updateWaterRecord);
router.patch("/records/:id/finalize", waterController.finalizeWaterRecord);

export default router;
