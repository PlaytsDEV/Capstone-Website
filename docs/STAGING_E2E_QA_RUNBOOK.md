# Contract staging/E2E operations

This repository supplies the authoritative staging Contract API, Admin web, synthetic fixture lifecycle, and real-notification dispatch gate. The complete cross-system/device checklist is in the coordinated Mobile repository at `LilyCrest-Clean/docs/STAGING_E2E_QA_RUNBOOK.md`.

No production data is needed or permitted. Start hosted staging with `NODE_ENV=production`, `LILYCREST_ENVIRONMENT=staging`, and values based on `server/.env.staging.example` and `web/.env.staging.example`. The staging database name, Firebase project/bucket, API host, and Admin host must each contain a clear staging/QA marker. PayMongo accepts only a test key. Startup fails closed when this contract is violated.

## Deployment

1. Provision a separate QA-named Mongo database and least-privilege user.
2. Provision a dedicated Firebase Auth/Storage/FCM project and service account.
3. Deploy `server` to a clearly named staging HTTPS host with staging-only CORS/public URLs, Resend QA sender/mailbox, secrets, and `STAGING_QA_ADMIN_EMAILS`.
4. Deploy `web` with `npm run build:staging` and the same dedicated Firebase project. Confirm the persistent STAGING banner and staging-only network targets.
5. Point the separate mobile-facing staging API at this Contract API. Do not point either service at `api.lilycrest.space` or any production data service.

## Fixture commands

Supply secrets through the host/terminal environment; never commit or print them. Use a unique run ID and clearly recognizable QA mailboxes.

```powershell
$env:QA_RUN_ID='qa-20260823-001'
npm.cmd run qa:fixtures:seed
npm.cmd run qa:fixtures:list
npm.cmd run qa:fixtures:cleanup
npm.cmd run qa:fixtures:cleanup:confirm
npm.cmd run qa:fixtures:list
```

Seed is idempotent and creates 21 marked business records plus one run manifest and three QA-claimed Firebase users. Contracts intentionally begin without prepared/final documents so QA must use the actual Admin lifecycle. Cleanup is dry-run by default, deletes only the exact listed IDs/QA-claimed Auth users/provably-owned storage objects, validates counts, and verifies zero captured IDs remain.

## Notification route

Authenticated allowlisted QA Admins may call `POST /api/staging/qa/notifications/:type` for `announcement`, `billing`, `contract`, `maintenance`, and `support`. The tenant must carry `qa_fixture: true` and the selected `qa_run_id`; every dispatch is audited. Announcement requires a selected live audience-eligible QA record. Contract requires an actual generated version. Support requires an actual Admin reply. Production never mounts the route.

## Guard inventory

- `server/config/environmentSafety.js`: service startup and write-target resource validation.
- `server/scripts/stagingWriteGuard.js` and `.cjs`: shared ESM/CommonJS CLI gate.
- `server/scripts/writeToolSafety.test.js`: scans every direct Mongo/Mongoose write script and named publisher/approval tools for the guard.
- All seed, reset, cleanup, wipe, delete, fix, repair, migrate, backfill, publisher, and approval scripts identified by the scanner are guarded.
- `seed_staging_qa_fixtures.mjs`: explicit staging gate before Auth or DB writes, deterministic run ownership, QA mailbox validation, and recoverable Auth manifest.
- `cleanup_staging_qa_fixtures.mjs`: explicit staging gate, dry run, exact-ID deletion, storage ownership proof, QA custom-claim check, and post-delete verification.
- `stagingQaRoutes.js`: staging-only mount, normal token/Admin middleware, QA Admin allowlist, QA tenant/run scoping, real notification producers, and audit records.
- Web environment validation rejects cross-environment API/socket/app/Firebase values; staging build and visible Admin banner are required.

Run before handoff:

```powershell
cd server
npm.cmd test -- --runInBand
cd ..\web
npm.cmd test
npm.cmd run build:production
```

Do not mark release ready until the complete device/browser checklist, cross-tenant Contract denial, draft/final lifecycle, mobile propagation, and cleanup verification have real staging evidence.
