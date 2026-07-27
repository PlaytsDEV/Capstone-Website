import mongoose from "mongoose";

const schema = new mongoose.Schema({
  issueTitle: { type: String, required: true, maxlength: 300 },
  aiReportId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyAIReport", required: true },
  surveyScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveySchedule", default: null },
  branchId: { type: String, default: null, index: true },
  description: { type: String, required: true, maxlength: 4000 },
  priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
  assignedDepartment: String,
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  targetDate: Date,
  status: {
    type: String,
    enum: ["proposed", "approved", "in_progress", "completed", "rejected", "deferred"],
    default: "proposed",
  },
  resolution: String,
  completedAt: Date,
  evidenceNotes: String,
  followUpMetric: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("SurveyImprovementAction", schema);
