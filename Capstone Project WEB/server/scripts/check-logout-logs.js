import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/lilycrest-dormitory";

async function checkLogoutLogs() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check for logout logs
    const logoutLogs = await AuditLog.find({
      $or: [{ action: /logout/i }, { details: /logout/i }],
    })
      .sort({ timestamp: -1 })
      .limit(10);

    console.log("\n📋 Logout logs found:", logoutLogs.length);

    if (logoutLogs.length > 0) {
      logoutLogs.forEach((log) => {
        console.log(
          `  - ${log.timestamp} | ${log.action} | ${log.user} | Role: ${log.userRole}`,
        );
      });
    } else {
      console.log("  No logout logs found in database");
    }

    // Check recent login-type logs
    console.log("\n📋 Recent login-type logs:");
    const loginLogs = await AuditLog.find({ type: "login" })
      .sort({ timestamp: -1 })
      .limit(10);
    console.log("  Found:", loginLogs.length);
    loginLogs.forEach((log) => {
      console.log(
        `  - ${log.timestamp} | ${log.action} | ${log.user} | Role: ${log.userRole}`,
      );
    });

    // Check all recent logs
    console.log("\n📋 All recent logs (last 10):");
    const allLogs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(10);
    allLogs.forEach((log) => {
      console.log(
        `  - ${log.timestamp} | ${log.type} | ${log.action} | ${log.user}`,
      );
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkLogoutLogs();
