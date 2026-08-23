import {
  EARLY_STAGE_STATUSES,
  isResidentContractEligible,
  selectCanonicalTenantContract,
} from "./tenantContractSelectionService.js";

const MOBILE_ROLES = new Set(["tenant", "applicant"]);
const TERMINAL_RESERVATION_STATUSES = new Set(["cancelled", "archived", "rejected"]);
const objectId = (value) => String(value?._id || value || "");
const normalizedEmail = (value) => String(value || "").trim().toLowerCase();
const normalizedStatus = (value) => String(value || "").trim().toLowerCase();

const shouldRetireAbandonedEarlyContract = (contract, reservation) => Boolean(
  contract &&
  reservation &&
  contract.isTestRecord !== true &&
  !contract.archivedAt &&
  EARLY_STAGE_STATUSES.has(contract.status) &&
  (
    reservation.isArchived === true ||
    TERMINAL_RESERVATION_STATUSES.has(normalizedStatus(reservation.status))
  )
);

const newestActiveStay = (stays) => [...stays]
  .filter((stay) => ["active", "ending_soon"].includes(stay.status))
  .sort((left, right) =>
    new Date(right.leaseStartDate || right.createdAt || 0).getTime()
    - new Date(left.leaseStartDate || left.createdAt || 0).getTime())[0] || null;

const block = (sourceTenantId, code, details = {}) => ({
  sourceTenantId,
  code,
  ...details,
});

/**
 * Builds a deterministic ownership-repair plan for legacy records whose
 * User document was deleted/recreated while their Reservation/Contract chain
 * retained the old ObjectId.
 *
 * Email is used only as a strict, one-time migration crosswalk against the
 * immutable Contract identity snapshot. Runtime authorization and Contract
 * resolution continue to use User._id -> Contract.tenantId exclusively.
 */
export function buildContractOwnershipReconciliationPlan({
  users = [],
  reservations = [],
  stays = [],
  contracts = [],
  now = new Date(),
} = {}) {
  const usersById = new Map(users.map((user) => [objectId(user._id), user]));
  const usersByEmail = new Map();
  for (const user of users) {
    const email = normalizedEmail(user.email);
    if (!email) continue;
    if (!usersByEmail.has(email)) usersByEmail.set(email, []);
    usersByEmail.get(email).push(user);
  }
  const reservationsById = new Map(
    reservations.map((reservation) => [objectId(reservation._id), reservation]),
  );
  const retirements = contracts.flatMap((contract) => {
    const reservation = reservationsById.get(objectId(contract.reservationId));
    if (!shouldRetireAbandonedEarlyContract(contract, reservation)) return [];
    return [{
      contractId: contract._id,
      reservationId: reservation._id,
      previousStatus: contract.status,
    }];
  });
  const retirementIds = new Set(retirements.map((entry) => objectId(entry.contractId)));

  const orphanContractsByOwner = new Map();
  for (const contract of contracts) {
    // Test fixtures are intentionally disposable and may reference synthetic
    // users/reservations that never existed in the canonical identity graph.
    // They must not block or be rewritten by the production relationship
    // reconciliation.
    if (contract.isTestRecord === true) continue;
    const ownerId = objectId(contract.tenantId);
    if (!ownerId || usersById.has(ownerId)) continue;
    if (!orphanContractsByOwner.has(ownerId)) orphanContractsByOwner.set(ownerId, []);
    orphanContractsByOwner.get(ownerId).push(contract);
  }

  const provisional = [];
  const blocked = [];
  for (const [sourceTenantId, sourceContracts] of orphanContractsByOwner) {
    const snapshotEmails = [...new Set(
      sourceContracts.map((contract) => normalizedEmail(contract.tenantEmail)).filter(Boolean),
    )];
    if (snapshotEmails.length !== 1) {
      blocked.push(block(sourceTenantId, "IDENTITY_SNAPSHOT_NOT_UNIQUE", {
        contractCount: sourceContracts.length,
      }));
      continue;
    }

    const targetCandidates = usersByEmail.get(snapshotEmails[0]) || [];
    if (targetCandidates.length !== 1) {
      blocked.push(block(sourceTenantId, "CANONICAL_USER_NOT_UNIQUE", {
        contractCount: sourceContracts.length,
        candidateCount: targetCandidates.length,
      }));
      continue;
    }

    const target = targetCandidates[0];
    if (!MOBILE_ROLES.has(String(target.role || "").toLowerCase())) {
      blocked.push(block(sourceTenantId, "CANONICAL_USER_NOT_MOBILE_ELIGIBLE", {
        contractCount: sourceContracts.length,
      }));
      continue;
    }

    const linkedReservations = sourceContracts.map((contract) =>
      reservationsById.get(objectId(contract.reservationId)) || null);
    if (linkedReservations.some((reservation) => !reservation)) {
      blocked.push(block(sourceTenantId, "CONTRACT_RESERVATION_MISSING", {
        contractCount: sourceContracts.length,
      }));
      continue;
    }
    if (linkedReservations.some((reservation) => objectId(reservation.userId) !== sourceTenantId)) {
      blocked.push(block(sourceTenantId, "RESERVATION_OWNER_MISMATCH", {
        contractCount: sourceContracts.length,
      }));
      continue;
    }

    provisional.push({
      sourceTenantId: sourceContracts[0].tenantId,
      targetTenantId: target._id,
      contractCount: sourceContracts.length,
      reservationCount: reservations.filter((reservation) =>
        objectId(reservation.userId) === sourceTenantId).length,
      stayCount: stays.filter((stay) => objectId(stay.tenantId) === sourceTenantId).length,
    });
  }

  const provisionalByTarget = new Map();
  for (const action of provisional) {
    const targetKey = objectId(action.targetTenantId);
    if (!provisionalByTarget.has(targetKey)) provisionalByTarget.set(targetKey, []);
    provisionalByTarget.get(targetKey).push(action);
  }

  const actions = [];
  for (const [targetTenantId, targetActions] of provisionalByTarget) {
    const sourceIds = new Set(targetActions.map((action) => objectId(action.sourceTenantId)));
    const postRebindContracts = contracts
      .filter((contract) =>
        objectId(contract.tenantId) === targetTenantId || sourceIds.has(objectId(contract.tenantId)))
      .map((contract) => {
        const retired = retirementIds.has(objectId(contract._id));
        return {
          ...contract,
          ...(retired ? {
            status: "cancelled",
            isCurrent: false,
            isCanonical: false,
            tenantVisible: false,
            publicationStatus: "withdrawn",
            archivedAt: now,
          } : {}),
          tenantId: targetTenantId,
          _reconciliationSource: sourceIds.has(objectId(contract.tenantId)) ? "orphan" : "current_user",
          _reconciliationRetired: retired,
        };
      });
    const postRebindStays = stays
      .filter((stay) =>
        objectId(stay.tenantId) === targetTenantId || sourceIds.has(objectId(stay.tenantId)))
      .map((stay) => ({ ...stay, tenantId: targetTenantId }));

    let selected;
    try {
      selected = selectCanonicalTenantContract({
        contracts: postRebindContracts,
        activeStay: newestActiveStay(postRebindStays),
        includeEarlyStages: true,
        now,
      });
    } catch (error) {
      if (error?.code === "MULTIPLE_CANONICAL_CONTRACTS") {
        for (const action of targetActions) {
          blocked.push(block(action.sourceTenantId, "POST_REBIND_MULTIPLE_CANONICAL_CONTRACTS", {
            contractCount: action.contractCount,
            candidates: postRebindContracts
              .filter((contract) => isResidentContractEligible(contract, { includeEarlyStages: true }))
              .map((contract) => {
                const reservation = reservationsById.get(objectId(contract.reservationId));
                return {
                  source: contract._reconciliationSource,
                  contractStatus: contract.status,
                  contractCreatedAt: contract.createdAt || null,
                  reservationStatus: reservation?.status || null,
                  reservationArchived: reservation?.isArchived === true,
                  retiredByPlan: contract._reconciliationRetired,
                  reservationCreatedAt: reservation?.createdAt || null,
                  reservationUpdatedAt: reservation?.updatedAt || null,
                };
              }),
          }));
        }
        continue;
      }
      throw error;
    }

    const hasEligibleContract = postRebindContracts.some((contract) =>
      isResidentContractEligible(contract, { includeEarlyStages: true }));
    if (hasEligibleContract && !selected) {
      for (const action of targetActions) {
          blocked.push(block(action.sourceTenantId, "POST_REBIND_NO_CANONICAL_CONTRACT", {
          contractCount: action.contractCount,
        }));
      }
      continue;
    }
    actions.push(...targetActions);
  }

  return {
    actions,
    blocked,
    retirements,
    scannedOrphanOwnerGroups: orphanContractsByOwner.size,
  };
}

export async function applyContractOwnershipReconciliation({ db, client, plan }) {
  if (!db || !client) throw new Error("Mongo database and client are required.");
  if (plan?.blocked?.length) {
    throw Object.assign(new Error("Ownership reconciliation contains blocked identity groups."), {
      code: "RECONCILIATION_BLOCKED",
      blockedCount: plan.blocked.length,
    });
  }
  const actions = plan?.actions || [];
  const retirements = plan?.retirements || [];
  if (!actions.length && !retirements.length) {
    return {
      actionsApplied: 0,
      contractsUpdated: 0,
      reservationsUpdated: 0,
      staysUpdated: 0,
      abandonedDraftsRetired: 0,
    };
  }

  const totals = {
    actionsApplied: 0,
    contractsUpdated: 0,
    reservationsUpdated: 0,
    staysUpdated: 0,
    abandonedDraftsRetired: 0,
  };
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const retirement of retirements) {
        const retiredAt = new Date();
        const reason = "Reservation was terminal before this Contract left its early-stage draft lifecycle; reconciled by the canonical ownership migration.";
        const result = await db.collection("contracts").updateOne(
          {
            _id: retirement.contractId,
            reservationId: retirement.reservationId,
            status: retirement.previousStatus,
            archivedAt: null,
          },
          {
            $set: {
              status: "cancelled",
              isCurrent: false,
              isCanonical: false,
              publicationStatus: "withdrawn",
              tenantVisible: false,
              archivedAt: retiredAt,
              archivedBy: null,
              archiveReason: reason,
              archivedPreviousStatus: retirement.previousStatus,
            },
            $push: {
              statusHistory: {
                status: "cancelled",
                changedAt: retiredAt,
                changedBy: null,
                reason,
              },
            },
          },
          { session },
        );
        if (result.matchedCount !== 1) {
          throw Object.assign(new Error("Abandoned Contract changed after reconciliation planning."), {
            code: "RECONCILIATION_SOURCE_CHANGED",
          });
        }
        totals.abandonedDraftsRetired += result.modifiedCount;
      }

      for (const action of actions) {
        const sourceTenantId = action.sourceTenantId;
        const targetTenantId = action.targetTenantId;
        const [contractResult, reservationResult, stayResult] = await Promise.all([
          db.collection("contracts").updateMany(
            { tenantId: sourceTenantId },
            { $set: { tenantId: targetTenantId } },
            { session },
          ),
          db.collection("reservations").updateMany(
            { userId: sourceTenantId },
            { $set: { userId: targetTenantId } },
            { session },
          ),
          db.collection("stays").updateMany(
            { tenantId: sourceTenantId },
            { $set: { tenantId: targetTenantId } },
            { session },
          ),
        ]);

        if (
          contractResult.matchedCount !== action.contractCount
          || reservationResult.matchedCount !== action.reservationCount
          || stayResult.matchedCount !== action.stayCount
        ) {
          throw Object.assign(new Error("Ownership reconciliation source changed after planning."), {
            code: "RECONCILIATION_SOURCE_CHANGED",
          });
        }

        totals.actionsApplied += 1;
        totals.contractsUpdated += contractResult.modifiedCount;
        totals.reservationsUpdated += reservationResult.modifiedCount;
        totals.staysUpdated += stayResult.modifiedCount;
      }
    });
  } finally {
    await session.endSession();
  }
  return totals;
}
