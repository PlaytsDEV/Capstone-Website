/**
 * =============================================================================
 * FIREBASE ADMIN SDK CONFIGURATION
 * =============================================================================
 *
 * Firebase Admin SDK initialization for server-side authentication and user management.
 *
 * Purpose:
 * - Verify Firebase ID tokens sent from the client
 * - Manage user custom claims (roles: branch_admin, owner)
 * - Access Firebase Authentication user data
 *
 * Security Notes:
 * - Private key and credentials are stored in environment variables
 * - Never commit service account credentials to version control
 * - Firebase is the single source of truth for authentication
 *
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID: Your Firebase project ID
 * - FIREBASE_PRIVATE_KEY_ID: Private key ID from service account
 * - FIREBASE_PRIVATE_KEY: Private key (with \n replaced by \\n)
 * - FIREBASE_CLIENT_EMAIL: Service account email
 * - FIREBASE_CLIENT_ID: Client ID
 * - FIREBASE_CLIENT_CERT_URL: Certificate URL
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Service Account Configuration
 *
 * This object contains the credentials needed to authenticate
 * the Firebase Admin SDK with your Firebase project.
 *
 * The private key needs special handling:
 * - In .env file, newlines are stored as "\\n"
 * - We replace them with actual newline characters "\n"
 */
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,

  // Replace escaped newlines with actual newlines for the private key
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),

  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,

  // Standard Firebase Auth URLs
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",

  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com",
};

const requiredEnvVars = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
  "FIREBASE_CLIENT_CERT_URL",
];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

const authEmulatorHost = String(process.env.FIREBASE_AUTH_EMULATOR_HOST || "").trim();
const emulatorProjectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
const canUseAuthEmulator = Boolean(authEmulatorHost)
  && !authEmulatorHost.includes("://")
  && /^(127\.0\.0\.1|localhost|\[?::1\]?):\d+$/.test(authEmulatorHost)
  && emulatorProjectId.startsWith("demo-")
  && process.env.NODE_ENV !== "production";
const canInitialize = canUseAuthEmulator || missingEnvVars.length === 0;

/**
 * Initialize Firebase Admin SDK
 *
 * This must be called before using any Firebase Admin features.
 * It authenticates the server with Firebase using the service account.
 *
 * IMPORTANT: Check if already initialized to prevent multiple initialization
 * errors when nodemon restarts the server.
 */
/**
 * Resolve the Cloud Storage bucket name to use, without requiring
 * FIREBASE_STORAGE_BUCKET to be explicitly set.
 *
 * `admin.storage().bucket()` (no argument) only resolves a bucket when the
 * app was initialized with an explicit `storageBucket` — which, on this
 * deployment, it was not (FIREBASE_STORAGE_BUCKET is absent from Render).
 * Rather than depending on that missing env var, resolve deterministically:
 *
 *   1. FIREBASE_STORAGE_BUCKET (explicit, if ever set — wins outright)
 *   2. GCLOUD_STORAGE_BUCKET / GOOGLE_CLOUD_STORAGE_BUCKET (explicit,
 *      common Google Cloud tooling convention, if ever set)
 *   3. `${FIREBASE_PROJECT_ID}.firebasestorage.app` — the verified real
 *      bucket for this project (manually confirmed:
 *      dormitorymanagement-caps-572cf.firebasestorage.app). This is the
 *      *current* Firebase default-bucket naming convention (projects
 *      created after ~Oct 2024 default to `.firebasestorage.app`, not the
 *      legacy `.appspot.com`), so it is safe to assume as a fallback for
 *      this project rather than a guess.
 *
 * A leading `gs://` is stripped from any explicit value, matching the
 * convention already accepted elsewhere in this codebase for stored bucket
 * URIs (see services/attachmentUploadService.js).
 */
function stripGsPrefix(value) {
  return String(value || "").trim().replace(/^gs:\/\//i, "");
}

export function resolveFirebaseStorageBucket() {
  const explicit = stripGsPrefix(
    process.env.FIREBASE_STORAGE_BUCKET
      || process.env.GCLOUD_STORAGE_BUCKET
      || process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
  );
  if (explicit) return explicit;

  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  if (projectId) return `${projectId}.firebasestorage.app`;

  return null;
}

const resolvedStorageBucket = resolveFirebaseStorageBucket();

try {
  if (authEmulatorHost && !canUseAuthEmulator) {
    console.error(
      "Firebase Auth Emulator configuration refused: use a loopback host, demo- project, and non-production runtime.",
    );
  } else if (!canInitialize) {
    console.error(
      "❌ Firebase Admin SDK initialization failed: Missing required env vars",
    );
    console.error("⚠️ Missing:", missingEnvVars.join(", "));
  } else if (!admin.apps.length) {
    admin.initializeApp(canUseAuthEmulator
      ? { projectId: emulatorProjectId }
      : {
        credential: admin.credential.cert(serviceAccount),
        storageBucket: resolvedStorageBucket || undefined,
      });
    console.log("✅ Firebase Admin SDK initialized successfully");
    if (canUseAuthEmulator) {
      console.log("Firebase Admin is isolated to the loopback Auth Emulator.");
    } else if (!process.env.FIREBASE_STORAGE_BUCKET && resolvedStorageBucket) {
      console.log(`ℹ️ FIREBASE_STORAGE_BUCKET not set — using derived bucket: ${resolvedStorageBucket}`);
    }
  } else {
    console.log("ℹ️ Firebase Admin SDK already initialized");
  }
} catch (error) {
  console.error("❌ Firebase Admin SDK initialization failed:", error.message);
  console.error("⚠️ Authentication features will not work!");

  // Don't exit the process - allow server to start for non-auth endpoints
  // This is useful during development or partial outages
}

/**
 * Export Firebase Auth module (lazy)
 *
 * This avoids throwing when Firebase failed to initialize.
 */
export const getAuth = () => {
  if (!admin.apps.length) {
    return null;
  }

  return admin.auth();
};

/**
 * Export Firebase Storage bucket (lazy)
 *
 * Returns the Cloud Storage bucket using the Admin SDK. Uploads via this
 * bypass client-side Storage security rules.
 *
 * Always passed an explicit bucket name (resolveFirebaseStorageBucket()),
 * rather than relying on `admin.storage().bucket()`'s bare default-bucket
 * resolution — that bare form only works when the app was initialized with
 * an explicit `storageBucket`, which is not guaranteed here (see
 * resolveFirebaseStorageBucket() above for why). This is the one source of
 * truth for which bucket every caller in this codebase uses.
 */
export const getFirebaseStorage = () => {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin SDK is not initialized.");
  }
  const bucketName = resolveFirebaseStorageBucket();
  if (!bucketName) {
    throw new Error("Firebase Storage bucket could not be resolved (no FIREBASE_STORAGE_BUCKET and no FIREBASE_PROJECT_ID).");
  }
  return admin.storage().bucket(bucketName);
};

/**
 * Export Firebase Admin instance
 *
 * Use this for accessing other Firebase services if needed in the future
 * (e.g., Firestore, Cloud Storage, Cloud Messaging)
 */
export default admin;
