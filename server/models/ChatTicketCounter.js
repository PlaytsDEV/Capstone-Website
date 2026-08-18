import mongoose from "mongoose";

const chatTicketCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, collection: "chatTicketCounters" },
);

export default mongoose.model("ChatTicketCounter", chatTicketCounterSchema);
