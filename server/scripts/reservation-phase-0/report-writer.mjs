import fs from "node:fs/promises";
import path from "node:path";
import { CODE_FINDINGS, renderCodeFindings } from "./code-findings.mjs";

const CSV_FILES = Object.freeze({
  nonCanonicalStatuses: "reservation-status-audit.csv",
  expiredPaymentHolds: "expired-payment-holds.csv",
  inventoryHoldAudit: "inventory-hold-audit.csv",
  reservationPaymentAudit: "reservation-payment-audit.csv",
  initialPaymentAudit: "initial-payment-audit.csv",
  advanceRentCoverageAudit: "advance-rent-coverage-audit.csv",
  securityDepositAudit: "security-deposit-audit.csv",
  moveInReadinessAudit: "move-in-readiness-audit.csv",
  moveInContractAudit: "move-in-contract-audit.csv",
  contractPricingReconciliation: "contract-pricing-reconciliation.csv",
  leaseTypeAudit: "lease-type-audit.csv",
  zeroDiscountAudit: "zero-percent-discount-audit.csv",
  penaltyPolicyAudit: "penalty-policy-audit.csv",
  prohibitedCashPayments: "prohibited-cash-payments.csv",
  paymentProofAudit: "payment-proof-audit.csv",
  paymentAllocationAudit: "payment-allocation-audit.csv",
  orphanedRecords: "orphaned-records.csv",
  paymentReconciliation: "payment-reconciliation.csv",
  billingOrphans: "reservation-billing-orphans.csv",
  branchConsistency: "branch-consistency.csv",
  duplicateRiskIndicators: "duplicate-risk-indicators.csv",
  financialEvidence: "advance-rent-security-deposit-evidence.csv",
});

const csvCell = (value) => {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(rows = []) {
  if (!rows.length) return "issue_count\n0\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  return `${headers.map(csvCell).join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function safetyMarkdown(safety, recordQueriesExecuted) {
  return [
    "# Reservation Phase 0 Environment Safety",
    "",
    `- Environment name: ${safety.environmentName}`,
    `- Database category: ${safety.category}`,
    `- Database name: ${safety.databaseName || "unknown"}`,
    `- Host category: ${safety.hostCategory}`,
    `- Host fingerprint: ${safety.hostFingerprint || "unavailable"}`,
    `- Metadata connection: ${safety.metadataConnected ? "completed" : "not completed"}`,
    `- Credential privilege assessment: ${safety.privilegeAssessment}`,
    `- Explicit operational read-only authorization: ${safety.explicitlyAuthorized ? "present" : "absent"}`,
    `- Read-only safety established: ${safety.safe ? "yes" : "no"}`,
    `- Record-level queries executed: ${recordQueriesExecuted ? "yes" : "no"}`,
    `- Decision: ${safety.reason}`,
    "",
    "No connection string, hostname, username, password, or token is included in this report.",
    "",
  ].join("\n");
}

export const OWNER_DECISIONS = `# Reservation Phase 0 Owner-Decision Worksheet

This worksheet separates policy already confirmed in the Lilycrest Gil Puyat Developer Workflow Manual v1.0 (August 2026) from interpretations and unresolved owner decisions. Do not answer open questions on Lilycrest's behalf.

## 1. Confirmed by the manual

- The reservation fee is PHP 2,000 for every room, credited to the initial payment, and normally non-refundable when the applicant cancels.
- A Reservation is confirmed only after application review, verified fee payment, an availability recheck, and confirmation.
- Temporary checkout locks, application payment deadlines, and confirmed-Reservation validity are distinct time windows.
- Initial payment is one month advance rent plus one month security deposit plus approved initial charges, less the PHP 2,000 fee credit. Partial and combined payments are permitted.
- Advance rent covers the first month; that period must not be billed twice.
- Security deposit is one month of the approved final monthly rate. Refund, deduction, or forfeiture requires authorized approval; forfeiture is not automatic.
- Approved rate inputs and outputs must be preserved as an immutable snapshot.
- Short-term leases are 1–5 months; long-term leases are 6–12 months. Historical rates differing from January 2026 reference rates are not automatically invalid.
- A 0% discount is valid.
- Move-in requires a confirmed Reservation, initial balance or approved arrangement, required documents or approved exception, room and bed, actual move-in date, approved rate snapshot, emergency contact, and house-rules evidence. The reservation fee alone is insufficient.
- Prepare a Contract draft after confirmation and finalize it after actual move-in details are known. Signed or notarized status is not a pre-move-in requirement absent further owner direction.
- Rent due day follows the actual move-in day; regular billing starts after advance-rent coverage.
- Core penalty policy: no penalty on due day, one grace day, PHP 50 on day +2, PHP 100 on day +3, continuing at PHP 50 per penalty day.
- Cash is prohibited. Payments must use bank transfer, bank deposit, or an approved online channel and retain a traceable external reference.
- Proof upload alone cannot settle a payment. Evidence must include successful status, transaction date, reference, receiving account, exact amount, and verifier.
- Partial and combined allocations must reconcile exactly; overpayment and unallocated amounts must remain visible.

## 2. Strong implementation interpretation

- Treat the January 2026 Gil Puyat rates as reference values, not a basis for automatically changing or invalidating historical approved snapshots.
- Treat a prepared draft as the expected post-confirmation Contract artifact; generate the final Contract only when actual move-in facts can be represented accurately.
- Never auto-release inventory, forfeit a deposit, waive a penalty, or correct financial state from this audit. Every finding is review-only.
- Classify records lacking sufficient evidence as unknown or requiring review, never as compliant merely because no finding could be calculated.

## 3. Still unresolved

1. Does the one-day grace rule apply to all currently active Contracts?
2. What happens to the daily late fee after a partial payment?
3. Does lateness use transaction date or proof-upload date?
4. How many days separate Notice 1, Notice 2, and Notice 3?
5. Must every short-term tenant receive a full Contract?
6. Exactly how many move-in-date changes are allowed?
7. What fallback method applies when an intermediate meter reading is unavailable?
8. Can an expired tenant continue month-to-month, and under what terms?
9. Can electricity rate vary per billing cycle?
10. What is the security-deposit refund processing period?
11. Which roles may approve penalty waivers, custom discounts, custom rates, payment arrangements, and Reservation-validity extensions?
12. What are the final utility rules for private and double rooms?
13. Is the existing 24-hour application payment deadline approved?
14. Is the recommended 30-minute temporary payment lock approved?
15. Does the default 30-day confirmed-Reservation validity apply to every case?
16. What happens to the reservation fee if Lilycrest cancels the Reservation?
17. Can the reservation fee be refunded for approved exceptional cases?
18. What exact approval is required for a longer Reservation validity?
19. What maximum penalty cap, if any, should apply?
20. Are weekends and holidays counted in penalty days?

## 4. Requires written owner confirmation

Record the approved answer, approver, effective date, affected Contracts, required role, and audit-reason requirements for every unresolved item before Phase 1 changes implement it.

## 5. Implementation impact

The unresolved answers control scheduler cutoffs, penalty calculations, notices, role permissions, utility billing, refund timing, Reservation extensions, and legacy-record treatment. Until confirmed, those behaviors must remain configurable, manual-review-only, or unchanged.
`;

function executiveMarkdown({ safety, result, repository }) {
  const executed = Boolean(result);
  const counts = result?.counts || {};
  const count = (key) => executed ? counts[key] ?? 0 : "NOT EXECUTED";
  return `# Reservation Workflow Phase 0 Executive Report

## Verdict

${executed ? "PHASE 0 COMPLETE - READY FOR OWNER DECISIONS" : `PHASE 0 BLOCKED - ${safety.metadataConnected ? "ENVIRONMENT SAFETY NOT ESTABLISHED" : "REQUIRED DATA INACCESSIBLE"}`}

## Repository

- Branch: ${repository.branch}
- Commit inspected: ${repository.commit}
- Working tree at audit execution: ${repository.workingTreeAtAudit}
- Node: ${repository.nodeVersion}
- Package manager: npm ${repository.npmVersion}
- Production workflow logic changed: no

## Environment safety

- Category: ${safety.category}
- Database: ${safety.databaseName || "unknown"}
- Host category: ${safety.hostCategory}
- Privileges: ${safety.privilegeAssessment}
- Record-level queries: ${executed ? "executed after safety approval" : "not executed"}
- Reason: ${safety.reason}

## Audit counts

- Non-canonical statuses: ${count("nonCanonicalStatuses")}
- Expired payment windows: ${count("expiredPaymentHolds")}
- Expired holds still holding inventory: ${executed ? result.inventoryHoldAudit.filter((row) => row.inventoryStillHeld).length : "NOT EXECUTED"}
- Confirmed Reservations missing verified fee evidence: ${count("reservationPaymentAudit")}
- Initial-payment evidence findings: ${count("initialPaymentAudit")}
- Advance-rent coverage findings: ${count("advanceRentCoverageAudit")}
- Security-deposit findings: ${count("securityDepositAudit")}
- Move-in readiness findings: ${count("moveInReadinessAudit")}
- Contract timing/readiness findings: ${count("moveInContractAudit")}
- Contract pricing findings: ${count("contractPricingReconciliation")}
- Lease-type findings: ${count("leaseTypeAudit")}
- Penalty-policy findings: ${count("penaltyPolicyAudit")}
- Prohibited cash-payment findings: ${count("prohibitedCashPayments")}
- Payment-proof findings: ${count("paymentProofAudit")}
- Payment-allocation findings: ${count("paymentAllocationAudit")}
- Orphaned records: ${count("orphanedRecords")}
- Payment reconciliation findings: ${count("paymentReconciliation")}
- Billing integrity findings: ${count("billingOrphans")}
- Branch mismatches: ${count("branchConsistency")}
- Duplicate-risk indicators: ${count("duplicateRiskIndicators")}
- Advance-rent/security-deposit evidence: ${executed ? result.advanceDepositConclusion : "INCONCLUSIVE - RECORD QUERIES BLOCKED"}

## Privacy

Output includes internal IDs only where operational review needs them. User and external payment references are fingerprinted; email, phone, identity-document, credential, and private storage fields are never selected from MongoDB.
`;
}

function readinessMarkdown({ safety, result }) {
  const blockers = [];
  if (!safety.safe) blockers.push("Database identity and read-only credentials have not both been established.");
  if (!result) blockers.push("Required record-level audit checks have not run.");
  blockers.push("Business-owner policy answers in owner-decisions.md remain unresolved.");
  return `# Reservation Phase 1 Readiness

Verdict: ${result && safety.safe ? "READY AFTER OWNER DECISIONS" : "NOT READY"}

## Blockers

${blockers.map((item) => `- ${item}`).join("\n")}

## Recommended Phase 1 inputs

- Approved owner-decision worksheet with named approver and decision date.
- Redacted Phase 0 issue exports reviewed by an authorized administrator.
- Explicit correction policy for legacy records and a backup/export requirement.
- Confirmed payment, contract-readiness, discount, deposit, and penalty policies.
- A separate Phase 1 change plan; no Phase 1 behavior is included here.
`;
}

function statusDefinitionsMarkdown(statusDefinitions) {
  const mismatchRows = statusDefinitions.transitionMismatches.length
    ? statusDefinitions.transitionMismatches.map((row) => `| ${row.status} | ${row.backendOnly.join("; ") || "-"} | ${row.frontendOnly.join("; ") || "-"} |`).join("\n")
    : "| None | - | - |";
  return `# Reservation Status-Definition Audit

- Backend canonical statuses: ${statusDefinitions.backendStatuses.join(", ")}
- Frontend canonical statuses: ${statusDefinitions.frontendStatuses.join(", ")}
- Mongoose schema enum: ${statusDefinitions.schemaStatuses.join(", ")}
- Backend-only statuses: ${statusDefinitions.backendOnlyStatuses.join(", ") || "none"}
- Frontend-only statuses: ${statusDefinitions.frontendOnlyStatuses.join(", ") || "none"}
- Schema-only statuses: ${statusDefinitions.schemaOnlyStatuses.join(", ") || "none"}
- Backend statuses missing from schema: ${statusDefinitions.backendMissingFromSchema.join(", ") || "none"}

## Transition mismatches

| Status | Backend-only targets | Frontend-only targets |
| --- | --- | --- |
${mismatchRows}
`;
}

export async function writeReports({ outputDirectory, safety, result, repository, statusDefinitions }) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const recordQueriesExecuted = Boolean(result);
  const summary = {
    phase: 0,
    verdict: result ? "COMPLETE_READY_FOR_OWNER_DECISIONS" : safety.metadataConnected ? "BLOCKED_ENVIRONMENT_SAFETY_NOT_ESTABLISHED" : "BLOCKED_REQUIRED_DATA_INACCESSIBLE",
    generatedAt: new Date().toISOString(),
    repository,
    environment: { environmentName: safety.environmentName, databaseCategory: safety.category, databaseName: safety.databaseName, hostCategory: safety.hostCategory, hostFingerprint: safety.hostFingerprint, privilegeAssessment: safety.privilegeAssessment, readOnlySafetyEstablished: safety.safe, recordLevelQueriesExecuted: recordQueriesExecuted },
    counts: result?.counts || Object.fromEntries(Object.keys(CSV_FILES).map((key) => [key, null])),
    advanceDepositConclusion: result?.advanceDepositConclusion || "Inconclusive due to inaccessible records",
    moneyTolerance: result?.moneyTolerance ?? 0.01,
    codeFindings: CODE_FINDINGS,
    statusDefinitions,
  };
  await fs.writeFile(path.join(outputDirectory, "phase-0-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDirectory, "environment-safety.md"), safetyMarkdown(safety, recordQueriesExecuted), "utf8");
  await fs.writeFile(path.join(outputDirectory, "code-findings-verification.md"), renderCodeFindings(), "utf8");
  await fs.writeFile(path.join(outputDirectory, "status-definitions.md"), statusDefinitionsMarkdown(statusDefinitions), "utf8");
  await fs.writeFile(path.join(outputDirectory, "owner-decisions.md"), OWNER_DECISIONS, "utf8");
  await fs.writeFile(path.join(outputDirectory, "phase-1-readiness.md"), readinessMarkdown({ safety, result }), "utf8");
  await fs.writeFile(path.join(outputDirectory, "executive-report.md"), executiveMarkdown({ safety, result, repository }), "utf8");
  for (const [key, fileName] of Object.entries(CSV_FILES)) {
    const rows = result ? result[key] || [] : [{ audit_status: "not_executed", issue_count: null, reason: safety.reason }];
    await fs.writeFile(path.join(outputDirectory, fileName), toCsv(rows), "utf8");
  }
  return summary;
}
