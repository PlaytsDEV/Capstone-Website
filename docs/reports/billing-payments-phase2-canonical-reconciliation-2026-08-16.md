# Billing + Payments Phase 2 — Canonical Reconciliation Report

**Scope:** `Capstone-Website/server` only. `LilyCrest-Mobile` was not modified in this phase. No Render changes were made. No commit was made, no push was made, no deployment was triggered.

**Continues from:** `docs/reports/billing-payments-consolidation-report-2026-08-12.md` (the "Aug 12 report" throughout this document) and three prior audit/hardening phases performed against `D:\LilyCrest\LilyCrest-Clean` (the standalone/legacy mobile backend), whose findings were reconciled against the canonical implementation here.

---

## 1. Executive Verdict

**PHASE COMPLETE.** One real, live contradiction-class bug was found and fixed at its true source (`toMobileBill()` never populated `utility_deadlines`, reproducing the "Paid" + "not released" bug the prior mobile-side phases were built to eliminate — but in the canonical bridge, not the legacy backend). A second, independently-discovered duplication (the mobile dashboard's own hand-rolled status math, missing voided/waived precedence) was found and fixed at its source. A missing endpoint (Payment Receipt) was implemented against real, existing canonical fields — no fabrication. Everything else the three prior phases specified as required guarantees (settlement identity, amount validation, idempotency, ownership isolation, fail-closed ambiguous matching) was found **already implemented, and generally more robustly**, in the canonical backend — nothing needed porting there.

---

## 2. Starting State — Both Repositories

### D:\Capstone-Website (canonical) — before this phase
- Branch `main`, HEAD `cf0c2f82` ("Merge branch 'main' of https://github.com/kuurz-z/Capstone-Website")
- Pre-existing dirty, **untouched by this phase**: `server/controllers/paymentController.js`, `server/controllers/paymentController.test.js`, `server/controllers/webhookController.js`, `server/controllers/webhookController.test.js`, `web/src/features/tenant/pages/SignIn.jsx` (small, unrelated, in-progress payment-method-labeling work from another session — left exactly as found)
- Pre-existing untracked, **untouched by this phase**: `docs/reports/` (contains the Aug 12 report), `server/scripts/purge_all_non_admin_users.mjs`

### D:\LilyCrest\LilyCrest-Clean (mobile) — state carried in from prior phases
- Branch `master`, HEAD `13014e15` ("fix: harden billing payment settlement and eliminate paid/unpaid state drift") — **already pushed to `origin/master`** (`yellll03/LilyCrest-Mobile`) in a prior turn, before this reconciliation phase began. Not modified further in this phase.

---

## 3. The Architecture Correction

Confirmed via the Render dashboard (`lilycrest-api` service, screenshot provided by the user) and cross-checked against both repos' git history:

```
kuurz-z/Capstone-Website (this repo), server/, branch main
        │
        ▼
Render: lilycrest-api   ──►   https://api.lilycrest.space
        ▲
        │ HTTPS, /api/m/*
        │
yellll03/LilyCrest-Mobile, frontend/  (EXPO_PUBLIC_BACKEND_URL, all build profiles)
```

`yellll03/LilyCrest-Mobile/backend` is **not** deployed anywhere reachable at `api.lilycrest.space`. It is a legacy/reference/rollback-target codebase only. The three prior phases' backend hardening work there (payment settlement, receipt endpoint, utility-release fix) is real, tested, and now pushed — but was applied to a backend that is not what currently serves production mobile billing traffic. This was not previously visible from inside that repository alone (nothing in `LilyCrest-Clean` recorded which Render service deploys from it), which is exactly why the prior phases' own audits could not resolve it and flagged it as `NOT VERIFIED`.

### Timeline reconciliation (a real discrepancy, now resolved with evidence, not assumption)

The Aug 12 report explicitly stated the mobile app was still hardcoded to `mobile-api.lilycrest.space` and that `isDisallowedMobileRuntimeUrl()` "still actively refuses `api.lilycrest.space` as a runtime target." A live read of `frontend/src/config/api.js` this phase shows `MOBILE_BACKEND_URL = 'https://api.lilycrest.space'` as the hardcoded default, with `isDisallowedMobileRuntimeUrl()` not referencing either host at all — the opposite of what the Aug 12 report describes.

`git log` resolves this cleanly:
```
LilyCrest-Mobile commit 15f46eb7 "fix: point mobile runtime to canonical API" — 2026-08-14 01:06:38
```
Two days **after** the Aug 12 report, a separate change flipped the mobile app's default target from `mobile-api.lilycrest.space` to `api.lilycrest.space`. Both reports are correct for the moment they were each written — the mobile app has been pointed at the canonical backend since 2026-08-14, i.e. for the last two days of production traffic, through whatever APK builds have shipped since that config change went live.

**Practical implication:** the three prior mobile-side phases' backend fixes were made against a backend that (as of Aug 14) is likely no longer receiving live mobile traffic. Their frontend fixes remain fully valid and load-bearing, since they run against whichever backend the app is configured for — and this phase confirms the canonical backend's response shapes are compatible with them (Section 9).

---

## 4. Root Causes Found in the Canonical Backend This Phase

1. **`toMobileBill()` never populated `utility_deadlines`.** `server/services/mobileBillingBridge.js`'s mapper returned every mobile-shaped field the frontend needs *except* `utility_deadlines` — a field `frontend/src/utils/billingStatus.js`'s `getUtilityReleaseSchedule()` reads to decide whether to show "Your utility bill has not been released yet." With the field always `undefined` → `{}`, any bill with an electricity/water charge but no rent charge would permanently render as unreleased, **independent of its paid status** — reproducing the exact "Paid" + "not released" contradiction the mobile-side Phase 1 work fixed in the *legacy* backend, but here at the true, currently-live source.
2. **The mobile dashboard (`server/mobile/controllers/dashboard.controller.js`) reimplemented bill-status derivation locally**, instead of using the canonical `mobileBillingBridge.js` (comment in the file explained this as "kept local... since this file is CommonJS and billingPolicy.js is ESM"). The local `effectiveBillingFields()` handled the common case (`remainingAmount <= 0` → paid) correctly, but had no rule for `status === "voided"` (→ should map to `cancelled`) or `status === "waived"` with a residual balance (→ should still map to `paid`) — both of which `resolveMobileBillStatus()` in the canonical bridge already handle correctly. A voided or waived-with-balance bill could show its raw, unmapped status string on the Dashboard while showing the correct value everywhere else — the same contradiction class, discovered independently of the two prior mobile-side reports (which never had visibility into this file, since it never appeared as part of the mobile-side audits' scope).
3. **No Payment Receipt endpoint existed** at all in the canonical bridge (`GET /api/m/billing/:billingId/receipt` was 404 against this backend) — confirmed both by reading `mobileBillingRoutes.js`'s full route table and by the Aug 12 report's own compatibility table (Section 10), which lists no receipt endpoint.

Everything else the prior phases specified — settlement identity resolution, amount validation before marking paid, idempotency, ownership isolation, fail-closed ambiguous checkout matching — was already correctly implemented here, and in some respects more robustly than the reference implementation (Section 6).

---

## 5. Files Modified

| File | Reason | What changed |
|---|---|---|
| `server/services/mobileBillingBridge.js` | Root cause #1 | Added `mobileUtilityDeadlines()` (new private helper) using the *existing* authoritative `getUtilityDispatchEntry()`/dispatch-state signal (`billingPolicy.js`, already used by `isUtilityChargeVisible`) — no new schema fields, no fabrication. Wired into `toMobileBill()`'s return object as `utility_deadlines`. |
| `server/mobile/controllers/dashboard.controller.js` | Root cause #2 | Removed the local `effectiveBillingFields()`/`roundMoney()` reimplementation. Billing array now maps each raw `bills` collection document through `toMobileBill()` (canonical bridge), loaded via `await import('../../services/mobileBillingBridge.js')` — Node's native, standard mechanism for a CommonJS module to consume an ESM one, requiring no build-tool changes. Dashboard-only extras (`user_id`, `charges`, `reservation_id`) are still added, additively, never overriding a status/amount/date field from the bridge. |
| `server/routes/mobileBillingRoutes.js` | Root cause #3 | New route `GET /billing/:billingId/receipt` — same tenant-ownership-scoped `Bill.findOne` pattern as every other route in this file, 404 if the bill isn't found *or* isn't effectively paid (`isMobileEffectivelyPaid`), otherwise generates and downloads a receipt PDF. |
| `server/utils/pdfGenerator.js` | Root cause #3 | New `generateBillReceiptPdf()`, patterned directly on the existing `generateTransferSettlementPdf()` (a receipt-style document already in this file) — same `pdfkit` conventions, same header/footer style. Contains payment evidence only (Receipt No., Bill ID, Tenant, Billing Period, Payment Date, Payment Method, Reference No., Amount Paid, Applied to Bill, Remaining Balance, Status: PAID) — deliberately no charges table, no TOTAL DUE, no payment instructions. |
| `server/services/mobileBillingBridge.test.js` | Tests | 4 new tests for `utility_deadlines` (dispatched, still-draft, no-utility-charge, paid+released-simultaneously). |
| `server/mobile/controllers/dashboard.controller.test.js` | Tests | 3 existing test fixtures updated (they set a bare `totalAmount` field with no `charges`, which the canonical `getVisibleBillSnapshot()` correctly ignores in favor of deriving totals from `charges` — expected, necessary fallout from switching to the canonical path, not a weakened assertion). 3 new tests: voided → cancelled, waived-with-balance → paid, utility_deadlines presence. |
| `server/routes/mobileBillingRoutes.test.js` | Tests | Updated one exact-import-string assertion for the new `toMobilePaymentMethodLabel` import. Added the new route to the route-inventory allowlist. 2 new tests: receipt route checks `isMobileEffectivelyPaid` before generating anything; receipt route uses a distinct generator (`generateBillReceiptPdf`, not `generateRentBillPdf`). |
| `server/routes/mobileBillingRoutes.mount.test.js`, `server/routes/mobileFullMountOrder.test.js`, `server/routes/mobileAuthMount.test.js` | Tests | Added `toMobilePaymentMethodLabel: jest.fn(() => null)` to each file's existing `mobileBillingBridge.js` mock, since the real module now exports it and these files import the real route module against a mocked bridge. |

Nothing under `LilyCrest-Clean/` was modified in this phase.

---

## 6. Cross-Check Against the Three Prior Mobile-Side Phases

| Guarantee (from the mobile-side phases) | Canonical backend status | Action taken |
|---|---|---|
| Ambiguous checkout-ID matching fails closed | **Already true by construction** — `handleBillPayment()` resolves the bill via a single `Bill.findById(metadata.billId)` (server-generated at checkout creation, HMAC-signature-verified on the way back); there is no "find by session ID alone" fallback anywhere in this codebase, so the failure mode the mobile-side phase hardened against does not exist here to begin with. | None needed |
| Insufficient settlement cannot mark a bill fully paid | **Already implemented, and more completely** — `settlePaymongoBill()` clamps `appliedAmount = min(remainingAmount, settledAmount)` and applies it through a real ledger (`applyBillPayment`), meaning an underpayment is properly recorded as a **partial payment** against the balance (canonical `partially-paid` is a real, wired-up state here — unlike the standalone mobile backend, where no partial-payment machinery existed, correctly leading the mobile-side phase to choose "fail closed" instead). | None needed |
| Idempotency | **Already implemented, more robustly** — dual-layer: `settlePaymongoBill()`'s own `paymongoPaymentId === paymentReference \|\| status === "paid"` guard, *plus* a durable, persisted `PaymongoWebhookEvent` ledger (`beginWebhookEvent`/`finishWebhookEvent`, tracking `processingStatus`/`attemptCount`/`lastError` per event ID) that the standalone mobile backend never had. | None needed |
| Tenant ownership isolation | **Already implemented** — every route in `mobileBillingRoutes.js`/`mobilePaymongoRoutes.js` scopes by `req.mobileTenant._id`, verified both by the Aug 12 report's own static test and a real-HTTP mount-order test. | None needed |
| Real Payment Receipt endpoint | **Missing** | Implemented (Section 5) |
| Unpaid receipt → 404 | N/A (endpoint didn't exist) | Implemented — `isMobileEffectivelyPaid()` gate, same function `/history/paid` already uses |
| Receipt ≠ Statement | N/A | Implemented as a genuinely separate PDF generator with narrower content (Section 5) |
| Mobile receipt visibility only after settlement | N/A | Same `isMobileEffectivelyPaid()` gate |
| Utility-release contradiction eliminated | **Was present** (Root cause #1) | Fixed |
| Single source of truth for bill status across screens | **Partially present** (dashboard was the exception — Root cause #2) | Fixed |

No canonical file was restructured to mirror the standalone mobile backend's shape (e.g. no second PayMongo controller was created). Every fix was applied to the existing canonical implementation, in its own idiom — matching the explicit instruction not to copy the legacy backend's structure.

---

## 7. A Genuine Capability Discovery — Two Prior Mobile-Side Findings Were Wrong About the Overall System

Two things the mobile-side phases classified as `UNKNOWN` or `does not exist anywhere in the codebase` are, in fact, both real and canonical — they simply live in this repository, not the one those phases were scoped to:

1. **The "unknown bill-schema fields."** The mobile-side phases found fields (`publicationState`, `paymentState`, `dueState`, `utilityDispatch`, `structuredWorkflowVersion`, `pdfPath`, `pdfGeneratedAt`, etc.) on a live bill document, searched *every* branch, the stash, and every dangling commit of `LilyCrest-Mobile`'s entire git history, found zero matches anywhere, and correctly concluded (for that repository) that nothing there ever wrote them. This phase found the actual writer: `server/services/billing/billingPolicy.js`'s `syncBillAmounts()` writes `paymentState`/`dueState`/`publicationState`; the utility billing flow writes `utilityDispatch`; `server/controllers/billing/_helpers.js`'s `generateRentBillPdf()`/`finalizeRentBill()` write `pdfPath`/`pdfGeneratedAt`. Both repositories share the same MongoDB cluster and the same `bills` collection — confirming the single open question the Aug 12 report itself flagged as unverified ("whether the standalone LilyCrest-Mobile backend and lilycrest-api are configured against the same MongoDB cluster"). These fields are fully authoritative; the mobile-side classification of "safe to ignore, non-authoritative" was correct in the narrow sense (nothing in *that* repo should depend on them) but incomplete about the system as a whole.
2. **The utility electricity/water breakdown "calculator."** The mobile-side phases concluded, correctly for `LilyCrest-Mobile/backend` in isolation, that no automated meter-reading/consumption calculator existed anywhere — utility billing there is manual-final-amount-only. This phase found a real one here: `UtilityPeriod` (Mongoose model) plus `buildTenantUtilityBreakdown()` (`server/controllers/billing/_helpers.js`) — genuine per-tenant segments with `readingFrom`/`readingTo`, `ratePerUnit`, `activeTenantIds`, and computed per-tenant shares. **This is not currently bridged to the mobile app** — `toMobileBill()` doesn't call it, so the mobile app still cannot show a real breakdown even though the data frequently exists. Not fixed in this phase (it requires an async, per-tenant, DB-querying call, which doesn't fit `toMobileBill()`'s pure-mapper contract, and is additive scope beyond the paid/unpaid-contradiction mandate) — flagged as the single highest-value follow-up identified across all four phases of this work (Section 10).

---

## 8. Environment / Render

No environment variables were read, set, or required to change. No Render service, domain, or deployment state was touched. `PAYMONGO_WEBHOOK_SECRET`'s prior "please re-confirm it's set" note from the Aug 12 report still applies and was not re-verified here (values were not inspected).

---

## 9. Mobile Frontend Compatibility Re-Verification

Static field-by-field comparison between what `LilyCrest-Mobile/frontend`'s billing screens (`billingStatus.js`, `billing-history.jsx`, `bill-details.jsx`, `documentManager.js`) read, and what the canonical bridge (after this phase's fixes) now returns:

| Frontend expects | Canonical bridge provides | Compatible? |
|---|---|---|
| `bill.status`, `.remaining_amount`, `.total`, `.amount` | Same field names, mobile-vocabulary status | Yes |
| `bill.payment_date` (checked first in a 4-alias fallback chain) | `payment_date` | Yes |
| `bill.paymongo_reference` | `paymongo_reference` (sourced from `paymongoPaymentId`) | Yes |
| `bill.payment_method` (locally re-humanized, tolerates an already-humanized string) | Already-humanized label (e.g. "GCash") | Yes — frontend's `paymentMethodLabel()` passes an already-correct value straight through since it isn't the literal string `"paymongo"` |
| `bill.utility_deadlines[<utility>].billReleaseDate/.finalDueDate` | Now populated (Root cause #1 fix) | Yes |
| `bill.electricity_breakdown`/`.water_breakdown` | Not provided (Section 7, item 2) | Degrades to the honest "Breakdown unavailable." fallback — not a crash, not fabricated data |
| `documentUrl('bill', id)` → `GET /billing/:id/pdf` | Route exists | Yes |
| `documentUrl('bill-receipt', id)` → `GET /billing/:id/receipt` | Route now exists (Root cause #3 fix) | Yes |
| `bill.billing_id` (primary key `getBillId()` checks) | `billing_id: String(bill._id)` | Yes |
| `bill.rent`/`.electricity`/`.water`/`.penalties` (charges display) | Same field names | Yes |

No frontend change is required as a result of this phase.

---

## 10. Tests

```
Command: node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathIgnorePatterns=integration --ci
Test Suites: 158 passed, 158 total
Tests:       1570 passed, 1570 total
```

Baseline before this phase (from the Aug 12 report, for reference — the true pre-phase baseline is higher since multiple other reconciliation phases ran between Aug 12 and now, evidenced by the dashboard controller's own "Phase 4.5"/"Phase 3.6" comments): 132 suites / 1306 tests. This phase added 9 new tests across 3 files and updated 4 existing test files for expected, correctly-reasoned fallout (Section 5).

One test (`services/digitalStayProofService.test.js`, unrelated to billing — a PDF-rendering timeout) failed once under full-suite parallel load and passed cleanly (4/4) when run in isolation immediately after; re-running the full suite a second time produced a clean 158/158, 1570/1570. Confirmed pre-existing flakiness under load, not a regression from this phase's changes.

**Not run:** the 6 pre-existing `*.integration.test.js` files, per the same rationale as the Aug 12 report (none touch billing/payments/`/api/m`, require infrastructure not confirmed available, not modified here).

---

## 11. Security Review

No new IDOR, ownership bypass, or unsafe query was introduced. The new receipt route follows the identical ownership-scoping pattern (`Bill.findOne({ _id, userId: req.mobileTenant._id, isArchived: false })`) as every other route in the same file, verified by the existing static test that requires every `Bill.find/findOne` call in this file to include `userId: req.mobileTenant._id` (the new route's call matches this pattern and was covered by the existing test without modification). The dashboard's dynamic `import()` of the bridge module introduces no new attack surface — it loads a fixed, hardcoded relative path, never anything derived from request input.

---

## 12. Remaining Items

**Not blocking, explicitly out of scope for this phase:**
- Utility breakdown data exists (`UtilityPeriod`/`buildTenantUtilityBreakdown`) but isn't bridged to mobile — Section 7, item 2. Highest-value follow-up identified.
- Everything the Aug 12 report already listed as open in its own Section 16 (documents mock data, auth/session consolidation, live-chat IDOR, legacy `billing` collection data, mobile API host switchover readiness beyond billing) remains open — this phase did not touch any of it, matching its billing-only mandate.
- The mobile dashboard's fallback to the legacy `billing` collection (when the canonical `bills` query returns empty for a user) was left untouched — it is currently unreachable in practice (the legacy collection was confirmed empty during an earlier mobile-side phase's direct database read), and removing it is a separate, small cleanup rather than something blocking this phase's contradiction-elimination mandate.
- `LilyCrest-Mobile/backend`'s already-pushed Phase 1–3 hardening remains valuable as the rollback-path implementation and as the specification this phase reconciled against — no action needed on it.

**No BLOCKING items were found or left open in this phase's scope.**

---

## 13. Final Go/No-Go

### Is the canonical backend now free of the "paid bill shows contradictory state elsewhere" bug class, for every surface the mobile app actually calls?

**YES**, for every field/screen this phase could verify: Billing History, Bill Details, and Dashboard now derive bill status from the identical canonical function (`toMobileBill()`/`resolveMobileBillStatus()`), and utility-release status is now populated from the real dispatch-state signal instead of being permanently absent.

### Does this phase's work require a Render deployment to take effect?

**Yes, eventually** — none of these fixes are live until `Capstone-Website/server`'s `main` branch is deployed to the `lilycrest-api` Render service. **Not deployed in this phase**, per explicit instruction.

### Does this phase's work require anything from `LilyCrest-Mobile`?

**No** — the frontend contracts were re-verified as already compatible (Section 9); no frontend change or new APK is required as a direct result of this specific reconciliation.
