/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "update_branch_admin_emails.mjs" });

 * Migration script to update Branch Admin email addresses in MongoDB and Firebase Auth.
 */

import admin from "firebase-admin";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ── Firebase Admin Init ────────────────────────────────────────────────────
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const auth = admin.auth();

const EMAIL_MIGRATIONS = [
  {
    oldEmail: "admin@lilycrest.com",
    newEmail: "gilpuyat_admin@lilycrest.com",
    branch: "gil-puyat",
  },
  {
    oldEmail: "guada_admin@lilycrest.com",
    newEmail: "guadalupe_admin@lilycrest.com",
    branch: "guadalupe",
  },
];

async function updateEmails() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  const usersCollection = mongoose.connection.db.collection("users");

  for (const item of EMAIL_MIGRATIONS) {
    console.log(`\nProcessing email migration for ${item.branch}: ${item.oldEmail} -> ${item.newEmail}`);

    // Check if user exists by old or new email
    let mongoUser = await usersCollection.findOne({ email: item.oldEmail });
    if (!mongoUser) {
      mongoUser = await usersCollection.findOne({ email: item.newEmail });
      if (mongoUser) {
        console.log(`User already has new email in MongoDB: ${item.newEmail}`);
      } else {
        console.warn(`⚠️ User not found in MongoDB by ${item.oldEmail} or ${item.newEmail}`);
      }
    } else {
      // Update in MongoDB
      await usersCollection.updateOne(
        { _id: mongoUser._id },
        { $set: { email: item.newEmail } }
      );
      console.log(`✅ MongoDB email updated: ${item.oldEmail} -> ${item.newEmail}`);
    }

    // Update in Firebase Auth
    try {
      let fbUser;
      try {
        fbUser = await auth.getUserByEmail(item.oldEmail);
      } catch {
        fbUser = await auth.getUserByEmail(item.newEmail);
      }

      if (fbUser) {
        await auth.updateUser(fbUser.uid, {
          email: item.newEmail,
          emailVerified: true,
        });
        console.log(`✅ Firebase Auth email updated for UID ${fbUser.uid}: -> ${item.newEmail}`);
      }
    } catch (fbErr) {
      console.error(`❌ Firebase Auth error for ${item.branch}:`, fbErr.message);
    }
  }

  console.log("\n--- Verification of Branch Admin accounts in MongoDB ---");
  const branchAdmins = await usersCollection.find({ role: "branch_admin" }).toArray();
  for (const u of branchAdmins) {
    console.log(`Email: ${u.email} | Username: ${u.username} | Name: ${u.firstName} ${u.lastName} | Branch: ${u.branch}`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Branch admin email migration complete.");
}

updateEmails().catch((err) => {
  console.error("❌ Fatal error updating branch admin emails:", err);
  process.exit(1);
});
