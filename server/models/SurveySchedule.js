import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";
import { SURVEY_TYPES } from "./SurveyTemplate.js";

const schema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyTemplate", required: true, index: true },
  templateVersion: { type: Number, required: true },
  surveyType: { type: String, enum: SURVEY_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 250 },
  description: { type: String, default: "", maxlength: 3000 },
  year: { type: Number, min: 2020, max: 2200 },
  quarter: { type: Number, min: 1, max: 4 },
  branchId: { type: String, enum: ROOM_BRANCHES, default: null, index: true },
  startAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  closeAt: { type: Date, required: true },
  recurrence: { type: String, enum: ["none", "quarterly"], default: "none" },
  eligibilityRules: {
    minimumTenancyDays: { type: Number, default: 14, min: 0 },
    lateMoveInBehavior: {
      type: String,
      enum: ["assign_when_eligible", "assign_immediately", "skip_quarter"],
      default: "assign_when_eligible",
    },
    targetGroup: { type: String, default: "active_tenants" },
  },
  reminderRules: {
    daysBeforeDue: { type: [Number], default: [7, 3, 0] },
    sendOverdue: { type: Boolean, default: true },
  },
  isAnonymous: { type: Boolean, default: true },
  isMandatory: { type: Boolean, default: false },
  allowResponseEditing: { type: Boolean, default: false },
  acceptLateSubmissions: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["draft", "scheduled", "active", "closed", "archived", "cancelled"],
    default: "draft",
    index: true,
  },
  activatedAt: Date,
  closedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index(
  { surveyType: 1, year: 1, quarter: 1, branchId: 1, templateId: 1 },
  { unique: true, partialFilterExpression: { surveyType: "quarterly_satisfaction" } },
);
schema.pre("validate", function validateDates(next) {
  if (!(this.startAt < this.dueAt && this.dueAt <= this.closeAt)) {
    return next(new Error("Survey dates must satisfy startAt < dueAt <= closeAt"));
  }
  next();
});

export default mongoose.model("SurveySchedule", schema);
