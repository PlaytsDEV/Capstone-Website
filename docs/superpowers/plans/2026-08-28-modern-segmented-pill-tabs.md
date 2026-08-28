# Modern Segmented Pill Header Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AdminTabs and AdminPageHeader navigation bar from a misaligned underline style into a modern inset segmented pill design system, eliminating floating lines and unifying tab navigation across the entire portal.

**Architecture:** Replace the `.admin-tabs-bar` underline CSS with an inset segmented track container (`bg-muted`, rounded pill borders) and convert `.admin-tab-btn` into elevated, tactile solid pill buttons (`bg-card`, neutral 1px border, bold contrast). Preserve all WAI-ARIA tab semantics, Lucide icons, badges, overflow menu behavior, and React props for 100% backward compatibility.

**Tech Stack:** React 18, Vite, CSS custom properties (solid HSL tokens), WAI-ARIA tablist/tab accessibility standard, Node.js test runner.

**Spec:** Implementation plan aligned via `/grill-me` interactive design interview and `.agents/AGENTS.md` design tokens.

## Global Constraints

- Strictly zero background gradients, text gradients, or glow rings.
- Use solid HSL design tokens (`var(--bg-muted)`, `var(--bg-card)`, `var(--foreground)`, `var(--border)`).
- Neutral 1px borders (`border border-slate-200/80 dark:border-slate-700` or `1px solid var(--border)`).
- 100% backward-compatible component API (`AdminTabs` & `AdminPageHeader` props unchanged).
- Full dark mode support and WCAG 4.5:1 text contrast compliance.
- No layout shift or horizontal scroll overflow on mobile viewports.

---

### What to Expect from These Changes

| Visual & Functional Area | Expected Outcome in Simple Terms |
|:---|:---|
| **Elimination of "Random" Lines** | The isolated 2px black line under the active tab and the disconnected grey bottom track are completely replaced with a unified segmented pill container. |
| **Tactile Segmented Pill Look** | Tabs now sit inside a sleek, subtle inset background track. The active tab turns into a crisp, elevated white card/pill (or dark card in dark mode) with a subtle 1px border and bold text. |
| **Unified Portal Navigation** | All admin and owner pages that use `AdminTabs` / `AdminPageHeader` (Billing, System Settings, User Management, Audit Logs) automatically adopt this modern, consistent look. |
| **Smooth Interactive Feedback** | Inactive tabs smoothly highlight on hover with subtle text darkening; active tabs are immediately prominent and tactile. |
| **Logic & Accessibility Preserved** | All tab switching callbacks, URL search parameters, filter synchronization, icons, badges, and keyboard arrow navigations remain 100% operational. |

---

### Task 1: Update AdminTabs Stylesheet with Modern Segmented Pill Tokens

**Files:**
- Modify: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminTabs.css:1-191`
- Test: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminTabs.test.mjs`

**Interfaces:**
- Consumes: CSS custom properties (`--bg-muted`, `--bg-card`, `--border-light`, `--border`, `--foreground`, `--muted-foreground`, `--text-primary`).
- Produces: CSS classes `.admin-tabs-bar`, `.admin-tabs-scroll-area`, `.admin-tab-btn`, `.admin-tab-btn--active`, `.admin-tab-btn--disabled`, `.admin-tab-icon`, `.admin-tab-badge`, `.admin-tabs-more-*`.

- [ ] **Step 1: Write the updated AdminTabs.css rules**

Replace the contents of `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminTabs.css` with the modern segmented pill design:

```css
/* =============================================================================
   ADMIN TABS - Unified Inset Segmented Pill Navigation Tab Standard (Lilycrest DMS)
   Solid HSL tokens, high-contrast, zero-gradient, tactile Apple/Linear design
   ============================================================================= */

.admin-tabs-bar {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  background: var(--bg-muted, #f1f5f9);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  position: relative;
  overflow: visible;
  max-width: 100%;
}

.admin-tabs-scroll-area {
  display: flex;
  align-items: center;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
  min-width: 0;
}

.admin-tabs-scroll-area::-webkit-scrollbar {
  display: none;
}

.admin-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--muted-foreground, #64748b);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  outline: none;
  transition:
    color var(--duration-fast, 150ms) var(--ease-out, ease-out),
    background-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
    box-shadow var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.admin-tab-btn:hover:not(:disabled):not(.admin-tab-btn--active) {
  color: var(--foreground, #0f172a);
  background: rgba(0, 0, 0, 0.04);
}

:global(.dark) .admin-tab-btn:hover:not(:disabled):not(.admin-tab-btn--active) {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

.admin-tab-btn:focus-visible {
  outline: 2px solid var(--foreground, #0f172a);
  outline-offset: 1px;
}

.admin-tab-btn--active {
  background: var(--bg-card, #ffffff);
  color: var(--foreground, #0f172a);
  font-weight: 700;
  border-color: var(--border, #e2e8f0);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

:global(.dark) .admin-tab-btn--active {
  background: var(--bg-card, #1e293b);
  color: #f8fafc;
  border-color: var(--border, #334155);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

.admin-tab-btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-tab-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.admin-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1.5px 6.5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.admin-tab-badge--warning {
  background: var(--warning-light, #fef3c7);
  color: var(--warning-dark, #b45309);
}

.admin-tab-badge--danger {
  background: #fee2e2;
  color: #b91c1c;
}

.admin-tab-badge--info {
  background: #e0f2fe;
  color: #0369a1;
}

.admin-tab-badge--success {
  background: var(--success-light, #dcfce7);
  color: var(--success-dark, #166534);
}

.admin-tab-badge--default {
  background: var(--muted, #e2e8f0);
  color: var(--muted-foreground, #475569);
}

/* More Dropdown */
.admin-tabs-more-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  overflow: visible;
}

.admin-tab-more-btn {
  gap: 4px;
}

.admin-tab-more-chevron {
  width: 14px;
  height: 14px;
  opacity: 0.7;
  transition: transform var(--duration-fast, 150ms) ease;
}

.admin-tab-more-btn[aria-expanded="true"] .admin-tab-more-chevron {
  transform: rotate(180deg);
}

.admin-tabs-more-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 190px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 5px;
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.dark) .admin-tabs-more-menu {
  background: var(--bg-card, #1e293b);
  border-color: var(--border, #334155);
}

.admin-tabs-more-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm, 13px);
  font-weight: 500;
  color: var(--text-primary, #0f172a);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--duration-fast, 150ms) ease;
}

:global(.dark) .admin-tabs-more-item {
  color: #f8fafc;
}

.admin-tabs-more-item:hover:not(:disabled) {
  background: var(--bg-hover, #f8fafc);
}

:global(.dark) .admin-tabs-more-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
}

.admin-tabs-more-item:focus-visible {
  outline: 2px solid var(--foreground, #0f172a);
  outline-offset: -2px;
}

.admin-tabs-more-item--active {
  background: var(--bg-hover, #f1f5f9);
  font-weight: 700;
  color: var(--foreground, #0f172a);
}

:global(.dark) .admin-tabs-more-item--active {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.admin-tabs-more-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Commit Task 1 changes**

```bash
git add web/src/shared/components/AdminTabs.css
git commit -m "style(admin): modernize AdminTabs with inset segmented pill design system"
```

---

### Task 2: Refine AdminPageHeader Layout and Spacing for Segmented Tabs

**Files:**
- Modify: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminPageHeader.css:1-130`

**Interfaces:**
- Consumes: `.admin-page-header`, `.admin-page-header-tabs-row`, `.admin-page-header-tabs`.
- Produces: Seamless layout integration of the segmented pill track inside the sticky header.

- [ ] **Step 1: Update AdminPageHeader.css**

Refine the tab row styles in `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminPageHeader.css`:

```css
/* ── Tier 2: Tabs Row (Full-width underneath Title) ── */
.admin-page-header-tabs-row {
  width: 100%;
  padding-bottom: 0.625rem;
}

.admin-page-header-tabs {
  min-height: 38px;
  width: auto;
}

/* When header has tabs, optimize top row bottom spacing */
.admin-page-header--with-tabs .admin-page-header-top {
  padding-bottom: 0.625rem;
}
```

- [ ] **Step 2: Commit Task 2 changes**

```bash
git add web/src/shared/components/AdminPageHeader.css
git commit -m "style(admin): optimize AdminPageHeader spacing for segmented tab controls"
```

---

### Task 3: Update Unit Tests and Verify Build

**Files:**
- Modify: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminTabs.test.mjs:1-62`

- [ ] **Step 1: Update AdminTabs.test.mjs assertions**

Update `web/src/shared/components/AdminTabs.test.mjs` to assert the segmented pill classes and tokens:

```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");

test("AdminTabs component and CSS exist with unified segmented pill standard", () => {
  const tabsJsx = fs.readFileSync(
    path.join(webRoot, "src/shared/components/AdminTabs.jsx"),
    "utf8",
  );
  const tabsCss = fs.readFileSync(
    path.join(webRoot, "src/shared/components/AdminTabs.css"),
    "utf8",
  );

  assert.match(tabsJsx, /role="tablist"/);
  assert.match(tabsJsx, /role="tab"/);
  assert.match(tabsJsx, /aria-selected=/);
  assert.match(tabsJsx, /admin-tab-btn--active/);
  assert.match(tabsJsx, /admin-tab-badge/);

  assert.match(tabsCss, /\.admin-tabs-bar/);
  assert.match(tabsCss, /\.admin-tab-btn/);
  assert.match(tabsCss, /\.admin-tab-btn--active/);
  assert.match(tabsCss, /border-radius:\s*12px/);
  assert.match(tabsCss, /border-radius:\s*8px/);
});

test("System category pages integrate AdminTabs component", () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(webRoot, relativePath), "utf8");

  // SystemSettingsPage
  const systemSettings = read(
    "src/features/owner/pages/SystemSettingsPage.jsx",
  );
  assert.match(systemSettings, /AdminTabs|AdminPageHeader/);
  assert.match(systemSettings, /<Admin(Tabs|PageHeader)/);

  // UserManagementPage
  const userManagement = read(
    "src/features/admin/pages/UserManagementPage.jsx",
  );
  assert.match(userManagement, /AdminTabs|AdminPageHeader/);
  assert.match(userManagement, /<Admin(Tabs|PageHeader)/);

  // PageShell (used by AuditLogsPage)
  const pageShell = read(
    "src/features/admin/components/shared/PageShell.jsx",
  );
  assert.match(pageShell, /AdminTabs|AdminPageHeader/);
  assert.match(pageShell, /<Admin(Tabs|PageHeader)/);

  // AuditLogsPage search params synchronization
  const auditLogs = read("src/features/admin/pages/AuditLogsPage.jsx");
  assert.match(auditLogs, /useSearchParams/);
  assert.match(auditLogs, /SECURITY_SIGNALS_TAB/);
});
```

- [ ] **Step 2: Run unit test to verify it passes**

Run: `node --test src/shared/components/AdminTabs.test.mjs` (cwd: `web`)
Expected: PASS

- [ ] **Step 3: Run web build check**

Run: `npm run build` (cwd: `web`)
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit Task 3 changes**

```bash
git add web/src/shared/components/AdminTabs.test.mjs
git commit -m "test(admin): update AdminTabs unit test assertions for segmented pill design"
```
