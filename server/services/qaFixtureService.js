import crypto from "node:crypto";
import mongoose from "mongoose";
import { QA_FIXTURE_MARKER } from "../utils/qaFixtureSafety.js";

const FIXTURE_SPECS = Object.freeze([
  { name: "QA-ACTIVE", envPrefix: "QA_ACTIVE", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-INACTIVE", envPrefix: "QA_INACTIVE", role: "tenant", tenantStatus: "inactive", accountStatus: "deactivated" },
  { name: "QA-USERNAME", envPrefix: "QA_USERNAME", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-MAINTENANCE", envPrefix: "QA_MAINTENANCE", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-BILLING", envPrefix: "QA_BILLING", role: "tenant", tenantStatus: "active", accountStatus: "active" },
  { name: "QA-ADMIN", envPrefix: "QA_ADMIN", role: "owner", tenantStatus: "applicant", accountStatus: "active" },
]);

function fixtureSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function requiredSecret(env, key) {
  const value = String(env[key] || "").trim();
  if (!value) throw new Error(`${key} is required but must be supplied outside source control.`);
  return value;
}

export function readFixtureDefinitions(env = process.env) {
  return FIXTURE_SPECS.map((spec) => ({
    ...spec,
    email: requiredSecret(env, `${spec.envPrefix}_EMAIL`).toLowerCase(),
    password: requiredSecret(env, `${spec.envPrefix}_PASSWORD`),
  }));
}

export function exactFixtureFilter(name = null) {
  return {
    qaFixtureMarker: QA_FIXTURE_MARKER,
    ...(name ? { "qaFixture.name": name } : {}),
  };
}

export function buildFixtureUser(definition, now = new Date()) {
  const slug = fixtureSlug(definition.name);
  const active = definition.accountStatus === "active";
  return {
    firebaseUid: `qa-emulator-${slug}`,
    firebase_uid: `qa-emulator-${slug}`,
    email: definition.email,
    username: `qa_${slug}`.slice(0, 30),
    username_normalized: `qa_${slug}`.slice(0, 30),
    user_id: `qa_${slug}`,
    firstName: "QA",
    lastName: definition.name.replace(/^QA-/, ""),
    branch: "gil-puyat",
    role: definition.role,
    tenantStatus: definition.tenantStatus,
    accountStatus: definition.accountStatus,
    isActive: active,
    is_active: active,
    isArchived: false,
    isEmailVerified: true,
    onboardingStatus: "active",
    securityVersion: 0,
    lastUsernameChangedAt: null,
    qaFixtureMarker: QA_FIXTURE_MARKER,
    qaFixture: {
      marker: QA_FIXTURE_MARKER,
      name: definition.name,
      environment: "isolated-local",
      synthetic: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

async function upsertFirebaseUser(auth, user, password) {
  try {
    await auth.getUser(user.firebaseUid);
    await auth.updateUser(user.firebaseUid, {
      email: user.email,
      password,
      displayName: `${user.firstName} ${user.lastName}`,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({
      uid: user.firebaseUid,
      email: user.email,
      password,
      displayName: `${user.firstName} ${user.lastName}`,
      emailVerified: true,
      disabled: false,
    });
  }
}

function maintenanceDoc({ user, status, suffix, now, rating = null }) {
  const completed = status === "completed";
  return {
    _id: new mongoose.Types.ObjectId(),
    request_id: `QA-MAINT-${suffix}`,
    ticketNumber: `QA-MAINT-${suffix}`,
    user_id: user.user_id,
    userId: user._id,
    title: `Isolated QA ${suffix.replace(/-/g, " ")}`,
    description: `Synthetic ${status} maintenance request for isolated Android regression QA only.`,
    request_type: "maintenance",
    urgency: "normal",
    status,
    branch: "gil-puyat",
    location: "Isolated QA - no real room or resident",
    isArchived: false,
    tenant_confirmed_resolved: completed,
    created_at: now,
    updated_at: now,
    statusHistory: [{
      event: "qa_fixture_seeded",
      status,
      actor_id: "qa_fixture_tool",
      actor_name: "Isolated QA Fixture Tool",
      actor_role: "system",
      note: "Synthetic local-only fixture state",
      timestamp: now,
    }],
    resolutionConfirmation: completed
      ? {
        confirmedAt: now,
        rating,
        tenantFeedback: "Existing isolated QA rating",
        action: "confirm",
      }
      : {},
    qaFixtureMarker: QA_FIXTURE_MARKER,
    qaFixture: { marker: QA_FIXTURE_MARKER, name: `QA-MAINT-${suffix}`, synthetic: true },
  };
}

function billingDoc(user, now) {
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: user._id,
    branch: "gil-puyat",
    billingMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    billingCycleStart: new Date(now.getFullYear(), now.getMonth(), 1),
    billingCycleEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    dueDate,
    charges: { rent: 100, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
    totalAmount: 100,
    grossAmount: 100,
    remainingAmount: 100,
    paidAmount: 0,
    status: "pending",
    publicationState: "published",
    releasedAt: now,
    paymentState: "unpaid",
    dueState: "current",
    disputeState: "none",
    isArchived: false,
    notes: "Synthetic isolated QA PayMongo TEST MODE bill",
    qaFixtureMarker: QA_FIXTURE_MARKER,
    qaFixture: { marker: QA_FIXTURE_MARKER, name: "QA-BILLING-UNPAID", synthetic: true },
    createdAt: now,
    updatedAt: now,
  };
}

export async function seedQaFixtures({ db, auth, definitions, now = new Date() }) {
  const users = db.collection("users");
  const seeded = {};
  for (const definition of definitions) {
    const expected = buildFixtureUser(definition, now);
    await upsertFirebaseUser(auth, expected, definition.password);
    await users.updateOne(
      exactFixtureFilter(definition.name),
      { $set: expected },
      { upsert: true },
    );
    seeded[definition.name] = await users.findOne(exactFixtureFilter(definition.name));
  }

  const maintenanceUser = seeded["QA-MAINTENANCE"];
  const maintenance = db.collection("maintenance_requests");
  const maintenanceStates = [
    ["pending", "PENDING", null],
    ["in_progress", "INPROGRESS", null],
    ["resolved", "RESOLVED-UNRATED", null],
    ["completed", "COMPLETED-RATED", 4],
  ];
  for (const [status, suffix, rating] of maintenanceStates) {
    const doc = maintenanceDoc({ user: maintenanceUser, status, suffix, now, rating });
    const { _id, ...mutableFields } = doc;
    await maintenance.updateOne(
      exactFixtureFilter(`QA-MAINT-${suffix}`),
      { $set: mutableFields, $setOnInsert: { _id } },
      { upsert: true },
    );
  }

  const billingUser = seeded["QA-BILLING"];
  const bill = billingDoc(billingUser, now);
  const { _id, ...mutableBillFields } = bill;
  await db.collection("bills").updateOne(
    exactFixtureFilter("QA-BILLING-UNPAID"),
    { $set: mutableBillFields, $setOnInsert: { _id } },
    { upsert: true },
  );

  return getQaFixtureStatus({ db, auth, definitions });
}

async function deleteFirebaseFixtureUsers(auth, definitions) {
  for (const definition of definitions) {
    const uid = `qa-emulator-${fixtureSlug(definition.name)}`;
    if (!uid.startsWith("qa-emulator-")) throw new Error("Refusing unexpected Firebase UID.");
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }
}

export async function removeQaFixtures({ db, auth, definitions }) {
  const fixtureUsers = await db.collection("users")
    .find(exactFixtureFilter())
    .project({ user_id: 1 })
    .toArray();
  const userIds = fixtureUsers.map((entry) => entry.user_id).filter(Boolean);

  await db.collection("maintenance_requests").deleteMany(exactFixtureFilter());
  await db.collection("bills").deleteMany(exactFixtureFilter());
  if (userIds.length) {
    await db.collection("user_sessions").deleteMany({ user_id: { $in: userIds } });
    await db.collection("otp_store").deleteMany({ user_id: { $in: userIds } });
  }
  await db.collection("users").deleteMany(exactFixtureFilter());
  await deleteFirebaseFixtureUsers(auth, definitions);

  return { removedFixtureUsers: fixtureUsers.length };
}

export async function getQaFixtureStatus({ db, auth, definitions }) {
  const output = [];
  for (const definition of definitions) {
    const user = await db.collection("users").findOne(exactFixtureFilter(definition.name));
    let firebase = false;
    try {
      await auth.getUser(`qa-emulator-${fixtureSlug(definition.name)}`);
      firebase = true;
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    output.push({
      name: definition.name,
      database: Boolean(user),
      firebase,
      state: user ? `${user.role}/${user.tenantStatus}/${user.accountStatus}` : "missing",
    });
  }

  const maintenance = await db.collection("maintenance_requests")
    .aggregate([
      { $match: exactFixtureFilter() },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const bills = await db.collection("bills").countDocuments(exactFixtureFilter());
  return { marker: QA_FIXTURE_MARKER, fixtures: output, maintenance, bills };
}

export function stableFixtureDigest(status) {
  return crypto.createHash("sha256").update(JSON.stringify(status)).digest("hex");
}
