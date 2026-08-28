# Tenant Billing Branch Electricity Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Tenant Billing dashboard (`BillingTab.jsx`) dynamically utility-aware so that tenants in all-inclusive branches (Guadalupe / GD) only see Rent totals and statements without empty or confusing electricity chips and filter options.

**Architecture:** Derive `hasElectricityBilling` dynamically from active bill charge summaries (`summary.hasElectricityCharge`). Pass `hasElectricityBilling` into `StatementLedgerHero` and `StatementFilters` to conditionally render the electricity breakdown chip and category filter menu item.

**Tech Stack:** React 18, Lucide React, Vite, Node.js / Express.js

**Spec:** [LILYCREST_WEB_BILLING_DETAILED_FLOW.md](file:///d:/Portfolio/3rdYear/CapstoneSystem/LILYCREST_WEB_BILLING_DETAILED_FLOW.md)

## Global Constraints

- Always use "Tenant" (never "Resident").
- Always use "Rent" or "Rent Billing" (never "Rental Fee").
- Always use "Owner" / "Dorm Owner" (never "Super Admin").
- Strictly no gradients; use solid flat neutral tokens.
- All state normalization and memoized hooks must be declared before any JSX rendering them.

---

## What to Expect from These Changes

- **Guadalupe (GD) Branch Tenants**:
  - The top summary ledger card will show only **Total Outstanding Balance** and the clean **🏠 Rent: ₱X.XX** chip.
  - The **⚡ Electricity: ₱0.00** chip and its divider will be hidden.
  - In the **Category Filter** dropdown, "Electricity" will not appear when no electricity statements exist.
- **Gil Puyat Branch Tenants**:
  - Whenever electricity charges or submetered statements exist, both **🏠 Rent** and **⚡ Electricity** chips and category filters will appear normally.

---

### Task 1: Make Electricity Chip and Filter Dynamically Conditional in BillingTab

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/components/profile/BillingTab.jsx:560-750,1520-1535,1715-1740`

**Interfaces:**
- Consumes: `billSummaries` from `BillingTab.jsx`
- Produces: `hasElectricityBilling` boolean passed to `StatementLedgerHero` and `StatementFilters`

- [ ] **Step 1: Check existing BillingTab rendering without hasElectricityBilling**

Verify current `StatementLedgerHero` (lines 620-630) renders `Electricity` unconditionally while `Water` is wrapped in `{hasWaterBilling && ...}`.

- [ ] **Step 2: Add hasElectricityBilling memoization**

In `Capstone-Website/web/src/features/tenant/components/profile/BillingTab.jsx` around line 1525, add:
```javascript
  const hasElectricityBilling = useMemo(
    () => billSummaries.some(({ summary }) => summary.hasElectricityCharge),
    [billSummaries],
  );
```

- [ ] **Step 3: Update StatementLedgerHero component props and JSX**

Update `StatementLedgerHero` definition and chips container:
```javascript
const StatementLedgerHero = ({
  totalBalance,
  unpaidRent,
  unpaidElec,
  unpaidWater,
  hasElectricityBilling = false,
  hasWaterBilling = false,
  onPayAll,
  unpaidCount = 0,
}) => {
```
And wrap the electricity chip:
```jsx
      <div className="statement-ledger-hero__chips" style={dash.chipsContainer}>
        <div style={dash.chipItem}>
          <Home size={15} color="#0A1628" />
          <span>Rent:</span>
          <strong style={{ color: "#0A1628", fontWeight: 700 }}>
            {fmt(unpaidRent)}
          </strong>
        </div>

        {hasElectricityBilling && (
          <>
            <div style={dash.chipDivider} />
            <div style={dash.chipItem}>
              <Zap size={15} color="#d97706" />
              <span>Electricity:</span>
              <strong style={{ color: "#0A1628", fontWeight: 700 }}>
                {fmt(unpaidElec)}
              </strong>
            </div>
          </>
        )}

        {hasWaterBilling && (
          <>
            <div style={dash.chipDivider} />
            <div style={dash.chipItem}>
              <Droplets size={15} color="#2563eb" />
              <span>Water:</span>
              <strong style={{ color: "#0A1628", fontWeight: 700 }}>
                {fmt(unpaidWater)}
              </strong>
            </div>
          </>
        )}
      </div>
```

- [ ] **Step 4: Update StatementFilters component props and categoryOptions**

Update `StatementFilters`:
```javascript
const StatementFilters = ({
  bills = [],
  statusFilter = "all",
  setStatusFilter,
  categoryFilter = "all",
  setCategoryFilter,
  hasElectricityBilling = false,
  hasWaterBilling = false,
}) => {
```
And update `categoryOptions`:
```javascript
  const categoryOptions = [
    { value: "all", label: "All Kinds", count: bills.length },
    { value: "rent", label: "Rent", icon: Home, count: rentCount },
    ...(hasElectricityBilling ? [{ value: "electricity", label: "Electricity", icon: Zap, count: elecCount }] : []),
    ...(hasWaterBilling ? [{ value: "water", label: "Water", icon: Droplets, count: waterCount }] : []),
  ];
```

- [ ] **Step 5: Pass hasElectricityBilling to both components in BillingTab JSX**

Update the JSX calls around line 1718:
```jsx
      {/* 1. Account Summary Ledger Hero */}
      <StatementLedgerHero
        totalBalance={totalUnpaidBalance}
        unpaidRent={unpaidRent}
        unpaidElec={unpaidElec}
        unpaidWater={unpaidWater}
        hasElectricityBilling={hasElectricityBilling}
        hasWaterBilling={hasWaterBilling}
        unpaidCount={unpaidBills.length}
        onPayAll={handleOpenReviewForAll}
      />

      {/* 2. Dual Filter Toolbar (Status & Clickable Category Dropdown) */}
      <StatementFilters
        bills={bills}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        hasElectricityBilling={hasElectricityBilling}
        hasWaterBilling={hasWaterBilling}
      />
```

---

### Task 2: Build & Verification

**Files:**
- Test: `Capstone-Website/web` build & verify

- [ ] **Step 1: Run web build check**

Execute in terminal:
```powershell
npm --prefix d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\web run build
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Run server test suite**

Execute in terminal:
```powershell
npm --prefix d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\server test
```
Expected: Tests pass with 0 regressions.
