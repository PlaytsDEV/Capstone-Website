import mongoose from "mongoose";
import dotenv from "dotenv";
import Inquiry from "./models/Inquiry.js";

dotenv.config({ path: "./.env" });

async function checkAllInquiryBranches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const inquiries = await Inquiry.find({});
    console.log("Total Inquiries:", inquiries.length);
    const summary = inquiries.map(i => ({
      id: i._id,
      name: i.name || i.fullName,
      email: i.email,
      branch: i.branch,
      preferredBranch: i.preferredBranch,
    }));
    console.log("Summary of all inquiries in DB:");
    console.dir(summary, { maxArrayLength: null });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAllInquiryBranches();
