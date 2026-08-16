import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

const normalizeTextList = (items = []) =>
  [...new Set(
    (Array.isArray(items) ? items : [items])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  )];

const toCategoryKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const serviceProviderSchema = new mongoose.Schema(
  {
    providerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    serviceCategories: {
      type: [String],
      default: [],
      index: true,
    },
    serviceCategoryKeys: {
      type: [String],
      default: [],
      index: true,
      select: false,
    },
    branchCoverage: {
      type: [String],
      enum: ROOM_BRANCHES,
      default: [],
      index: true,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
    minRate: {
      type: Number,
      default: null,
      min: 0,
    },
    maxRate: {
      type: Number,
      default: null,
      min: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    averageResponseTime: {
      type: String,
      default: null,
      trim: true,
    },
    internalRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRatingPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    externalRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    externalReviewCount: {
      type: Number,
      default: null,
      min: 0,
    },
    internalFeedback: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: String,
      default: null,
      trim: true,
    },
    updatedBy: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    collection: "service_providers",
    timestamps: true,
  },
);

serviceProviderSchema.pre("validate", function normalizeProvider(next) {
  this.serviceCategories = normalizeTextList(this.serviceCategories);
  this.serviceCategoryKeys = this.serviceCategories.map(toCategoryKey).filter(Boolean);
  this.branchCoverage = normalizeTextList(this.branchCoverage).map((branch) =>
    branch.toLowerCase(),
  );
  this.tags = normalizeTextList(this.tags);
  this.internalFeedback = normalizeTextList(this.internalFeedback);
  next();
});

serviceProviderSchema.index({
  providerName: "text",
  notes: "text",
  serviceCategories: "text",
});
serviceProviderSchema.index({ status: 1, branchCoverage: 1 });
serviceProviderSchema.index({ status: 1, serviceCategoryKeys: 1 });

const ServiceProvider = mongoose.model("ServiceProvider", serviceProviderSchema);

export { toCategoryKey };
export default ServiceProvider;
