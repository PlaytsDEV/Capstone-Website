/**
 * ============================================================================
 * SCENARIO 6 TEST SUITE: MULTI-BRANCH FINANCIAL RECONCILIATION & AUDIT INTEGRITY
 * ============================================================================
 * Tests all 6 edge cases under General Scenario 6:
 * 1. Branch Financial Ledger & Cash Flow Reconciliation (zero cross-branch leakage)
 * 2. Cross-Branch Security Guard & Multi-Tenant Access Isolation
 * 3. Audit Log Sequence & Immutability Verification
 * 4. Super Admin Global Revenue & Overrides Authorization
 * 5. Receipt Hash & Payment Verification Key Integrity
 * 6. Branch KPI Yield Engine (RevPOB, Occupancy Rate %, Collection Efficiency %)
 */

import { describe, it, expect } from "@jest/globals";
import {
  reconcileBranchFinancialLedger,
  verifyAuditLogSequenceIntegrity,
  generateReceiptVerificationHash,
  calculateBranchOccupancyKPIs,
  validateCrossBranchAccessGuard,
} from "../services/branchFinancialAuditService.js";

describe("Scenario 6: Multi-Branch Financial Reconciliation & Audit Log Integrity", () => {
  it("1. should reconcile branch financial ledger with zero cross-branch leakage", () => {
    const rentPayments = [
      { amount: 6000, branch: "Main" },
      { amount: 5000, branch: "Main" },
      { amount: 7000, branch: "Annex" }, // Branch Annex payment
    ];

    const utilityPayments = [
      { amount: 1200, branch: "Main" },
      { amount: 1500, branch: "Annex" },
    ];

    const maintenanceExpenses = [
      { amount: 800, branch: "Main" },
      { amount: 2000, branch: "Annex" },
    ];

    const mainReconciliation = reconcileBranchFinancialLedger({
      branch: "Main",
      rentPayments,
      utilityPayments,
      maintenanceExpenses,
    });

    expect(mainReconciliation.branch).toBe("main");
    expect(mainReconciliation.totalRentCollected).toBe(11000); // 6000 + 5000 (Annex 7000 excluded)
    expect(mainReconciliation.totalUtilityCollected).toBe(1200);  // Annex 1500 excluded
    expect(mainReconciliation.totalMaintenanceExpenses).toBe(800);  // Annex 2000 excluded
    expect(mainReconciliation.netBranchRevenue).toBe(11400); // 11000 + 1200 - 800
  });

  it("2. should enforce cross-branch access isolation guards", () => {
    // Branch admin A attempting to access Branch B -> Denied
    const deniedGuard = validateCrossBranchAccessGuard({
      userBranch: "Main",
      targetBranch: "Annex",
      isSuperAdmin: false,
    });
    expect(deniedGuard.allowed).toBe(false);
    expect(deniedGuard.error).toContain("Access denied: User branch 'Main' cannot access resource in branch 'Annex'.");

    // Same branch access -> Allowed
    const sameBranchGuard = validateCrossBranchAccessGuard({
      userBranch: "Main",
      targetBranch: "Main",
      isSuperAdmin: false,
    });
    expect(sameBranchGuard.allowed).toBe(true);

    // Owner / Super Admin access -> Allowed unconditionally
    const ownerGuard = validateCrossBranchAccessGuard({
      userBranch: "Main",
      targetBranch: "Annex",
      isOwner: true,
    });
    expect(ownerGuard.allowed).toBe(true);

    const superAdminGuard = validateCrossBranchAccessGuard({
      userBranch: "Main",
      targetBranch: "Annex",
      isSuperAdmin: true,
    });
    expect(superAdminGuard.allowed).toBe(true);
  });

  it("3. should verify audit log sequence integrity and detect out-of-sequence records", () => {
    const validLogs = [
      { createdAt: "2026-07-26T10:00:00Z", actorId: "admin-1", action: "UPDATE_ROOM" },
      { createdAt: "2026-07-26T10:05:00Z", actorId: "admin-2", action: "PROCESS_PAYMENT" },
    ];
    expect(verifyAuditLogSequenceIntegrity(validLogs).isValid).toBe(true);

    // Out-of-sequence or missing actor entry
    const corruptedLogs = [
      { createdAt: "2026-07-26T10:10:00Z", actorId: "admin-1", action: "UPDATE_ROOM" },
      { createdAt: "2026-07-26T10:00:00Z", actorId: "admin-2", action: "PROCESS_PAYMENT" }, // Earlier timestamp!
    ];

    const evalCorrupted = verifyAuditLogSequenceIntegrity(corruptedLogs);
    expect(evalCorrupted.isValid).toBe(false);
    expect(evalCorrupted.corruptedCount).toBe(1);
  });

  it("4. should generate deterministic receipt verification hash and verification URL", () => {
    const hashPayload = generateReceiptVerificationHash({
      paymentId: "PAY-998877",
      tenantId: "USER-123",
      amount: 6500,
      paidAt: new Date("2026-07-26T12:00:00Z"),
    });

    expect(hashPayload.verificationHash).toBeDefined();
    expect(hashPayload.verificationHash).toHaveLength(16);
    expect(hashPayload.verificationUrl).toContain("PAY-998877");
    expect(hashPayload.verificationUrl).toContain(hashPayload.verificationHash);
  });

  it("5. should calculate branch performance KPIs (RevPOB, Occupancy Rate %, Collection Efficiency %)", () => {
    const kpis = calculateBranchOccupancyKPIs({
      totalBeds: 50,
      occupiedBeds: 40,
      totalMonthlyRentPotential: 300000,
      actualCollectedRent: 240000,
    });

    expect(kpis.occupancyRate).toBe(80); // 40 / 50 * 100
    expect(kpis.revPOB).toBe(6000);       // 240000 / 40
    expect(kpis.collectionEfficiency).toBe(80); // 240000 / 300000 * 100
  });

  it("6. should aggregate global multi-branch totals when branch filter is set to 'all'", () => {
    const rentPayments = [
      { amount: 6000, branch: "Main" },
      { amount: 7000, branch: "Annex" },
    ];

    const globalReconciliation = reconcileBranchFinancialLedger({
      branch: "all",
      rentPayments,
    });

    expect(globalReconciliation.totalRentCollected).toBe(13000);
    expect(globalReconciliation.recordCount).toBe(2);
  });
});
