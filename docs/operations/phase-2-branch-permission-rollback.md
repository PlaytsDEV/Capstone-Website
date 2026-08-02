# Phase 2 Branch Permission Rollback

Phase 2 is additive authorization hardening and has no database migration.

## Changed surfaces

- Reservation cancellation and pre-move-in modification handlers
- Tenancy reversal, termination, abandonment, and room-swap handlers
- Milestone arrangement handler and service branch recheck
- Reservation and billing route middleware order
- Shared fail-closed branch authorization and audit adapter
- Focused authorization, route, and regression tests

## Safe rollback

1. Revert the Phase 2 PR or the affected focused commit.
2. Run Reservation, tenancy-action, Billing, route-access, audit, and Phase 1 regression tests.
3. Deploy the reverted application without running a database rollback.
4. If a valid same-branch action was blocked, investigate the authoritative branch relationship and correct the code or test fixture.

Do not disable branch authorization with a production feature flag, add a temporary cross-branch bypass, or modify historical records to make a denied request pass.
