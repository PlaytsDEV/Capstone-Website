#!/usr/bin/env node
import mongoose from "mongoose";
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
import { normalizeQaRunId } from "./qaFixtureIds.js";

assertStagingWriteTarget(process.env, { toolName: "staging QA fixture cleanup" });

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const ids = (records) => records.map((record) => record._id);
const nonEmpty = (values) => values.filter(Boolean);

const runId = normalizeQaRunId(required("QA_RUN_ID"));
const execute = process.argv.includes("--confirm-staging-cleanup");
const listOnly = process.argv.includes("--list-only");
const dbName = String(process.env.DB_NAME || "").trim() || undefined;
await mongoose.connect(required("MONGODB_URI"), { ...(dbName ? { dbName } : {}) });
const db = mongoose.connection.db;

const recordsByCollection = new Map();
async function collect(collectionName, filter) {
  const records = await db.collection(collectionName).find(filter).sort({ _id: 1 }).toArray();
  recordsByCollection.set(collectionName, records);
  return records;
}

const runManifests = await collect("qa_fixture_runs", { qa_run_id: runId });
const users = await collect("users", { qa_fixture: true, qa_run_id: runId });
const userMongoIds = ids(users);
const tenantMongoIds = ids(users.filter((user) => user.role === "tenant"));
const adminMongoIds = ids(users.filter((user) => ["owner", "branch_admin", "admin", "superadmin"].includes(user.role)));
const businessUserIds = nonEmpty(users.map((user) => user.user_id));
const firebaseUids = [...new Set(nonEmpty([
  ...users.map((user) => user.firebaseUid || user.firebase_uid),
  ...runManifests.flatMap((manifest) => Object.values(manifest.auth_uids || {})),
]))];

const rooms = await collect("rooms", { qa_fixture: true, qa_run_id: runId });
const reservations = await collect("reservations", {
  $or: [{ qa_run_id: runId }, { userId: { $in: tenantMongoIds } }],
});
const stays = await collect("stays", {
  $or: [{ qa_run_id: runId }, { tenantId: { $in: tenantMongoIds } }],
});
const contracts = await collect("contracts", {
  $or: [{ qa_run_id: runId }, { tenantId: { $in: tenantMongoIds } }],
});
const bills = await collect("bills", {
  $or: [
    { qa_run_id: runId },
    { userId: { $in: tenantMongoIds } },
    { user_id: { $in: businessUserIds } },
    { tenantUserId: { $in: businessUserIds } },
  ],
});
const maintenance = await collect("maintenance_requests", {
  $or: [{ qa_run_id: runId }, { user_id: { $in: businessUserIds } }, { userId: { $in: tenantMongoIds } }],
});
const conversations = await collect("chat_conversations", {
  $or: [{ qa_run_id: runId }, { tenantId: { $in: tenantMongoIds } }, { tenantUserId: { $in: businessUserIds } }],
});
const conversationIds = ids(conversations);

await collect("chat_messages", { $or: [{ qa_run_id: runId }, { conversationId: { $in: conversationIds } }] });
await collect("chat_attachments", {
  $or: [
    { qa_run_id: runId },
    { conversationId: { $in: conversationIds } },
    { uploadedBy: { $in: [...userMongoIds, ...businessUserIds] } },
  ],
});
await collect("notifications", {
  $or: [
    { qa_run_id: runId },
    { userId: { $in: userMongoIds } },
    { user_id: { $in: businessUserIds } },
  ],
});
await collect("notification_reads", { $or: [{ qa_run_id: runId }, { user_id: { $in: businessUserIds } }] });
await collect("notification_read_state", { $or: [{ qa_run_id: runId }, { user_id: { $in: businessUserIds } }] });
await collect("user_sessions", { $or: [{ qa_run_id: runId }, { user_id: { $in: businessUserIds } }] });
await collect("otp_store", { $or: [{ qa_run_id: runId }, { user_id: { $in: businessUserIds } }] });
await collect("announcements", {
  $or: [{ qa_run_id: runId }, { publishedBy: { $in: adminMongoIds } }, { createdBy: { $in: adminMongoIds } }],
});
await collect("payments", {
  $or: [
    { qa_run_id: runId },
    { userId: { $in: tenantMongoIds } },
    { tenantId: { $in: tenantMongoIds } },
    { reservationId: { $in: ids(reservations) } },
  ],
});
await collect("uploaded_documents", {
  $or: [
    { qa_run_id: runId },
    { userId: { $in: tenantMongoIds } },
    { tenantId: { $in: tenantMongoIds } },
    { contractId: { $in: ids(contracts) } },
  ],
});
await collect("qa_notification_dispatch_audits", { qa_run_id: runId });

const listed = [];
for (const [collection, records] of recordsByCollection) {
  for (const record of records) {
    listed.push({
      collection,
      id: String(record._id),
      key: record.qa_fixture_key || "",
      label: record.email || record.title || record.request_id || record.contractNumber || record.billing_id || record.ticketId || "",
    });
  }
}

function collectStorageKeys(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectStorageKeys(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/storageKey$/i.test(key) && typeof child === "string" && child.trim()) output.add(child.trim());
    else collectStorageKeys(child, output);
  }
  return output;
}

const candidateStorageKeys = [...collectStorageKeys([
  ...contracts,
  ...maintenance,
  ...(recordsByCollection.get("chat_attachments") || []),
  ...(recordsByCollection.get("uploaded_documents") || []),
])];
const ownershipMarkers = [
  runId,
  ...businessUserIds,
  ...userMongoIds.map(String),
  ...ids(contracts).map(String),
  ...ids(maintenance).map(String),
  ...conversationIds.map(String),
].map((value) => String(value).toLowerCase());
const storageKeys = candidateStorageKeys.filter((key) => ownershipMarkers.some((marker) => key.toLowerCase().includes(marker)));
const skippedStorageKeys = candidateStorageKeys.filter((key) => !storageKeys.includes(key));

const { getAuth, getFirebaseStorage } = await import("../config/firebase.js");
const auth = getAuth();
if (!auth) throw new Error("The dedicated staging Firebase Admin project is not configured.");
const firebaseUsers = [];
for (const uid of firebaseUids) {
  try {
    const user = await auth.getUser(uid);
    if (user.customClaims?.qa_fixture === true && user.customClaims?.qa_run_id === runId) firebaseUsers.push(user);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}

const report = {
  mode: execute ? "execute" : listOnly ? "list" : "dry-run",
  qaRunId: runId,
  database: mongoose.connection.name,
  records: listed,
  firebaseUsers: firebaseUsers.map((user) => ({ uid: user.uid, email: user.email || "" })),
  storageKeys,
  skippedStorageKeys,
};

if (!execute) {
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

if (skippedStorageKeys.length) {
  throw new Error("Cleanup stopped: one or more storage keys could not be proven to belong to this QA run. Review the dry-run report.");
}

const bucket = getFirebaseStorage();
for (const storageKey of storageKeys) await bucket.file(storageKey).delete({ ignoreNotFound: true });
for (const user of firebaseUsers) await auth.deleteUser(user.uid);

const deleted = [];
// Delete by the exact IDs reported in the dry run. Ownership filters are not
// re-evaluated during deletion, preventing a concurrent non-QA record from
// entering scope between list and execute.
for (const [collection, records] of recordsByCollection) {
  if (!records.length) continue;
  const result = await db.collection(collection).deleteMany({ _id: { $in: ids(records) } });
  if (result.deletedCount !== records.length) {
    throw new Error(`Cleanup count mismatch for ${collection}: listed ${records.length}, deleted ${result.deletedCount}.`);
  }
  deleted.push({ collection, count: result.deletedCount });
}

const remaining = [];
for (const [collection, records] of recordsByCollection) {
  if (!records.length) continue;
  const count = await db.collection(collection).countDocuments({ _id: { $in: ids(records) } });
  if (count) remaining.push({ collection, count });
}

console.log(JSON.stringify({ ...report, deleted, remaining, verified: remaining.length === 0 }, null, 2));
await mongoose.disconnect();
if (remaining.length) process.exit(1);
