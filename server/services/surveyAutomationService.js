import dayjs from "dayjs";
import {
  Reservation,
  Stay,
  SurveyAssignment,
  SurveyNotificationLog,
  SurveySchedule,
  SurveyTemplate,
  User,
} from "../models/index.js";
import notify from "../utils/notificationService.js";
import logger from "../middleware/logger.js";

const assignmentCopy = (schedule, stay) => ({
  surveyScheduleId: schedule._id,
  templateId: schedule.templateId,
  templateVersion: schedule.templateVersion,
  tenantId: stay.tenantId,
  branchId: stay.branch,
  stayId: stay._id,
  surveyType: schedule.surveyType,
  dueAt: schedule.dueAt,
  closeAt: schedule.closeAt,
  isAnonymous: schedule.isAnonymous,
  isMandatory: schedule.isMandatory,
  allowResponseEditing: schedule.allowResponseEditing,
  acceptLateSubmissions: schedule.acceptLateSubmissions,
});

export async function ensureCurrentQuarterSchedules(now = new Date()) {
  const year = dayjs(now).year();
  const quarter = Math.floor(dayjs(now).month() / 3) + 1;
  const startAt = dayjs(`${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`).startOf("day");
  const closeAt = startAt.add(3, "month").subtract(1, "day").endOf("day");
  const templates = await SurveyTemplate.find({
    surveyType: "quarterly_satisfaction",
    status: "active",
  });
  let created = 0;
  for (const template of templates) {
    const branches = template.branchIds?.length ? template.branchIds : [null];
    for (const branchId of branches) {
      const result = await SurveySchedule.updateOne(
        {
          surveyType: "quarterly_satisfaction",
          year, quarter, branchId, templateId: template._id,
        },
        {
          $setOnInsert: {
            templateVersion: template.version,
            title: `${template.name} - Q${quarter} ${year}`,
            description: template.description,
            startAt: startAt.toDate(),
            dueAt: closeAt.subtract(7, "day").toDate(),
            closeAt: closeAt.toDate(),
            recurrence: "quarterly",
            status: now >= startAt.toDate() ? "scheduled" : "scheduled",
            isAnonymous: template.isAnonymous,
            isMandatory: template.isMandatory,
            allowResponseEditing: template.allowResponseEditing,
            eligibilityRules: {
              minimumTenancyDays: 14,
              lateMoveInBehavior: "assign_when_eligible",
              targetGroup: "active_tenants",
            },
            reminderRules: { daysBeforeDue: [7, 3, 0], sendOverdue: true },
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount) created += 1;
    }
  }
  return { created, year, quarter };
}

export async function assignEligibleTenants(scheduleOrId, now = new Date()) {
  const schedule = scheduleOrId?._id
    ? scheduleOrId
    : await SurveySchedule.findById(scheduleOrId);
  if (!schedule) throw Object.assign(new Error("Survey schedule not found"), { code: "SURVEY_NOT_FOUND", statusCode: 404 });
  const minimumDate = dayjs(now)
    .subtract(Number(schedule.eligibilityRules?.minimumTenancyDays || 0), "day")
    .toDate();
  const stayQuery = {
    status: { $in: ["active", "ending_soon"] },
    leaseStartDate: { $lte: minimumDate },
  };
  if (schedule.branchId) stayQuery.branch = schedule.branchId;
  const stays = await Stay.find(stayQuery).lean();
  const tenants = await User.find({
    _id: { $in: stays.map((stay) => stay.tenantId) },
    role: "tenant",
    accountStatus: "active",
    isArchived: { $ne: true },
  }).select("_id").lean();
  const allowed = new Set(tenants.map((tenant) => String(tenant._id)));
  let created = 0;
  for (const stay of stays.filter((item) => allowed.has(String(item.tenantId)))) {
    const result = await SurveyAssignment.updateOne(
      { surveyScheduleId: schedule._id, tenantId: stay.tenantId },
      { $setOnInsert: assignmentCopy(schedule, stay) },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }
  return { eligible: stays.length, assigned: created };
}

export async function activateDueSurveys(now = new Date()) {
  const schedules = await SurveySchedule.find({
    status: "scheduled",
    startAt: { $lte: now },
    closeAt: { $gt: now },
  });
  let activated = 0;
  for (const schedule of schedules) {
    const claimed = await SurveySchedule.findOneAndUpdate(
      { _id: schedule._id, status: "scheduled" },
      { $set: { status: "active", activatedAt: now } },
      { new: true },
    );
    if (!claimed) continue;
    await assignEligibleTenants(claimed, now);
    activated += 1;
  }
  return { activated };
}

async function deliverAssignmentNotice(assignment, type, now) {
  const log = await SurveyNotificationLog.findOneAndUpdate(
    { assignmentId: assignment._id, notificationType: type, channel: "in_app" },
    {
      $setOnInsert: {
        tenantId: assignment.tenantId,
        surveyScheduleId: assignment.surveyScheduleId,
        scheduledAt: now,
        status: "pending",
      },
    },
    { upsert: true, new: true },
  );
  if (log.status === "sent") return false;
  try {
    await notify.general(
      assignment.tenantId,
      type === "initial" ? "New Survey Available" : "Survey Reminder",
      type === "overdue"
        ? "Your survey is overdue. Please submit it before the closing date."
        : "A tenant survey is waiting for your response.",
      { entityType: "survey_assignment", entityId: String(assignment._id), actionUrl: "/tenant/surveys" },
    );
    log.status = "sent"; log.sentAt = now; log.failureReason = "";
  } catch (error) {
    log.status = "failed"; log.retryCount += 1; log.failureReason = String(error.message).slice(0, 1000);
  }
  await log.save();
  return log.status === "sent";
}

export async function processSurveyLifecycle(now = new Date()) {
  await ensureCurrentQuarterSchedules(now);
  await activateDueSurveys(now);
  const active = await SurveySchedule.find({ status: "active" });
  let notified = 0;
  for (const schedule of active) {
    await assignEligibleTenants(schedule, now);
    const assignments = await SurveyAssignment.find({
      surveyScheduleId: schedule._id,
      status: { $in: ["pending", "opened", "in_progress", "overdue"] },
    });
    for (const assignment of assignments) {
      if (now > assignment.closeAt) {
        assignment.status = "expired"; assignment.expiredAt = now; await assignment.save();
        continue;
      }
      if (now > assignment.dueAt && assignment.status !== "overdue") {
        assignment.status = schedule.acceptLateSubmissions ? "overdue" : "expired";
        if (assignment.status === "expired") assignment.expiredAt = now;
        await assignment.save();
      }
      const days = dayjs(assignment.dueAt).startOf("day").diff(dayjs(now).startOf("day"), "day");
      const type = assignment.status === "overdue"
        ? "overdue"
        : !assignment.openedAt ? "initial" : `due_${days}_days`;
      if (type === "initial" || type === "overdue" ||
          (schedule.reminderRules?.daysBeforeDue || [7, 3, 0]).includes(days)) {
        if (await deliverAssignmentNotice(assignment, type, now)) notified += 1;
      }
    }
    if (now >= schedule.closeAt) {
      schedule.status = "closed"; schedule.closedAt = now; await schedule.save();
    }
  }
  return { schedules: active.length, notified };
}

export async function ensureMoveOutSurveyAssignment(reservationOrId, now = new Date()) {
  const reservation = reservationOrId?._id
    ? reservationOrId
    : await Reservation.findById(reservationOrId);
  if (!reservation) throw Object.assign(new Error("Reservation not found"), { statusCode: 404, code: "RESERVATION_NOT_FOUND" });
  const stay = await Stay.findOne({
    reservationId: reservation._id,
    status: { $in: ["active", "ending_soon"] },
  });
  if (!stay) throw Object.assign(new Error("No active stay found"), { statusCode: 422, code: "NO_ACTIVE_STAY" });
  const template = await SurveyTemplate.findOne({ surveyType: "move_out", status: "active" })
    .sort({ version: -1 });
  if (!template) throw Object.assign(new Error("Active move-out survey template not found"), { statusCode: 422, code: "SURVEY_TEMPLATE_NOT_FOUND" });
  const closeAt = dayjs(now).add(30, "day").toDate();
  const assignment = await SurveyAssignment.findOneAndUpdate(
    { moveOutRequestId: reservation._id, surveyType: "move_out" },
    {
      $setOnInsert: {
        templateId: template._id,
        templateVersion: template.version,
        tenantId: stay.tenantId,
        branchId: stay.branch,
        stayId: stay._id,
        dueAt: dayjs(now).add(7, "day").toDate(),
        closeAt,
        isAnonymous: template.isAnonymous,
        isMandatory: true,
        allowResponseEditing: template.allowResponseEditing,
      },
    },
    { upsert: true, new: true },
  );
  await deliverAssignmentNotice(assignment, "move_out_required", now);
  return assignment;
}

export async function assertMoveOutSurveyComplete(reservationId) {
  const assignment = await SurveyAssignment.findOne({
    moveOutRequestId: reservationId,
    surveyType: "move_out",
  });
  if (!assignment || !["submitted", "waived"].includes(assignment.status)) {
    throw Object.assign(
      new Error("The tenant must complete the required move-out survey before the move-out can be finalized."),
      {
        statusCode: 422,
        code: "MOVE_OUT_SURVEY_REQUIRED",
        surveyAssignmentId: assignment?._id || null,
      },
    );
  }
  return assignment;
}

export async function runSurveyScheduler(now = new Date()) {
  try { return await processSurveyLifecycle(now); }
  catch (error) {
    logger.error({ err: error }, "Survey scheduler failed");
    throw error;
  }
}
