/**
 * Script to update and standardize Branch Admin usernames, first/last names,
 * and Firebase display names for Gil Puyat and Guadalupe branches.
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

const TARGET_ADMINS = [
  {
    email: "gilpuyat_admin@lilycrest.com",
    newUsername: "gilpuyat_admin",
    newFirstName: "Gil Puyat",
    newLastName: "Branch Admin",
    newDisplayName: "Gil Puyat Branch Admin",
    branch: "gil-puyat",
  },
  {
    email: "guadalupe_admin@lilycrest.com",
    newUsername: "guadalupe_admin",
    newFirstName: "Guadalupe",
    newLastName: "Branch Admin",
    newDisplayName: "Guadalupe Branch Admin",
    branch: "guadalupe",
  },
];

async function updateBranchAdmins() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  const usersCollection = mongoose.connection.db.collection("users");

  for (const target of TARGET_ADMINS) {
    console.log(`\nProcessing ${target.email} (${target.branch})...`);

    // 1. Check existing MongoDB record
    const mongoUser = await usersCollection.findOne({ email: target.email });
    if (!mongoUser) {
      console.warn(`⚠️ No MongoDB record found for ${target.email}`);
    } else {
      console.log(`Current MongoDB user: username="${mongoUser.username}", name="${mongoUser.firstName} ${mongoUser.lastName}"`);

      // Update MongoDB record
      const updateResult = await usersCollection.updateOne(
        { email: target.email },
        {
          $set: {
            username: target.newUsername,
            firstName: target.newFirstName,
            lastName: target.newLastName,
            role: "branch_admin",
            branch: target.branch,
          },
        }
      );
      console.log(`✅ MongoDB updated: matched ${updateResult.matchedCount}, modified ${updateResult.modifiedCount}`);
    }

    // 2. Update Firebase Auth display name if user exists in Firebase
    try {
      const firebaseUser = await auth.getUserByEmail(target.email);
      console.log(`Current Firebase user: uid="${firebaseUser.uid}", displayName="${firebaseUser.displayName}"`);
      await auth.updateUser(firebaseUser.uid, {
        displayName: target.newDisplayName,
      });
      console.log(`✅ Firebase displayName updated to "${target.newDisplayName}"`);
    } catch (fbErr) {
      if (fbErr.code === "auth/user-not-found") {
        console.warn(`⚠️ Firebase user not found for ${target.email}`);
      } else {
        console.error(`❌ Firebase update error for ${target.email}:`, fbErr.message);
      }
    }
  }

  // 3. Output updated state for verification
  console.log("\n--- Verification of updated admin accounts in MongoDB ---");
  const updatedAdmins = await usersCollection
    .find({ email: { $in: TARGET_ADMINS.map((t) => t.email) } })
    .toArray();

  for (const u of updatedAdmins) {
    console.log(`Email: ${u.email}`);
    console.log(`  Username:  ${u.username}`);
    console.log(`  Name:      ${u.firstName} ${u.lastName}`);
    console.log(`  Role:      ${u.role}`);
    console.log(`  Branch:    ${u.branch}`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Branch admin identity update completed successfully.");
}

updateBranchAdmins().catch((err) => {
  console.error("❌ Fatal error updating branch admins:", err);
  process.exit(1);
});
