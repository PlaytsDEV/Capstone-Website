---
description: Safely merge a feature branch into main, verify build & test checks, and push to remote
---

## /merge-main — Merge Feature Branch into Main

This workflow guides you through safely merging your active working branch (or a specified feature branch) into `main`, running strict frontend and backend verification checks, resolving conflicts if needed, and pushing the updated `main` branch to the remote repository.

---

### Step 1 — Review Uncommitted Changes & Validate Feature Branch

Make sure your work on the current branch is committed and passes initial local checks before starting the merge.

```powershell
# Run from d:\Portfolio\3rdYear\CapstoneSystem\Capstone-Website
git status
git branch --show-current
```

> **Mandatory Quality Gate**: Run tests on the feature branch first to ensure zero pre-existing errors.
> - **Frontend**: Run `npm test` and `npm run build` in `web/`
> - **Server**: Run `npm test` in `server/`

---

### Step 2 — Fetch Latest Remote Changes

Fetch all remote branches and tags to ensure your local repository has the newest refs.

```powershell
git fetch origin
```

---

### Step 3 — Switch to `main` and Pull Latest Updates

Switch to the `main` branch and ensure it is synchronized with `origin/main`.

```powershell
git checkout main
git pull origin main
```

---

### Step 4 — Merge Feature Branch into `main`

Merge your feature branch into `main`. Replace `<feature-branch>` with the name of the branch you wish to merge (e.g., `feature/billing-update` or `dev`).

```powershell
git merge <feature-branch>
```

#### Handling Merge Conflicts (if any)
If Git flags merge conflicts:
1. Inspect conflicting files: `git status`
2. Open affected files, resolve conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Stage resolved files: `git add .`
4. Complete the merge commit: `git commit -m "fix: resolve merge conflicts from <feature-branch> into main"`
5. (Optional) To abort the merge if needed: `git merge --abort`

---

### Step 5 — Mandatory Quality Gate: Strict Frontend & Server Build & Test Verification

**CRITICAL RULE**: NEVER push to `main` without empirical verification. You MUST run all verification commands and ensure **ZERO ERRORS** before proceeding to push.

```powershell
# 1. Verify Frontend Tests & Build
cd web
npm test
npm run build
cd ..

# 2. Verify Server Unit Test Suite
cd server
npm test
cd ..
```

> ⚠️ **Zero-Error Enforcement**:
> - If `npm test` or `npm run build` in `web/` fails, inspect the error log, patch the broken code or test assertion immediately, and re-run until clean.
> - If `npm test` in `server/` fails, fix the failing controller/schema/test assertion immediately and re-run.
> - **DO NOT push to `origin/main` until ALL tests and builds pass with 0 errors.**

---

### Step 6 — Push Updated `main` to Remote Repository

Only after all frontend and server tests and builds pass with **0 errors**, push `main` to GitHub.

```powershell
git push origin main
```

---

### Step 7 — (Optional) Clean Up Merged Feature Branch

If the feature branch is fully merged and no longer needed:

```powershell
# Delete local feature branch
git branch -d <feature-branch>

# Delete remote feature branch (if pushed)
git push origin --delete <feature-branch>
```

---

> **Success!** Both frontend and server were verified error-free, merged into `main`, and pushed to the remote repository.
