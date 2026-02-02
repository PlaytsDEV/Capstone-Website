# Logout Refactor Summary

## Problem Statement

The logout implementation had **violated separation of concerns**, causing:

1. ESLint errors (`showNotification` imported but never used in Navbar.js)
2. Auth hook (`useAuth.js`) handling UI concerns (notifications, navigation)
3. Potential duplicate logout execution due to mixed responsibilities
4. Unclear ownership of logout behavior

## Solution: Enforce Separation of Concerns

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    UI COMPONENTS                             │
│  (Navbar, Sidebar, TenantLayout)                            │
│                                                              │
│  Responsibilities:                                           │
│  ✓ Show confirmation dialogs                                │
│  ✓ Display notifications                                    │
│  ✓ Navigate after logout                                    │
│  ✓ Manage local loading states                              │
└──────────────────┬──────────────────────────────────────────┘
                   │ calls logout()
                   │ receives {success, branch}
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUTH HOOK                                 │
│  (useAuth.js)                                               │
│                                                              │
│  Responsibilities:                                           │
│  ✓ Execute Firebase signOut()                               │
│  ✓ Clear auth state                                         │
│  ✓ Return logout result                                     │
│  ✗ NO notifications                                         │
│  ✗ NO navigation                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Changes Made

### 1. `useAuth.js` - Pure Auth Logic

**BEFORE:**

```javascript
// ❌ Auth hook handling UI concerns
import { useNavigate } from "react-router-dom";
import { showNotification } from "../utils/notification";

const logout = async (branchOverride) => {
  // ...
  showNotification("You have been logged out successfully", "success");
  navigate(branchHome, { replace: true });
};
```

**AFTER:**

```javascript
// ✅ Auth hook returns data, no UI side effects
const logout = async (branchOverride) => {
  // Guard against duplicate execution
  if (logoutExecutedRef.current) {
    return { success: false, branch: null };
  }
  logoutExecutedRef.current = true;
  setGlobalLoading(true);

  // Capture branch BEFORE clearing user state
  let branch = branchOverride || user?.branch;
  const branchHome = branch ? `/${branch}` : "/";

  try {
    // Execute Firebase signOut
    await authApi.logout();

    // Clear auth state
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    // Return result for caller to handle UI
    return { success: true, branch: branchHome };
  } catch (error) {
    console.error("Logout error:", error);
    logoutExecutedRef.current = false;
    throw error; // Let caller handle error notification
  } finally {
    setGlobalLoading(false);
  }
};
```

**Key Changes:**

- ❌ Removed `useNavigate` import
- ❌ Removed `showNotification` import
- ✅ Returns `{success, branch}` object
- ✅ Throws errors for caller to handle
- ✅ Pure auth logic only

---

### 2. `Navbar.js` - UI Component Responsibility

**BEFORE:**

```javascript
// ❌ showNotification imported but never used (ESLint error)
import { showNotification, showConfirmation } from "...";

const handleLogout = useCallback(async () => {
  // ...
  await authLogout(user?.branch); // useAuth was handling everything
}, [authLogout, isLoading, globalLoading, user]);
```

**AFTER:**

```javascript
// ✅ UI component handles notifications and navigation
import { showNotification, showConfirmation } from "...";

const handleLogout = useCallback(async () => {
  setShowProfileMenu(false);

  if (isLoading || globalLoading || logoutCalledRef.current) return;

  // Show confirmation
  const confirmed = await showConfirmation(...);
  if (!confirmed) return;

  logoutCalledRef.current = true;
  setIsLoading(true);

  try {
    // Call auth hook (returns result)
    const result = await authLogout(user?.branch);

    if (result?.success) {
      // UI handles notification
      showNotification("You have been logged out successfully", "success");

      // UI handles navigation
      navigate(result.branch || "/", { replace: true });
    }
  } catch (error) {
    // UI handles error notification
    showNotification("Logout failed. Please try again.", "error");
    logoutCalledRef.current = false;
  } finally {
    setIsLoading(false);
  }
}, [authLogout, isLoading, globalLoading, user, navigate]);
```

**Key Changes:**

- ✅ `showNotification` now actually used (no ESLint error)
- ✅ Component handles success notification
- ✅ Component handles error notification
- ✅ Component handles navigation
- ✅ `navigate` added to dependency array

---

### 3. `Sidebar.jsx` (Admin) - Same Pattern

**BEFORE:**

```javascript
// ❌ Assumed useAuth handled everything
const handleLogout = async () => {
  await logout();
  // Redirect is handled by useAuth auth state listener
};
```

**AFTER:**

```javascript
// ✅ Component handles notifications and navigation
import { showNotification } from "../../../shared/utils/notification";
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

const handleLogout = async () => {
  try {
    const result = await logout();

    if (result?.success) {
      showNotification("You have been logged out successfully", "success");
      navigate("/tenant/signin", { replace: true });
    }
  } catch (error) {
    showNotification("Logout failed. Please try again.", "error");
    logoutCalledRef.current = false;
  }
};
```

---

### 4. `TenantLayout.jsx` - Same Pattern

**BEFORE:**

```javascript
// ❌ Incomplete imports
import { showConfirmation } from "../utils/notification";

const handleLogout = async () => {
  await logout();
  // Redirect is handled by useAuth auth state listener
};
```

**AFTER:**

```javascript
// ✅ Complete imports and proper UI handling
import { showConfirmation, showNotification } from "../utils/notification";
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

const handleLogout = async () => {
  const confirmed = await showConfirmation(...);
  if (!confirmed) return;

  try {
    const result = await logout(user?.branch);

    if (result?.success) {
      showNotification("You have been logged out successfully", "success");
      navigate(result.branch || "/", { replace: true });
    }
  } catch (error) {
    showNotification("Logout failed. Please try again.", "error");
    logoutCalledRef.current = false;
  }
};
```

---

## Logout Flow (After Refactor)

### USER Logout from Navbar:

```
1. User clicks "Logout" button
   ↓
2. handleLogout() in Navbar.js
   ↓
3. showConfirmation() → "Are you sure?"
   ↓
4. If confirmed:
   ↓
5. authLogout(user.branch) → calls useAuth.logout()
   ↓
6. useAuth.logout():
   - Executes Firebase signOut()
   - Clears auth state
   - Returns {success: true, branch: "/gpuyat"}
   ↓
7. Navbar.js receives result:
   - showNotification("You have been logged out successfully", "success")
   - navigate("/gpuyat", { replace: true })
   ↓
8. User is at branch home, logged out
```

### ADMIN Logout from Sidebar:

```
1. Admin clicks "Logout" button
   ↓
2. confirmLogout() → shows modal
   ↓
3. Admin clicks "Confirm"
   ↓
4. proceedLogout() → closes modal, calls handleLogout()
   ↓
5. handleLogout() → authLogout()
   ↓
6. useAuth.logout():
   - Executes Firebase signOut()
   - Clears auth state
   - Returns {success: true, branch: "/"}
   ↓
7. Sidebar.jsx receives result:
   - showNotification("You have been logged out successfully", "success")
   - navigate("/tenant/signin", { replace: true })
   ↓
8. Admin is at sign-in page, logged out
```

---

## Benefits

### ✅ Eliminated ESLint Errors

- `showNotification` is now used in components where it's imported
- All variables are defined in proper scope

### ✅ Clear Separation of Concerns

- **useAuth.js**: Auth logic only (signOut, state management)
- **UI Components**: User feedback (notifications, navigation)
- **GlobalLoading**: Visual-only component

### ✅ Prevented Duplicate Execution

- Logout triggered only by explicit user action
- Ref guards prevent duplicate calls
- Single source of truth for logout flow

### ✅ Stable Logout Behavior

- Loading state reflects actual async process
- Notification fires exactly once per logout
- Redirect occurs only after logout completes
- Error handling allows retry

### ✅ Testable & Maintainable

- Auth hook can be tested independently (pure logic)
- UI components can be tested for proper feedback
- Clear contract: `logout()` returns `{success, branch}` or throws error

---

## Testing Scenarios

### ✅ User Logout Success

- ✅ Confirmation dialog appears
- ✅ Loading state shown on button
- ✅ Firebase signOut executes once
- ✅ Success notification appears once
- ✅ Redirects to branch home (e.g., `/gpuyat`)
- ✅ Protected routes inaccessible

### ✅ User Logout Cancel

- ✅ Confirmation dialog appears
- ✅ User clicks "Cancel"
- ✅ No logout execution
- ✅ User remains logged in

### ✅ User Logout Error

- ✅ Confirmation dialog appears
- ✅ Firebase signOut fails
- ✅ Error notification appears
- ✅ Logout ref reset (allows retry)
- ✅ User remains on current page

### ✅ Admin Logout Success

- ✅ Modal appears
- ✅ Admin confirms
- ✅ Firebase signOut executes once
- ✅ Success notification appears once
- ✅ Redirects to `/tenant/signin`
- ✅ Admin routes inaccessible

---

## Conclusion

The refactor enforces **proper separation of concerns** between authentication logic and UI feedback:

- **Auth hooks** = Pure state management
- **UI components** = User feedback and navigation
- **GlobalLoading** = Visual-only overlay

This eliminates ESLint errors, prevents duplicate logout behavior, and creates a clear, testable architecture.

**No more mixed responsibilities. No more duplicate notifications. No more unstable logout flow.**
