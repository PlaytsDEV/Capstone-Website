import mongoose from "mongoose";

const schema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyAssignment", required: true, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  surveyScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveySchedule", default: null },
  notificationType: { type: String, required: true },
  channel: { type: String, enum: ["in_app", "email"], required: true },
  scheduledAt: { type: Date, required: true },
  sentAt: Date,
  status: { type: String, enum: ["pending", "sent", "failed"], default: "pending", index: true },
  failureReason: { type: String, default: "", maxlength: 1000 },
  retryCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

schema.index(
  { assignmentId: 1, notificationType: 1, channel: 1 },
  { unique: true },
);
export default mongoose.model("SurveyNotificationLog", schema);
