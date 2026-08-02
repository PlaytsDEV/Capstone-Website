# Phase 2 Branch Permission Hardening

## Scope

Phase 2 secures ten administrative mutations without changing Reservation, Billing, Contract, Payment, penalty, or pricing calculations:

1. Approve cancellation request
2. Reject cancellation request
3. Approve pre-move-in modification
4. Reject pre-move-in modification
5. Cancel transfer
6. Cancel move-out
7. Execute early termination
8. Execute same-branch room swap
9. Trigger abandonment
10. Create milestone billing arrangement

## Reference patterns

The implementation follows the existing protected Reservation lifecycle actions in `reservationLifecycleController.js`, branch-scoped payment verification, and the Contract router/controller boundary:

1. Authentication
2. Permission enforcement
3. `filterByBranch`
4. Authoritative record loading
5. Shared `checkBranchAccess` enforcement
6. State validation and mutation
7. Success audit
8. Notification or response

`branchAuthorizationService.js` is a fail-closed adapter around the established access helper. It verifies that required server-side branch sources exist and agree before calling `checkBranchAccess`.

## Role matrix

| Actor | Same-branch record | Other-branch record | Missing branch scope | Cross-branch room swap or transfer |
|---|---|---|---|---|
| Gil Puyat Branch Admin | Allowed with required action permission | Denied | Denied | Denied |
| Guadalupe Branch Admin | Allowed with required action permission | Denied | Denied | Denied |
| Owner / Super Admin | Allowed under existing global policy | Allowed under existing global policy | Denied if branch middleware context is absent | Cross-branch swap/transfer remains unsupported |
| Applicant / Tenant | Not an administrative actor | Denied by authentication/permission middleware | Denied | Denied |

## Failure behavior

- Wrong actor branch: `403 BRANCH_ACCESS_DENIED`
- Missing actor scope: `403 BRANCH_SCOPE_MISSING`
- Unsupported cross-branch action: `403 CROSS_BRANCH_ACTION_NOT_ALLOWED`
- Missing or malformed target branch: `422 TARGET_BRANCH_UNRESOLVED`
- Invalid Room/Bed relationship: `422 TARGET_BED_MISMATCH`
- Conflicting linked branches: `409 BRANCH_RELATIONSHIP_INCONSISTENT`
- Inconsistent Bill relationships: `409 BILL_BRANCH_MISMATCH`

Denied actions stop before business mutation, workflow service invocation, successful business audit, or notification. A separate sanitized security audit records the denial.

## Database impact

None. Phase 2 adds no schema, index, migration, backfill, or historical record update.

## Known exclusions

Penalty unification, legacy PayMongo reconciliation, orphan migration, historical corrections, broad UI redesign, a cross-branch transfer feature, and unrelated audit findings remain outside this phase.
