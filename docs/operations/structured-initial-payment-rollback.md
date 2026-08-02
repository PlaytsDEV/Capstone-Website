# Structured Initial Payment v1 — Rollout and Rollback

## Boundary

The feature flag controls assignment only. Once a Reservation stores `financialWorkflowVersion: structured-initial-payment-v1`, it remains on that workflow even if the flag is disabled. This prevents a mid-payment rollback from deleting Bills, credits, or provider references.

## Controlled rollout

1. Deploy with `STRUCTURED_INITIAL_PAYMENT_ENABLED=false`.
2. Run automated tests and the controlled QA checklist.
3. Set an approved ISO timestamp in `STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT`.
4. Enable the flag for newly eligible Reservations.
5. Monitor webhook reconciliation, duplicate-key errors, initial Bill creation, and first regular billing.

## Rollback

1. Set `STRUCTURED_INITIAL_PAYMENT_ENABLED=false` to stop assigning the workflow to additional Reservations.
2. Do not remove markers from already assigned Reservations.
3. Keep PayMongo webhook processing available for existing structured Bills.
4. Roll back the application release if necessary while preserving stored Reservations, Bills, Payments, webhook events, and audit logs.
5. Reconcile any in-flight PayMongo session through provider evidence; never infer settlement from a browser redirect.

Rollback must not run a historical migration, recalculate legacy Bills, reuse the Reservation Fee credit, or alter penalties.
