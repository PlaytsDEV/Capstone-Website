import mongoose from "mongoose";

const contractCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    branch: { type: String, required: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, collection: "contractCounters" },
);

contractCounterSchema.index({ branch: 1, year: 1 }, { unique: true });

export default mongoose.model("ContractCounter", contractCounterSchema);
