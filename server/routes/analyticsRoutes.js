import express from "express";
import { verifyAdmin, verifyOwner, verifyToken } from "../middleware/auth.js";
import {
  getAuditSummary,
  getAnalyticsInsights,
  getBillingReport,
  getDashboardAnalytics,
  getDemographicsReport,
  getFinancialsReport,
  getOccupancyForecast,
  getOccupancyReport,
  getOccupancyRateHistory,
  getOperationsReport,
  getRoomBedHistory,
  getSystemPerformance,
} from "../controllers/analyticsController.js";

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.get("/dashboard", getDashboardAnalytics);
router.get("/reports/occupancy", getOccupancyReport);
router.get("/reports/occupancy-history", getOccupancyRateHistory);
router.get("/rooms/:roomId/bed-history", getRoomBedHistory);
router.get("/reports/billing", getBillingReport);
router.get("/reports/operations", getOperationsReport);
router.get("/reports/demographics", getDemographicsReport);
router.get("/forecast/occupancy", getOccupancyForecast);
router.post("/insights", getAnalyticsInsights);
router.get("/financials", verifyOwner, getFinancialsReport);
router.get("/audit", verifyOwner, getAuditSummary);
router.get("/system-performance", verifyOwner, getSystemPerformance);

export default router;

