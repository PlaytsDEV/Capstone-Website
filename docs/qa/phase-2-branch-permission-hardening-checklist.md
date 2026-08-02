# Phase 2 Controlled Branch-Authorization QA

Use test accounts and test records only. Capture the before state before submitting each action and verify the authoritative server state afterward.

Required accounts:

- Gil Puyat Branch Admin
- Guadalupe Branch Admin
- Owner / Super Admin
- Optional administrative account without the required module permission

Required fixtures:

- Pending cancellation and pre-move-in modification Reservations in both branches
- Active Stays, Rooms, and Beds in both branches
- Eligible Bills in both branches
- Valid same-branch and deliberately invalid cross-branch room-swap pairs

| Tester | Account role | Actor branch | Target branch | Endpoint or UI action | Expected result | Actual result | HTTP status | Response code | Before state | After state | Notification generated | Audit entry generated | Screenshot | Console error | Network error | Test date |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  | Branch Admin |  |  | Approve cancellation | Same branch succeeds; other branch is denied with no bed release |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Reject cancellation | Same branch succeeds; other branch remains pending |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Approve pre-move-in modification | Same branch succeeds; other branch dates and assignment remain unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Reject pre-move-in modification | Same branch succeeds; other branch request remains pending |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Cancel transfer | Same branch succeeds; other branch source/target assignments remain unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Cancel move-out | Same branch succeeds; other branch Stay, Room, and billing flags remain unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Early termination | Same branch succeeds; other branch Reservation, Stay, Contract, and deposit state remain unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Abandonment | Same branch succeeds; other branch occupancy and deposit state remain unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Branch Admin |  |  | Room swap | Same-branch pair follows existing behavior; other-branch source/target and invalid Bed are denied |  |  |  |  |  |  |  |  |  |  |  |
|  | Billing Admin |  |  | Milestone arrangement | Same branch succeeds; other branch leaves Bill and arrangements unchanged |  |  |  |  |  |  |  |  |  |  |  |
|  | Owner / Super Admin | Global | Gil Puyat | Repeat all ten actions | Existing global policy is preserved, except unsupported cross-branch swap/transfer |  |  |  |  |  |  |  |  |  |  |  |
|  | Owner / Super Admin | Global | Guadalupe | Repeat all ten actions | Existing global policy is preserved, except unsupported cross-branch swap/transfer |  |  |  |  |  |  |  |  |  |  |  |
|  | Admin without permission |  | Same branch | Repeat applicable action | Permission middleware denies before branch resolution or mutation |  |  |  |  |  |  |  |  |  |  |  |

For every denied action confirm there is no successful business audit, no user-facing success notification, and no local optimistic success state. A sanitized denied-attempt security event is expected.
