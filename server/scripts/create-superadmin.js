/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "create-superadmin.js" });

 * One-time script to recreate the superadmin account.
 * Run with: node --env-file=.env scripts/create-superadmin.js
 */

import admin from "firebase-admin";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolveProvisioningIdentity, uidFingerprint } from "./provisioningIdentitySafety.js";

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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();

// ── Superadmin Credentials ─────────────────────────────────────────────────
const EMAIL = "superadmin@lilycrest.com";
const PASSWORD = String(process.env.PROVISIONING_ADMIN_PASSWORD || "");

// ── MongoDB User Schema (minimal inline) ──────────────────────────────────
const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  username:    { type: String, required: true, unique: true },
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  role:        { type: String, default: "applicant" },
  branch:      { type: String, default: null },
  accountStatus: { type: String, default: "active" },
  isActive:    { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: true },
  isArchived:  { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

// ── Main ───────────────────────────────────────────────────────────────────
async function run() {
  if (!PASSWORD) throw new Error("PROVISIONING_ADMIN_PASSWORD is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const identity = await resolveProvisioningIdentity({
    email: EMAIL,
    auth,
    findMongoUser: (email) => User.findOne({ email }),
  });
  let firebaseUid = identity.firebaseUser?.uid;
  if (firebaseUid) {
    console.log(`Firebase identity verified (non-reversible UID fingerprint: ${uidFingerprint(firebaseUid)})`);
    await auth.updateUser(firebaseUid, { password: PASSWORD, emailVerified: true });
  } else {
    const created = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Super Admin", emailVerified: true });
    firebaseUid = created.uid;
    console.log(`Firebase identity created (non-reversible UID fingerprint: ${uidFingerprint(firebaseUid)})`);
  }

  const existingMongo = identity.mongoUser;
  if (existingMongo) {
    existingMongo.role = "owner";
    existingMongo.accountStatus = "active";
    existingMongo.isActive = true;
    existingMongo.isArchived = false;
    await existingMongo.save();
  } else {
    await User.create({
      firebaseUid,
      email:     EMAIL,
      username:  "superadmin",
      firstName: "Super",
      lastName:  "Admin",
      role:      "owner",
      branch:    null,
      accountStatus: "active",
      isActive:  true,
      isEmailVerified: true,
      isArchived: false,
      permissions: [],
    });
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
