# Unify Appliance Pricing Constants & Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify declared appliance add-on pricing constants and normalization across Admin (`ReservationDetailsModal.jsx`, `TenantOverviewTab.jsx`) and Tenant (`roomDetailsPricing.js`) surfaces so all modules consume single-source-of-truth helpers without ad-hoc duplicate parser logic.

**Architecture:** Export `APPLIANCE_DEFAULT_PRICE` and `STANDARD_APPLIANCES_LIST` from `web/src/features/tenant/utils/roomDetailsPricing.js`. Refactor `ReservationDetailsModal.jsx` to use `resolveApplianceBreakdown`, and refactor `TenantOverviewTab.jsx` to consume the unified default price constant. Provide automated regression tests verifying consistent parsing across array and object formats.

**Tech Stack:** React 19, Vite, TanStack Query, Node test runner (`node --test`), Jest.

## Global Constraints
- Strictly adhere to Lilycrest DMS invariants: solid tokens, zero gradients, 1px neutral borders (`border-slate-200 dark:border-slate-700` or `1px solid var(--border)`).
- Strictly maintain terminology invariants: "Tenant" (never "Resident"), "Rent" (never "Rental Fee"), "Preferred Move-in Date".
- No breaking changes to existing database models, backend API payloads, or mobile endpoint parity.
- 100% test pass rate across backend (`npm test` in `/server`) and frontend (`npm test` / `npm run build` in `/web`).

---

### Task 1: Unify Appliance Constants in `roomDetailsPricing.js` & Add Export Tests

**Files:**
- Modify: `web/src/features/tenant/utils/roomDetailsPricing.js:100-140`
- Test: `web/src/features/tenant/utils/roomDetailsPricing.test.mjs`

**Interfaces:**
- Consumes: None
- Produces: `APPLIANCE_DEFAULT_PRICE`, `STANDARD_APPLIANCES_CATALOG`, `resolveApplianceBreakdown`

- [ ] **Step 1: Write failing regression test for standardized appliance catalog export**

```javascript
// in web/src/features/tenant/utils/roomDetailsPricing.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPLIANCE_DEFAULT_PRICE,
  STANDARD_APPLIANCES_CATALOG,
  resolveApplianceBreakdown,
} from "./roomDetailsPricing.js";

describe("STANDARD_APPLIANCES_CATALOG and APPLIANCE_DEFAULT_PRICE", () => {
  it("exports APPLIANCE_DEFAULT_PRICE as 200", () => {
    assert.equal(APPLIANCE_DEFAULT_PRICE, 200);
  });

  it("exports standard catalog containing fan, ricecooker, and laptop with 200 unit price", () => {
    assert.equal(Array.isArray(STANDARD_APPLIANCES_CATALOG), true);
    assert.equal(STANDARD_APPLIANCES_CATALOG.length, 3);
    const fan = STANDARD_APPLIANCES_CATALOG.find((a) => a.id === "fan");
    assert.ok(fan);
    assert.equal(fan.unitPrice, 200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/src/features/tenant/utils/roomDetailsPricing.test.mjs`
Expected: FAIL (STANDARD_APPLIANCES_CATALOG is not exported)

- [ ] **Step 3: Export `STANDARD_APPLIANCES_CATALOG` in `roomDetailsPricing.js`**

```javascript
export const APPLIANCE_DEFAULT_PRICE = 200;

export const STANDARD_APPLIANCES_CATALOG = [
  { id: "fan", name: "Electric Fan", unitPrice: APPLIANCE_DEFAULT_PRICE },
  { id: "ricecooker", name: "Rice Cooker", unitPrice: APPLIANCE_DEFAULT_PRICE },
  { id: "laptop", name: "Laptop", unitPrice: APPLIANCE_DEFAULT_PRICE },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/src/features/tenant/utils/roomDetailsPricing.test.mjs`
Expected: PASS

---

### Task 2: Refactor `TenantOverviewTab.jsx` to Consume Unified Catalog

**Files:**
- Modify: `web/src/features/admin/components/tenants/details/TenantOverviewTab.jsx:1-40`
- Test: `web/src/features/tenant/utils/roomDetailsPricing.test.mjs`

**Interfaces:**
- Consumes: `STANDARD_APPLIANCES_CATALOG` from `../../../../tenant/utils/roomDetailsPricing.js`
- Produces: Normalized state mapping for Guadalupe tenant appliance editor

- [ ] **Step 1: Update `TenantOverviewTab.jsx` imports**

Replace local hardcoded `const STANDARD_APPLIANCES = ...` with import:
```javascript
import { STANDARD_APPLIANCES_CATALOG as STANDARD_APPLIANCES } from "../../../../tenant/utils/roomDetailsPricing.js";
```

- [ ] **Step 2: Run frontend tests & build check**

Run: `npm test` in `Capstone-Website/web`
Expected: PASS

---

### Task 3: Refactor `ReservationDetailsModal.jsx` to Use `resolveApplianceBreakdown`

**Files:**
- Modify: `web/src/features/admin/components/ReservationDetailsModal.jsx:900-965`
- Test: `web/src/features/tenant/utils/roomDetailsPricing.test.mjs`

**Interfaces:**
- Consumes: `resolveApplianceBreakdown` from `../../tenant/utils/roomDetailsPricing.js`
- Produces: Clean memoized `declaredAppliances` and `monthlyApplianceSubtotal`

- [ ] **Step 1: Import `resolveApplianceBreakdown` in `ReservationDetailsModal.jsx`**

```javascript
import { resolveApplianceBreakdown } from "../../tenant/utils/roomDetailsPricing.js";
```

- [ ] **Step 2: Replace manual array/object parsing with `resolveApplianceBreakdown`**

```javascript
  const applianceBreakdown = useMemo(() => {
    return resolveApplianceBreakdown(
      reservation?.selectedAppliances,
      reservation?.applianceFees,
      reservation?.roomId || reservation?.room,
    );
  }, [reservation?.selectedAppliances, reservation?.applianceFees, reservation?.roomId, reservation?.room]);

  const declaredAppliances = applianceBreakdown.items;
  const monthlyApplianceSubtotal = applianceBreakdown.totalApplianceFees;
```

- [ ] **Step 3: Run frontend tests and build verification**

Run: `npm test` in `Capstone-Website/web`
Run: `npm run build` in `Capstone-Website/web`
Expected: PASS with 0 errors.

---

## What to Expect from These Changes
- **Single Source of Truth**: All appliance pricing (rates, names, calculations) is maintained in one central utility module (`roomDetailsPricing.js`), eliminating code duplication across admin and tenant portals.
- **Identical Numbers Everywhere**: When an admin views a reservation in `ReservationDetailsModal` or manages appliances in `TenantOverviewTab`, the totals, item labels, and monthly subtotals will match the tenant's view down to the exact peso.
- **Maintainability**: Future adjustments to standard appliance rates or catalogs only require editing a single file rather than multiple component files.

---

## Verification Plan

### Automated Tests
1. `node --test web/src/features/tenant/utils/roomDetailsPricing.test.mjs`
2. `npm test` in `Capstone-Website/web`
3. `npm test` in `Capstone-Website/server`
4. `npm run build` in `Capstone-Website/web`

### Manual Verification
1. Open Guadalupe tenant in `/admin/tenants` → verify Appliance Add-ons card renders all 3 standard items with ₱200/mo rates.
2. Open Admin Reservation Modal for a Guadalupe reservation → verify Appliance Add-ons subcard accurately displays declared items and correct subtotal.
