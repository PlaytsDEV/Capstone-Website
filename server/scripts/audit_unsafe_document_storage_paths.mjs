/**
 * Read-only audit for the MOB-P0-01 storage-authorization invariant
 * (services/documentStorageAuthorization.service.js): scans every tenant's
 * `users.uploaded_documents` entries and reports any record whose
 * storagePath/downloadUrl can no longer be proven to belong to that same
 * tenant under the current bucket configuration.
 *
 * This does NOT modify any record. A flagged record is not necessarily an
 * active exploit — most will be legitimate historical uploads written
 * before this invariant existed under a different prefix convention — but
 * every flagged record now fails closed (409, re-upload required) the next
 * time its owner tries to read or delete it via GET/DELETE
 * /api/m/users/documents/:docId, per services/mobileUserDocumentService.js.
 * This script lets that population be sized and reviewed before tenants
 * hit it organically.
 *
 * Intentionally dry-run only — no --write/--apply/--repair flag exists.
 * Any remediation (re-registering a corrected storagePath, or asking the
 * tenant to re-upload) must go through the normal authenticated upload
 * flow, never a direct DB write from this script.
 *
 * Usage: node scripts/audit_unsafe_document_storage_paths.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { authorizeTenantStorageObject } from "../services/documentStorageAuthorization.service.js";
import { resolveFirebaseStorageBucket } from "../config/firebase.js";

dotenv.config();

if (process.argv.some((argument) => ["--write", "--apply", "--repair"].includes(argument))) {
  throw new Error(
    "This command is intentionally dry-run only. Remediation must go through the normal authenticated re-upload flow.",
  );
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const configuredBucket = resolveFirebaseStorageBucket();
if (!configuredBucket) {
  throw new Error("Firebase Storage bucket could not be resolved (no FIREBASE_STORAGE_BUCKET and no FIREBASE_PROJECT_ID) — cannot audit against an unknown bucket.");
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const cursor = mongoose.connection.db.collection("users").find(
    { "uploaded_documents.storagePath": { $exists: true, $ne: null } },
    { projection: { user_id: 1, uploaded_documents: 1 } },
  );

  let scannedUsers = 0;
  let scannedDocuments = 0;
  const flagged = [];

  for await (const user of cursor) {
    scannedUsers += 1;
    for (const doc of user.uploaded_documents || []) {
      if (!doc.storagePath) continue;
      scannedDocuments += 1;

      const result = authorizeTenantStorageObject({
        downloadUrl: doc.downloadUrl || doc.file_url,
        storagePath: doc.storagePath,
        userId: user.user_id,
        configuredBucket,
      });
      if (result.authorized) continue;

      flagged.push({
        userId: user.user_id,
        docId: doc.doc_id,
        type: doc.type || null,
        status: doc.status || null,
        uploadedAt: doc.uploaded_at || doc.uploadedAt || null,
        storagePath: doc.storagePath,
        reason: result.reason,
      });
    }
  }

  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    configuredBucket,
    scannedUsers,
    scannedDocuments,
    flaggedCount: flagged.length,
    flagged,
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
