# Resolve Multiple Active Contract Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely resolve the multiple active contract records conflict (error `MULTIPLE_CANONICAL_CONTRACTS`) for tenant Leander Ponce and ensure resilient Admin UI contract inspection and backend tie-breaking.

**Architecture:** A three-phase architecture: 1) A deterministic, non-destructive MongoDB audit and reconciliation script that cleanly archives conflicting duplicates while preserving legal audit history, 2) Backend canonical contract selector enhancement with weighted tie-breaking logic (notarized > signed > prepared PDF > newest timestamp) and audit warning logging, 3) Resilient Admin UI contract switcher and error fallback in `TenantContractsTab` and `TenantDetailModal` so administrators are never blocked from viewing or downloading contract documents.

**Tech Stack:** Node.js (ESM), Express.js, MongoDB / Mongoose, Jest, React, Vite, Tailwind CSS, Lucide Icons.

**Spec:** [implementation_plan.md](file:///C:/Users/Adming/.gemini/antigravity/brain/9ac25119-a151-4859-b170-350e7f36bf83/implementation_plan.md)

## Global Constraints

- Never hard-delete contract documents; all retired duplicate records must be non-destructively updated with `status: "voided"`, `isCurrent: false`, `isCanonical: false`, and `publicationStatus: "withdrawn"`.
- Maintain strict terminology invariants: "Tenant" (NEVER "Resident"), "Assistant" (NEVER "Copilot"), "Owner" (NEVER "Super Admin"), "Rent" (NEVER "Rental Fee").
- UI components must strictly follow solid HSL tokens, 1px neutral borders, and NO gradients.
- Backend selector changes must maintain 100% backward compatibility with mobile endpoints and existing unit tests.
- All tasks must be fully verified with Jest unit tests and React production build.

---

### Task 1: Backend Selector Smart Tie-Breaker (TDD)

**Files:**
- Modify: `Capstone-Website/server/services/tenantContractSelectionService.js`
- Test: `Capstone-Website/server/services/tenantContractSelectionService.test.js`

**Interfaces:**
- Consumes: `Contract` documents, `activeStay` object, `{ includeEarlyStages }` options.
- Produces: `selectCanonicalTenantContract({ contracts, activeStay, includeEarlyStages, now })` returning the single authoritative `Contract` document using smart tie-breaking when multiple active candidates exist.

- [ ] **Step 1: Write the failing / updated unit tests in `tenantContractSelectionService.test.js`**

Add tests verifying that when multiple canonical contracts exist for a tenant, the selector tie-breaks in favor of the contract with attached documents (notarized > signed > prepared) or latest timestamp rather than crashing with an unhandled 409:

```javascript
test("gracefully tie-breaks multiple canonical contracts by document readiness score", () => {
  const selected = selectCanonicalTenantContract({
    contracts: [
      contract({ _id: "draft-only", preparedDocuments: [] }),
      contract({
        _id: "with-signed-doc",
        signedDocuments: [{ fileUrl: "/signed.pdf", uploadedAt: new Date() }],
      }),
    ],
    activeStay,
  });
  expect(selected._id).toBe("with-signed-doc");
});

test("gracefully tie-breaks identical multiple canonical contracts by newest creation date", () => {
  const selected = selectCanonicalTenantContract({
    contracts: [
      contract({ _id: "older", createdAt: new Date("2026-01-01T00:00:00Z") }),
      contract({ _id: "newer", createdAt: new Date("2026-02-01T00:00:00Z") }),
    ],
    activeStay,
  });
  expect(selected._id).toBe("newer");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest services/tenantContractSelectionService.test.js -t "gracefully tie-breaks"` in `Capstone-Website/server`.
Expected: FAIL (currently throws `MULTIPLE_CANONICAL_CONTRACTS`).

- [ ] **Step 3: Implement smart document weighting and tie-breaker in `tenantContractSelectionService.js`**

In `Capstone-Website/server/services/tenantContractSelectionService.js`, define the document readiness score calculator and apply it when `highest.length > 1`:

```javascript
const documentReadinessScore = (c) => {
  let score = 0;
  if (Array.isArray(c?.notarizedDocuments) && c.notarizedDocuments.length > 0) score += 4;
  if (Array.isArray(c?.signedDocuments) && c.signedDocuments.length > 0) score += 2;
  if ((Array.isArray(c?.preparedDocuments) && c.preparedDocuments.length > 0) || c?.status === "generated") score += 1;
  return score;
};
```

Update `selectCanonicalTenantContract`:
```javascript
  const highest = tiered.filter(({ rank }) => rank === highestRank);
  if (highest.length === 1) {
    return highest[0].contract;
  }

  // Tie-breaker: evaluate document evidence and creation recency
  const scored = highest.map(({ contract }) => ({
    contract,
    docScore: documentReadinessScore(contract),
    timestamp: new Date(contract.updatedAt || contract.createdAt || 0).getTime(),
  })).sort((a, b) => b.docScore - a.docScore || b.timestamp - a.timestamp);

  return scored[0].contract;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest services/tenantContractSelectionService.test.js` in `Capstone-Website/server`.
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/tenantContractSelectionService.js server/services/tenantContractSelectionService.test.js
git commit -m "feat(server): add smart tie-breaker for canonical contract selection"
```

---

### Task 2: Database Duplicate Contract Audit & Reconciliation Script

**Files:**
- Create: `Capstone-Website/server/scripts/reconcile_duplicate_contracts.mjs`

**Interfaces:**
- Consumes: MongoDB `contracts`, `users`, `reservations`, `stays` collections via `process.env.MONGODB_URI`.
- Produces: CLI script with `--dry-run` (default) and `--apply` modes to identify and non-destructively archive duplicate active contracts.

- [ ] **Step 1: Write `reconcile_duplicate_contracts.mjs` script**

Create `Capstone-Website/server/scripts/reconcile_duplicate_contracts.mjs`:

```javascript
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Contract, User, Reservation, Stay } from "../models/index.js";

dotenv.config();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const TERMINAL_STATUSES = new Set(["voided", "cancelled", "archived", "rejected", "replaced", "terminated"]);

const documentReadinessScore = (c) => {
  let score = 0;
  if (Array.isArray(c?.notarizedDocuments) && c.notarizedDocuments.length > 0) score += 4;
  if (Array.isArray(c?.signedDocuments) && c.signedDocuments.length > 0) score += 2;
  if ((Array.isArray(c?.preparedDocuments) && c.preparedDocuments.length > 0) || c?.status === "generated") score += 1;
  return score;
};

async function run() {
  await mongoose.connect(mongoUri);
  console.log(`[Reconcile Contracts] Connected to MongoDB. Mode: ${APPLY ? "APPLY (Commit Changes)" : "DRY RUN (No Writes)"}`);

  const contracts = await Contract.find({}).sort({ createdAt: 1 }).lean();
  console.log(`[Reconcile Contracts] Total contract records scanned: ${contracts.length}`);

  // Group active/canonical contracts by tenantId
  const activeByTenant = new Map();
  for (const c of contracts) {
    if (!c.tenantId) continue;
    const tId = String(c.tenantId);
    const isTerminal = TERMINAL_STATUSES.has(c.status);
    const isActiveOrCurrent = c.isCurrent !== false && c.isCanonical !== false && !isTerminal;

    if (isActiveOrCurrent) {
      if (!activeByTenant.has(tId)) activeByTenant.set(tId, []);
      activeByTenant.get(tId).push(c);
    }
  }

  const conflictingGroups = [];
  for (const [tenantId, group] of activeByTenant.entries()) {
    if (group.length > 1) {
      conflictingGroups.push({ tenantId, group });
    }
  }

  console.log(`[Reconcile Contracts] Found ${conflictingGroups.length} tenants with multiple active contracts.`);

  let totalArchived = 0;

  for (const { tenantId, group } of conflictingGroups) {
    const user = await User.findById(tenantId).select("name email").lean();
    const tenantName = user?.name || group[0].tenantLegalName || "Unknown Tenant";
    console.log(`\n======================================================`);
    console.log(`Tenant: ${tenantName} (${tenantId}) - ${group.length} conflicting records:`);

    // Rank candidates
    const ranked = group.map((c) => ({
      contract: c,
      id: String(c._id),
      contractNumber: c.contractNumber,
      status: c.status,
      docScore: documentReadinessScore(c),
      signedDocs: c.signedDocuments?.length || 0,
      notarizedDocs: c.notarizedDocuments?.length || 0,
      createdAt: c.createdAt,
    })).sort((a, b) => b.docScore - a.docScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const canonical = ranked[0];
    const duplicates = ranked.slice(1);

    console.log(`  -> KEEP CANONICAL: ${canonical.contractNumber} (ID: ${canonical.id}, Status: ${canonical.status}, DocScore: ${canonical.docScore})`);
    for (const dup of duplicates) {
      console.log(`  -> ARCHIVE DUPLICATE: ${dup.contractNumber} (ID: ${dup.id}, Status: ${dup.status}, DocScore: ${dup.docScore})`);
    }

    if (APPLY) {
      for (const dup of duplicates) {
        await Contract.findByIdAndUpdate(dup.id, {
          $set: {
            isCurrent: false,
            isCanonical: false,
            publicationStatus: "withdrawn",
            status: "voided",
            duplicateOfContractId: canonical.id,
            reconciliationNote: `Archived as duplicate of canonical contract ${canonical.contractNumber}`,
            voidedAt: new Date(),
          },
        });
        totalArchived++;
      }
      console.log(`  [OK] Successfully updated ${duplicates.length} duplicate records.`);
    }
  }

  console.log(`\n======================================================`);
  if (APPLY) {
    console.log(`[Reconcile Contracts] DONE. Total duplicate records safely archived: ${totalArchived}`);
  } else {
    console.log(`[Reconcile Contracts] DRY RUN COMPLETE. Run with --apply to commit changes.`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run dry-run audit to verify duplicate discovery**

Run: `node Capstone-Website/server/scripts/reconcile_duplicate_contracts.mjs`
Expected: Discovers tenant Leander Ponce and any duplicate contracts, displaying recommended canonical and duplicate items.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/reconcile_duplicate_contracts.mjs
git commit -m "feat(scripts): add non-destructive duplicate contract reconciliation script"
```

---

### Task 3: Admin UI Multi-Contract Selector & Resilient Fallback

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/components/tenants/details/TenantContractsTab.jsx`
- Modify: `Capstone-Website/web/src/features/admin/components/TenantDetailModal.jsx`

**Interfaces:**
- Consumes: `allTenantContracts` array, `dedicatedContract` object, `dedicatedContractError` code.
- Produces: Visual contract version switcher dropdown/tabs in `TenantContractsTab`, and resilient fallback in `TenantDetailModal` that avoids showing dead-end error popups.

- [ ] **Step 1: Enhance `TenantContractsTab.jsx` with contract selector**

In `TenantContractsTab.jsx`:
- Accept props: `allTenantContracts = []`, `selectedContract`, `onSelectContract`.
- Compute active display contract (`displayContract = selectedContract || dedicatedContract || allTenantContracts[0]`).
- When `allTenantContracts.length > 1`, display a clean, neutral selector bar above the contract details:
  - Formatted option text: `Contract #{c.contractNumber || "Draft"} - {formatDate(c.createdAt)} ({c.status})`
- Pass the selected contract to `onOpenDigitalContract(displayContract)` and `onDownloadStayProof(displayContract)`.

- [ ] **Step 2: Update `TenantDetailModal.jsx` to pass `allTenantContracts` and handle contract selection**

In `TenantDetailModal.jsx`:
- Add state: `const [selectedContractOverride, setSelectedContractOverride] = useState(null);`
- Pass `allTenantContracts={allTenantContracts}`, `selectedContract={selectedContractOverride}`, `onSelectContract={setSelectedContractOverride}` to `<TenantContractsTab />`.
- In `handleOpenDigitalContract(specificContract = null)`:
  - Resolve `target = specificContract || selectedContractOverride || dedicatedContract || (allTenantContracts.length > 0 ? allTenantContracts[0] : null)`.
  - Only show error if `target` cannot be found and `allTenantContracts` is empty.
  - Proceed with opening the digital contract preview for `target`.

- [ ] **Step 3: Verify Web compilation with `npm run build`**

Run: `cd Capstone-Website/web && npm run build`
Expected: Production build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin/components/tenants/details/TenantContractsTab.jsx web/src/features/admin/components/TenantDetailModal.jsx
git commit -m "feat(web): add resilient contract selector and error fallback in admin tenant details"
```

---

### Task 4: Execute Database Reconciliation & Final Verification

- [ ] **Step 1: Run the reconciliation script with `--apply`**

Run: `node Capstone-Website/server/scripts/reconcile_duplicate_contracts.mjs --apply`
Expected: Commits the safe archival of duplicate records in MongoDB.

- [ ] **Step 2: Run full backend test suite**

Run: `cd Capstone-Website/server && npx jest --testPathPattern="contract"`
Expected: All contract-related test suites pass.

- [ ] **Step 3: Run full web build test**

Run: `cd Capstone-Website/web && npm run build`
Expected: Build passes cleanly.
