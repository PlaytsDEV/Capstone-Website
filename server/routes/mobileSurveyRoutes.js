import express from "express";
import mongoose from "mongoose";
import { SurveyAssignment, SurveyResponse } from "../models/index.js";
import { validateSurveyAnswers } from "../services/surveyValidationService.js";
import auditLogger from "../utils/auditLogger.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Same session-token resolution as mobileContractRoutes.js: identity is
// derived server-side from the mobile session, never from client input.
const mobileTenant = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies?.session_token;
    if (!token) return res.status(401).json({ detail: "Not authenticated" });
    const session = await mongoose.connection.db.collection("user_sessions").findOne({
      session_token: token,
      expires_at: { $gt: new Date() },
    });
    if (!session?.user_id) return res.status(401).json({ detail: "Invalid or expired session" });
    const user = await mongoose.connection.db.collection("users").findOne({ user_id: session.user_id });
    if (!user || !["tenant", "applicant"].includes(user.role)) {
      return res.status(403).json({ detail: "Tenant survey access denied" });
    }
    req.mobileTenant = user;
    return next();
  } catch {
    return res.status(401).json({ detail: "Authentication error" });
  }
};

// ─── Web SurveyTemplate/SurveyAssignment/SurveyResponse → mobile survey shape ──
// Mobile's UI (frontend/app/surveys.jsx, survey-form.jsx) was built around the
// mobile backend's own fixed survey_definitions/survey_responses shape. Rather
// than duplicate business logic, this bridge queries the single authoritative
// Web models and translates them into that existing wire contract so the
// screens keep working unmodified while the data underneath is the real thing.

const SURVEY_TYPE_LABELS = {
  quarterly_satisfaction: "QUARTERLY",
  move_out: "MOVE_OUT",
};
const toMobileSurveyType = (surveyType) => SURVEY_TYPE_LABELS[surveyType] || surveyType;

// Mobile's question renderer only has dedicated UI for a 1-5 rating and a
// single-choice chip list; every other question type degrades to free text
// (still submits successfully — validated server-side against the real type).
const QUESTION_TYPE_MAP = {
  rating_5: "RATING",
  star_rating: "RATING",
  single_choice: "SINGLE_CHOICE",
  dropdown: "SINGLE_CHOICE",
  yes_no: "SINGLE_CHOICE",
};
const toMobileQuestionType = (type) => QUESTION_TYPE_MAP[type] || "TEXT";

const toMobileOptions = (question) => {
  if (question.type === "yes_no") return ["yes", "no"];
  return (question.options || []).map((option) => option.value);
};

const toMobileQuestions = (template) =>
  (template?.questions || [])
    .filter((question) => question.active !== false)
    .map((question) => ({
      questionId: question.key,
      prompt: question.text,
      type: toMobileQuestionType(question.type),
      required: !!question.required,
      options: toMobileOptions(question),
      maxLength: ["short_text", "long_text"].includes(question.type) ? question.characterLimit : undefined,
      order: question.order,
    }));

const ASSIGNMENT_STATUS_MAP = {
  pending: "NOT_STARTED",
  opened: "NOT_STARTED",
  in_progress: "IN_PROGRESS",
  submitted: "SUBMITTED",
  overdue: "EXPIRED",
  expired: "EXPIRED",
  waived: "EXPIRED",
};
const toMobileResponseStatus = (status) => ASSIGNMENT_STATUS_MAP[status] || "NOT_STARTED";

const isAssignmentActive = (assignment) => {
  const now = new Date();
  const schedule = assignment.surveyScheduleId;
  const scheduleActive = !schedule || schedule.status === "active";
  const closeAt = assignment.closeAt || schedule?.closeAt;
  return scheduleActive
    && (!closeAt || now <= new Date(closeAt))
    && !["expired", "waived"].includes(assignment.status);
};

const toMobileSurveySummary = (assignment) => {
  const template = assignment.templateId;
  const schedule = assignment.surveyScheduleId;
  return {
    surveyId: String(assignment._id),
    title: schedule?.title || template?.name || "Survey",
    description: template?.description || "",
    surveyType: toMobileSurveyType(assignment.surveyType),
    availableFrom: schedule?.startAt || assignment.assignedAt,
    availableUntil: assignment.closeAt || schedule?.closeAt || null,
    status: isAssignmentActive(assignment) ? "ACTIVE" : "CLOSED",
    tenantResponseStatus: toMobileResponseStatus(assignment.status),
  };
};

const toMobileSurveyDetail = (assignment) => ({
  ...toMobileSurveySummary(assignment),
  questions: toMobileQuestions(assignment.templateId),
});

const toMobileAnswerArray = (answers = []) =>
  answers.map((answer) => ({ questionId: answer.questionKey, value: answer.value }));

const toMobileResponseView = (response) => (response ? {
  status: response.status === "submitted" ? "SUBMITTED" : "DRAFT",
  answers: toMobileAnswerArray(response.answers),
  submittedAt: response.submittedAt || null,
} : null);

router.get("/surveys/me", mobileTenant, asyncRoute(async (req, res) => {
  const assignments = await SurveyAssignment.find({ tenantId: req.mobileTenant._id })
    .populate("templateId", "name description surveyType")
    .populate("surveyScheduleId", "title description startAt dueAt closeAt status")
    .sort({ dueAt: 1 })
    .lean();
  res.json({ surveys: assignments.map(toMobileSurveySummary) });
}));

router.get("/surveys/:assignmentId/me", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.assignmentId)) {
    return res.status(404).json({ detail: "Survey not found." });
  }
  const assignment = await SurveyAssignment.findOne({
    _id: req.params.assignmentId,
    tenantId: req.mobileTenant._id,
  }).populate("templateId").populate("surveyScheduleId");
  if (!assignment) return res.status(404).json({ detail: "Survey not found." });

  if (!assignment.openedAt) {
    assignment.openedAt = new Date();
    if (assignment.status === "pending") assignment.status = "opened";
    await assignment.save();
  }

  const response = await SurveyResponse.findOne({ assignmentId: assignment._id }).lean();
  res.json({ ...toMobileSurveyDetail(assignment), response: toMobileResponseView(response) });
}));

router.get("/surveys/:assignmentId/response/me", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.assignmentId)) {
    return res.status(404).json({ detail: "Survey response not found." });
  }
  const assignment = await SurveyAssignment.findOne({
    _id: req.params.assignmentId,
    tenantId: req.mobileTenant._id,
  }).populate("templateId").populate("surveyScheduleId");
  if (!assignment) return res.status(404).json({ detail: "Survey response not found." });

  const response = await SurveyResponse.findOne({ assignmentId: assignment._id }).lean();
  if (!response) return res.status(404).json({ detail: "Survey response not found." });

  res.json({ survey: toMobileSurveyDetail(assignment), response: toMobileResponseView(response) });
}));

async function saveMobileSurveyResponse(req, res, submission) {
  if (!mongoose.isValidObjectId(req.params.assignmentId)) {
    return res.status(404).json({ detail: "Survey not found." });
  }
  const assignment = await SurveyAssignment.findOne({
    _id: req.params.assignmentId,
    tenantId: req.mobileTenant._id,
  }).populate("templateId").populate("surveyScheduleId", "startAt dueAt closeAt status");
  if (!assignment) return res.status(404).json({ detail: "Survey not found." });

  const now = new Date();
  const startAt = assignment.surveyScheduleId?.startAt || assignment.assignedAt;
  if (startAt && now < new Date(startAt)) {
    return res.status(409).json({ detail: "This survey has not started." });
  }
  if (assignment.closeAt && now > new Date(assignment.closeAt)) {
    return res.status(409).json({ detail: "This survey is closed." });
  }
  if (assignment.status === "submitted" && !assignment.allowResponseEditing) {
    return res.status(409).json({ detail: "This survey was already submitted." });
  }

  const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const webAnswers = rawAnswers.map((answer) => ({ questionKey: answer.questionId, value: answer.value }));
  const validation = validateSurveyAnswers(assignment.templateId, webAnswers, { submission });
  if (!validation.valid) {
    return res.status(422).json({
      detail: "One or more survey answers are invalid.",
      fields: Object.fromEntries(validation.errors.map((error) => [error.field, error.code])),
    });
  }

  const existing = await SurveyResponse.findOne({ assignmentId: assignment._id });
  const revision = existing?.status === "submitted"
    ? [{ answers: existing.answers, editedAt: now, editedBy: req.mobileTenant._id }]
    : [];

  const response = await SurveyResponse.findOneAndUpdate(
    { assignmentId: assignment._id },
    {
      $set: {
        surveyScheduleId: assignment.surveyScheduleId?._id || null,
        templateId: assignment.templateId._id,
        templateVersion: assignment.templateVersion,
        tenantId: req.mobileTenant._id,
        branchId: assignment.branchId,
        stayId: assignment.stayId,
        moveOutRequestId: assignment.moveOutRequestId,
        answers: validation.answers,
        completionPercentage: validation.completionPercentage,
        isAnonymous: assignment.isAnonymous,
        status: submission ? "submitted" : "draft",
        lastSavedAt: now,
        ...(submission ? { submittedAt: now } : {}),
      },
      ...(revision.length ? { $push: { revisions: revision[0] } } : {}),
    },
    { upsert: true, new: true },
  );

  assignment.status = submission ? "submitted" : "in_progress";
  assignment.startedAt = assignment.startedAt || now;
  if (submission) assignment.submittedAt = now;
  await assignment.save();

  if (submission) {
    await auditLogger.logModification(
      req, "survey_response", response._id, {}, { assignmentId: assignment._id, channel: "mobile" },
      "Survey submitted via mobile",
    );
  }

  res.json({ response: toMobileResponseView(response) });
}

router.put("/surveys/:assignmentId/draft", mobileTenant, asyncRoute((req, res) => saveMobileSurveyResponse(req, res, false)));
router.post("/surveys/:assignmentId/submit", mobileTenant, asyncRoute((req, res) => saveMobileSurveyResponse(req, res, true)));

export default router;
