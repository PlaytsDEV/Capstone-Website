#!/usr/bin/env node
import mongoose from "mongoose";
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
import { normalizeQaRunId, qaMetadata, stableObjectId } from "./qaFixtureIds.js";

assertStagingWriteTarget(process.env, { toolName: "staging QA fixture seed" });

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const validateQaEmail = (name) => {
  const email = required(name).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/(^qa[.+_-]|[.+_-]qa(?:[.+_-]|@))/i.test(email)) {
    throw new Error(`${name} must be a clearly recognizable QA mailbox address.`);
  }
  return email;
};

const validatePassword = (name) => {
  const password = required(name);
  if (password.length < 12) throw new Error(`${name} must contain at least 12 characters.`);
  return password;
};

const runId = normalizeQaRunId(required("QA_RUN_ID"));
const emails = {
  admin: validateQaEmail("QA_ADMIN_EMAIL"),
  tenantA: validateQaEmail("QA_TENANT_A_EMAIL"),
  tenantB: validateQaEmail("QA_TENANT_B_EMAIL"),
};
const googleEmail = validateQaEmail("QA_GOOGLE_EMAIL");
if (googleEmail !== emails.tenantB) {
  throw new Error("QA_GOOGLE_EMAIL must equal QA_TENANT_B_EMAIL so account-switch QA uses the independent Tenant B fixture.");
}
if (new Set(Object.values(emails)).size !== 3) throw new Error("QA Admin, Tenant A, and Tenant B emails must be distinct.");

const passwords = {
  admin: validatePassword("QA_ADMIN_PASSWORD"),
  tenantA: validatePassword("QA_TENANT_A_PASSWORD"),
  tenantB: validatePassword("QA_TENANT_B_PASSWORD"),
};

const now = new Date();
const leaseStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 15));
const leaseEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 14));
const billMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const dueDateA = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 10));
const dueDateB = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
const futureStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const expiredEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const ids = Object.fromEntries([
  "admin", "tenant-a", "tenant-b", "room-a", "room-b", "reservation-a", "reservation-b",
  "stay-a", "stay-b", "contract-a", "contract-b", "bill-a", "bill-b", "maintenance-a",
  "conversation-a", "announcement-global", "announcement-branch-a", "announcement-branch-b",
  "announcement-private-a", "announcement-future", "announcement-expired",
].map((key) => [key, stableObjectId(runId, key)]));

const dbName = String(process.env.DB_NAME || "").trim() || undefined;
await mongoose.connect(required("MONGODB_URI"), { ...(dbName ? { dbName } : {}) });
const db = mongoose.connection.db;

const { getAuth } = await import("../config/firebase.js");
const auth = getAuth();
if (!auth) throw new Error("The dedicated staging Firebase Admin project is not configured.");

async function ensureFirebaseIdentity({ email, password, role, fixtureKey, identityKey }) {
  let account;
  try {
    account = await auth.getUserByEmail(email);
    account = await auth.updateUser(account.uid, { password, disabled: false, emailVerified: true });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    account = await auth.createUser({ email, password, disabled: false, emailVerified: true, displayName: fixtureKey });
  }
  await auth.setCustomUserClaims(account.uid, {
    qa_fixture: true,
    qa_run_id: runId,
    role,
    ...(role === "owner" ? { owner: true } : {}),
  });
  await db.collection("qa_fixture_runs").updateOne(
    { qa_run_id: runId },
    {
      $set: {
        qa_fixture: true,
        qa_run_id: runId,
        environment: "staging",
        [`auth_uids.${identityKey}`]: account.uid,
        [`auth_emails.${identityKey}`]: email,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return account.uid;
}

const firebaseUids = {
  admin: await ensureFirebaseIdentity({ email: emails.admin, password: passwords.admin, role: "owner", fixtureKey: "QA Admin", identityKey: "admin" }),
  tenantA: await ensureFirebaseIdentity({ email: emails.tenantA, password: passwords.tenantA, role: "tenant", fixtureKey: "QA Tenant Alpha", identityKey: "tenantA" }),
  tenantB: await ensureFirebaseIdentity({ email: emails.tenantB, password: passwords.tenantB, role: "tenant", fixtureKey: "QA Tenant Beta", identityKey: "tenantB" }),
};

const timestamps = { createdAt: now, updatedAt: now, created_at: now, updated_at: now };
const users = [
  {
    _id: ids.admin,
    firebaseUid: firebaseUids.admin,
    firebase_uid: firebaseUids.admin,
    email: emails.admin,
    username: `qa-admin-${runId}`,
    user_id: `qa-admin-${runId}`,
    firstName: "QA",
    lastName: "Administrator",
    name: "QA Administrator",
    role: "owner",
    permissions: ["manageReservations", "manageTenants", "manageBilling", "manageRooms", "manageMaintenance", "manageAnnouncements", "viewReports", "manageUsers"],
    accountStatus: "active",
    status: "active",
    is_active: true,
    isArchived: false,
    securityVersion: 0,
    ...qaMetadata(runId, "admin"),
    ...timestamps,
  },
  {
    _id: ids["tenant-a"],
    firebaseUid: firebaseUids.tenantA,
    firebase_uid: firebaseUids.tenantA,
    email: emails.tenantA,
    username: `qa-tenant-alpha-${runId}`,
    user_id: `qa-tenant-a-${runId}`,
    firstName: "QA Tenant",
    lastName: "Alpha",
    name: "QA Tenant Alpha",
    role: "tenant",
    branch: "gil-puyat",
    branch_id: "gil-puyat",
    tenantStatus: "active",
    tenant_status: "active",
    accountStatus: "active",
    status: "active",
    is_active: true,
    isArchived: false,
    securityVersion: 0,
    address: "100 Synthetic Test Avenue, QA City",
    ...qaMetadata(runId, "tenant-a"),
    ...timestamps,
  },
  {
    _id: ids["tenant-b"],
    firebaseUid: firebaseUids.tenantB,
    firebase_uid: firebaseUids.tenantB,
    email: emails.tenantB,
    google_email: googleEmail,
    username: `qa-tenant-beta-${runId}`,
    user_id: `qa-tenant-b-${runId}`,
    firstName: "QA Tenant",
    lastName: "Beta",
    name: "QA Tenant Beta",
    role: "tenant",
    branch: "guadalupe",
    branch_id: "guadalupe",
    tenantStatus: "active",
    tenant_status: "active",
    accountStatus: "active",
    status: "active",
    is_active: true,
    isArchived: false,
    securityVersion: 0,
    address: "200 Synthetic Test Boulevard, QA City",
    ...qaMetadata(runId, "tenant-b"),
    ...timestamps,
  },
];

const rooms = [
  {
    _id: ids["room-a"], name: "QA Room A", roomNumber: "QA-GP-A01", room_number: "QA-GP-A01",
    description: "Synthetic QA room for Tenant Alpha only.", floor: 1, branch: "gil-puyat", branch_id: "gil-puyat",
    type: "private", room_type: "Private", capacity: 1, currentOccupancy: 1, price: 6900, monthlyPrice: 6900,
    beds: [{ id: "QA-BED-A", position: "single", bunkBlock: "A", code: "QA-GP-A01-A", status: "occupied", occupiedBy: { userId: ids["tenant-a"], reservationId: ids["reservation-a"], occupiedSince: leaseStart } }],
    available: false, isArchived: false, ...qaMetadata(runId, "room-a"), ...timestamps,
  },
  {
    _id: ids["room-b"], name: "QA Room B", roomNumber: "QA-GU-B01", room_number: "QA-GU-B01",
    description: "Synthetic QA room for Tenant Beta only.", floor: 2, branch: "guadalupe", branch_id: "guadalupe",
    type: "private", room_type: "Private", capacity: 1, currentOccupancy: 1, price: 8400, monthlyPrice: 8400,
    beds: [{ id: "QA-BED-B", position: "single", bunkBlock: "B", code: "QA-GU-B01-B", status: "occupied", occupiedBy: { userId: ids["tenant-b"], reservationId: ids["reservation-b"], occupiedSince: leaseStart } }],
    available: false, isArchived: false, ...qaMetadata(runId, "room-b"), ...timestamps,
  },
];

const contractSequenceBase = 900000 + (Number.parseInt(stableObjectId(runId, "contract-sequence").toHexString().slice(0, 8), 16) % 90000);
const tenantCases = [
  { key: "a", user: users[1], room: rooms[0], reservationId: ids["reservation-a"], stayId: ids["stay-a"], contractId: ids["contract-a"], billId: ids["bill-a"], rent: 6900, bill: 7350, previous: 450, dueDate: dueDateA, sequence: contractSequenceBase, branch: "gil-puyat" },
  { key: "b", user: users[2], room: rooms[1], reservationId: ids["reservation-b"], stayId: ids["stay-b"], contractId: ids["contract-b"], billId: ids["bill-b"], rent: 8400, bill: 9125, previous: 725, dueDate: dueDateB, sequence: contractSequenceBase + 1, branch: "guadalupe" },
];

const reservations = tenantCases.map((item) => ({
  _id: item.reservationId,
  reservationCode: `QA-${runId.toUpperCase()}-RES-${item.key.toUpperCase()}`,
  userId: item.user._id,
  roomId: item.room._id,
  currentStayId: item.stayId,
  latestStayStatus: "active",
  selectedBed: { id: item.room.beds[0].id, position: "single", bunkBlock: item.key.toUpperCase(), code: item.room.beds[0].code },
  intendedMoveInDate: leaseStart,
  confirmedMoveInDate: leaseStart,
  moveInDate: leaseStart,
  moveOutDate: leaseEnd,
  leaseDuration: 12,
  branch: item.branch,
  branchName: item.branch,
  billingEmail: item.user.email,
  totalPrice: item.rent,
  monthlyRent: item.rent,
  status: "moveIn",
  paymentStatus: "paid",
  isArchived: false,
  ...qaMetadata(runId, `reservation-${item.key}`),
  ...timestamps,
}));

const stays = tenantCases.map((item) => ({
  _id: item.stayId, tenantId: item.user._id, reservationId: item.reservationId, branch: item.branch,
  roomId: item.room._id, bedId: item.room.beds[0].id, bunkBlock: item.key.toUpperCase(), bedCode: item.room.beds[0].code,
  leaseStartDate: leaseStart, leaseEndDate: leaseEnd, monthlyRent: item.rent, status: "active",
  createdBy: ids.admin, updatedBy: ids.admin, ...qaMetadata(runId, `stay-${item.key}`), ...timestamps,
}));

const contracts = tenantCases.map((item) => ({
  _id: item.contractId, tenantId: item.user._id, applicationId: item.reservationId, reservationId: item.reservationId,
  stayId: item.stayId, roomId: item.room._id, branch: item.branch,
  contractNumber: `QA-${now.getUTCFullYear()}-${runId.toUpperCase()}-${item.key.toUpperCase()}`,
  contractYear: now.getUTCFullYear(), contractSequence: item.sequence, version: 1, contractPurpose: "initial",
  initialContractKey: `qa:${runId}:${item.key}`, initialStayKey: `qa:${runId}:stay:${item.key}`,
  isTestRecord: true, testPurpose: `Synthetic staging E2E fixture ${runId}`, createdForTestingBy: ids.admin, createdForTestingAt: now,
  roomType: "private", leaseType: "long_term", propertyName: `QA LilyCrest Branch ${item.key.toUpperCase()}`,
  propertyAddress: item.key === "a" ? "101 QA Property Lane, Test District" : "202 QA Property Lane, Test District",
  roomNumber: item.room.roomNumber, bedId: item.room.beds[0].id, bedLabel: item.room.beds[0].code,
  tenantLegalName: item.user.name, tenantAddress: item.user.address, tenantEmail: item.user.email,
  tenantPhone: "+63900000000" + (item.key === "a" ? "1" : "2"), tenantNationality: "Synthetic QA",
  tenantBirthDate: new Date("1995-01-01T00:00:00.000Z"), tenantAgeAtGeneration: 31,
  leaseStartDate: leaseStart, leaseEndDate: leaseEnd, leaseDurationMonths: 12,
  regularMonthlyRate: item.rent, discountPercentage: 0, discountType: "none", discountAmount: 0,
  approvedMonthlyRate: item.rent, advanceRentAmount: item.rent, securityDepositAmount: item.rent,
  reservationFeeAmount: 2000, reservationFeeCreditAmount: 2000, pricingApprovalId: item.reservationId,
  pricingApprovedBy: ids.admin, pricingApprovedAt: now, pricingApprovalNotes: "Synthetic QA fixture pricing",
  status: "ready_for_generation", isCurrent: true, isCanonical: true, tenantVisible: false,
  preparedDocuments: [], signedDocuments: [], notarizedDocuments: [], finalDocument: null,
  statusHistory: [{ status: "ready_for_generation", changedAt: now, changedBy: ids.admin, reason: "Synthetic QA fixture ready for real Admin generation workflow" }],
  createdBy: ids.admin, updatedBy: ids.admin, ...qaMetadata(runId, `contract-${item.key}`), ...timestamps,
}));

const bills = tenantCases.map((item) => ({
  _id: item.billId, reservationId: item.reservationId, userId: item.user._id, user_id: item.user.user_id,
  tenantUserId: item.user.user_id, branch: item.branch, roomId: item.room._id,
  billing_id: `QA-BILL-${runId.toUpperCase()}-${item.key.toUpperCase()}`,
  billingMonth: billMonth, billingCycleStart: billMonth, dueDate: item.dueDate, issuedAt: now, sentAt: now, releasedAt: now,
  charges: { rent: item.rent, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
  totalAmount: item.bill, grossAmount: item.bill, previousBalance: item.previous, balanceForward: item.previous,
  paidAmount: 0, remainingAmount: item.bill, status: "pending", publicationState: "published", paymentState: "unpaid", dueState: "current",
  billType: "rent", description: `QA current bill ${item.key.toUpperCase()}`,
  ...qaMetadata(runId, `bill-${item.key}`), ...timestamps,
}));

const announcements = [
  { _id: ids["announcement-global"], title: "QA Global Announcement", content: `Synthetic global announcement for ${runId}.`, category: "general", targetBranch: "both", visibility: "tenants-only", publicationStatus: "published", startsAt: new Date(now.getTime() - 3600000), endsAt: null, publishedAt: now, publishedBy: ids.admin, authorName: "QA Administrator", isArchived: false, ...qaMetadata(runId, "announcement-global"), ...timestamps },
  { _id: ids["announcement-branch-a"], title: "QA Branch A Announcement", content: `Synthetic Branch A announcement for ${runId}.`, category: "maintenance", targetBranch: "gil-puyat", visibility: "tenants-only", publicationStatus: "published", startsAt: new Date(now.getTime() - 3600000), endsAt: null, publishedAt: now, publishedBy: ids.admin, isArchived: false, ...qaMetadata(runId, "announcement-branch-a"), ...timestamps },
  { _id: ids["announcement-branch-b"], title: "QA Branch B Announcement", content: `Synthetic Branch B announcement for ${runId}.`, category: "event", targetBranch: "guadalupe", visibility: "tenants-only", publicationStatus: "published", startsAt: new Date(now.getTime() - 3600000), endsAt: null, publishedAt: now, publishedBy: ids.admin, isArchived: false, ...qaMetadata(runId, "announcement-branch-b"), ...timestamps },
  { _id: ids["announcement-private-a"], title: "QA Private Tenant A Announcement", content: `Synthetic private Tenant A announcement for ${runId}.`, category: "reminder", targetBranch: "both", visibility: "tenants-only", is_private: true, user_id: users[1].user_id, publicationStatus: "published", startsAt: new Date(now.getTime() - 3600000), endsAt: null, publishedAt: now, publishedBy: ids.admin, isArchived: false, ...qaMetadata(runId, "announcement-private-a"), ...timestamps },
  { _id: ids["announcement-future"], title: "QA Future Announcement", content: `Synthetic future announcement for ${runId}.`, category: "general", targetBranch: "both", visibility: "tenants-only", publicationStatus: "scheduled", startsAt: futureStart, endsAt: null, publishedAt: null, publishedBy: ids.admin, isArchived: false, ...qaMetadata(runId, "announcement-future"), ...timestamps },
  { _id: ids["announcement-expired"], title: "QA Expired Announcement", content: `Synthetic expired announcement for ${runId}.`, category: "general", targetBranch: "both", visibility: "tenants-only", publicationStatus: "published", startsAt: new Date(expiredEnd.getTime() - 86400000), endsAt: expiredEnd, publishedAt: new Date(expiredEnd.getTime() - 86400000), publishedBy: ids.admin, isArchived: false, ...qaMetadata(runId, "announcement-expired"), ...timestamps },
];

const maintenance = {
  _id: ids["maintenance-a"], request_id: `QA-MAINT-${runId.toUpperCase()}-A`, ticketNumber: `QA-MNT-${runId.toUpperCase()}-A`,
  user_id: users[1].user_id, userId: users[1]._id, branch: "gil-puyat", roomId: rooms[0]._id, reservationId: reservations[0]._id,
  occupancyContext: { branch: "gil-puyat", roomNumber: rooms[0].roomNumber, bedId: rooms[0].beds[0].id },
  request_type: "maintenance", description: "Synthetic initial maintenance request for staging workflow verification.",
  urgency: "normal", status: "pending", attachments: [], statusHistory: [{ event: "created", status: "pending", actor_id: users[1].user_id, actor_name: users[1].name, actor_role: "tenant", note: "Synthetic QA fixture", timestamp: now }],
  created_at: now, updated_at: now, createdAt: now, updatedAt: now, ...qaMetadata(runId, "maintenance-a"),
};

const conversation = {
  _id: ids["conversation-a"], ticketId: `QA-${runId.toUpperCase()}-SUP-A`, tenantId: users[1]._id,
  tenantUserId: users[1].user_id, tenantName: users[1].name, tenantEmail: users[1].email,
  branch: "gil-puyat", roomNumber: rooms[0].roomNumber, roomBed: rooms[0].beds[0].code,
  status: "open", category: "general_inquiry", priority: "normal", lastMessage: "", lastMessageAt: null,
  unreadAdminCount: 0, unreadTenantCount: 0, statusHistory: [],
  ...qaMetadata(runId, "conversation-a"), ...timestamps,
};

const collections = [
  ["users", users], ["rooms", rooms], ["reservations", reservations], ["stays", stays],
  ["contracts", contracts], ["bills", bills], ["announcements", announcements],
  ["maintenance_requests", [maintenance]], ["chat_conversations", [conversation]],
];

const summary = [];
for (const [collectionName, records] of collections) {
  for (const record of records) {
    const result = await db.collection(collectionName).replaceOne({ _id: record._id }, record, { upsert: true });
    summary.push({ collection: collectionName, id: String(record._id), key: record.qa_fixture_key, created: result.upsertedCount === 1 });
  }
}

await db.collection("qa_fixture_runs").updateOne(
  { qa_run_id: runId },
  { $set: { qa_fixture: true, qa_run_id: runId, environment: "staging", fixtureCount: summary.length, updatedAt: now }, $setOnInsert: { createdAt: now } },
  { upsert: true },
);

console.log(JSON.stringify({
  qaRunId: runId,
  database: mongoose.connection.name,
  created: summary.filter((entry) => entry.created).length,
  updated: summary.filter((entry) => !entry.created).length,
  records: summary,
  identities: { tenantA: emails.tenantA, tenantB: emails.tenantB, admin: emails.admin, googleQaIdentity: googleEmail },
}, null, 2));

await mongoose.disconnect();
