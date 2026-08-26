/**
 * ============================================================================
 * DATABASE DUPLICATE CONTRACT AUDIT & RECONCILIATION SCRIPT
 * ============================================================================
 *
 * Scans MongoDB contracts to identify tenants with multiple active/current
 * contracts. Scores candidates by document readiness and timestamp recency,
 * designating the highest scoring contract as Canonical and archiving
 * duplicates cleanly and non-destructively.
 *
 * Default mode is DRY RUN (no database modifications).
 * Use `--apply` (or `--write`) to persist reconciliation updates.
 *
 * Usage:
 *   node server/scripts/reconcile_duplicate_contracts.mjs
 *   node server/scripts/reconcile_duplicate_contracts.mjs --apply
 *   node server/scripts/reconcile_duplicate_contracts.mjs --tenant=<tenantId>
 *   node server/scripts/reconcile_duplicate_contracts.mjs --json
 * ============================================================================
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../../.env") });
dotenv.config();

export const EXCLUDED_STATUSES = Object.freeze(new Set([
  "voided",
  "cancelled",
  "archived",
  "rejected",
  "replaced",
  "terminated",
]));

/**
 * Checks if a contract record qualifies as an active/current candidate
 * that could potentially conflict with other active contracts for the same tenant.
 */
export const isCurrentActiveCandidate = (contract) => {
  if (!contract) return false;
  if (EXCLUDED_STATUSES.has(contract.status)) return false;
  if (contract.isCurrent === false) return false;
  if (contract.isCanonical === false) return false;
  if (contract.archivedAt) return false;
  if (contract.duplicateOfContractId) return false;
  return true;
};

/**
 * Computes document readiness score according to canonical ranking rules:
 * - Notarized document present: +4
 * - Signed document present: +2
 * - Prepared PDF / generated status: +1
 */
export const computeDocumentScore = (contract) => {
  if (!contract) return 0;
  let score = 0;
  if (Array.isArray(contract.notarizedDocuments) && contract.notarizedDocuments.length > 0) {
    score += 4;
  }
  if (Array.isArray(contract.signedDocuments) && contract.signedDocuments.length > 0) {
    score += 2;
  }
  if (
    (Array.isArray(contract.preparedDocuments) && contract.preparedDocuments.length > 0) ||
    contract.status === "generated"
  ) {
    score += 1;
  }
  return score;
};

const getCandidateTimestamp = (contract) => {
  const raw = contract?.updatedAt || contract?.createdAt;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getCandidateVersion = (contract) => {
  const v = Number(contract?.version);
  return Number.isNaN(v) ? 1 : v;
};

/**
 * Sorts contract candidates deterministically:
 * 1. Document readiness score (descending)
 * 2. Most recent updatedAt / createdAt timestamp (descending)
 * 3. Contract version (descending)
 * 4. Contract ID string comparison (stable tie-break)
 */
export const sortContractCandidates = (candidates) => {
  return [...candidates].sort((a, b) => {
    const scoreA = computeDocumentScore(a);
    const scoreB = computeDocumentScore(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const timeA = getCandidateTimestamp(a);
    const timeB = getCandidateTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    const verA = getCandidateVersion(a);
    const verB = getCandidateVersion(b);
    if (verA !== verB) {
      return verB - verA;
    }

    const idA = String(a._id || "");
    const idB = String(b._id || "");
    return idA.localeCompare(idB);
  });
};

/**
 * Analyzes a list of contract records, groups active contracts by tenant,
 * and identifies conflicting groups where a tenant has > 1 active contract.
 */
export const buildReconciliationPlan = (contracts = [], { users = [] } = {}) => {
  const usersById = new Map(
    users.map((user) => [String(user._id || user.id || ""), user]),
  );

  const activeContractsByTenant = new Map();

  for (const contract of contracts) {
    if (!isCurrentActiveCandidate(contract)) {
      continue;
    }
    const tenantKey = String(contract.tenantId || "");
    if (!tenantKey) continue;

    if (!activeContractsByTenant.has(tenantKey)) {
      activeContractsByTenant.set(tenantKey, []);
    }
    activeContractsByTenant.get(tenantKey).push(contract);
  }

  const conflictingGroups = [];
  let totalDuplicatesCount = 0;

  for (const [tenantId, candidateList] of activeContractsByTenant.entries()) {
    if (candidateList.length <= 1) {
      continue;
    }

    const sorted = sortContractCandidates(candidateList);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    totalDuplicatesCount += duplicates.length;

    const user = usersById.get(tenantId);
    const tenantLabel = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || tenantId
      : canonical.tenantLegalName || canonical.tenantEmail || tenantId;

    conflictingGroups.push({
      tenantId,
      tenantLabel,
      tenantEmail: user?.email || canonical.tenantEmail || null,
      totalActiveContracts: candidateList.length,
      canonical: {
        _id: String(canonical._id),
        contractNumber: canonical.contractNumber,
        status: canonical.status,
        docScore: computeDocumentScore(canonical),
        notarizedCount: canonical.notarizedDocuments?.length || 0,
        signedCount: canonical.signedDocuments?.length || 0,
        preparedCount: canonical.preparedDocuments?.length || (canonical.status === "generated" ? 1 : 0),
        version: canonical.version || 1,
        createdAt: canonical.createdAt,
        updatedAt: canonical.updatedAt,
      },
      duplicates: duplicates.map((dup) => ({
        _id: String(dup._id),
        contractNumber: dup.contractNumber,
        status: dup.status,
        docScore: computeDocumentScore(dup),
        notarizedCount: dup.notarizedDocuments?.length || 0,
        signedCount: dup.signedDocuments?.length || 0,
        preparedCount: dup.preparedDocuments?.length || (dup.status === "generated" ? 1 : 0),
        version: dup.version || 1,
        createdAt: dup.createdAt,
        updatedAt: dup.updatedAt,
        proposedAction: {
          isCurrent: false,
          isCanonical: false,
          status: "voided",
          publicationStatus: "withdrawn",
          duplicateOfContractId: String(canonical._id),
          reconciliationNote: `Archived as duplicate of canonical contract ${canonical._id} (${canonical.contractNumber || canonical._id})`,
          voidReason: `Archived as duplicate of canonical contract ${canonical._id}`,
        },
      })),
    });
  }

  return {
    scannedContractsCount: contracts.length,
    activeCandidatesCount: Array.from(activeContractsByTenant.values()).reduce(
      (acc, list) => acc + list.length,
      0,
    ),
    tenantsWithActiveContractsCount: activeContractsByTenant.size,
    conflictingGroupsCount: conflictingGroups.length,
    totalDuplicatesToArchive: totalDuplicatesCount,
    conflictingGroups,
  };
};

/**
 * Applies reconciliation plan to MongoDB database.
 */
export const applyReconciliation = async ({ db, plan }) => {
  if (!db) {
    throw new Error("MongoDB database connection is required to apply reconciliation.");
  }

  const contractsCollection = db.collection("contracts");
  let updatedCount = 0;
  const auditDetails = [];
  const now = new Date();

  for (const group of plan.conflictingGroups) {
    const canonicalId = group.canonical._id;

    for (const dup of group.duplicates) {
      const duplicateId = dup._id;
      const note = `Archived as duplicate of canonical contract ${canonicalId} (${group.canonical.contractNumber || canonicalId})`;

      const updateQuery = {
        _id: new mongoose.Types.ObjectId(duplicateId),
      };

      const updateDoc = {
        $set: {
          isCurrent: false,
          isCanonical: false,
          status: "voided",
          publicationStatus: "withdrawn",
          duplicateOfContractId: new mongoose.Types.ObjectId(canonicalId),
          reconciliationNote: note,
          voidReason: note,
          voidedAt: now,
        },
        $push: {
          statusHistory: {
            status: "voided",
            changedAt: now,
            reason: note,
          },
        },
      };

      const result = await contractsCollection.updateOne(updateQuery, updateDoc);
      if (result.modifiedCount > 0) {
        updatedCount += 1;
        auditDetails.push({
          duplicateContractId: duplicateId,
          duplicateContractNumber: dup.contractNumber,
          canonicalContractId: canonicalId,
          canonicalContractNumber: group.canonical.contractNumber,
          tenantId: group.tenantId,
          status: "archived_and_voided",
        });
      }
    }
  }

  return {
    updatedContractsCount: updatedCount,
    auditDetails,
  };
};

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply") || args.includes("--write");
  const isJson = args.includes("--json");
  const tenantArg = args.find((arg) => arg.startsWith("--tenant="));
  const tenantFilter = tenantArg ? tenantArg.split("=")[1] : null;

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("Error: MONGODB_URI or MONGO_URI environment variable is required.");
    console.error("Please configure MONGODB_URI in .env or provide it in environment.");
    process.exitCode = 1;
    return;
  }

  const connectOptions = process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
  await mongoose.connect(mongoUri, connectOptions);

  try {
    const db = mongoose.connection.db;

    const contractQuery = tenantFilter
      ? { tenantId: new mongoose.Types.ObjectId(tenantFilter) }
      : {};

    const contracts = await db
      .collection("contracts")
      .find(contractQuery)
      .sort({ createdAt: -1 })
      .toArray();

    const tenantIds = [
      ...new Set(contracts.map((c) => String(c.tenantId)).filter(Boolean)),
    ].map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return id;
      }
    });

    const users = await db
      .collection("users")
      .find({ _id: { $in: tenantIds } })
      .project({ _id: 1, email: 1, firstName: 1, lastName: 1, role: 1 })
      .toArray();

    const plan = buildReconciliationPlan(contracts, { users });

    let applyResult = null;
    if (isApply && plan.conflictingGroupsCount > 0) {
      applyResult = await applyReconciliation({ db, plan });
    }

    if (isJson) {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: isApply ? "APPLY" : "DRY_RUN",
            database: mongoose.connection.name,
            plan,
            applyResult,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    console.log("================================================================================");
    console.log("             LILYCREST DUPLICATE CONTRACT AUDIT & RECONCILIATION                ");
    console.log("================================================================================");
    console.log(`Database : ${mongoose.connection.name}`);
    console.log(`Mode     : ${isApply ? "APPLY (PERSIST TO DB)" : "DRY RUN (NO DB WRITES)"}`);
    console.log(`Filter   : ${tenantFilter ? `Tenant ID ${tenantFilter}` : "All Tenants"}`);
    console.log("--------------------------------------------------------------------------------");
    console.log(`Total Contracts Scanned      : ${plan.scannedContractsCount}`);
    console.log(`Active Candidates Detected   : ${plan.activeCandidatesCount}`);
    console.log(`Tenants with Active Contracts: ${plan.tenantsWithActiveContractsCount}`);
    console.log(`Conflicting Groups Found     : ${plan.conflictingGroupsCount}`);
    console.log(`Duplicate Contracts to Void  : ${plan.totalDuplicatesToArchive}`);
    console.log("================================================================================");

    if (plan.conflictingGroupsCount === 0) {
      console.log("\nNo duplicate active contract conflicts detected. Database is clean!");
    } else {
      console.log("\nCONFLICTING GROUPS BREAKDOWN:");
      for (const [index, group] of plan.conflictingGroups.entries()) {
        console.log(`\n[Group #${index + 1}] Tenant: ${group.tenantLabel} (${group.tenantId})`);
        console.log(`  -> CANONICAL CONTRACT (Preserved):`);
        console.log(
          `     ID: ${group.canonical._id} | Number: ${group.canonical.contractNumber || "N/A"} | Status: ${group.canonical.status} | Score: ${group.canonical.docScore} (Notarized:${group.canonical.notarizedCount}, Signed:${group.canonical.signedCount}, Prepared:${group.canonical.preparedCount}) | Version: ${group.canonical.version}`,
        );
        console.log(`  -> DUPLICATE CONTRACTS (To be archived & voided):`);
        for (const dup of group.duplicates) {
          console.log(
            `     ID: ${dup._id} | Number: ${dup.contractNumber || "N/A"} | Status: ${dup.status} | Score: ${dup.docScore} (Notarized:${dup.notarizedCount}, Signed:${dup.signedCount}, Prepared:${dup.preparedCount}) | Version: ${dup.version}`,
          );
        }
      }

      console.log("\n================================================================================");
      if (isApply) {
        console.log(`APPLY SUMMARY: Successfully archived and voided ${applyResult?.updatedContractsCount || 0} duplicate contract record(s).`);
      } else {
        console.log(`DRY RUN COMPLETE: ${plan.totalDuplicatesToArchive} duplicate contract record(s) identified.`);
        console.log(`To persist these changes, execute:`);
        console.log(`  node server/scripts/reconcile_duplicate_contracts.mjs --apply`);
      }
      console.log("================================================================================");
    }
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

// Execute main if run directly
const isDirectExecution =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("reconcile_duplicate_contracts.mjs");

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Duplicate contract reconciliation failed:", error);
    process.exitCode = 1;
  });
}
