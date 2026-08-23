import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import {
  isResidentContractEligible,
  selectCanonicalTenantContract,
} from "../services/tenantContractSelectionService.js";
import { resolveTenantContractDocument } from "../services/tenantContractDocumentResolver.js";
import { canAutoFinalize } from "../services/contractSigningService.js";

if (process.argv.some((argument) => ["--write", "--apply", "--repair", "--delete"].includes(argument))) {
  throw new Error("This audit is read-only and never changes LilyCrest records.");
}

const mongoUri = process.env.LILY_AUDIT_MONGO_URI;
const databaseName = process.env.LILY_AUDIT_DB_NAME || undefined;
if (!mongoUri) throw new Error("LILY_AUDIT_MONGO_URI is required.");

const objectId = (value) => String(value?._id || value || "");
const fingerprint = (value) => crypto
  .createHash("sha256")
  .update(`lilycrest-contract-audit:${objectId(value)}`)
  .digest("hex")
  .slice(0, 12);

const increment = (target, key) => {
  const normalized = String(key || "missing");
  target[normalized] = (target[normalized] || 0) + 1;
};

const bsonType = (value) => {
  if (value == null) return "missing";
  if (value?._bsontype === "ObjectId") return "objectId";
  return typeof value;
};

const sortNewestFirst = (left, right) =>
  new Date(right.leaseStartDate || right.createdAt || 0).getTime()
  - new Date(left.leaseStartDate || left.createdAt || 0).getTime();

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15_000 });

try {
  await client.connect();
  const db = client.db(databaseName);
  const collectionNames = new Set(
    (await db.listCollections().toArray()).map((entry) => entry.name),
  );
  const requiredCollections = ["users", "user_sessions", "reservations", "stays", "contracts"];
  const missingCollections = requiredCollections.filter((name) => !collectionNames.has(name));
  if (missingCollections.length) {
    throw new Error(`Missing required collections: ${missingCollections.join(", ")}`);
  }

  const [users, sessions, reservations, stays, contracts] = await Promise.all([
    db.collection("users").find(
      {},
      { projection: { _id: 1, user_id: 1, role: 1, email: 1 } },
    ).toArray(),
    db.collection("user_sessions").find(
      {},
      { projection: { _id: 0, user_id: 1, expires_at: 1 } },
    ).toArray(),
    db.collection("reservations").find(
      {},
      { projection: { _id: 1, userId: 1, status: 1, isArchived: 1 } },
    ).toArray(),
    db.collection("stays").find(
      {},
      { projection: { _id: 1, tenantId: 1, reservationId: 1, status: 1, leaseStartDate: 1 } },
    ).toArray(),
    db.collection("contracts").find(
      {},
      {
        projection: {
          tenantId: 1,
          tenantEmail: 1,
          applicationId: 1,
          reservationId: 1,
          stayId: 1,
          status: 1,
          publicationStatus: 1,
          tenantVisible: 1,
          isCurrent: 1,
          isCanonical: 1,
          archivedAt: 1,
          duplicateOfContractId: 1,
          supersededByContractId: 1,
          supersededBy: 1,
          replacesContractId: 1,
          isTestRecord: 1,
          leaseStartDate: 1,
          createdAt: 1,
          updatedAt: 1,
          finalDocument: 1,
          finalStorageKey: 1,
          preparedDocuments: 1,
          signedDocuments: 1,
          notarizedDocuments: 1,
          notarizedDocumentVersion: 1,
          version: 1,
        },
      },
    ).toArray(),
  ]);

  const mobileUsers = users.filter((user) =>
    ["tenant", "applicant"].includes(String(user.role || "").toLowerCase()));
  const usersByMongoId = new Map(users.map((user) => [objectId(user._id), user]));
  const usersBySessionId = new Map(users.map((user) => [String(user.user_id || ""), user]));
  const usersByEmail = new Map();
  for (const user of users) {
    const normalizedEmail = String(user.email || "").trim().toLowerCase();
    if (!normalizedEmail) continue;
    if (!usersByEmail.has(normalizedEmail)) usersByEmail.set(normalizedEmail, []);
    usersByEmail.get(normalizedEmail).push(user);
  }
  const reservationsById = new Map(reservations.map((reservation) => [objectId(reservation._id), reservation]));

  const contractsByTenant = new Map();
  const activeStaysByTenant = new Map();
  for (const contract of contracts) {
    const tenantKey = objectId(contract.tenantId);
    if (!contractsByTenant.has(tenantKey)) contractsByTenant.set(tenantKey, []);
    contractsByTenant.get(tenantKey).push(contract);
  }
  for (const stay of stays.filter((entry) => ["active", "ending_soon"].includes(entry.status))) {
    const tenantKey = objectId(stay.tenantId);
    const current = activeStaysByTenant.get(tenantKey);
    if (!current || sortNewestFirst(stay, current) < 0) activeStaysByTenant.set(tenantKey, stay);
  }

  const contractTenantIdTypes = {};
  const contractStatuses = {};
  const reservationOwnership = {
    matched: 0,
    mismatched: 0,
    missingReservation: 0,
  };
  const contractOwnerLookup = { matched: 0, missing: 0, mobileEligible: 0, notMobileEligible: 0 };
  const contractOwnerRoles = {};
  const orphanedContractRecords = {
    test: 0,
    nonTest: 0,
    statuses: {},
    uniqueExactEmailMatch: 0,
    uniqueExactEmailMatchMobileEligible: 0,
    noUniqueExactEmailMatch: 0,
  };
  for (const contract of contracts) {
    increment(contractTenantIdTypes, bsonType(contract.tenantId));
    increment(contractStatuses, contract.status);
    const owner = usersByMongoId.get(objectId(contract.tenantId));
    if (owner) {
      contractOwnerLookup.matched += 1;
      const ownerRole = String(owner.role || "missing").toLowerCase();
      increment(contractOwnerRoles, ownerRole);
      if (["tenant", "applicant"].includes(ownerRole)) contractOwnerLookup.mobileEligible += 1;
      else contractOwnerLookup.notMobileEligible += 1;
    } else {
      contractOwnerLookup.missing += 1;
      increment(contractOwnerRoles, "missing_owner");
      if (contract.isTestRecord === true) orphanedContractRecords.test += 1;
      else orphanedContractRecords.nonTest += 1;
      increment(orphanedContractRecords.statuses, contract.status);
      const normalizedSnapshotEmail = String(contract.tenantEmail || "").trim().toLowerCase();
      const exactMatches = normalizedSnapshotEmail ? (usersByEmail.get(normalizedSnapshotEmail) || []) : [];
      if (exactMatches.length === 1) {
        orphanedContractRecords.uniqueExactEmailMatch += 1;
        const role = String(exactMatches[0].role || "").toLowerCase();
        if (["tenant", "applicant"].includes(role)) {
          orphanedContractRecords.uniqueExactEmailMatchMobileEligible += 1;
        }
      } else {
        orphanedContractRecords.noUniqueExactEmailMatch += 1;
      }
    }

    const reservation = reservationsById.get(objectId(contract.reservationId));
    if (!reservation) reservationOwnership.missingReservation += 1;
    else if (objectId(reservation.userId) === objectId(contract.tenantId)) reservationOwnership.matched += 1;
    else reservationOwnership.mismatched += 1;
  }

  const sessionUserLookup = { matched: 0, missing: 0, activeMatched: 0, activeMissing: 0 };
  const now = new Date();
  for (const session of sessions) {
    const matched = usersBySessionId.has(String(session.user_id || ""));
    const active = new Date(session.expires_at || 0).getTime() > now.getTime();
    sessionUserLookup[matched ? "matched" : "missing"] += 1;
    if (active) sessionUserLookup[matched ? "activeMatched" : "activeMissing"] += 1;
  }

  const selectionOutcomes = {
    selected: 0,
    noContract: 0,
    multipleCanonicalContracts: 0,
    otherErrors: 0,
  };
  const selectedLifecycleStatuses = {};
  const selectedDocumentTypes = {};
  const collisions = [];
  const hiddenContractOwners = [];

  for (const user of mobileUsers) {
    const tenantKey = objectId(user._id);
    const tenantContracts = contractsByTenant.get(tenantKey) || [];
    const activeStay = activeStaysByTenant.get(tenantKey) || null;
    const eligible = tenantContracts.filter((contract) =>
      isResidentContractEligible(contract, { includeEarlyStages: true }));

    try {
      const selected = selectCanonicalTenantContract({
        contracts: tenantContracts,
        activeStay,
        includeEarlyStages: true,
        now,
      });
      if (!selected) {
        selectionOutcomes.noContract += 1;
        if (tenantContracts.length) {
          hiddenContractOwners.push({
            tenant: fingerprint(user._id),
            contractCount: tenantContracts.length,
            statuses: [...new Set(tenantContracts.map((contract) => contract.status))].sort(),
          });
        }
        continue;
      }

      selectionOutcomes.selected += 1;
      increment(selectedLifecycleStatuses, selected.status);
      increment(selectedDocumentTypes, resolveTenantContractDocument(selected).type || "unavailable");
    } catch (error) {
      if (error?.code === "MULTIPLE_CANONICAL_CONTRACTS") {
        selectionOutcomes.multipleCanonicalContracts += 1;
        collisions.push({
          tenant: fingerprint(user._id),
          eligibleCandidateCount: eligible.length,
          statuses: eligible.map((contract) => contract.status).sort(),
          currentFlags: eligible.map((contract) => contract.isCurrent !== false),
          reservationOwnerMatches: eligible.map((contract) => {
            const reservation = reservationsById.get(objectId(contract.reservationId));
            return Boolean(reservation) && objectId(reservation.userId) === tenantKey;
          }),
        });
      } else {
        selectionOutcomes.otherErrors += 1;
      }
    }
  }

  const eligibleDocumentSources = {};
  const legacySignedOnly = {
    count: 0,
    safeToAutoFinalize: 0,
    unsafeToAutoFinalize: 0,
    currentSignedMetadataPresent: 0,
    currentSignedMetadataMissing: 0,
    storageProviders: {},
  };
  for (const contract of contracts.filter((entry) =>
    isResidentContractEligible(entry, { includeEarlyStages: true }))) {
    const resolved = resolveTenantContractDocument(contract);
    increment(eligibleDocumentSources, resolved.type || "unavailable");
    const currentSignedDocument = [...(contract.signedDocuments || [])]
      .filter((document) => !document.superseded && !document.rejectedAt)
      .sort((left, right) => Number(right.version || 0) - Number(left.version || 0))[0];
    const legacySignedWithoutFinal = !contract.finalDocument && Boolean(currentSignedDocument);
    if (legacySignedWithoutFinal) {
      legacySignedOnly.count += 1;
      legacySignedOnly[canAutoFinalize(contract) ? "safeToAutoFinalize" : "unsafeToAutoFinalize"] += 1;
      const metadataPresent = Boolean(
        currentSignedDocument?.storageKey
        && currentSignedDocument?.fileName
        && currentSignedDocument?.fileSize,
      );
      legacySignedOnly[metadataPresent ? "currentSignedMetadataPresent" : "currentSignedMetadataMissing"] += 1;
      increment(legacySignedOnly.storageProviders, currentSignedDocument?.storageProvider || "legacy_local");
    }
  }

  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    privacy: "No names, emails, raw IDs, tokens, document URLs, or connection values are emitted.",
    counts: {
      users: users.length,
      tenantAndApplicantAccounts: mobileUsers.length,
      sessions: sessions.length,
      reservations: reservations.length,
      stays: stays.length,
      contracts: contracts.length,
    },
    identity: {
      contractTenantIdTypes,
      contractOwnerLookup,
      contractOwnerRoles,
      orphanedContractRecords,
      reservationOwnership,
      sessionUserLookup,
    },
    contractStatuses,
    selectionOutcomes,
    selectedLifecycleStatuses,
    selectedDocumentTypes,
    eligibleDocumentSources,
    legacySignedOnly,
    collisions,
    hiddenContractOwners,
  }, null, 2)}\n`);
} finally {
  await client.close();
}
