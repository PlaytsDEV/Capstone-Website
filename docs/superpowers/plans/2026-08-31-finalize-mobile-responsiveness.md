# Finalize & Merge Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish dark-mode mobile navigation contrast, stage and commit all mobile responsiveness changes, execute full regression and build checks, and prepare `feature/mobile-responsiveness` for merge into `main`.

**Architecture:** Refine active nav text tokens for dark mode in `Navbar.js`, record a clean conventional git commit covering the mobile drawer, touch targets, and safe-area adjustments, run automated test suites across both server and client, and execute a fast-forward/non-conflicting merge into `main`.

**Tech Stack:** React 19, Vite, Tailwind CSS / Vanilla CSS tokens, Express.js / Mongoose, Git.

**Spec:** Code review findings from `feature/mobile-responsiveness` audit and Lilycrest DMS Design Guidelines (`AGENTS.md`).

---

## Global Constraints

- Terminology: Always use "Tenant" (never "Resident"), "Rent" (never "Rental Fee"), and "Assistant" (never "Copilot").
- Design: Strictly no gradients, solid HSL tokens, transparent status badges with colored status dots, and neutral 1px borders (`1px solid var(--border)`).
- Touch Targets: All interactive buttons and inputs must maintain a minimum tap target height of $\ge 44\text{px}$ to $48\text{px}$.
- Verification Gate: Never mark tasks complete without empirical runtime verification (`npm test` in `server/`, `npm test` in `web/`, and `npm run build` in `web/`).

---

## What to Expect from These Changes

- **Visual & UI Outcomes**:
  - In dark mode, active links inside the mobile slide-over menu will appear in a bright, crisp gold accent (`#F0D278`) rather than a muted dark-gold tone, ensuring sharp contrast and readability against dark slate card backgrounds.
  - All landing page hero buttons, contact links, room detail appliances, and reservation step controls will remain comfortable to tap on mobile devices with proper bottom padding above device home bars.
- **Workflow & Functional Outcomes**:
  - The working directory will be clean, with all mobile improvements properly committed to git with a clear conventional commit message.
  - Full automated tests (3,061 backend tests + 896 frontend tests) and production Vite build will pass with zero regressions.
  - The `feature/mobile-responsiveness` branch will be safely merged into `main`.

---

## Proposed Changes & Tasks

### Task 1: Refine Dark-Mode Mobile Navigation Link Contrast in `Navbar.js`

**Files:**
- Modify: `web/src/features/public/components/Navbar.js:480-495`
- Test: `web/src/shared/components/Navbar.test.mjs` or run `npm test` in `web/`

**Interfaces:**
- Consumes: `isDark` boolean state and `activeSection` from `Navbar.js`.
- Produces: Accessible high-contrast active link styling in mobile slide-over drawer.

- [ ] **Step 1: Update active link text color in mobile navigation list**

In `web/src/features/public/components/Navbar.js`, adjust the inline color ternary for active links:

```jsx
// Before:
color: isActive
  ? "var(--lp-accent-text, #8C6200)"
  : (isDark ? "#F8FAFC" : "var(--lp-navy, #0A1628)"),

// After:
color: isActive
  ? (isDark ? "var(--lp-accent, #D4AF37)" : "var(--lp-accent-text, #8C6200)")
  : (isDark ? "#F8FAFC" : "var(--lp-navy, #0A1628)"),
```

- [ ] **Step 2: Run frontend tests to ensure no regressions**

Run in `web/`:
```bash
npm test
```
Expected: All 896 tests passing.

---

### Task 2: Stage and Commit Working Tree Changes

**Files:**
- Stage: All modified files in `web/` (`Navbar.js`, `RoomDetailsModal.jsx`, `ContactFooter.jsx`, `HeroSection.jsx`, `ThemeToggleButton.jsx`, `PublicChatbotLauncher.jsx`, `ScrollToTopButton.jsx`, reservation step components, and CSS files).

- [ ] **Step 1: Check git status**

Run in `Capstone-Website/`:
```bash
git status
```

- [ ] **Step 2: Stage and commit files**

```bash
git add web/
git commit -m "feat(mobile): complete mobile drawer portaling, touch target ergonomics, and safe-area insets"
```

---

### Task 3: Full End-to-End Build & Test Verification

**Files:**
- Verification only

- [ ] **Step 1: Run backend test suite**

Run in `Capstone-Website/server`:
```bash
npm test
```
Expected: 320 test suites passed (3,061 tests passed).

- [ ] **Step 2: Run frontend production build**

Run in `Capstone-Website/web`:
```bash
npm run build
```
Expected: Build completes successfully with 0 errors.

---

### Task 4: Merge Branch into `main`

**Files:**
- Git repository branches

- [ ] **Step 1: Switch to `main` and pull latest remote changes**

```bash
git checkout main
git pull origin main
```

- [ ] **Step 2: Merge `feature/mobile-responsiveness` into `main`**

```bash
git merge feature/mobile-responsiveness --no-ff -m "feat(mobile): merge mobile responsiveness and touch ergonomics enhancements into main"
```

- [ ] **Step 3: Verify build on `main`**

Run in `Capstone-Website/web`:
```bash
npm run build
```

---

## Verification Plan

### Automated Tests
- Server: `npm test` in `d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\server` (320 suites)
- Client: `npm test` in `d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\web` (7 suites)
- Production Build: `npm run build` in `d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website\web`

### Manual Verification
- Verify that the mobile navigation drawer displays active section links in vibrant gold in dark mode and dark gold in light mode.
- Verify that `git log` on `main` reflects a clean merge commit history.
