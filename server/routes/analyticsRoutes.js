import express from "express";
import { verifyAdmin, verifyOwner, verifyToken } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission } from "../middleware/permissions.js";
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
  getSupportChatReport,
  getSystemPerformance,
} from "../controllers/analyticsController.js";

const router = express.Router();

// Operational dashboard summary used by /admin/dashboard (branch-scoped)
router.get("/dashboard", verifyToken, verifyAdmin, filterByBranch, getDashboardAnalytics);

// Deep analytics, reports, forecasts, and AI insights are strictly Owner-only
router.use(verifyToken, verifyAdmin, verifyOwner);

router.get("/reports/occupancy", filterByBranch, getOccupancyReport);
router.get("/reports/occupancy-history", filterByBranch, getOccupancyRateHistory);
router.get("/rooms/:roomId/bed-history", filterByBranch, getRoomBedHistory);
router.get("/reports/billing", filterByBranch, getBillingReport);
router.get("/reports/operations", filterByBranch, getOperationsReport);
router.get("/reports/support-chat", filterByBranch, getSupportChatReport);
router.get("/reports/demographics", filterByBranch, getDemographicsReport);
router.get("/forecast/occupancy", filterByBranch, getOccupancyForecast);
router.post("/insights", filterByBranch, getAnalyticsInsights);
router.get("/financials", getFinancialsReport);
router.get("/audit", getAuditSummary);
router.get("/system-performance", getSystemPerformance);

export default router;

