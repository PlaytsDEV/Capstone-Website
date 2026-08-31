# ROOM TRANSFER PRODUCTION READ-ONLY AUDIT ACCESS

## Purpose

Provide an approved, read-only path for validating:

- legacy `securityDepositHeld` evidence;
- Adriane's Room Transfer financial chronology;
- generated initial-Contract predecessor state;
- current-rent resolution; and
- Room Transfer Bill presentation.

No production writes will occur during validation. The audit runners refuse
`--apply` through the read-only connection path.

## Required from the infrastructure owner

1. Authoritative production MongoDB database name.
2. A dedicated audit user with only `read@<production-db>`.
3. Authentication database/source for that audit user.
4. Approved tunnel, proxy, or bastion procedure.
5. Expected local loopback host and port.
6. VPN and IP-allowlist requirements.
7. Approved, Git-ignored profile/environment-variable location.
8. Confirmation that `connectionStatus` with `showPrivileges: true` is
   available to the audit user.
9. Confirmation that the returned role and privileges contain no write,
   collection-creation, or index-creation actions.

Do not provide the normal application read/write URI, Render credentials,
developer credentials, or credentials copied from another environment.

## Required profile fields

The approved secret-bearing profile must provide:

```text
MONGODB_URI=<approved read-only tunnel/proxy URI including the database name>
RESERVATION_AUDIT_READ_ONLY_AUTHORIZED=true
RESERVATION_AUDIT_EXPECTED_DATABASE=<authoritative production database name>
RESERVATION_AUDIT_EXPECTED_HOST=<approved loopback host>
RESERVATION_AUDIT_EXPECTED_PORT=<approved local forwarding port>
```

Do not commit this profile or print its URI. The expected host, port, and
database must match the URI exactly, and the connected database must match the
expected database. The endpoint must be loopback-only. The disposable
`lilycrest-reservation-audit-2026-08` copy is explicitly rejected as a
production target.

## Startup sequence

1. Establish the approved tunnel/VPN path supplied by the infrastructure owner.
2. Load the approved Git-ignored audit profile.
3. Run one audit script without `--apply`.
4. Confirm the startup output reports:

   ```text
   MODE: READ ONLY / DRY RUN
   DATABASE: <approved production database>
   PRIVILEGES: READ ONLY VERIFIED
   ```

5. Stop immediately on any authorization, identity, role, or privilege error.

The repository does not currently contain the missing tunnel host, local port,
VPN instructions, or credentials. Infrastructure must supply those values; do
not guess them.

## Audit commands after access approval

From `server/`, and only after the safety banner succeeds:

```text
node scripts/backfill_security_deposit_held.mjs
node scripts/repair_adriane_room_transfer.mjs
node scripts/audit_room_transfer_generated_predecessors.mjs
```

Do not pass `--apply` during production validation.

## Deferred, non-blocking OPS follow-ups

Production validation is intentionally deferred until the approved read-only
access path exists. This does not block application-code review because Room
Transfer fails closed when legacy deposit or current-rent evidence cannot be
proved.

The following remain separate operator-approved tasks and are not application
startup, scheduler, deployment, or migration steps:

1. Audit production evidence for `securityDepositHeld`.
2. Plan and approve any safe legacy deposit backfill.
3. Reconcile Adriane's Room Transfer financial chronology.
4. Audit generated-initial Contract finalization eligibility.
5. Optionally sample production current-rent source resolution.

No production repair, Contract publication, refund, rent credit, or data
mutation is authorized by this document.
