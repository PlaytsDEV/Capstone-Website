import fs from "node:fs/promises";
import path from "node:path";
import { CODE_FINDINGS, renderCodeFindings } from "./code-findings.mjs";

const CSV_FILES = Object.freeze({
  nonCanonicalStatuses: "reservation-status-audit.csv",
  expiredPaymentHolds: "expired-payment-holds.csv",
  inventoryHoldAudit: "inventory-hold-audit.csv",
  moveInContractAudit: "move-in-contract-audit.csv",
  contractPricingReconciliation: "contract-pricing-reconciliation.csv",
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

Do not answer these questions on behalf of the owner. Record the approved policy, approver, and decision date beside each item.

## A. Pre-move-in charges

1. Should the system collect only the reservation fee before move-in?
2. Should it also collect one-month advance rent?
3. Should it also collect one-month security deposit?
4. Should these appear in one pre-move-in Bill as separate line items?
5. Can partial payments be accepted?
6. Can payments be recorded offline?
7. What exactly must be paid before contract drafting?
8. What exactly must be paid before move-in?

## B. Reservation fee

1. Is PHP 2,000 legally fixed?
2. Is it editable through Business Settings?
3. Is it non-refundable?
4. Is it credited toward first-month rent?
5. What happens when Lilycrest cancels the application?
6. What happens when the applicant cancels?
7. What wording should appear consistently in the UI and Contract?

## C. Security deposit

1. Is it one month of discounted rent?
2. Is it one month of regular undiscounted rent?
3. Is it refundable in full by default?
4. What deductions are allowed?
5. Must the original payment be traceable before a refund can be processed?

## D. Discount and room pricing

1. Is identical base pricing across both branches intentional?
2. Can discounts validly be disabled?
3. Is 0% discount a valid contract state?
4. Are discounts global or branch-specific?
5. Are room-specific short-term prices supposed to work?
6. Are regularLongRate and regularShortRate still required?
7. Should pricing become immutable at application approval or payment approval?

## E. Contract readiness

1. Can a Contract be drafted before payment?
2. Must the reservation fee be paid first?
3. Must all pre-move-in charges be paid first?
4. What Contract state is required for move-in: draft, pricing approved, generated, signed, notarized, or published?
5. Can an authorized admin override the Contract requirement?
6. If yes, what reason, permission, and audit evidence are required?

## F. Penalty policy

1. Confirm the rent due-date rule.
2. Confirm whether there is exactly one grace day.
3. Confirm that PHP 50 per day begins after the grace day.
4. Confirm whether weekends and holidays count.
5. Confirm the timezone used.
6. Confirm whether penalties have a maximum cap.
7. Confirm whether penalties continue after partial payment.
8. Confirm whether admins may waive penalties.
9. Confirm what audit reason is required for a waiver.

## G. Legacy records

1. Should existing move-ins without Contracts be grandfathered?
2. Should they require Contract completion?
3. Should expired unpaid holds be automatically cancelled after review?
4. Who approves record correction?
5. Is a backup/export required before corrective migration?
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
- Move-ins without a fully ready Contract: ${executed ? result.moveInContractAudit.filter((row) => row.readiness !== "fully_ready").length : "NOT EXECUTED"}
- Contract pricing findings: ${count("contractPricingReconciliation")}
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
  for (const [key, fileName] of Object.entries(CSV_FILES)) await fs.writeFile(path.join(outputDirectory, fileName), toCsv(result?.[key] || []), "utf8");
  return summary;
}
