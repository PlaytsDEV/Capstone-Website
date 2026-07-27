import mongoose from "mongoose";

const schema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  reportType: { type: String, enum: ["quarterly", "move_out", "custom"], required: true },
  surveyScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveySchedule", default: null },
  surveyType: String,
  branchId: { type: String, default: null, index: true },
  year: Number,
  quarter: Number,
  dateRange: { from: Date, to: Date },
  version: { type: Number, required: true, min: 1 },
  responseCount: { type: Number, required: true },
  metricsSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: { type: String, required: true },
  positiveFindings: [String],
  negativeFindings: [String],
  recurringIssues: [String],
  possibleCauses: [String],
  recommendations: [{
    issue: String, evidence: mongoose.Schema.Types.Mixed, recommendedAction: String,
    priority: String, suggestedOwner: String, suggestedTimeline: String,
    metricToMonitor: String, expectedResult: String,
  }],
  priorityActions: [String],
  trendAnalysis: [String],
  limitations: [String],
  modelMetadata: mongoose.Schema.Types.Mixed,
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ reportType: 1, branchId: 1, year: 1, quarter: 1, version: -1 });
export default mongoose.model("SurveyAIReport", schema);
