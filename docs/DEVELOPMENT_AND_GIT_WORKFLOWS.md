# Lilycrest DMS — Development & Git Workflows

This document establishes version control rules, branch naming conventions, commit formatting, and Git workflow procedures.

---

## 1. Branch Strategy & Naming Conventions

- **`main`**: Protected production branch. Requires code review and verified passing builds before merging.
- **Feature Branches**: Named according to developer or feature context:
  - `feature/<feature-name>`
  - `fix/<bug-description>`
  - `BranchVince`, `BranchDeveloper`

---

## 2. Conventional Commit Standards

All commits MUST follow Conventional Commits formatting:

```
<type>(<scope>): <short summary>

[optional body]
```

### Allowed Types
- `feat`: A new user-facing feature or API endpoint.
- `fix`: A bug fix or patch.
- `docs`: Documentation updates.
- `style`: Formatting, CSS design token tweaks, no code logic changes.
- `refactor`: Restructuring code without changing behavior.
- `test`: Adding or updating test cases.
- `chore`: Maintenance tasks, dependency updates, cleanup.

### Examples
- `feat(billing): implement 15th-cycle utility pro-rata calculation`
- `fix(auth): sanitize express parameters against NoSQL injection`
- `docs(cleanup): consolidate docs directory into 10 master guides`

---

## 3. Git Helper Scripts

The repository includes convenient PowerShell scripts in `Capstone-Website/scripts/`:
- `scripts/gm.ps1` — Safe git merge script into `main`.
- `scripts/gp.ps1` — Safe git push script with pre-push build verification.
