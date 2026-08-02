import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { analyzeAuditDataset, assertReportOnlyArgs, classifyEnvironment, fingerprint, maskEmail, maskPhone, moneyEqual, roundMoney } from "./audit-core.mjs";
import { toCsv } from "./report-writer.mjs";
import { inspectStatusDefinitions } from "./status-definitions.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const now = new Date("2026-08-02T12:00:00.000Z");
const oid = (suffix) => `0000000000000000000000${String(suffix).padStart(2, "0")}`;
const fixture = (overrides = {}) => ({
  users: [{ _id: oid(1), branch: "gil-puyat" }],
  rooms: [{ _id: oid(2), branch: "gil-puyat", type: "private", regularLongRate: 9000, regularShortRate: 10000, beds: [{ id: "A", status: "reserved", occupiedBy: { reservationId: oid(3) } }] }],
  reservations: [{ _id: oid(3), userId: oid(1), roomId: oid(2), selectedBed: { id: "A" }, status: "approved_for_payment", paymentStatus: "pending", paymentExpiresAt: "2026-08-01T12:00:00.000Z", monthlyRent: 9000, reservationFeeAmount: 2000, isArchived: false }],
  contracts: [], bills: [], payments: [], stays: [], settings: [], auditLogs: [], webhookEvents: [], collectionWarnings: [],
  ...overrides,
});

describe("reservation Phase 0 audit safety", () => {
  test.each(["--fix", "--repair", "--apply", "--migrate", "--delete", "--update", "--write"])("rejects mutation flag %s", (flag) => {
    expect(() => assertReportOnlyArgs(["--report-only", flag])).toThrow(/unsupported mutation option/i);
  });

  test("requires explicit report-only mode", () => {
    expect(() => assertReportOnlyArgs([])).toThrow(/requires --report-only/i);
    expect(assertReportOnlyArgs(["--report-only"])).toEqual({ reportOnly: true, metadataOnly: false });
  });

  test("derives canonical status sets from backend, schema, and frontend sources", () => {
    const definitions = inspectStatusDefinitions();
    expect(definitions.backendOnlyStatuses).toEqual([]);
    expect(definitions.frontendOnlyStatuses).toEqual([]);
    expect(definitions.schemaOnlyStatuses).toEqual([]);
    expect(definitions.transitionMismatches.length).toBeGreaterThan(0);
  });

  test("database source contains no write-method calls", () => {
    const source = fs.readFileSync(path.join(here, "read-only-source.mjs"), "utf8");
    expect(source).not.toMatch(/\.(insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|replaceOne|bulkWrite|findOneAndUpdate|save)\s*\(/);
  });

  test("database source has no aggregation write stages", () => {
    const source = fs.readFileSync(path.join(here, "read-only-source.mjs"), "utf8");
    expect(source).not.toMatch(/\$(merge|out)\b/i);
    expect(source).not.toMatch(/\.aggregate\s*\(/);
  });

  test("blocks an unverified operational target", () => {
    expect(classifyEnvironment({ environmentName: "development", hostCategory: "managed-remote", databaseName: "lilycrest-dormitory", privilegeAssessment: "write-capable" })).toEqual(expect.objectContaining({ safe: false, category: "operational-unverified" }));
  });

  test("allows only a named non-production target with read-only privileges", () => {
    expect(classifyEnvironment({ environmentName: "test", hostCategory: "managed-remote", databaseName: "lilycrest-test", privilegeAssessment: "read-only" }).safe).toBe(true);
  });
});

describe("reservation Phase 0 audit checks", () => {
  test("detects non-canonical reservation status values", () => {
    const result = analyzeAuditDataset(fixture({ reservations: [{ ...fixture().reservations[0], status: "approved" }] }), { now });
    expect(result.nonCanonicalStatuses).toHaveLength(1);
    expect(result.nonCanonicalStatuses[0]).toEqual(expect.objectContaining({ currentStatus: "approved", schemaAccepts: false, classification: "legacy", requiresAdminReview: true }));
  });

  test("detects only expired unpaid payment holds", () => {
    const pendingFuture = { ...fixture().reservations[0], _id: oid(4), paymentExpiresAt: "2026-08-03T12:00:00.000Z" };
    const result = analyzeAuditDataset(fixture({ reservations: [fixture().reservations[0], pendingFuture] }), { now });
    expect(result.expiredPaymentHolds.map((row) => row.reservationId)).toEqual([oid(3)]);
  });

  test("does not flag paid reservations for release", () => {
    const paid = { ...fixture().reservations[0], paymentStatus: "paid" };
    expect(analyzeAuditDataset(fixture({ reservations: [paid] }), { now }).expiredPaymentHolds).toHaveLength(0);
  });

  test("does not flag an expired reservation with a successful Payment", () => {
    const payments = [{ _id: oid(5), reservationId: oid(3), purpose: "reservation_deposit", amount: 2000, status: "confirmed", branch: "gil-puyat" }];
    expect(analyzeAuditDataset(fixture({ payments }), { now }).expiredPaymentHolds).toHaveLength(0);
  });

  test("detects contractless move-in records", () => {
    const movedIn = { ...fixture().reservations[0], status: "moveIn", paymentStatus: "paid" };
    const result = analyzeAuditDataset(fixture({ reservations: [movedIn] }), { now });
    expect(result.moveInContractAudit).toEqual(expect.arrayContaining([expect.objectContaining({ policyState: "No Contract", preparedDraftExists: false, classification: "missing_expected_prepared_draft" })]));
  });

  test("flags a confirmed reservation without a verified PHP 2,000 fee", () => {
    const reservation = { ...fixture().reservations[0], status: "reserved", paymentStatus: "paid" };
    expect(analyzeAuditDataset(fixture({ reservations: [reservation] }), { now }).reservationPaymentAudit[0].issues).toContain("confirmed_reservation_without_verified_fee");
  });

  test("accepts a verified fee only with an exact amount and external reference", () => {
    const reservation = { ...fixture().reservations[0], status: "reserved", paymentStatus: "paid" };
    const payment = { _id: oid(5), reservationId: oid(3), purpose: "reservation_deposit", amount: 2000, status: "confirmed", source: "paymongo", externalPaymentId: "external-1", branch: "gil-puyat" };
    expect(analyzeAuditDataset(fixture({ reservations: [reservation], payments: [payment] }), { now }).reservationPaymentAudit).toHaveLength(0);
  });

  test("classifies incomplete initial-payment collection evidence", () => {
    const reservation = { ...fixture().reservations[0], status: "reserved", paymentStatus: "paid" };
    const result = analyzeAuditDataset(fixture({ reservations: [reservation] }), { now });
    expect(result.initialPaymentAudit[0].classification).toBe("no_evidence");
  });

  test("detects regular rent overlapping advance-rent coverage", () => {
    const reservation = { ...fixture().reservations[0], status: "moveIn", paymentStatus: "paid", confirmedMoveInDate: "2026-07-15T00:00:00.000Z" };
    const contract = { _id: oid(6), reservationId: oid(3), tenantId: oid(1), roomId: oid(2), branch: "gil-puyat", advanceCoverageStart: "2026-07-15T00:00:00.000Z", advanceCoverageEnd: "2026-08-15T00:00:00.000Z" };
    const bill = { _id: oid(7), reservationId: oid(3), userId: oid(1), roomId: oid(2), branch: "gil-puyat", charges: { rent: 9000 }, billingCycleStart: "2026-07-15T00:00:00.000Z", billingCycleEnd: "2026-08-14T00:00:00.000Z", status: "paid" };
    const advance = { _id: oid(8), reservationId: oid(3), purpose: "advance_rent", amount: 9000, status: "confirmed", source: "paymongo", externalPaymentId: "advance-1" };
    expect(analyzeAuditDataset(fixture({ reservations: [reservation], contracts: [contract], bills: [bill], payments: [advance] }), { now }).advanceRentCoverageAudit[0].classification).toBe("confirmed_duplicate_billing");
  });

  test("flags a security deposit that differs from the approved final rate", () => {
    const contract = { _id: oid(6), reservationId: oid(3), tenantId: oid(1), roomId: oid(2), branch: "gil-puyat", approvedMonthlyRate: 9000, securityDepositAmount: 10000 };
    expect(analyzeAuditDataset(fixture({ contracts: [contract] }), { now }).securityDepositAudit[0].issues).toContain("deposit_not_equal_to_approved_final_monthly_rate");
  });

  test("reports move-in readiness gaps independently of signature and notarization", () => {
    const reservation = { ...fixture().reservations[0], status: "moveIn", paymentStatus: "paid" };
    const result = analyzeAuditDataset(fixture({ reservations: [reservation] }), { now });
    expect(result.moveInReadinessAudit[0].issues).toEqual(expect.arrayContaining(["reservation_fee_not_verified", "actual_move_in_date_missing", "rate_snapshot_not_approved"]));
    expect(result.moveInReadinessAudit[0].issues.join(" ")).not.toMatch(/signed|notarized/);
  });

  test("detects a lease type inconsistent with a 1–5 month duration", () => {
    const contract = { _id: oid(6), reservationId: oid(3), tenantId: oid(1), roomId: oid(2), branch: "gil-puyat", leaseDurationMonths: 5, leaseType: "long_term" };
    expect(analyzeAuditDataset(fixture({ contracts: [contract] }), { now }).leaseTypeAudit[0].expectedLeaseType).toBe("short_term");
  });

  test("treats a mathematically consistent zero percent discount as valid", () => {
    const contract = { _id: oid(6), reservationId: oid(3), tenantId: oid(1), roomId: oid(2), branch: "gil-puyat", discountPercentage: 0, discountAmount: 0, regularMonthlyRate: 9000, approvedMonthlyRate: 9000 };
    expect(analyzeAuditDataset(fixture({ contracts: [contract] }), { now }).zeroDiscountAudit[0]).toEqual(expect.objectContaining({ mathematicallyValid: true }));
  });

  test("calculates PHP 50 beginning on day two after the due date", () => {
    const bill = { _id: oid(7), userId: oid(1), roomId: oid(2), branch: "gil-puyat", dueDate: "2026-07-30T00:00:00.000Z", remainingAmount: 1000, charges: { penalty: 100 } };
    const result = analyzeAuditDataset(fixture({ bills: [bill] }), { now });
    expect(result.penaltyPolicyAudit).toHaveLength(0);
  });

  test("flags prohibited cash payment records", () => {
    const payment = { _id: oid(5), tenantId: oid(1), reservationId: oid(3), method: "cash", amount: 1000, status: "confirmed" };
    expect(analyzeAuditDataset(fixture({ payments: [payment] }), { now }).prohibitedCashPayments[0].classification).toBe("prohibited_cash_payment");
  });

  test("flags successful manual proof without required evidence or reference", () => {
    const payment = { _id: oid(5), tenantId: oid(1), reservationId: oid(3), method: "bank", amount: 1000, status: "confirmed", source: "manual_proof", verifiedAt: now, verifiedBy: oid(1), safeEvidence: { providerStatus: "failed" } };
    const issues = analyzeAuditDataset(fixture({ payments: [payment] }), { now }).paymentProofAudit[0].issues;
    expect(issues).toEqual(expect.arrayContaining(["invalid_proof_status_accepted", "transaction_date_missing", "external_reference_missing", "receiving_account_evidence_missing"]));
  });

  test("detects payment allocations that do not reconcile to the payment", () => {
    const payment = { _id: oid(5), tenantId: oid(1), reservationId: oid(3), amount: 1000, status: "confirmed", safeEvidence: { allocations: [{ targetId: oid(7), amount: 600 }], unallocatedAmount: 0 } };
    const bill = { _id: oid(7), reservationId: oid(3), userId: oid(1), roomId: oid(2), branch: "gil-puyat", totalAmount: 1000 };
    expect(analyzeAuditDataset(fixture({ payments: [payment], bills: [bill] }), { now }).paymentAllocationAudit[0].issues).toContain("allocated_plus_unallocated_does_not_equal_payment");
  });

  test("pricing reconciliation catches changed regular and approved rates", () => {
    const contract = { _id: oid(6), reservationId: oid(3), tenantId: oid(1), roomId: oid(2), branch: "gil-puyat", regularMonthlyRate: 10000, discountPercentage: 10, discountAmount: 1000, approvedMonthlyRate: 9000, reservationFeeAmount: 2000, securityDepositAmount: 9000, advanceRentAmount: 9000 };
    const changedReservation = { ...fixture().reservations[0], monthlyRent: 8500 };
    const result = analyzeAuditDataset(fixture({ reservations: [changedReservation], contracts: [contract] }), { now });
    expect(result.contractPricingReconciliation[0].issues).toContain("contract_reservation_monthly_rent_mismatch");
  });

  test("uses application centavo rounding and a one-cent tolerance", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(moneyEqual(100.001, 100.009)).toBe(true);
    expect(moneyEqual(100, 100.02)).toBe(false);
  });

  test("detects orphaned relationships", () => {
    const broken = { ...fixture().reservations[0], userId: oid(9), roomId: oid(8) };
    const result = analyzeAuditDataset(fixture({ reservations: [broken] }), { now });
    expect(result.orphanedRecords.map((row) => row.relation)).toEqual(expect.arrayContaining(["reservation.user", "reservation.room"]));
  });

  test("detects branch mismatches across linked records", () => {
    const reservation = { ...fixture().reservations[0], branch: "guadalupe" };
    const result = analyzeAuditDataset(fixture({ reservations: [reservation] }), { now });
    expect(result.branchConsistency[0]).toEqual(expect.objectContaining({ sourceType: "reservation", sourceBranch: "guadalupe", targetBranch: "gil-puyat" }));
  });

  test("redacts identifiers and PII deterministically", () => {
    expect(maskEmail("leigh@example.com")).toBe("l***@example.com");
    expect(maskPhone("+63 912 345 6789")).toMatch(/\*6789$/);
    expect(fingerprint("secret-reference")).toHaveLength(12);
    expect(fingerprint("secret-reference")).toBe(fingerprint("secret-reference"));
  });

  test("empty collections produce valid reports", () => {
    const result = analyzeAuditDataset({}, { now });
    expect(result.counts.nonCanonicalStatuses).toBe(0);
    expect(toCsv([])).toBe("issue_count\n0\n");
  });

  test("missing optional collections are reported without crashing", () => {
    const result = analyzeAuditDataset({ collectionWarnings: ["Optional or required collection unavailable: auditLogs"] }, { now });
    expect(result.collectionWarnings).toEqual(["Optional or required collection unavailable: auditLogs"]);
  });

  test("reports are deterministic for identical fixtures and timestamps", () => {
    expect(analyzeAuditDataset(fixture(), { now })).toEqual(analyzeAuditDataset(fixture(), { now }));
  });

  test("detects bill balance and duplicate period issues", () => {
    const bills = [
      { _id: oid(10), reservationId: oid(3), userId: oid(1), roomId: oid(2), branch: "gil-puyat", billingMonth: "2026-08", totalAmount: 1000, paidAmount: 0, remainingAmount: 1200, status: "pending" },
      { _id: oid(11), reservationId: oid(3), userId: oid(1), roomId: oid(2), branch: "gil-puyat", billingMonth: "2026-08", totalAmount: 1000, paidAmount: 0, remainingAmount: 1000, status: "pending" },
    ];
    const result = analyzeAuditDataset(fixture({ bills }), { now });
    expect(result.billingOrphans[0].problems).toContain("remaining_exceeds_total");
    expect(result.duplicateRiskIndicators.map((row) => row.category)).toContain("duplicate_billing_period");
  });
});
