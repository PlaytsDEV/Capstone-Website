import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const schema = new mongoose.Schema({
  surveyScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveySchedule", default: null, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyTemplate", required: true, index: true },
  templateVersion: { type: Number, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  branchId: { type: String, enum: ROOM_BRANCHES, required: true, index: true },
  stayId: { type: mongoose.Schema.Types.ObjectId, ref: "Stay", required: true, index: true },
  moveOutRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null, index: true },
  surveyType: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ["pending", "opened", "in_progress", "submitted", "overdue", "expired", "waived"],
    default: "pending",
    index: true,
  },
  assignedAt: { type: Date, default: Date.now },
  openedAt: Date,
  startedAt: Date,
  submittedAt: Date,
  dueAt: { type: Date, required: true },
  closeAt: { type: Date, required: true },
  expiredAt: Date,
  waivedAt: Date,
  waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  waiverReason: { type: String, default: "", maxlength: 2000 },
  isAnonymous: { type: Boolean, default: true },
  isMandatory: { type: Boolean, default: false },
  allowResponseEditing: { type: Boolean, default: false },
  acceptLateSubmissions: { type: Boolean, default: false },
}, { timestamps: true });

schema.index(
  { surveyScheduleId: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { surveyScheduleId: { $type: "objectId" } } },
);
schema.index(
  { moveOutRequestId: 1, surveyType: 1 },
  { unique: true, partialFilterExpression: { moveOutRequestId: { $type: "objectId" } } },
);

export default mongoose.model("SurveyAssignment", schema);
