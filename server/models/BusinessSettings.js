import mongoose from "mongoose";
import { BUSINESS } from "../config/constants.js";

const branchOverrideSchema = new mongoose.Schema(
  {
    isApplianceFeeEnabled: {
      type: Boolean,
      default: false,
    },
    applianceFeeAmountPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const businessSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    reservationFeeAmount: {
      type: Number,
      default: BUSINESS.DEPOSIT_AMOUNT,
      min: 0,
    },
    penaltyRatePerDay: {
      type: Number,
      default: BUSINESS.PENALTY_RATE_PER_DAY,
      min: 0,
    },
    defaultElectricityRatePerKwh: {
      type: Number,
      default: BUSINESS.DEFAULT_ELECTRICITY_RATE_PER_KWH,
      min: 0,
    },
    defaultWaterRatePerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    branchOverrides: {
      type: Map,
      of: branchOverrideSchema,
      default: () => ({
        "gil-puyat": {
          isApplianceFeeEnabled: false,
          applianceFeeAmountPerUnit: 0,
        },
        guadalupe: {
          isApplianceFeeEnabled: true,
          applianceFeeAmountPerUnit: 200,
        },
      }),
    },
  },
  { timestamps: true },
);

export default mongoose.model("BusinessSettings", businessSettingsSchema);
