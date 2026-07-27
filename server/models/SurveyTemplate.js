import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

export const SURVEY_TYPES = [
  "quarterly_satisfaction", "move_out", "maintenance", "reservation",
  "move_in", "facility", "event", "custom",
];
export const QUESTION_TYPES = [
  "single_choice", "multiple_choice", "yes_no", "rating_5", "rating_10",
  "star_rating", "likert", "short_text", "long_text", "number", "date",
  "dropdown", "ranking", "nps",
];

const questionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  helpText: { type: String, default: "", maxlength: 1000 },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  required: { type: Boolean, default: false },
  order: { type: Number, required: true, min: 0 },
  category: { type: String, default: "General", trim: true },
  options: [{ value: String, label: String }],
  min: Number,
  max: Number,
  characterLimit: { type: Number, default: 4000, min: 1, max: 20000 },
  conditional: {
    questionKey: String,
    operator: { type: String, enum: ["equals", "not_equals", "includes"], default: "equals" },
    value: mongoose.Schema.Types.Mixed,
    requiredWhenVisible: { type: Boolean, default: false },
  },
  includeInAnalytics: { type: Boolean, default: true },
  includeInAI: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, { _id: true });

const schema = new mongoose.Schema({
  familyKey: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: "", maxlength: 3000 },
  purpose: { type: String, default: "", maxlength: 1000 },
  surveyType: { type: String, enum: SURVEY_TYPES, required: true, index: true },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["draft", "active", "inactive", "archived"], default: "draft", index: true },
  isSystemTemplate: { type: Boolean, default: false, index: true },
  systemTemplateKey: { type: String, default: null, trim: true, index: true },
  industryCategory: { type: String, default: "", trim: true },
  recommendedFrequency: { type: String, default: "", trim: true },
  recommendedTrigger: { type: String, default: "", trim: true },
  estimatedCompletionMinutes: { type: String, default: "", trim: true },
  analyticsCategories: [{ type: String, trim: true }],
  defaultAnonymousSetting: { type: Boolean, default: true },
  templateVersion: { type: String, default: "1.0.0", trim: true },
  sourceSystemTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "SurveyTemplate", default: null },
  sourceTemplateVersion: { type: String, default: null, trim: true },
  copyKey: { type: String, default: null, trim: true },
  introductoryText: { type: String, default: "", maxlength: 3000 },
  branchIds: [{ type: String, enum: ROOM_BRANCHES }],
  questions: {
    type: [questionSchema],
    validate: [(value) => value.length > 0, "At least one question is required"],
  },
  isAnonymous: { type: Boolean, default: true },
  isMandatory: { type: Boolean, default: false },
  allowResponseEditing: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  publishedAt: Date,
  archivedAt: Date,
}, { timestamps: true });

schema.index({ familyKey: 1, version: 1 }, { unique: true });
schema.index(
  { systemTemplateKey: 1, templateVersion: 1 },
  { unique: true, partialFilterExpression: { isSystemTemplate: true } },
);
schema.index({ surveyType: 1, status: 1, branchIds: 1 });
schema.index(
  { copyKey: 1 },
  { unique: true, partialFilterExpression: { copyKey: { $type: "string" } } },
);

export default mongoose.model("SurveyTemplate", schema);
