import path from "path";
import fs from "fs/promises";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract } from "../models/index.js";

dotenv.config();
const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("A private backup directory is required.");
await mongoose.connect(process.env.MONGODB_URI);
try {
  const records = await Contract.find({}).lean();
  const output = path.resolve(outputDirectory, "contract-records.json");
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.writeFile(output, JSON.stringify({
    exportedAt: new Date().toISOString(),
    collection: "contracts",
    recordCount: records.length,
    records,
  }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ output, recordCount: records.length }));
} finally {
  await mongoose.disconnect();
}
