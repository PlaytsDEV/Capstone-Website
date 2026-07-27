import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getMySurvey, listMySurveys, saveMySurveyDraft, submitMySurvey,
} from "../controllers/surveyController.js";

const router = express.Router();
router.use(verifyToken);
router.get("/", listMySurveys);
router.get("/:assignmentId", getMySurvey);
router.put("/:assignmentId/draft", saveMySurveyDraft);
router.post("/:assignmentId/submit", submitMySurvey);
export default router;
