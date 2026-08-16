/**
 * One-time / idempotent script to create or update the Gil Puyat branch admin account.
 * Run with: node --env-file=.env scripts/create-branchadmin-gilpuyat.js
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

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const auth = admin.auth();

// ── Branch Admin Credentials ─────────────────────────────────────────────────
const EMAIL = "gilpuyat_admin@lilycrest.com";
const PASSWORD = String(process.env.REGULAR_ADMIN_PASSWORD || process.env.PROVISIONING_ADMIN_PASSWORD || "Lilycrest2026!");

// ── MongoDB User Schema (minimal inline) ──────────────────────────────────
const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  username:    { type: String, required: true, unique: true },
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  role:        { type: String, default: "branch_admin" },
  branch:      { type: String, default: "gil-puyat" },
  accountStatus: { type: String, default: "active" },
  isActive:    { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: true },
  isArchived:  { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

// ── Main ───────────────────────────────────────────────────────────────────
async function run() {
  if (!PASSWORD) throw new Error("A valid password is required for provisioning");
  await mongoose.connect(process.env.MONGODB_URI);
  const identity = await resolveProvisioningIdentity({
    email: EMAIL,
    auth,
    findMongoUser: (email) => User.findOne({ email }),
  });
  let firebaseUid = identity.firebaseUser?.uid;
  if (firebaseUid) {
    console.log(`Firebase identity verified (non-reversible UID fingerprint: ${uidFingerprint(firebaseUid)})`);
    await auth.updateUser(firebaseUid, { password: PASSWORD, displayName: "Gil Puyat Branch Admin", emailVerified: true });
  } else {
    const created = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Gil Puyat Branch Admin", emailVerified: true });
    firebaseUid = created.uid;
    console.log(`Firebase identity created (non-reversible UID fingerprint: ${uidFingerprint(firebaseUid)})`);
  }

  const existingMongo = identity.mongoUser;
  if (existingMongo) {
    existingMongo.username = "gilpuyat_admin";
    existingMongo.firstName = "Gil Puyat";
    existingMongo.lastName = "Branch Admin";
    existingMongo.role = "branch_admin";
    existingMongo.branch = "gil-puyat";
    existingMongo.accountStatus = "active";
    existingMongo.isActive = true;
    existingMongo.isArchived = false;
    await existingMongo.save();
  } else {
    await User.create({
      firebaseUid,
      email:     EMAIL,
      username:  "gilpuyat_admin",
      firstName: "Gil Puyat",
      lastName:  "Branch Admin",
      role:      "branch_admin",
      branch:    "gil-puyat",
      accountStatus: "active",
      isActive:  true,
      isEmailVerified: true,
      isArchived: false,
      permissions: [
          "manageReservations",
          "manageTenants",
          "manageBilling",
          "manageRooms",
          "manageMaintenance",
          "manageAnnouncements",
          "viewReports",
          "manageUsers"
      ],
    });
  }
  console.log("✅ Gil Puyat Branch Admin account provisioned/verified successfully.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
