# Revert Subtabs to Underline Navigation Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert all page header subtabs and nested sub-navigation tabs across Lilycrest DMS from the rounded inset pill box design back to the clean, high-contrast bottom-line (underline) indicator style.

**Architecture:** Update centralized `AdminTabs.css` and `AdminPageHeader.css` to enforce a transparent container background, a 1px solid bottom baseline border, and a 2px solid bottom-line indicator on the active tab (`#0f172a` / slate-900 in light mode, `#f8fafc` / white in dark mode) with `font-bold`, while preserving semantic icon accent colors.

**Tech Stack:** React 18, Vite, Tailwind CSS, Pure CSS variables (solid HSL design tokens).

## Global Constraints

- Strictly no background gradients, text gradients, or glowing colored outlines.
- Use solid HSL CSS tokens (`var(--text-primary)`, `var(--border)`, `var(--foreground)`, `var(--border-light)`).
- Preserve semantic icon colors (Sky for User Accounts, Amber for Roles & Access, Emerald for Payments, Rose for Violations).
- Active tab must use a 2px solid bottom line resting flush against the baseline divider (`margin-bottom: -1px`).
- WAI-ARIA tab semantics (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) and keyboard navigation must remain fully intact.

## What to Expect from These Changes

- **Visual Appearance**: The rounded gray pill containers surrounding header tabs (like "User Accounts" and "Roles & Access Matrix") will be completely removed. Tabs will now sit cleanly side-by-side on top of a subtle horizontal baseline.
- **Selection Feedback**: When you click or switch to a tab, an active 2px dark underline will appear directly beneath that tab's text and icon, while inactive tabs remain muted with a subtle hover underline preview.
- **Consistency**: All header subtabs across Accounts & Access, Billing, Maintenance, Analytics, and System Settings will look unified and aligned with the enterprise design system standard.
- **Dark Mode Support**: Seamless transition in dark mode, where the active underline becomes crisp white/slate-100 against dark backgrounds without colorful glow or card borders.

---

### Task 1: Revert Global `AdminTabs.css` to Underline Indicator Standard

**Files:**
- Modify: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminTabs.css`

**Interfaces:**
- Consumes: CSS custom properties (`--text-primary`, `--text-muted`, `--border-light`, `--border`, `--foreground`, `--bg-card`, `--shadow-lg`).
- Produces: Underline navigation tab styles for `.admin-tabs-bar`, `.admin-tab-btn`, `.admin-tab-btn--active`, `.admin-tab-badge`, and `.admin-tabs-more-menu`.

- [ ] **Step 1: Replace inset pill container styles with transparent baseline layout**
Set `.admin-tabs-bar` to `background: transparent; border: none; border-bottom: 1px solid var(--border-light, #e2e8f0); border-radius: 0; padding: 0; width: 100%;`.

- [ ] **Step 2: Update tab button styles for flush bottom border alignment**
Set `.admin-tab-btn` with `background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; border-radius: 0; padding: 9px 16px; font-weight: 600; color: var(--text-muted, #64748b);`.

- [ ] **Step 3: Define high-contrast active state and subtle hover state**
Set `.admin-tab-btn--active` with `color: var(--text-primary, #0f172a); border-bottom-color: var(--text-primary, #0f172a); font-weight: 700; background: transparent; box-shadow: none;` and dark mode override `color: var(--foreground, #f8fafc); border-bottom-color: var(--foreground, #f8fafc);`.

- [ ] **Step 4: Keep badge counters and More overflow menu styled cleanly**
Preserve badge counter pill tokens and align dropdown items.

---

### Task 2: Refine `AdminPageHeader.css` Layout & Spacing

**Files:**
- Modify: `d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/shared/components/AdminPageHeader.css`

**Interfaces:**
- Consumes: `.admin-page-header`, `.admin-page-header-tabs-row`, `.admin-page-header-tabs`.
- Produces: Seamless integration between sticky sub-header and underline tabs without double borders or awkward padding gaps.

- [ ] **Step 1: Adjust `.admin-page-header-tabs-row` padding and baseline alignment**
Update `.admin-page-header-tabs-row` so the tabs baseline sits directly at the bottom edge of `.admin-page-header`.

- [ ] **Step 2: Ensure `.admin-page-header-tabs` removes any redundant double borders**
Set `.admin-page-header-tabs` to merge cleanly with `.admin-page-header` border.

---

### Task 3: Build Verification & Regression Check

**Files:**
- Test: Web production build and style inspection

- [ ] **Step 1: Run Vite production build check**
Run `npm run build` in `d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\web`.
Expected: `✓ built in ...ms` with 0 errors.

- [ ] **Step 2: Verify tab transitions and accessibility attributes**
Confirm tab switching works seamlessly across Accounts & Access, Billing, Maintenance, and Settings.
