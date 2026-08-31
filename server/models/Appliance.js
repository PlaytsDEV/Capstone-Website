import mongoose from "mongoose";

export const APPLIANCE_CATEGORIES = Object.freeze([
  "cooling",
  "cooking",
  "electronics",
  "personal_care",
  "general",
]);

const applianceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Appliance name is required"],
      trim: true,
      minlength: [3, "Appliance name must be at least 3 characters"],
      maxlength: [50, "Appliance name cannot exceed 50 characters"],
      match: [
        /^(?=.*[a-zA-Z])[a-zA-Z0-9\s\-()\/]+$/,
        "Appliance name must contain letters and valid characters (letters, digits, spaces, hyphens, parentheses)",
      ],
    },
    code: {
      type: String,
      required: [true, "Appliance code is required"],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    monthlyFee: {
      type: Number,
      required: [true, "Monthly fee is required"],
      min: [0, "Monthly fee cannot be negative"],
      max: [5000, "Monthly fee cannot exceed ₱5,000"],
      validate: {
        validator: (v) => Number.isInteger(v) && v % 10 === 0,
        message: "Monthly fee must be a whole number multiple of 10",
      },
      default: 0,
    },
    category: {
      type: String,
      enum: {
        values: APPLIANCE_CATEGORIES,
        message: "Invalid appliance category: {VALUE}",
      },
      default: "general",
      lowercase: true,
      trim: true,
    },
    maxQuantity: {
      type: Number,
      default: 5,
      min: [1, "Max quantity must be at least 1"],
      max: [10, "Max quantity cannot exceed 10"],
      validate: {
        validator: (v) => Number.isInteger(v),
        message: "Max quantity must be an integer",
      },
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [150, "Description cannot exceed 150 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful statics & query helpers
applianceSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

const Appliance = mongoose.models.Appliance || mongoose.model("Appliance", applianceSchema);

export default Appliance;
