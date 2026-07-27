import express from "express";
import { verifyAdmin, verifyToken } from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/permissions.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import {
  activateSurveySchedule, archiveSurveyTemplate, assignSurveyTenants,
  closeSurveySchedule, copySystemSurveyTemplate, createImprovementAction, createSurveySchedule,
  createSurveyTemplate, generateAIReport, getSurveyAnalytics, getSurveyTemplate,
  listAIReports, listSurveySchedules, listSurveyTemplates, publishSurveyTemplate,
  updateSurveyTemplate,
  overrideMoveOutSurvey,
} from "../controllers/surveyController.js";

const router = express.Router();
router.use(verifyToken, verifyAdmin, filterByBranch);
router.get("/templates", requireAnyPermission(["manageSurveyTemplates", "viewSurveyAnalytics"]), listSurveyTemplates);
router.post("/templates", requirePermission("manageSurveyTemplates"), createSurveyTemplate);
router.get("/templates/:id", requireAnyPermission(["manageSurveyTemplates", "viewSurveyAnalytics"]), getSurveyTemplate);
router.post("/templates/:id/copy", requirePermission("manageSurveyTemplates"), copySystemSurveyTemplate);
router.put("/templates/:id", requirePermission("manageSurveyTemplates"), updateSurveyTemplate);
router.post("/templates/:id/publish", requirePermission("manageSurveyTemplates"), publishSurveyTemplate);
router.post("/templates/:id/archive", requirePermission("manageSurveyTemplates"), archiveSurveyTemplate);
router.get("/schedules", requireAnyPermission(["manageSurveySchedules", "viewSurveyAnalytics"]), listSurveySchedules);
router.post("/schedules", requirePermission("manageSurveySchedules"), createSurveySchedule);
router.post("/schedules/:id/activate", requirePermission("manageSurveySchedules"), activateSurveySchedule);
router.post("/schedules/:id/close", requirePermission("manageSurveySchedules"), closeSurveySchedule);
router.post("/schedules/:id/assign-tenants", requirePermission("manageSurveySchedules"), assignSurveyTenants);
router.get("/analytics/overview", requirePermission("viewSurveyAnalytics"), getSurveyAnalytics);
router.get("/analytics/quarterly", requirePermission("viewSurveyAnalytics"), getSurveyAnalytics);
router.get("/analytics/move-out", requirePermission("viewSurveyAnalytics"), getSurveyAnalytics);
router.get("/analytics/questions", requirePermission("viewSurveyAnalytics"), getSurveyAnalytics);
router.get("/analytics/branches", requirePermission("viewSurveyAnalytics"), getSurveyAnalytics);
router.post("/ai-reports/generate", requirePermission("generateSurveyAIReports"), generateAIReport);
router.get("/ai-reports", requirePermission("viewSurveyAnalytics"), listAIReports);
router.post("/improvement-actions", requirePermission("manageSurveySchedules"), createImprovementAction);
router.post("/move-outs/:id/survey-override", requirePermission("overrideMoveOutSurvey"), overrideMoveOutSurvey);
export default router;
