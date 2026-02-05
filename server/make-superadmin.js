/**
 * Script to make a user a super-admin in the database
 * Usage: node make-superadmin.js <email>
 */

import mongoose from "mongoose";
import User from "./models/User.js";
import { connect } from "./config/database.js";

async function makeSuperAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.log("Usage: node make-superadmin.js <email>");
    process.exit(1);
  }

  try {
    await connect();
    console.log(`\n🔍 Looking up user: ${email}`);

    const user = await User.findOneAndUpdate(
      { email },
      { role: "superAdmin", branch: "" },
      { new: true }
    );

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ User updated to superAdmin:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Branch: ${user.branch || "(none)"}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

makeSuperAdmin();
