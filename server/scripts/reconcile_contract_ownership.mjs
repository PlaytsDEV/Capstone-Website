import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import {
  applyContractOwnershipReconciliation,
  buildContractOwnershipReconciliationPlan,
} from "../services/contractOwnershipReconciliationService.js";

const write = process.argv.includes("--write");
const mongoUri = process.env.LILY_AUDIT_MONGO_URI;
const databaseName = process.env.LILY_AUDIT_DB_NAME || undefined;
if (!mongoUri) throw new Error("LILY_AUDIT_MONGO_URI is required.");

const fingerprint = (value) => crypto
  .createHash("sha256")
  .update(`lilycrest-contract-reconciliation:${String(value || "")}`)
  .digest("hex")
  .slice(0, 12);

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15_000 });
try {
  await client.connect();
  const db = client.db(databaseName);
  const [users, reservations, stays, contracts] = await Promise.all([
    db.collection("users").find({}, { projection: { _id: 1, email: 1, role: 1 } }).toArray(),
    db.collection("reservations").find({}, {
      projection: { _id: 1, userId: 1, status: 1, isArchived: 1, createdAt: 1, updatedAt: 1 },
    }).toArray(),
    db.collection("stays").find({}, { projection: { _id: 1, tenantId: 1, reservationId: 1, status: 1, leaseStartDate: 1 } }).toArray(),
    db.collection("contracts").find({}, {
      projection: {
        tenantId: 1,
        tenantEmail: 1,
        reservationId: 1,
        applicationId: 1,
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
        leaseStartDate: 1,
        createdAt: 1,
        isTestRecord: 1,
      },
    }).toArray(),
  ]);

  const plan = buildContractOwnershipReconciliationPlan({
    users,
    reservations,
    stays,
    contracts,
  });
  const applied = write
    ? await applyContractOwnershipReconciliation({ db, client, plan })
    : {
      actionsApplied: 0,
      contractsUpdated: 0,
      reservationsUpdated: 0,
      staysUpdated: 0,
      abandonedDraftsRetired: 0,
    };

  process.stdout.write(`${JSON.stringify({
    dryRun: !write,
    runtimeFallbackAdded: false,
    scannedOrphanOwnerGroups: plan.scannedOrphanOwnerGroups,
    abandonedEarlyContractsToRetire: plan.retirements.length,
    safeActions: plan.actions.map((action) => ({
      sourceTenant: fingerprint(action.sourceTenantId),
      targetTenant: fingerprint(action.targetTenantId),
      contractCount: action.contractCount,
      reservationCount: action.reservationCount,
      stayCount: action.stayCount,
    })),
    blocked: plan.blocked.map((entry) => ({
      sourceTenant: fingerprint(entry.sourceTenantId),
      code: entry.code,
      contractCount: entry.contractCount || 0,
      candidateCount: entry.candidateCount ?? null,
      candidates: entry.candidates || [],
    })),
    applied,
  }, null, 2)}\n`);
} finally {
  await client.close();
}
