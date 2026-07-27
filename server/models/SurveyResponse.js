import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionKey: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
}, { _id: false });

const revisionSchema = new mongoose.Schema({
  answers: [answerSchema],
  editedAt: { type: Date, default: Date.now },
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { _id: false });

const schema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyAssignment", required: true, unique: true },
  surveyScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveySchedule", default: null, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyTemplate", required: true, index: true },
  templateVersion: { type: Number, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  branchId: { type: String, required: true, index: true },
  stayId: { type: mongoose.Schema.Types.ObjectId, ref: "Stay", required: true },
  moveOutRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
  answers: [answerSchema],
  completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
  isAnonymous: { type: Boolean, default: true },
  status: { type: String, enum: ["draft", "submitted"], default: "draft", index: true },
  submittedAt: Date,
  lastSavedAt: Date,
  editedAt: Date,
  revisions: [revisionSchema],
}, { timestamps: true });

schema.index({ surveyScheduleId: 1, status: 1, branchId: 1 });
export default mongoose.model("SurveyResponse", schema);
