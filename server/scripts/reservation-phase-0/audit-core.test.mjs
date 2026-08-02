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
    expect(result.moveInContractAudit).toEqual([expect.objectContaining({ readiness: "no_contract", classification: "critical_admin_review" })]);
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
