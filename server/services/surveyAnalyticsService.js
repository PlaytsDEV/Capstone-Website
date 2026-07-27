import crypto from "crypto";
import {
  SurveyAIReport,
  SurveyAssignment,
  SurveyResponse,
  SurveySchedule,
  SurveyTemplate,
} from "../models/index.js";

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const safeBranchFilter = (branchId) => branchId ? { branchId } : {};

export async function buildSurveyAnalytics(filters = {}, { anonymityThreshold = 5 } = {}) {
  let scheduleIds = null;
  if (filters.scheduleId) {
    scheduleIds = [filters.scheduleId];
  } else if (filters.year || filters.quarter || filters.surveyType ||
      filters.dateFrom || filters.dateTo) {
    const scheduleQuery = {
      ...(filters.year ? { year: Number(filters.year) } : {}),
      ...(filters.quarter ? { quarter: Number(filters.quarter) } : {}),
      ...(filters.surveyType ? { surveyType: filters.surveyType } : {}),
      ...safeBranchFilter(filters.branchId),
    };
    if (filters.dateFrom || filters.dateTo) {
      scheduleQuery.startAt = {
        ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
      };
    }
    const schedules = await SurveySchedule.find(scheduleQuery).select("_id").lean();
    scheduleIds = schedules.map((schedule) => schedule._id);
  }
  const responseQuery = {
    status: "submitted",
    ...safeBranchFilter(filters.branchId),
  };
  if (scheduleIds) responseQuery.surveyScheduleId = { $in: scheduleIds };
  if (filters.surveyType) {
    const assignments = await SurveyAssignment.find({ surveyType: filters.surveyType }).select("_id").lean();
    responseQuery.assignmentId = { $in: assignments.map((item) => item._id) };
  }
  const responses = await SurveyResponse.find(responseQuery).lean();
  const assignmentQuery = {
    ...(scheduleIds ? { surveyScheduleId: { $in: scheduleIds } } : {}),
    ...(filters.surveyType ? { surveyType: filters.surveyType } : {}),
    ...safeBranchFilter(filters.branchId),
  };
  const totalAssigned = await SurveyAssignment.countDocuments(assignmentQuery);
  const templates = await SurveyTemplate.find({
    _id: { $in: [...new Set(responses.map((item) => String(item.templateId)))] },
  }).lean();
  const questionMap = new Map();
  templates.forEach((template) => template.questions.forEach((question) => {
    questionMap.set(`${template._id}:${question.key}`, question);
  }));
  const aggregates = new Map();
  for (const response of responses) {
    for (const answer of response.answers || []) {
      const question = questionMap.get(`${response.templateId}:${answer.questionKey}`);
      if (!question?.includeInAnalytics) continue;
      const current = aggregates.get(answer.questionKey) || {
        key: answer.questionKey, text: question.text, type: question.type,
        category: question.category, count: 0, numeric: [], options: {},
      };
      current.count += 1;
      if (["rating_5", "rating_10", "star_rating", "likert", "nps", "number"].includes(question.type)) {
        if (Number.isFinite(Number(answer.value))) current.numeric.push(Number(answer.value));
      } else if (Array.isArray(answer.value)) {
        answer.value.forEach((value) => { current.options[value] = (current.options[value] || 0) + 1; });
      } else if (!["short_text", "long_text"].includes(question.type)) {
        current.options[answer.value] = (current.options[answer.value] || 0) + 1;
      }
      aggregates.set(answer.questionKey, current);
    }
  }
  const questions = [...aggregates.values()].map((item) => {
    const sorted = [...item.numeric].sort((a, b) => a - b);
    const average = item.numeric.length
      ? round(item.numeric.reduce((sum, value) => sum + value, 0) / item.numeric.length)
      : null;
    const median = sorted.length
      ? round(sorted.length % 2 ? sorted[(sorted.length - 1) / 2] :
        (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : null;
    return {
      key: item.key, text: item.text, type: item.type, category: item.category,
      responseCount: item.count, average, median,
      distribution: Object.entries(item.options).map(([value, count]) => ({
        value, count, percentage: round((count / item.count) * 100, 1),
      })),
    };
  });
  const ratingQuestions = questions.filter((question) => question.average != null);
  const categoryBuckets = new Map();
  ratingQuestions.forEach((question) => {
    const values = categoryBuckets.get(question.category) || [];
    values.push(question.average); categoryBuckets.set(question.category, values);
  });
  const categoryAverages = [...categoryBuckets.entries()].map(([category, values]) => ({
    category,
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
  }));
  const npsQuestion = questions.find((question) => question.type === "nps" || question.type === "rating_10");
  const submittedByBranch = responses.reduce((counts, response) => {
    counts[response.branchId] = (counts[response.branchId] || 0) + 1;
    return counts;
  }, {});
  const assignmentsByBranch = await SurveyAssignment.aggregate([
    { $match: assignmentQuery },
    { $group: { _id: "$branchId", assigned: { $sum: 1 } } },
  ]);
  const branchComparison = assignmentsByBranch.map((item) => ({
    branchId: item._id,
    assigned: item.assigned,
    submitted: submittedByBranch[item._id] || 0,
    completionRate: item.assigned
      ? round(((submittedByBranch[item._id] || 0) / item.assigned) * 100, 1)
      : 0,
  }));
  return {
    filters,
    totalAssigned,
    totalSubmitted: responses.length,
    pending: Math.max(0, totalAssigned - responses.length),
    completionRate: totalAssigned ? round((responses.length / totalAssigned) * 100, 1) : 0,
    averageSatisfaction: ratingQuestions.length
      ? round(ratingQuestions.reduce((sum, question) => sum + question.average, 0) / ratingQuestions.length)
      : null,
    recommendationScore: npsQuestion?.average ?? null,
    categoryAverages,
    questions,
    branchComparison,
    privacy: {
      anonymityThreshold,
      detailedSegmentationAvailable: responses.length >= anonymityThreshold,
      tenantIdentifiersIncluded: false,
    },
  };
}

const heuristicReport = (metrics) => {
  const ranked = [...metrics.categoryAverages].sort((a, b) => b.average - a.average);
  const limitations = [];
  if (metrics.totalSubmitted < 5) limitations.push("Response count is below five; detailed segmentation is suppressed.");
  if (metrics.completionRate < 50) limitations.push("Completion rate is low, so results may not represent all tenants.");
  return {
    summary: metrics.totalSubmitted
      ? `${metrics.totalSubmitted} submitted responses produced a ${metrics.completionRate}% completion rate and an average satisfaction score of ${metrics.averageSatisfaction ?? "not available"}.`
      : "No submitted survey responses are available.",
    positiveFindings: ranked.slice(0, 3).map((item) => `${item.category}: ${item.average}`),
    negativeFindings: ranked.slice(-3).reverse().map((item) => `${item.category}: ${item.average}`),
    recurringIssues: [],
    possibleCauses: ["Operational causes require management review; survey results show association, not confirmed causation."],
    recommendations: ranked.slice(-3).reverse().map((item) => ({
      issue: `Lower satisfaction in ${item.category}`,
      evidence: { currentAverage: item.average, responseCount: metrics.totalSubmitted },
      recommendedAction: `Review tenant comments and operating performance related to ${item.category}.`,
      priority: item.average < 3 ? "high" : "medium",
      suggestedOwner: "Dormitory Operations",
      suggestedTimeline: "Within 30 days",
      metricToMonitor: `${item.category} satisfaction score`,
      expectedResult: "Improved satisfaction in the next survey period",
    })),
    limitations,
    modelMetadata: { provider: "evidence-based-fallback", usedFallback: true },
  };
};

async function requestGeminiReport(metrics) {
  if (!process.env.GEMINI_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const prompt = [
      "Analyze only the following de-identified aggregate tenant survey data.",
      "Never invent values, tenant identities, percentages, causes, or trends.",
      "Return strict JSON with: summary, positiveFindings, negativeFindings, recurringIssues,",
      "possibleCauses, recommendations, limitations. Recommendations must contain issue,",
      "evidence, recommendedAction, priority, suggestedOwner, suggestedTimeline,",
      "metricToMonitor, expectedResult. Treat causes as possibilities, not facts.",
      JSON.stringify(metrics),
    ].join("\n");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const body = await response.json();
    const parsed = JSON.parse(body.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return {
      ...parsed,
      modelMetadata: { provider: "gemini", model: "gemini-2.5-flash", usedFallback: false },
    };
  } finally { clearTimeout(timeout); }
}

export async function generateSurveyAIReport({
  filters,
  reportType = "custom",
  generatedBy,
  forceNewVersion = false,
}) {
  const metrics = await buildSurveyAnalytics(filters);
  if (!metrics.totalSubmitted) {
    throw Object.assign(new Error("No submitted responses are available for analysis."), {
      statusCode: 422, code: "AI_REPORT_NO_DATA",
    });
  }
  const snapshotHash = crypto.createHash("sha256")
    .update(JSON.stringify(metrics)).digest("hex");
  const scopeKey = `${reportType}:${filters.scheduleId || "all"}:${filters.branchId || "all"}:${snapshotHash}`;
  const existing = await SurveyAIReport.findOne({ idempotencyKey: scopeKey });
  if (existing && !forceNewVersion) {
    throw Object.assign(new Error("An AI report already exists for this data snapshot."), {
      statusCode: 409, code: "AI_REPORT_ALREADY_EXISTS", reportId: existing._id,
    });
  }
  let report;
  try {
    report = await requestGeminiReport(metrics);
  } catch {
    report = null;
  }
  report ||= heuristicReport(metrics);
  const previous = await SurveyAIReport.findOne({
    reportType, branchId: filters.branchId || null,
  }).sort({ version: -1 }).lean();
  return SurveyAIReport.create({
    idempotencyKey: forceNewVersion ? `${scopeKey}:${Number(previous?.version || 0) + 1}` : scopeKey,
    reportType,
    surveyScheduleId: filters.scheduleId || null,
    surveyType: filters.surveyType || null,
    branchId: filters.branchId || null,
    year: filters.year || null,
    quarter: filters.quarter || null,
    version: Number(previous?.version || 0) + 1,
    responseCount: metrics.totalSubmitted,
    metricsSnapshot: metrics,
    ...report,
    priorityActions: report.recommendations.map((item) => item.recommendedAction),
    trendAnalysis: previous
      ? ["Comparison is available in the stored metrics snapshots; further review is required to confirm causes."]
      : [],
    generatedBy,
  });
}
