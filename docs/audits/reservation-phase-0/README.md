# Reservation Workflow Phase 0 Audit

This package provides a read-only, report-only audit of Reservation lifecycle, payment-hold, inventory, Contract, billing, payment-reconciliation, branch, duplicate, and orphan-reference integrity.

## Safety contract

- The command accepts only `--report-only` and optional `--metadata-only`.
- Mutation-style flags are rejected.
- The database source uses projected `find` reads and metadata commands only; it contains no update, insert, delete, upsert, save, bulk-write, replacement, `$merge`, or `$out` operation.
- A production/operational target requires both explicit authorization (`RESERVATION_AUDIT_READ_ONLY_AUTHORIZED=true`) and credentials proven read-only by MongoDB privilege metadata.
- A remote database whose identity is not demonstrably non-production is blocked unless the same explicit authorization and read-only credential conditions are met.
- Database output is written to `server/audit-output/reservation-phase-0/`, which is ignored by Git.
- User identifiers and external payment references are one-way fingerprinted where full IDs are unnecessary. Email, phone, credential, identity-document, and private storage fields are not selected.

## Commands

From `server/`:

```sh
npm run reservation:audit-phase-0:metadata
npm run reservation:audit-phase-0
npm test -- --runInBand scripts/reservation-phase-0/audit-core.test.mjs
```

The metadata command is the safe first run. It connects only to obtain database identity and authenticated privilege metadata. The record-level command proceeds only if the same guard establishes a safe target.

## Output

The output directory contains the JSON summary, environment-safety report, status-definition comparison, code-finding verification, owner-decision worksheet, Phase 1 readiness verdict, executive report, and category CSVs. Empty CSVs remain valid and contain an explicit zero issue count.

Do not commit generated operational reports. The sample file in this directory is synthetic and contains no operational identifiers.
