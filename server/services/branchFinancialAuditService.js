import crypto from "crypto";

/**
 * ============================================================================
 * MULTI-BRANCH FINANCIAL RECONCILIATION & AUDIT INTEGRITY SERVICE (Scenario 6)
 * ============================================================================
 * Handles branch-isolated financial ledger reconciliation, audit log sequence
 * verification, receipt hash generation, branch occupancy yield KPIs, and cross-branch
 * security isolation guards.
 */

const SECRET_HASH_SEED = process.env.RECEIPT_HASH_SECRET || "LILYCREST-SECURE-HASH-2026";

/**
 * Reconciles branch-level financial revenue, deposit holds, utility income, and maintenance expenses.
 */
export function reconcileBranchFinancialLedger({
  branch = "",
  rentPayments = [],
  depositHolds = [],
  utilityPayments = [],
  maintenanceExpenses = [],
} = {}) {
  const targetBranch = String(branch || "").trim().toLowerCase();

  const filterBranch = (list) =>
    (list || []).filter((item) => {
      const itemBranch = String(item.branch || item.roomId?.branch || "").trim().toLowerCase();
      return !targetBranch || targetBranch === "all" || itemBranch === targetBranch;
    });

  const bRent = filterBranch(rentPayments);
  const bDeposit = filterBranch(depositHolds);
  const bUtility = filterBranch(utilityPayments);
  const bMaint = filterBranch(maintenanceExpenses);

  const totalRentCollected = bRent.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
  const totalDepositHeld = bDeposit.reduce((sum, d) => sum + Math.max(0, Number(d.amount || 0)), 0);
  const totalUtilityCollected = bUtility.reduce((sum, u) => sum + Math.max(0, Number(u.amount || 0)), 0);
  const totalMaintenanceExpenses = bMaint.reduce((sum, m) => sum + Math.max(0, Number(m.amount || 0)), 0);

  const netBranchRevenue = totalRentCollected + totalUtilityCollected - totalMaintenanceExpenses;

  return {
    branch: targetBranch || "all",
    totalRentCollected: Math.round(totalRentCollected * 100) / 100,
    totalDepositHeld: Math.round(totalDepositHeld * 100) / 100,
    totalUtilityCollected: Math.round(totalUtilityCollected * 100) / 100,
    totalMaintenanceExpenses: Math.round(totalMaintenanceExpenses * 100) / 100,
    netBranchRevenue: Math.round(netBranchRevenue * 100) / 100,
    recordCount: bRent.length + bDeposit.length + bUtility.length + bMaint.length,
  };
}

/**
 * Verifies audit log chronological sequence integrity and state snapshot completeness.
 */
export function verifyAuditLogSequenceIntegrity(auditLogs = []) {
  if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
    return { isValid: true, corruptedCount: 0, totalVerified: 0 };
  }

  let corruptedCount = 0;
  let lastTimestamp = 0;

  auditLogs.forEach((log, index) => {
    const timestamp = log.createdAt ? new Date(log.createdAt).getTime() : 0;
    const hasActor = Boolean(log.actorId || log.userId || log.performedBy);
    const hasAction = Boolean(log.action || log.event);

    const isSequenceError = timestamp < lastTimestamp;
    const isMissingFields = !hasActor || !hasAction;

    if (isSequenceError || isMissingFields) {
      corruptedCount++;
    }

    lastTimestamp = Math.max(lastTimestamp, timestamp);
  });

  if (corruptedCount > 0) {
    return {
      isValid: false,
      corruptedCount,
      totalVerified: auditLogs.length,
      error: `Audit log integrity check failed: ${corruptedCount} corrupted or out-of-sequence records detected.`,
    };
  }

  return {
    isValid: true,
    corruptedCount: 0,
    totalVerified: auditLogs.length,
  };
}

/**
 * Generates a deterministic cryptographic verification hash for payment receipts.
 */
export function generateReceiptVerificationHash({
  paymentId,
  tenantId,
  amount,
  paidAt = new Date(),
  secretSeed = SECRET_HASH_SEED,
} = {}) {
  if (!paymentId || !tenantId || !amount) {
    throw new Error("Receipt hash generation requires paymentId, tenantId, and amount.");
  }

  const rawPayload = `${paymentId}:${tenantId}:${Number(amount).toFixed(2)}:${new Date(paidAt).toISOString()}:${secretSeed}`;
  const verificationHash = crypto.createHash("sha256").update(rawPayload).digest("hex").slice(0, 16).toUpperCase();

  return {
    verificationHash,
    verificationUrl: `/verify-receipt?id=${paymentId}&hash=${verificationHash}`,
  };
}

/**
 * Calculates branch performance KPIs: RevPOB, Occupancy Rate %, and Collection Efficiency %.
 */
export function calculateBranchOccupancyKPIs({
  totalBeds = 0,
  occupiedBeds = 0,
  totalMonthlyRentPotential = 0,
  actualCollectedRent = 0,
} = {}) {
  const beds = Math.max(0, Number(totalBeds || 0));
  const occupied = Math.min(beds, Math.max(0, Number(occupiedBeds || 0)));
  const potential = Math.max(0, Number(totalMonthlyRentPotential || 0));
  const collected = Math.max(0, Number(actualCollectedRent || 0));

  const occupancyRate = beds > 0 ? (occupied / beds) * 100 : 0;
  const revPOB = occupied > 0 ? collected / occupied : 0;
  const collectionEfficiency = potential > 0 ? (collected / potential) * 100 : 0;

  return {
    totalBeds: beds,
    occupiedBeds: occupied,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    revPOB: Math.round(revPOB * 100) / 100,
    collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
  };
}

/**
 * Enforces strict multi-branch boundary access guards.
 */
export function validateCrossBranchAccessGuard({
  userBranch = "",
  targetBranch = "",
  isOwner = false,
  isSuperAdmin = false,
} = {}) {
  if (isOwner || isSuperAdmin) {
    return { allowed: true };
  }

  const uBranch = String(userBranch || "").trim().toLowerCase();
  const tBranch = String(targetBranch || "").trim().toLowerCase();

  if (!uBranch || uBranch === "all" || !tBranch || tBranch === "all" || uBranch === tBranch) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: `Access denied: User branch '${userBranch}' cannot access resource in branch '${targetBranch}'.`,
  };
}
