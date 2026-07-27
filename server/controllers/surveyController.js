import mongoose from "mongoose";
import {
  SurveyAIReport,
  SurveyAssignment,
  SurveyImprovementAction,
  SurveyResponse,
  SurveySchedule,
  SurveyTemplate,
  User,
} from "../models/index.js";
import {
  assignEligibleTenants,
  assertMoveOutSurveyComplete,
  ensureMoveOutSurveyAssignment,
} from "../services/surveyAutomationService.js";
import { buildSurveyAnalytics, generateSurveyAIReport } from "../services/surveyAnalyticsService.js";
import { validateSurveyAnswers, validateSurveyTemplateDefinition } from "../services/surveyValidationService.js";
import auditLogger from "../utils/auditLogger.js";

const actorFor = (req) => User.findOne({ firebaseUid: req.user.uid }).lean();
const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, code, message, ...extra });
const safeId = (id) => mongoose.Types.ObjectId.isValid(id);
const branchQuery = (req, requested = null) => {
  if (req.isOwner || req.user?.owner || req.branchFilter == null) return requested ? { branchId: requested } : {};
  const branch = req.branchFilter?.branch || req.branchFilter;
  if (requested && requested !== branch) {
    throw Object.assign(new Error("Survey branch access denied."), { statusCode: 403, code: "SURVEY_ACCESS_DENIED" });
  }
  return { branchId: branch };
};
const templateBranchIds = (req, requested = []) => {
  const branch = branchQuery(req).branchId;
  if (!branch) return requested;
  if (requested.length && requested.some((item) => item !== branch)) {
    throw Object.assign(new Error("Survey branch access denied."), {
      statusCode: 403, code: "SURVEY_ACCESS_DENIED",
    });
  }
  return [branch];
};
const assertTemplateAccess = (req, template) => {
  const branch = branchQuery(req).branchId;
  if (branch && template.branchIds?.length && !template.branchIds.includes(branch)) {
    throw Object.assign(new Error("Survey branch access denied."), {
      statusCode: 403, code: "SURVEY_ACCESS_DENIED",
    });
  }
};
const handle = (res, error) => fail(
  res,
  error.statusCode || (error.code === 11000 ? 409 : 500),
  error.code === 11000 ? "DUPLICATE_SURVEY_SCHEDULE" : (error.code || "SURVEY_OPERATION_FAILED"),
  error.code === 11000 ? "An equivalent survey record already exists." : error.message,
  error.details || {},
);

export const createSurveyTemplate = async (req, res) => {
  try {
    const actor = await actorFor(req);
    const familyKey = String(req.body.familyKey || req.body.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const {
      isSystemTemplate: _ignoredSystemFlag,
      systemTemplateKey: _ignoredSystemKey,
      sourceSystemTemplateId: _ignoredSourceId,
      ...editableBody
    } = req.body;
    const template = await SurveyTemplate.create({
      ...editableBody,
      branchIds: templateBranchIds(req, req.body.branchIds || []),
      familyKey, version: 1, status: "draft",
      isSystemTemplate: false, systemTemplateKey: null, sourceSystemTemplateId: null,
      createdBy: actor?._id, updatedBy: actor?._id,
    });
    await auditLogger.logModification(req, "survey_template", template._id, {}, template.toObject(), "Survey template created");
    res.status(201).json({ success: true, data: template });
  } catch (error) { handle(res, error); }
};

export const listSurveyTemplates = async (req, res) => {
  try {
    const query = {};
    if (req.query.surveyType) query.surveyType = req.query.surveyType;
    if (req.query.status) query.status = req.query.status;
    const branch = branchQuery(req).branchId;
    if (branch) query.$or = [{ branchIds: branch }, { branchIds: { $size: 0 } }];
    const data = await SurveyTemplate.find(query).sort({ familyKey: 1, version: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const getSurveyTemplate = async (req, res) => {
  try {
    const data = safeId(req.params.id) ? await SurveyTemplate.findById(req.params.id).lean() : null;
    if (!data) return fail(res, 404, "SURVEY_TEMPLATE_NOT_FOUND", "Survey template not found.");
    assertTemplateAccess(req, data);
    res.json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const updateSurveyTemplate = async (req, res) => {
  try {
    const current = safeId(req.params.id) ? await SurveyTemplate.findById(req.params.id) : null;
    if (!current) return fail(res, 404, "SURVEY_TEMPLATE_NOT_FOUND", "Survey template not found.");
    assertTemplateAccess(req, current);
    if (current.isSystemTemplate) {
      return fail(res, 409, "SYSTEM_TEMPLATE_IMMUTABLE", "System template sources cannot be edited. Create an editable copy first.");
    }
    if (current.status !== "draft") {
      return fail(res, 409, "PUBLISHED_TEMPLATE_IMMUTABLE", "Published template versions cannot be edited. Duplicate this version as a new draft.");
    }
    const actor = await actorFor(req);
    const {
      isSystemTemplate: _ignoredSystemFlag,
      systemTemplateKey: _ignoredSystemKey,
      sourceSystemTemplateId: _ignoredSourceId,
      familyKey: _ignoredFamilyKey,
      version: _ignoredVersion,
      status: _ignoredStatus,
      ...editableUpdates
    } = req.body;
    const updates = {
      ...editableUpdates,
      ...(req.body.branchIds ? { branchIds: templateBranchIds(req, req.body.branchIds) } : {}),
    };
    const validation = validateSurveyTemplateDefinition({ ...current.toObject(), ...updates });
    if (!validation.valid) {
      return fail(res, 422, "SURVEY_TEMPLATE_INVALID", "The survey draft contains invalid questions.", { errors: validation.errors });
    }
    Object.assign(current, updates, { updatedBy: actor?._id });
    const updated = await current.save();
    await auditLogger.logModification(req, "survey_template", updated._id, current.toObject(), updated.toObject(), "Survey template updated/versioned");
    res.json({ success: true, data: updated });
  } catch (error) { handle(res, error); }
};

export const publishSurveyTemplate = async (req, res) => {
  try {
    const template = safeId(req.params.id) ? await SurveyTemplate.findById(req.params.id) : null;
    if (!template) return fail(res, 404, "SURVEY_TEMPLATE_NOT_FOUND", "Survey template not found.");
    assertTemplateAccess(req, template);
    if (template.isSystemTemplate) {
      return fail(res, 409, "SYSTEM_TEMPLATE_IMMUTABLE", "System template sources cannot be published. Create an editable copy first.");
    }
    if (template.status !== "draft") {
      return fail(res, 409, "SURVEY_TEMPLATE_ALREADY_PUBLISHED", "Only draft templates can be published.");
    }
    const validation = validateSurveyTemplateDefinition(template, { publishing: true });
    if (!validation.valid) {
      return fail(res, 422, "SURVEY_TEMPLATE_INVALID", "Resolve template validation issues before publishing.", { errors: validation.errors });
    }
    await SurveyTemplate.updateMany(
      { familyKey: template.familyKey, _id: { $ne: template._id }, status: "active" },
      { $set: { status: "inactive" } },
    );
    template.status = "active"; template.publishedAt = new Date(); await template.save();
    await auditLogger.logModification(req, "survey_template", template._id, {}, template.toObject(), "Survey template published");
    res.json({ success: true, data: template });
  } catch (error) { handle(res, error); }
};

export const copySystemSurveyTemplate = async (req, res) => {
  try {
    const source = safeId(req.params.id) ? await SurveyTemplate.findById(req.params.id) : null;
    if (!source?.isSystemTemplate) {
      return fail(res, 404, "SYSTEM_TEMPLATE_NOT_FOUND", "System survey template not found.");
    }
    assertTemplateAccess(req, source);
    const actor = await actorFor(req);
    const scope = templateBranchIds(req, req.body.branchIds || []);
    const copyKey = [source._id, actor?._id || "system", [...scope].sort().join(",") || "organization"].join(":");
    const existing = await SurveyTemplate.findOne({ copyKey, status: "draft" });
    if (existing) return res.json({ success: true, data: existing, reused: true });
    const copy = await SurveyTemplate.create({
      ...source.toObject(),
      _id: undefined, createdAt: undefined, updatedAt: undefined,
      isSystemTemplate: false,
      systemTemplateKey: null,
      sourceSystemTemplateId: source._id,
      sourceTemplateVersion: source.templateVersion || String(source.version),
      copyKey,
      familyKey: `${source.systemTemplateKey}_${Date.now()}`,
      name: req.body.name || source.name,
      branchIds: scope,
      version: 1,
      status: "draft",
      publishedAt: null,
      archivedAt: null,
      createdBy: actor?._id,
      updatedBy: actor?._id,
    });
    await auditLogger.logModification(req, "survey_template", copy._id, {}, copy.toObject(), "System survey template copied to editable draft");
    res.status(201).json({ success: true, data: copy });
  } catch (error) { handle(res, error); }
};

export const archiveSurveyTemplate = async (req, res) => {
  try {
    const template = safeId(req.params.id) ? await SurveyTemplate.findById(req.params.id) : null;
    if (!template) return fail(res, 404, "SURVEY_TEMPLATE_NOT_FOUND", "Survey template not found.");
    assertTemplateAccess(req, template);
    if (template.isSystemTemplate) {
      return fail(res, 409, "SYSTEM_TEMPLATE_IMMUTABLE", "System template sources cannot be archived.");
    }
    if (template.status !== "draft") {
      return fail(res, 409, "SURVEY_TEMPLATE_ARCHIVE_NOT_ALLOWED", "Only editable draft templates can be archived from this workflow.");
    }
    template.status = "archived";
    template.archivedAt = new Date();
    template.copyKey = null;
    await template.save();
    await auditLogger.logModification(req, "survey_template", template._id, {}, template.toObject(), "Survey template archived");
    res.json({ success: true, data: template });
  } catch (error) { handle(res, error); }
};

export const createSurveySchedule = async (req, res) => {
  try {
    const branchId = branchQuery(req, req.body.branchId || null).branchId ?? req.body.branchId ?? null;
    const template = await SurveyTemplate.findById(req.body.templateId);
    if (!template || template.status !== "active" || template.isSystemTemplate) {
      return fail(res, 422, "SURVEY_TEMPLATE_NOT_PUBLISHED", "A published organization template is required.");
    }
    assertTemplateAccess(req, template);
    const actor = await actorFor(req);
    const schedule = await SurveySchedule.create({
      ...req.body, branchId, surveyType: template.surveyType, templateVersion: template.version,
      createdBy: actor?._id, updatedBy: actor?._id,
    });
    await auditLogger.logModification(req, "survey_schedule", schedule._id, {}, schedule.toObject(), "Survey schedule created");
    res.status(201).json({ success: true, data: schedule });
  } catch (error) { handle(res, error); }
};

export const listSurveySchedules = async (req, res) => {
  try {
    const query = { ...branchQuery(req, req.query.branchId || null) };
    if (req.query.status) query.status = req.query.status;
    if (req.query.surveyType) query.surveyType = req.query.surveyType;
    if (req.query.year) query.year = Number(req.query.year);
    if (req.query.quarter) query.quarter = Number(req.query.quarter);
    const data = await SurveySchedule.find(query).populate("templateId", "name version").sort({ startAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const activateSurveySchedule = async (req, res) => {
  try {
    const schedule = await SurveySchedule.findById(req.params.id);
    if (!schedule) return fail(res, 404, "SURVEY_NOT_FOUND", "Survey schedule not found.");
    branchQuery(req, schedule.branchId);
    if (schedule.status === "active") {
      const assignmentResult = await assignEligibleTenants(schedule);
      return res.json({ success: true, data: schedule, assignmentResult, reused: true });
    }
    if (!["draft", "scheduled"].includes(schedule.status)) {
      return fail(res, 409, "SURVEY_SCHEDULE_NOT_ACTIVATABLE", "Only draft schedules can be activated.");
    }
    schedule.status = "active"; schedule.activatedAt = new Date(); await schedule.save();
    const assignmentResult = await assignEligibleTenants(schedule);
    await auditLogger.logModification(req, "survey_schedule", schedule._id, {}, { schedule, assignmentResult }, "Survey activated and tenants assigned");
    res.json({ success: true, data: schedule, assignmentResult });
  } catch (error) { handle(res, error); }
};

export const closeSurveySchedule = async (req, res) => {
  try {
    const schedule = await SurveySchedule.findById(req.params.id);
    if (!schedule) return fail(res, 404, "SURVEY_NOT_FOUND", "Survey schedule not found.");
    branchQuery(req, schedule.branchId);
    schedule.status = "closed"; schedule.closedAt = new Date(); await schedule.save();
    await SurveyAssignment.updateMany(
      { surveyScheduleId: schedule._id, status: { $nin: ["submitted", "waived"] } },
      { $set: { status: "expired", expiredAt: new Date() } },
    );
    res.json({ success: true, data: schedule });
  } catch (error) { handle(res, error); }
};

export const assignSurveyTenants = async (req, res) => {
  try {
    const schedule = await SurveySchedule.findById(req.params.id);
    if (!schedule) return fail(res, 404, "SURVEY_NOT_FOUND", "Survey schedule not found.");
    branchQuery(req, schedule.branchId);
    res.json({ success: true, data: await assignEligibleTenants(schedule) });
  } catch (error) { handle(res, error); }
};

export const listMySurveys = async (req, res) => {
  try {
    const actor = await actorFor(req);
    const data = await SurveyAssignment.find({ tenantId: actor?._id })
      .populate("templateId", "name description surveyType version")
      .populate("surveyScheduleId", "title description startAt dueAt closeAt")
      .sort({ dueAt: 1 }).lean();
    res.json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const getMySurvey = async (req, res) => {
  try {
    const actor = await actorFor(req);
    const assignment = await SurveyAssignment.findOne({ _id: req.params.assignmentId, tenantId: actor?._id })
      .populate("templateId").populate("surveyScheduleId");
    if (!assignment) return fail(res, 404, "SURVEY_ASSIGNMENT_NOT_FOUND", "Survey assignment not found.");
    if (!assignment.openedAt) {
      assignment.openedAt = new Date(); if (assignment.status === "pending") assignment.status = "opened"; await assignment.save();
    }
    const response = await SurveyResponse.findOne({ assignmentId: assignment._id }).lean();
    res.json({ success: true, data: { assignment, response } });
  } catch (error) { handle(res, error); }
};

async function saveTenantResponse(req, res, submission) {
  try {
    const actor = await actorFor(req);
    const assignment = await SurveyAssignment.findOne({ _id: req.params.assignmentId, tenantId: actor?._id })
      .populate("templateId")
      .populate("surveyScheduleId", "startAt dueAt closeAt status");
    if (!assignment) return fail(res, 404, "SURVEY_ASSIGNMENT_NOT_FOUND", "Survey assignment not found.");
    const now = new Date();
    if (now < (assignment.surveyScheduleId?.startAt || assignment.assignedAt)) {
      return fail(res, 409, "SURVEY_NOT_STARTED", "This survey has not started.");
    }
    if (now > assignment.closeAt) return fail(res, 409, "SURVEY_CLOSED", "This survey is closed.");
    if (assignment.status === "submitted" && !assignment.allowResponseEditing) {
      return fail(res, 409, "SURVEY_ALREADY_SUBMITTED", "This survey was already submitted.");
    }
    const validation = validateSurveyAnswers(assignment.templateId, req.body.answers, { submission });
    if (!validation.valid) {
      return fail(res, 422, "SURVEY_RESPONSE_INVALID", "One or more survey answers are invalid.", { errors: validation.errors });
    }
    const existing = await SurveyResponse.findOne({ assignmentId: assignment._id });
    const revision = existing?.status === "submitted"
      ? [{ answers: existing.answers, editedAt: now, editedBy: actor._id }]
      : [];
    const response = await SurveyResponse.findOneAndUpdate(
      { assignmentId: assignment._id },
      {
        $set: {
          surveyScheduleId: assignment.surveyScheduleId,
          templateId: assignment.templateId._id,
          templateVersion: assignment.templateVersion,
          tenantId: actor._id,
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
    assignment.startedAt ||= now;
    if (submission) assignment.submittedAt = now;
    await assignment.save();
    if (submission) await auditLogger.logModification(req, "survey_response", response._id, {}, { assignmentId: assignment._id }, "Survey submitted");
    res.json({ success: true, data: response });
  } catch (error) { handle(res, error); }
}

export const saveMySurveyDraft = (req, res) => saveTenantResponse(req, res, false);
export const submitMySurvey = (req, res) => saveTenantResponse(req, res, true);

export const getSurveyAnalytics = async (req, res) => {
  try {
    const filters = { ...req.query, ...branchQuery(req, req.query.branchId || null) };
    res.json({ success: true, data: await buildSurveyAnalytics(filters) });
  } catch (error) { handle(res, error); }
};

export const generateAIReport = async (req, res) => {
  try {
    const actor = await actorFor(req);
    const filters = { ...(req.body.filters || {}), ...branchQuery(req, req.body.filters?.branchId || null) };
    const report = await generateSurveyAIReport({
      filters, reportType: req.body.reportType, generatedBy: actor?._id,
      forceNewVersion: req.body.forceNewVersion === true,
    });
    await auditLogger.logModification(req, "survey_ai_report", report._id, {}, { responseCount: report.responseCount }, "Survey AI report generated");
    res.status(201).json({ success: true, data: report });
  } catch (error) { handle(res, error); }
};

export const listAIReports = async (req, res) => {
  try {
    const data = await SurveyAIReport.find({ ...branchQuery(req, req.query.branchId || null) })
      .sort({ generatedAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const createImprovementAction = async (req, res) => {
  try {
    const actor = await actorFor(req);
    const branchId = branchQuery(req, req.body.branchId || null).branchId ?? req.body.branchId ?? null;
    const data = await SurveyImprovementAction.create({ ...req.body, branchId, createdBy: actor._id, updatedBy: actor._id });
    await auditLogger.logModification(req, "survey_improvement_action", data._id, {}, data.toObject(), "Survey improvement action created");
    res.status(201).json({ success: true, data });
  } catch (error) { handle(res, error); }
};

export const overrideMoveOutSurvey = async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 10) return fail(res, 422, "MOVE_OUT_SURVEY_OVERRIDE_DENIED", "A detailed override reason is required.");
    const actor = await actorFor(req);
    const assignment = await ensureMoveOutSurveyAssignment(req.params.id);
    branchQuery(req, assignment.branchId);
    assignment.status = "waived"; assignment.waivedAt = new Date();
    assignment.waivedBy = actor._id; assignment.waiverReason = reason; await assignment.save();
    await auditLogger.logModification(req, "survey_assignment", assignment._id, {}, assignment.toObject(), `Move-out survey overridden: ${reason}`);
    res.json({ success: true, data: assignment });
  } catch (error) { handle(res, error); }
};

export { assertMoveOutSurveyComplete };
