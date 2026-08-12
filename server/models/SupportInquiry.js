/**
 * ============================================================================
 * SUPPORT INQUIRY MODEL (Preserved Legacy Model)
 * ============================================================================
 *
 * @deprecated This is the original Inquiry model — a contact form / support
 * ticket system. Preserved to avoid breaking existing controllers and data.
 *
 * Going forward, use the new Inquiry model (inquiry-pipeline) which is the
 * lead capture and conversion pipeline per Spec §4.
 *
 * COLLECTION: "supportinquiries" (Mongoose auto-pluralizes "SupportInquiry")
 * Existing data in the "inquiries" collection is NOT migrated — it is
 * gradually replaced as the new Inquiry pipeline handles new intake.
 *
 * ============================================================================
 */

import mongoose from "mongoose";

const VALID_BRANCHES = ["gil-puyat", "guadalupe", "general"];
const VALID_STATUSES = ["pending", "in-progress", "resolved", "closed"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_TAGS = [
  "room-inquiry",
  "pricing",
  "availability",
  "amenities",
  "location",
  "booking",
  "complaint",
  "feedback",
  "maintenance",
  "billing",
  "general",
  "urgent",
];

const supportInquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    branch: {
      type: String,
      required: true,
      enum: VALID_BRANCHES,
      index: true,
    },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: VALID_PRIORITIES,
      default: "medium",
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) => tags.every((tag) => VALID_TAGS.includes(tag)),
        message: `Invalid tag. Valid tags: ${VALID_TAGS.join(", ")}`,
      },
    },
    response: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

supportInquirySchema.index({ branch: 1, status: 1 });
supportInquirySchema.index({ branch: 1, createdAt: -1 });
supportInquirySchema.index({ isArchived: 1, status: 1 });
supportInquirySchema.index({ isArchived: 1, createdAt: -1 });

supportInquirySchema.methods.archive = async function (archivedById = null) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = archivedById;
  return this.save();
};

supportInquirySchema.methods.restore = async function () {
  this.isArchived = false;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

supportInquirySchema.methods.respond = async function (responseText, responderId) {
  this.response = responseText;
  this.respondedBy = responderId;
  this.respondedAt = new Date();
  this.status = "resolved";
  return this.save();
};

supportInquirySchema.methods.markAsRead = async function () {
  this.isRead = true;
  return this.save();
};

supportInquirySchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isArchived: false });
};

supportInquirySchema.statics.findPending = function (branch = null) {
  const filter = { isArchived: false, status: "pending" };
  if (branch && branch !== "all") filter.branch = branch;
  return this.find(filter).sort({ createdAt: -1 });
};

export { VALID_BRANCHES, VALID_STATUSES, VALID_PRIORITIES, VALID_TAGS };
export default mongoose.model("SupportInquiry", supportInquirySchema);
