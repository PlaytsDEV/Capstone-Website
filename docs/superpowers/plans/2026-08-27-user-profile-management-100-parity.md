# User Profile & Admin User Management 100% Full-Stack Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% end-to-end data parity, UI consistency, and robust validation across Tenant Profile editing and Admin User Management modal (`EditUserModal`), ensuring all personal and emergency contact fields (`middleName`, `civilStatus`, `nationality`, `occupation`, `emergencyRelationship`, `phone`, `emergencyPhone`) are seamlessly supported across database models, Zod validation schemas, API controllers, React components, and automated test suites.

**Architecture:**
1. **Backend Validation & Controller Layer**: Update `updateUserSchema` and `usersController.js` `ALLOWED_ADMIN_UPDATE_FIELDS` whitelist to accept and sanitize `middleName`, `civilStatus`, `nationality`, `occupation`, and `emergencyRelationship`.
2. **Frontend Admin Component Layer**: Enrich `UserPersonalSection.jsx` with `middleName`, `dateOfBirth`, `civilStatus`, `nationality`, and `occupation` inputs, and `UserExtendedSection.jsx` with `emergencyRelationship` dropdown (`RELATIONSHIP_OPTIONS`) and cross-field phone collision protection.
3. **Automated Verification**: Build targeted Jest integration tests in backend and Node unit tests in frontend to guarantee zero regression and 100% test coverage.

**Tech Stack:** React 19, Express.js, MongoDB/Mongoose, Zod, Jest, Node test runner.

**Spec:** `LILIORA-FUNCTIONAL-SPECIFICATIONS-DETAILED.md` and `AGENTS.md`.

---

## Global Constraints
- Strictly adhere to terminology invariants: **Tenant** (never Resident), **Assistant** (never Copilot), **Owner** (never Super Admin).
- Strictly follow the no-gradient rule: use solid HSL color tokens, neutral 1px borders (`border-slate-200 dark:border-slate-700` or `1px solid var(--border)`).
- Preserve existing behavior and non-destructive updates.
- All forms must enforce clean dirty tracking, unsaved changes confirmation modals, and responsive feedback.

---

## What to Expect from These Changes
- **Admin Full Control**: Admins and Owners editing user profiles in **User Management** will see complete personal and emergency contact fields identical to what tenants see on their profile page (including Middle Name, Date of Birth, Civil Status, Nationality, Occupation, and Emergency Relationship).
- **Zero Inconsistency**: Data entered by a tenant during onboarding or profile editing will be fully visible and editable by admins, preventing missing or lost field updates.
- **Smart Safety Guards**: Admin inputs will enforce the same smart safeguards as tenant profile editing (e.g. emergency contact numbers cannot be identical to the user's mobile number, and emergency contact details must be fully filled as a set).
- **100% Test & Build Health**: Full backend suite (279 suites / 2677+ tests) and frontend test suite (660+ tests) will remain 100% green with zero build warnings.

---

## User Review Required

> [!IMPORTANT]
> **Admin Field Parity vs Role Scoping**:
> For non-student administrative roles (e.g., `branch_admin`, `owner`), student academic details (Student ID, School, Year Level) are hidden, while standard personal and emergency contact fields remain available.

---

## Open Questions for Clarification

1. **Date of Birth Input in Admin Edit**: Should Date of Birth in the Admin Edit Modal use a standard date picker input (`type="date"` / Year-Month-Day selector) matching the Tenant profile structure?
2. **Emergency Contact Optionality**: For administrative accounts (`branch_admin`, `owner`), emergency contacts remain optional, but if partially entered, should the 3-field complete set (Name, Relationship, Phone) be enforced?

---

## Proposed Changes & Tasks

### Task 1: Backend Zod Schema & Controller Whitelist Expansion

**Files:**
- Modify: `server/validation/zodSchemas.js`
- Modify: `server/controllers/usersController.js`
- Test: `server/controllers/usersController.test.js`

**Interfaces:**
- Consumes: User update payload from `PUT /api/users/:userId`.
- Produces: Sanitized and validated MongoDB update document supporting all 13 profile & emergency fields.

- [ ] **Step 1: Write failing integration test for expanded updateUser fields**
```javascript
test("updateUser accepts and persists middleName, civilStatus, nationality, occupation, and emergencyRelationship", async () => {
  const req = mockRequest({
    params: { userId: "507f1f77bcf86cd799439011" },
    body: {
      firstName: "Juan",
      middleName: "Protacio",
      lastName: "Rizal",
      civilStatus: "single",
      nationality: "Filipino",
      occupation: "Physician",
      emergencyContact: "Francisco Mercado",
      emergencyRelationship: "parent",
      emergencyPhone: "09181234567",
    },
  });
  const res = mockResponse();
  await updateUser(req, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    user: expect.objectContaining({
      middleName: "Protacio",
      civilStatus: "single",
      emergencyRelationship: "parent",
    }),
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- usersController.test.js`

- [ ] **Step 3: Update `updateUserSchema` and `ALLOWED_ADMIN_UPDATE_FIELDS`**
In `server/validation/zodSchemas.js`:
Add `middleName`, `civilStatus`, `nationality`, `occupation`, `emergencyRelationship` to `updateUserSchema`.
In `server/controllers/usersController.js`:
Add these fields to `ALLOWED_ADMIN_UPDATE_FIELDS`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- usersController.test.js`

- [ ] **Step 5: Commit**
```bash
git add server/validation/zodSchemas.js server/controllers/usersController.js server/controllers/usersController.test.js
git commit -m "feat(users): add middleName, civilStatus, nationality, occupation, and emergencyRelationship to updateUser"
```

---

### Task 2: Admin Edit User Modal - Personal & Extended Section Parity

**Files:**
- Modify: `web/src/features/admin/components/users/edit/UserPersonalSection.jsx`
- Modify: `web/src/features/admin/components/users/edit/UserExtendedSection.jsx`
- Modify: `web/src/features/admin/components/users/EditUserModal.jsx`
- Test: `web/src/features/admin/components/users/EditUserModal.test.mjs`

**Interfaces:**
- Consumes: `editForm`, `editFormErrors`, `onFormChange`, `onBlur`.
- Produces: Complete user personal and emergency contact fields with validation and phone collision protection.

- [ ] **Step 1: Write failing frontend unit tests for EditUserModal fields**
```javascript
test("EditUserModal renders middleName, civilStatus, nationality, occupation, and emergencyRelationship", () => {
  // Test asserting that all fields and relationship options render correctly in EditUserModal
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test` in `web/`

- [ ] **Step 3: Implement inputs in UserPersonalSection and UserExtendedSection**
Add `middleName`, `dateOfBirth`, `civilStatus`, `nationality`, `occupation` to `UserPersonalSection.jsx`.
Add `emergencyRelationship` dropdown and phone deduplication check in `UserExtendedSection.jsx`.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm test` in `web/`

- [ ] **Step 5: Commit**
```bash
git add web/src/features/admin/components/users/
git commit -m "feat(admin): complete full-field parity for User Management edit modal"
```

---

### Task 3: Full End-to-End Test Suite & Build Verification

**Files:**
- Test: `server/` (all test suites)
- Test: `web/` (all test suites)
- Build: `web/` (Vite build)

- [ ] **Step 1: Run full server test suite**
Run: `npm test` in `server/`
Expected: 279+ test suites passing.

- [ ] **Step 2: Run full web test suite**
Run: `npm test` in `web/`
Expected: All tests passing.

- [ ] **Step 3: Run production build check**
Run: `npm run build` in `web/`
Expected: Clean build with 0 errors.

---

## Verification Plan

### Automated Tests
- Server: `npm test`
- Web: `npm test`
- Web Build: `npm run build`

### Manual Verification Steps
1. Navigate to **Admin > User Management** (`/admin/users`).
2. Click **Edit** on a tenant or admin account.
3. Verify that Middle Name, Date of Birth, Civil Status, Nationality, Occupation, and Emergency Relationship dropdown are available and populated.
4. Attempt to save an emergency contact phone identical to the user's mobile number and verify collision validation warning.
5. Save valid changes and verify instant update in the table and backend database.
