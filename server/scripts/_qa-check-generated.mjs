import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
const { Contract } = await import("../models/index.js");
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const nums = ["00005", "GUAD-2026-00004", "00014", "00017", "00028", "00086", "GUAD-2026-00008"];
for (const n of nums) {
  const c = await Contract.findOne({ contractNumber: new RegExp(n.replace("GUAD-2026-","GUAD-2026-")) }).lean();
  if (!c) { console.log(n, "not found"); continue; }
  console.log(c.contractNumber, "status=", c.status, "prepared=", c.preparedDocument ? "present" : "absent", "updatedAt=", c.updatedAt);
}
await mongoose.disconnect();
